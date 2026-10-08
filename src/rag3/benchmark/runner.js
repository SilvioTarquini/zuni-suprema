'use strict';
// rag3/benchmark/runner.js — executor do benchmark A/B/C/D. Por padrão é DRY-RUN: monta e valida as requisições das 4 variantes e grava
// artefatos sanitizados SEM nenhuma chamada de rede. O modo pago só roda com (1) trava RAG3_ALLOW_PAID_CALLS, (2) confirmaCusto===true
// e (3) transportes HTTP injetados. Nenhum desses é criado aqui.
//   A generic        — IA generalista, sem RAG ZUNI
//   B zuni-openai    — retrieval 3.0 + política única + OpenAI
//   C zuni-claude    — retrieval 3.0 + política única + Claude
//   D zuni-current   — pipeline atual de produção (reproduzido, não alterado)
const { buildVariantRequests } = require('../pipeline');
const { resolverConfig } = require('../config');
const { chamadasPagasAutorizadas, PaidCallBlockedError } = require('../paidGuard');
const { estimarTokens } = require('../util');

const VARIANTES = Object.freeze(['generic', 'zuni-openai', 'zuni-claude', 'zuni-current']);
const CAMPOS_ARTEFATO = ['case_id', 'variant', 'provider', 'model', 'retrieval_status', 'block_ids', 'sources', 'similarities', 'truncated_blocks', 'book_recommendations', 'estimated_tokens', 'latency_ms', 'policy_hash', 'knowledge_pack_hash', 'payload_chars', 'prompt_fingerprint', 'knowledge_mode', 'proprietary_contribution', 'mode_reasons', 'response', 'dry_run'];

function serializarArtefato(a) {
  const out = {}; for (const k of CAMPOS_ARTEFATO) if (k in a) out[k] = a[k];
  return JSON.stringify(out);
}
function desserializarArtefato(s) { const o = JSON.parse(s); for (const k of Object.keys(o)) if (!CAMPOS_ARTEFATO.includes(k)) throw new Error('RAG3_ARTEFATO_CAMPO_INVALIDO'); return o; }

function artefatoBase(caso, variante, provider, modelo, dryRun) { return { case_id: caso.id, variant: variante, provider, model: modelo, response: null, latency_ms: null, dry_run: dryRun }; }

async function runBenchmark({ casos, variantes = VARIANTES, deps, modo = 'dry-run', transportes = null, confirmaCusto = false, baselineProvider = 'anthropic', env = process.env, config = resolverConfig() }) {
  const pago = modo === 'paid';
  if (pago) {
    if (!chamadasPagasAutorizadas(env)) throw new PaidCallBlockedError('benchmark-pago');
    if (confirmaCusto !== true) throw new Error('RAG3_CONFIRMACAO_DE_CUSTO_AUSENTE');
    if (!transportes || (variantes.includes('zuni-openai') && !transportes.openai) || (variantes.some((v) => v !== 'zuni-openai') && !transportes.anthropic)) throw new Error('RAG3_TRANSPORTES_AUSENTES');
  }
  const artefatos = []; const equivalencias = []; const falhas = [];
  for (const caso of casos) {
    const v = await buildVariantRequests(caso, { ...deps, config });
    equivalencias.push({ case_id: caso.id, ...v.equivalenciaZuni });
    const pack = v.preparo.knowledgePack; const rec = v.preparo.recommendation;
    const comuns = { policy_hash: pack.hash ? v.requests.zuni.hashes.politica : null, knowledge_pack_hash: pack.hash };
    const monta = (variante, provider, modelo, req, extra) => ({ ...artefatoBase(caso, variante, provider, modelo, !pago), ...extra, payload_chars: req.systemText.length + req.messages.reduce((s, m) => s + m.content.length, 0), estimated_tokens: { input: estimarTokens(req.systemText.length + req.messages.reduce((s, m) => s + m.content.length, 0)), output_max: variante === 'zuni-openai' ? config.provedores.openai.maxTokensSaida : (variante === 'zuni-current' ? 1024 : config.provedores.anthropic.maxTokensSaida) } });
    const chamar = async (art, provider, req) => {
      if (!pago) return art;
      try { const r = await provider.generate(req, { transporte: provider.nome === 'openai' ? transportes.openai : transportes.anthropic, env }); return { ...art, response: r.text, latency_ms: r.latencyMs, estimated_tokens: { ...art.estimated_tokens, input_real: r.usage.inputTokens, output_real: r.usage.outputTokens } }; }
      catch (e) { falhas.push({ case_id: caso.id, variant: art.variant, codigo: e.codigo || 'erro' }); return { ...art, response: null }; }
    };
    for (const variante of variantes) {
      if (variante === 'generic') {
        const prov = baselineProvider === 'openai' ? v.providers.openai : v.providers.anthropic;
        const art = monta('generic', prov.nome, prov.cfg.modelo, v.requests.generic, { retrieval_status: 'none', block_ids: [], sources: [], similarities: [], truncated_blocks: 0, book_recommendations: [], policy_hash: v.requests.generic.hashes.politica, knowledge_pack_hash: null });
        artefatos.push(await chamar(art, prov, v.requests.generic));
      } else if (variante === 'zuni-openai' || variante === 'zuni-claude') {
        const prov = variante === 'zuni-openai' ? v.providers.openai : v.providers.anthropic;
        const art = monta(variante, prov.nome, prov.cfg.modelo, v.requests.zuni, { ...comuns, knowledge_mode: v.preparo.modo.modo, proprietary_contribution: v.preparo.modo.contribuicaoProprietaria, mode_reasons: v.preparo.modo.motivos, retrieval_status: pack.status, block_ids: pack.blockIds, sources: pack.sources, similarities: pack.similarities, truncated_blocks: pack.truncatedBlocks, book_recommendations: rec.books.map((b) => ({ bookId: b.bookId, title: b.title, priceBRL: b.priceBRL, url: b.url, reason: b.reason, score: b.score })) });
        artefatos.push(await chamar(art, prov, v.requests.zuni));
      } else if (variante === 'zuni-current') {
        if (!v.atual) { falhas.push({ case_id: caso.id, variant: 'zuni-current', codigo: 'store_sem_searchCurrent' }); continue; }
        const art = monta('zuni-current', 'anthropic', 'claude-sonnet-4-6', v.requests.current, { retrieval_status: 'unvalidated', block_ids: v.atual.blocos.map((b) => b.id), sources: [...new Set(v.atual.blocos.map((b) => b.source))], similarities: v.atual.blocos.map((b) => Number(b.similarity.toFixed(4))), truncated_blocks: 0, book_recommendations: null, policy_hash: v.requests.current.hashes.politica, knowledge_pack_hash: v.requests.current.hashes.knowledgePack, prompt_fingerprint: v.requests.current.meta.fingerprint.hash });
        artefatos.push(await chamar(art, v.providers.anthropic, v.requests.current));
      }
    }
  }
  return { modo, artefatos, equivalencias, falhas, todasEquivalentes: equivalencias.every((e) => e.equivalentes) };
}

module.exports = { runBenchmark, serializarArtefato, desserializarArtefato, VARIANTES, CAMPOS_ARTEFATO };
