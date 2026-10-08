// FASE C2-A — benchmark real CONTROLADO (6 casos × 4 variantes). Execução ÚNICA, autorizada pelo operador.
//   A generic (Claude, sem RAG) · B ZUNI RAG 3.0 + OpenAI gpt-5.6-sol · C ZUNI RAG 3.0 + Claude sonnet-4-6 · D ZUNI CURRENT (produção, reproduzido)
// Banco: SOMENTE RPCs de busca (leitura). Nada é escrito no banco. A trava de chamadas pagas só é aberta DENTRO deste processo e fechada no fim.
// Uso: node scripts/rag3-c2a-benchmark.js            (fase 1 recuperação → portão → fase 2 geração)
//      node scripts/rag3-c2a-benchmark.js --so-recuperacao   (para depois da recuperação real; sem geração)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const raiz = path.join(__dirname, '..');
require(path.join(raiz, 'node_modules/dotenv')).config({ path: path.join(raiz, '.env') });
const { createClient } = require(path.join(raiz, 'node_modules/@supabase/supabase-js'));
const R = require(path.join(raiz, 'src/rag3'));
const { CASOS } = require(path.join(raiz, 'src/rag3/benchmark/dataset'));
const rubrica = require(path.join(raiz, 'src/rag3/benchmark/rubric'));
const calib = require(path.join(raiz, 'src/rag3/benchmark/calibration'));
const { CATALOGO } = require(path.join(raiz, 'src/lib/catalogoLivros'));
const { normalizar, sha256, estimarTokens } = require(path.join(raiz, 'src/rag3/util'));
const { VALOR_AUTORIZACAO } = require(path.join(raiz, 'src/rag3/paidGuard'));

const SO_RECUPERACAO = process.argv.includes('--so-recuperacao');
const SAIDA = 'C:\\Users\\Silvio\\Documents\\ZUNI-C2A';
const INTERNO = path.join(SAIDA, '_interno-nao-abrir-antes-da-avaliacao');
const IDS_CASOS = ['c01', 'c02', 'c07', 'c08', 'c10', 'c12'];
const CATEGORIA = { c01: 'in', c02: 'in', c07: 'in', c08: 'partial', c10: 'in', c12: 'out' };
const TETO_USD = 2.0;
const PRECOS = { openai: { entrada: 4, saida: 20 }, anthropic: { entrada: 3, saida: 15 }, embedding: 0.02 }; // US$/1M tokens
const MODELO_OPENAI = 'gpt-5.6-sol'; const MODELO_CLAUDE = 'claude-sonnet-4-6';
const MAX_SAIDA = { openai: 4000, anthropic: 1400, current: 1024 }; // OpenAI conta o raciocínio dentro do teto de saída

const usd = (tin, tout, p) => (tin / 1e6) * p.entrada + (tout / 1e6) * p.saida;
const log = (...a) => console.log(...a);
fs.mkdirSync(INTERNO, { recursive: true });

// ── store de gravação: registra as similaridades brutas (antes de qualquer limiar) para a calibração ──
class RecordingStore {
  constructor(inner) { this.inner = inner; this.buscas = []; }
  async search(p) { const r = await this.inner.search(p); this.buscas.push({ n: r.length, top1: r[0] ? r[0].similarity : null, top5: r.slice(0, 5).map((b) => Number(b.similarity.toFixed(4))), media10: r.length ? Number((r.slice(0, 10).reduce((s, b) => s + b.similarity, 0) / Math.min(10, r.length)).toFixed(4)) : null }); return r; }
  async searchCurrent(p) { return this.inner.searchCurrent(p); }
  mark() { return this.buscas.length; }
}

async function http(url, headers, body, timeoutMs = 180000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ac.signal });
    const json = await resp.json().catch(() => null);
    if (!resp.ok) { const e = new Error('http'); e.status = resp.status; e.codigoApi = json && json.error && (json.error.type || json.error.code) ? String(json.error.type || json.error.code).slice(0, 40) : null; throw e; }
    return json;
  } finally { clearTimeout(t); }
}

(async () => {
  const inicio = Date.now(); let gasto = 0; const erros = []; const extras = {};
  // Limiares SUGERIDOS pela calibração real (retrieval.json da 1ª passada), usados SÓ neste benchmark do Candidate (não são de produção).
  const cfg = R.resolverConfig({ limiares: { fraco: 0.506, encontrado: 0.543, calibrado: false }, provedores: { openai: { modelo: MODELO_OPENAI, maxTokensSaida: MAX_SAIDA.openai }, anthropic: { modelo: MODELO_CLAUDE, maxTokensSaida: MAX_SAIDA.anthropic } } });
  const casos = IDS_CASOS.map((id) => CASOS.find((c) => c.id === id)); if (casos.some((c) => !c)) throw new Error('caso ausente');

  // ── 4.5/5 estimativa PRÉ-execução (teto de entrada/saída de cada variante; contexto máximo observado) ──
  const atual = R.carregarPromptAtual();
  const est = (variante, chars, saida, p) => usd(Math.ceil((chars / 3.5) * 1.3), saida, p);
  const msgChars = (c) => c.message.length + (c.history || []).reduce((s, h) => s + h.content.length, 0);
  let estimativa = 0; const linhasEst = [];
  for (const c of casos) {
    const base = msgChars(c);
    const a = est('A', 600 + base, MAX_SAIDA.anthropic, PRECOS.anthropic);
    const b = est('B', R.politica.texto.length + cfg.contexto.maxCharsTotal + 2200 + base, MAX_SAIDA.openai, PRECOS.openai);
    const cc = est('C', R.politica.texto.length + cfg.contexto.maxCharsTotal + 2200 + base, MAX_SAIDA.anthropic, PRECOS.anthropic);
    const d = est('D', atual.systemChatAoVivo.length + 52000 + base, MAX_SAIDA.current, PRECOS.anthropic);
    linhasEst.push({ caso: c.id, A: +a.toFixed(4), B: +b.toFixed(4), C: +cc.toFixed(4), D: +d.toFixed(4) }); estimativa += a + b + cc + d;
  }
  const embEst = (casos.length * 5 * 70 / 1e6) * PRECOS.embedding; estimativa += embEst;
  log('ESTIMATIVA PRÉ-EXECUÇÃO (pior caso: entrada ×1,3, saída no teto, contexto atual no máximo observado):', JSON.stringify({ casos: casos.length, geracoes: casos.length * 4, usdMaximo: +estimativa.toFixed(3), embeddingsUsd: +embEst.toFixed(6), teto: TETO_USD }));
  if (estimativa > TETO_USD) { log('STOP: estimativa acima do teto.'); console.log(JSON.stringify(linhasEst)); process.exit(3); }

  // ── confirma o modelo OpenAI (consulta gratuita) ──
  const m = await fetch('https://api.openai.com/v1/models/' + MODELO_OPENAI, { headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY } });
  if (!m.ok) { log('STOP: modelo ' + MODELO_OPENAI + ' indisponível (HTTP ' + m.status + ').'); process.exit(4); }

  // ── ABRE a trava paga SOMENTE neste processo ──
  process.env.RAG3_ALLOW_PAID_CALLS = VALOR_AUTORIZACAO;
  try {
    const embedder = new R.OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY, fetchImpl: fetch });
    const cliente = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { auth: { persistSession: false } });
    const store = new RecordingStore(new R.SupabaseRpcVectorStore({ client: cliente }));
    const deps = { embedder, store, config: cfg, promptAtual: atual };

    // ═══ FASE 1 — recuperação REAL (embeddings reais; RPCs de leitura) ═══
    const prep = new Map(); const retrieval = []; const buscasPorCaso = new Map();
    for (const c of casos) {
      const m0 = store.mark();
      const v = await R.buildVariantRequests(c, deps);
      prep.set(c.id, v); buscasPorCaso.set(c.id, store.buscas.slice(m0));
      const r = v.preparo.retrieval; const d = r.diagnostics;
      retrieval.push({
        case_id: c.id, categoria: CATEGORIA[c.id], status: r.status, motivo: r.motivo, erro: r.erroCodigo || null,
        subconsultas: (r.queryPlan ? r.queryPlan.subconsultas : []).map((s) => s.kind === 'literal' ? 'literal:' + sha256(c.message + '|' + (c.history || []).length).slice(0, 10) : s.id),
        conceitos: r.queryPlan ? r.queryPlan.conceitos.map((x) => ({ id: x.id, origem: x.origin, peso: x.weight })) : [],
        diagnostico: d, buscas_brutas: buscasPorCaso.get(c.id),
        blocos: r.blocks.map((b) => ({ id: b.id, titulo: b.title, fonte: b.source, tema: b.theme, obra: b.bookId, similaridade: b.similarity, conceitos: b.concepts, truncamento: b.truncation })),
        current: v.atual ? { blocos: v.atual.blocos.map((b) => ({ id: b.id, titulo: b.title, fonte: b.source, tema: b.theme, similaridade: Number(b.similarity.toFixed(4)) })), chars_contexto: v.atual.conhecimento.reduce((s, t) => s + t.length, 0) } : null,
        knowledge_pack: { hash: v.preparo.knowledgePack.hash, status: v.preparo.knowledgePack.status, blocos: v.preparo.knowledgePack.blockIds.length, chars: v.preparo.knowledgePack.chars, tokens_est: v.preparo.knowledgePack.estimatedTokens, truncados: v.preparo.knowledgePack.truncatedBlocks }
      });
      gasto += (5 * 70 / 1e6) * PRECOS.embedding;
      log(`retrieval ${c.id} [${CATEGORIA[c.id]}] status=${r.status} blocos=${r.blocks.length} fontes=${d.sourceDiversity} topo=${d.topSimilarity} cobertura=${d.conceptCoverage}`);
    }
    // calibração (distribuição REAL do melhor bloco por categoria, antes de qualquer limiar)
    const amostras = casos.map((c) => { const bs = buscasPorCaso.get(c.id); return { categoria: CATEGORIA[c.id], topo: Math.max(...bs.map((x) => x.top1 || 0)), caso: c.id, top1PorSubconsulta: bs.map((x) => x.top1), media10PorSubconsulta: bs.map((x) => x.media10) }; });
    const resumo = calib.resumirSimilaridades(amostras); const sugestao = calib.sugerirLimiares(resumo);
    const calibracao = { amostras, resumo, sugestao: sugestao.suficiente ? { THRESHOLD_SUGGESTED_WEAK: sugestao.sugestao.fraco, THRESHOLD_SUGGESTED_FOUND: sugestao.sugestao.encontrado, separavel: sugestao.separavel, folga: sugestao.folga, aviso: sugestao.aviso + ' (amostra muito pequena: 4 dentro, 1 parcial, 1 fora)' } : sugestao, limiares_em_uso: cfg.limiares };
    fs.writeFileSync(path.join(INTERNO, 'retrieval.json'), JSON.stringify({ retrieval, calibracao }, null, 1));
    fs.writeFileSync(path.join(INTERNO, 'calibracao.json'), JSON.stringify(calibracao, null, 1));

    // portão: nenhum caso DENTRO do domínio pode ficar sem blocos (status none/error) — senão a geração não faria sentido
    const ruins = retrieval.filter((r) => r.categoria === 'in' && !['found', 'weak'].includes(r.status));
    if (SO_RECUPERACAO || ruins.length) {
      log(ruins.length ? 'PORTÃO: casos dentro do domínio sem conhecimento recuperado → NÃO gerar respostas: ' + ruins.map((r) => r.case_id + ':' + r.status).join(', ') : 'Parada pedida após a recuperação.');
      fs.writeFileSync(path.join(INTERNO, 'parada.json'), JSON.stringify({ motivo: ruins.length ? 'portao_recuperacao' : 'so_recuperacao', ruins: ruins.map((r) => r.case_id), gasto_estimado_usd: +gasto.toFixed(6) }, null, 1));
      return;
    }

    // ═══ Prova de equivalência B × C (mesma pergunta, histórico, knowledge pack, política, payload editorial) ═══
    const fairness = casos.map((c) => { const v = prep.get(c.id); const eq = v.equivalenciaZuni; const ed = (p) => R.conteudoEditorialDoPayload(p);
      return { case_id: c.id, equivalentes: eq.equivalentes, policy_hash: eq.politicaHash, knowledge_pack_hash: eq.knowledgePackHash, messages_hash: v.requests.zuni.hashes.mensagens, editorial_payload_hash_openai: sha256(JSON.stringify(ed(v.payloads.zuniOpenAI))), editorial_payload_hash_claude: sha256(JSON.stringify(ed(v.payloads.zuniClaude))), max_saida: { openai: MAX_SAIDA.openai, claude: MAX_SAIDA.anthropic }, blocos: v.preparo.knowledgePack.blockIds.length }; });
    if (!fairness.every((f) => f.equivalentes && f.editorial_payload_hash_openai === f.editorial_payload_hash_claude)) { log('STOP: B e C não são equivalentes.'); process.exit(5); }

    // ═══ FASE 2 — geração (24 chamadas no máximo; nunca repete resposta válida; para ao se aproximar do teto) ═══
    const arqArt = path.join(INTERNO, 'artefatos.json'); const artefatos = fs.existsSync(arqArt) ? JSON.parse(fs.readFileSync(arqArt, 'utf8')) : [];
    const transportes = {
      anthropic: async (payload) => http('https://api.anthropic.com/v1/messages', { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, payload),
      openai: async (payload) => { const j = await http('https://api.openai.com/v1/chat/completions', { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }, payload); extras.openai = { finish: j.choices && j.choices[0] && j.choices[0].finish_reason, reasoning: j.usage && j.usage.completion_tokens_details ? j.usage.completion_tokens_details.reasoning_tokens : null }; return j; }
    };
    const provA = new R.AnthropicProvider({ modelo: MODELO_CLAUDE, maxTokensSaida: MAX_SAIDA.anthropic });
    const provD = new R.AnthropicProvider({ modelo: MODELO_CLAUDE, maxTokensSaida: MAX_SAIDA.current });
    const provB = new R.OpenAIProvider({ modelo: MODELO_OPENAI, maxTokensSaida: MAX_SAIDA.openai });
    const variantes = [['A', 'generic', provA, 'generic'], ['B', 'zuni-openai', provB, 'zuni'], ['C', 'zuni-claude', provA, 'zuni'], ['D', 'zuni-current', provD, 'current']];
    let parou = null;
    for (const c of casos) {
      const v = prep.get(c.id);
      for (const [letra, nome, prov, tipoReq] of variantes) {
        if (artefatos.some((a) => a.case_id === c.id && a.variant === nome && a.response)) continue; // não repete resposta válida
        const req = tipoReq === 'generic' ? v.requests.generic : (tipoReq === 'zuni' ? v.requests.zuni : v.requests.current);
        const inTok = Math.ceil((req.systemText.length + req.messages.reduce((s, m2) => s + m2.content.length, 0)) / 3.5);
        const precos = prov.nome === 'openai' ? PRECOS.openai : PRECOS.anthropic; const saidaMax = nome === 'zuni-openai' ? MAX_SAIDA.openai : (nome === 'zuni-current' ? MAX_SAIDA.current : MAX_SAIDA.anthropic);
        const piorProx = usd(inTok * 1.3, saidaMax, precos);
        if (gasto + piorProx > TETO_USD * 0.97) { parou = { motivo: 'teto_de_custo', antes_de: c.id + ':' + nome, gasto: +gasto.toFixed(4) }; break; }
        const t0 = Date.now(); extras.openai = null;
        try {
          const r = await prov.generate(req, { transporte: prov.nome === 'openai' ? transportes.openai : transportes.anthropic });
          const texto = String(r.text || '').trim();
          const custo = usd(r.usage.inputTokens || 0, r.usage.outputTokens || 0, precos); gasto += custo;
          if (texto.length < 40) { erros.push({ case_id: c.id, variant: nome, codigo: 'resposta_vazia_ou_truncada', finish: extras.openai && extras.openai.finish, reasoning: extras.openai && extras.openai.reasoning }); artefatos.push({ case_id: c.id, variant: nome, letra, provider: prov.nome, model: prov.cfg.modelo, response: null, usage: r.usage, custo_usd: +custo.toFixed(5), latency_ms: r.latencyMs, finish_reason: extras.openai ? extras.openai.finish : null, reasoning_tokens: extras.openai ? extras.openai.reasoning : null }); }
          else artefatos.push({ case_id: c.id, variant: nome, letra, provider: prov.nome, model: prov.cfg.modelo, response: texto, usage: r.usage, custo_usd: +custo.toFixed(5), latency_ms: r.latencyMs, finish_reason: extras.openai ? extras.openai.finish : null, reasoning_tokens: extras.openai ? extras.openai.reasoning : null, input_tokens_estimado: inTok });
          log(`geração ${artefatos.length}/24 concluída | acumulado≈$${gasto.toFixed(3)}`); // CEGO: nada de variante/provider/rótulo no terminal
        } catch (e) { erros.push({ case_id: c.id, variant: nome, codigo: e.codigo || 'erro', retryable: Boolean(e.retryable) }); log(`ERRO em ${c.id}: ${e.codigo || 'erro'} (sem repetição automática)`); }
        fs.writeFileSync(arqArt, JSON.stringify(artefatos, null, 1)); // preserva o que já foi obtido
      }
      if (parou) break;
    }
    fs.writeFileSync(arqArt, JSON.stringify(artefatos, null, 1));

    // ═══ Recomendação de obra (decisão do sistema, fora do texto) ═══
    const titulosCatalogo = Object.entries(CATALOGO).filter(([, l]) => !l.teaser).map(([id, l]) => [id, normalizar(l.tituloPublico || l.titulo)]);
    const menciona = (texto) => titulosCatalogo.filter(([, t]) => t.length > 8 && normalizar(texto).includes(t)).map(([id]) => id);
    const livros = casos.map((c) => { const rec = prep.get(c.id).preparo.recommendation; const prov = prep.get(c.id).preparo.retrieval.blocks;
      const porVar = {}; for (const a of artefatos.filter((x) => x.case_id === c.id && x.response)) porVar[a.variant] = menciona(a.response);
      return { case_id: c.id, BOOK_RECOMMENDED: rec.books.length ? 'YES' : 'NO', livros: rec.books.map((b) => ({ BOOK_ID: b.bookId, titulo: b.title, preco_brl: b.priceBRL, url: b.url, WHY: b.reason + ' (pontuação ' + b.score + ')', PROVENANCE_SUPPORT: b.evidenceBlockIds.length ? 'YES' : 'NO', blocos_de_apoio: b.evidenceBlockIds })), suprimidas: rec.suppressed.map((s) => s.bookId ? s.bookId + ':' + s.motivo : s.motivo), esperado_no_dataset: c.book_candidate_expected, obras_com_proveniencia_no_pack: [...new Set(prov.filter((b) => b.bookId).map((b) => b.bookId))], mencoes_no_texto_por_variante: porVar }; });

    // ═══ Pacote cego ═══
    const itens = []; const chave = {};
    for (const c of casos) {
      const lista = artefatos.filter((a) => a.case_id === c.id && a.response); if (!lista.length) continue;
      const rnd = rubrica.mulberry32(rubrica.sementeDeTexto('zuni-c2a:' + c.id)); const ordem = [...lista];
      for (let i = ordem.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
      const id = 'caso-' + c.id.replace('c', ''); chave[id] = { case_id: c.id, mapa: Object.fromEntries(ordem.map((a, i) => [String(i + 1), { variante: a.variant, letra: a.letra, provider: a.provider, modelo: a.model }])) };
      itens.push({ id, contexto: { historico: c.history || [], mensagem: c.message }, respostas: ordem.map((a, i) => ({ rotulo: 'Resposta ' + (i + 1), texto: a.response })) });
    }
    const md = [];
    md.push('# ZUNI DIRECIONA — C2-A — Avaliação humana CEGA\n');
    md.push('Cada caso traz a pergunta (sintética) e 4 respostas anônimas. Avalie cada resposta de 0 a 5 nas 10 dimensões abaixo, sem tentar descobrir quem a escreveu. A recomendação de livro é avaliada à parte e **não** entra aqui.\n');
    md.push('**Dimensões (0–5):** ' + rubrica.DIMENSOES.join(' · ') + '\n');
    md.push('**Perguntas por resposta:**\n1. O que esta resposta acrescentou além de uma resposta genérica?\n2. Esta resposta justificaria pagar pelo ZUNI Direciona? YES / MAYBE / NO\n3. Esta resposta parece: GENÉRICA / BOA / DIFERENCIADA / EXCEPCIONAL\n');
    for (const it of itens) {
      md.push(`\n---\n\n## ${it.id.toUpperCase()}\n`);
      if (it.contexto.historico.length) { md.push('**Conversa anterior (sintética):**\n'); it.contexto.historico.forEach((h) => md.push(`> **${h.role === 'user' ? 'Pessoa' : 'Mentor'}:** ${h.content}`)); md.push(''); }
      md.push(`**Pergunta atual da pessoa:**\n\n> ${it.contexto.mensagem}\n`);
      for (const r of it.respostas) { md.push(`\n### ${r.rotulo}\n\n${r.texto}\n`); md.push(`**Notas (0–5):** ${rubrica.DIMENSOES.map((d) => d + ': __').join(' · ')}\n`); md.push('**1. O que acrescentou além de uma resposta genérica?** __\n\n**2. Justificaria pagar? (YES/MAYBE/NO):** __\n\n**3. Parece (GENÉRICA/BOA/DIFERENCIADA/EXCEPCIONAL):** __\n'); }
    }
    fs.writeFileSync(path.join(SAIDA, 'ZUNI_DIRECIONA_C2A_BLIND_EVALUATION.md'), md.join('\n'));
    fs.writeFileSync(path.join(SAIDA, 'ZUNI_DIRECIONA_C2A_BLIND_EVALUATION.json'), JSON.stringify({ instrucoes: 'avaliação cega', dimensoes: rubrica.DIMENSOES, perguntas: ['acrescentou', 'pagaria (YES|MAYBE|NO)', 'classificacao (GENERICA|BOA|DIFERENCIADA|EXCEPCIONAL)'], itens }, null, 1));
    fs.writeFileSync(path.join(INTERNO, 'ZUNI_DIRECIONA_C2A_BLIND_KEY.json'), JSON.stringify(chave, null, 1));
    fs.writeFileSync(path.join(INTERNO, 'livros.json'), JSON.stringify(livros, null, 1));
    fs.writeFileSync(path.join(INTERNO, 'fairness.json'), JSON.stringify(fairness, null, 1));
    const porProv = {}; for (const a of artefatos) { const k = a.provider; const x = (porProv[k] = porProv[k] || { chamadas: 0, entrada: 0, saida: 0, custo: 0 }); x.chamadas++; x.entrada += (a.usage && a.usage.inputTokens) || 0; x.saida += (a.usage && a.usage.outputTokens) || 0; x.custo += a.custo_usd || 0; }
    const resumoFinal = { gasto_estimado_usd: +gasto.toFixed(4), teto: TETO_USD, estimativa_pre: +estimativa.toFixed(3), geracoes_ok: artefatos.filter((a) => a.response).length, geracoes_registradas: artefatos.length, erros, parou, por_provider: porProv, duracao_s: Math.round((Date.now() - inicio) / 1000) };
    fs.writeFileSync(path.join(INTERNO, 'resumo_execucao.json'), JSON.stringify(resumoFinal, null, 1));
    log('RESUMO', JSON.stringify({ gasto_estimado_usd: resumoFinal.gasto_estimado_usd, geracoes_ok: resumoFinal.geracoes_ok, erros: erros.length, parou: parou && parou.motivo, duracao_s: resumoFinal.duracao_s }));
  } finally {
    delete process.env.RAG3_ALLOW_PAID_CALLS; // fecha a autorização deste processo
    log('trava paga desativada:', process.env.RAG3_ALLOW_PAID_CALLS === undefined);
  }
})().catch((e) => { delete process.env.RAG3_ALLOW_PAID_CALLS; console.error('FALHA:', String(e && e.message).slice(0, 160)); process.exit(1); });
