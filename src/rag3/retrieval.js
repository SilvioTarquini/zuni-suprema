'use strict';
// rag3/retrieval.js — retrieveZuniKnowledge(): recuperação HÍBRIDA com proveniência.
//   plano de consulta (multi-conceito) → embedding das subconsultas → busca GLOBAL por subconsulta → fusão
//   → dedupe/quase-duplicata → seleção com reserva por conceito + tetos por fonte/título → limiar (found/weak/none)
//   → controle de tamanho (janela de parágrafos mais relevante, nunca bloco gigante inteiro).
// O fornecedor de geração NÃO participa daqui. Nada é logado aqui; o chamador usa o logger sem PII.
const { resolverConfig } = require('./config');
const { criarQueryPlanner } = require('./queryPlanner');
const { chaveDeTitulo, shingles, jaccard, sha256, normalizar } = require('./util');
const { POR_ID } = require('./conceptLexicon');

function statusDe(blocos, cfg) {
  if (!blocos.length) return { status: 'none', motivo: 'sem_blocos_acima_do_limiar_fraco' };
  const topo = Math.max(...blocos.map((b) => b.similarity));
  const fortes = blocos.filter((b) => b.similarity >= cfg.limiares.fraco).length;
  if (topo >= cfg.limiares.encontrado && fortes >= cfg.limiares.minBlocosParaEncontrado) return { status: 'found', motivo: 'topo_e_quantidade_acima_do_limiar' };
  if (topo >= cfg.limiares.fraco) return { status: 'weak', motivo: topo >= cfg.limiares.encontrado ? 'poucos_blocos_fortes' : 'topo_entre_fraco_e_encontrado' };
  return { status: 'none', motivo: 'topo_abaixo_do_limiar_fraco' };
}

// Janela de parágrafos com maior sobreposição de radicais dos conceitos; blocos curtos passam inteiros.
function aplicarTamanho(texto, radicais, maxChars) {
  const original = texto.length;
  if (original <= maxChars) return { texto, truncado: false, original, mantido: original, estrategia: 'inteiro' };
  const paragrafos = texto.split(/\n{2,}|(?<=[.!?])\s{2,}/).filter(Boolean);
  if (paragrafos.length < 2) { const corte = texto.slice(0, maxChars); const fim = Math.max(corte.lastIndexOf('. '), corte.lastIndexOf('\n')); const t = (fim > maxChars * 0.5 ? corte.slice(0, fim + 1) : corte).trim(); return { texto: t + ' [trecho truncado]', truncado: true, original, mantido: t.length, estrategia: 'cabeca' }; }
  const pont = paragrafos.map((p) => { const n = normalizar(p); return radicais.reduce((s, r) => s + (n.includes(r) ? 1 : 0), 0); });
  let melhor = { ini: 0, fim: 0, score: -1 };
  for (let i = 0; i < paragrafos.length; i++) {
    let len = 0; let sc = 0;
    for (let j = i; j < paragrafos.length; j++) { if (len + paragrafos[j].length + 2 > maxChars && j > i) break; len += paragrafos[j].length + 2; sc += pont[j]; if (sc > melhor.score) melhor = { ini: i, fim: j, score: sc }; }
  }
  const t = paragrafos.slice(melhor.ini, melhor.fim + 1).join('\n\n').slice(0, maxChars).trim();
  return { texto: (melhor.ini > 0 ? '[...] ' : '') + t + (melhor.fim < paragrafos.length - 1 ? ' [...]' : ''), truncado: true, original, mantido: t.length, estrategia: 'janela-de-paragrafos' };
}

async function retrieveZuniKnowledge(params, deps) {
  const cfg = deps.config || resolverConfig();
  const { currentMessage = '', recentHistory = [], sessionSummary = '', selectedTheme = null } = params || {};
  const maxCandidatos = (params && params.maxCandidates) || cfg.recuperacao.candidatosPorSubconsulta;
  const maxFinais = (params && params.maxFinalBlocks) || cfg.recuperacao.maxBlocosFinais;
  const planner = deps.planner || criarQueryPlanner(cfg);
  const t0 = Date.now();
  try {
    const plano = await planner.plan({ currentMessage, recentHistory, sessionSummary, selectedTheme });
    if (!plano.subconsultas.length) return { status: 'none', motivo: 'sem_subconsultas', queryPlan: resumoDoPlano(plano), blocks: [], diagnostics: diag({ candidatos: 0, finais: 0, fontes: 0, cobertura: 0, ms: Date.now() - t0 }) };

    const vetores = await deps.embedder.embed(plano.subconsultas.map((s) => s.text));
    const porId = new Map(); let totalCandidatos = 0;
    for (let i = 0; i < plano.subconsultas.length; i++) {
      const sq = plano.subconsultas[i];
      const achados = await deps.store.search({ embedding: vetores[i], limit: maxCandidatos });
      totalCandidatos += achados.length;
      for (const b of achados) {
        const e = porId.get(b.id) || { ...b, similarity: b.similarity, conceitos: new Set(), subconsultas: new Set() };
        if (b.similarity > e.similarity) e.similarity = b.similarity;
        if (sq.conceptId) e.conceitos.add(sq.conceptId);
        e.subconsultas.add(sq.id); porId.set(b.id, e);
      }
    }

    // pontuação fundida: melhor similaridade + bônus por responder a mais de um conceito + bônus (não filtro) de tema
    const etiquetas = new Set(plano.etiquetasDeTema || []);
    const todos = [...porId.values()].map((e) => ({ ...e, fundida: e.similarity + cfg.recuperacao.bonusMultiConceito * Math.max(0, e.conceitos.size - 1) + (e.theme && etiquetas.has(e.theme) ? cfg.recuperacao.bonusTema : 0) }));
    const acimaDoLimiar = todos.filter((b) => b.similarity >= cfg.limiares.fraco).sort((a, b) => b.fundida - a.fundida);
    const descartadosPorLimiar = todos.length - acimaDoLimiar.length;

    const selecionados = []; const contFonte = {}; const contTitulo = {}; const hashes = new Set(); const sh = [];
    let descartadosPorCaps = 0; let descartadosPorDuplicata = 0;
    const tentar = (b) => {
      const h = sha256(b.text); if (hashes.has(h)) { descartadosPorDuplicata++; return false; }
      const s = shingles(b.text); if (sh.some((x) => jaccard(x, s) >= cfg.recuperacao.jaccardQuaseDuplicata)) { descartadosPorDuplicata++; return false; }
      const tk = chaveDeTitulo(b.title);
      if ((contFonte[b.source] || 0) >= cfg.recuperacao.tetoPorFonte || (contTitulo[tk] || 0) >= cfg.recuperacao.tetoPorTitulo) { descartadosPorCaps++; return false; }
      hashes.add(h); sh.push(s); contFonte[b.source] = (contFonte[b.source] || 0) + 1; contTitulo[tk] = (contTitulo[tk] || 0) + 1; selecionados.push(b); return true;
    };
    if (cfg.recuperacao.reservaPorConceito) {
      for (const c of plano.conceitos) { if (selecionados.length >= maxFinais) break; const melhor = acimaDoLimiar.find((b) => b.conceitos.has(c.id) && !selecionados.includes(b)); if (melhor) tentar(melhor); }
    }
    for (const b of acimaDoLimiar) { if (selecionados.length >= maxFinais) break; if (!selecionados.includes(b)) tentar(b); }

    // controle de tamanho + orçamento total
    const radicais = [...new Set(plano.conceitos.flatMap((c) => (POR_ID[c.id] ? POR_ID[c.id].radicais : []).map((r) => normalizar(r).trim())))];
    selecionados.sort((a, b) => b.fundida - a.fundida);
    let orcamento = cfg.contexto.maxCharsTotal; const finais = []; let truncados = 0; let descartadosPorOrcamento = 0;
    selecionados.forEach((b, idx) => {
      const restantes = selecionados.length - idx;
      const teto = Math.max(cfg.contexto.minCharsPorBlocoNoOrcamento, Math.min(cfg.contexto.maxCharsPorBloco, Math.floor(orcamento / restantes) * (restantes > 1 ? 1.6 : 1)));
      if (orcamento < cfg.contexto.minCharsPorBlocoNoOrcamento) { descartadosPorOrcamento++; return; }
      const r = aplicarTamanho(b.text, radicais, Math.min(teto, orcamento));
      orcamento -= r.texto.length; if (r.truncado) truncados++;
      finais.push({ id: b.id, title: b.title, source: b.source, path: b.path, theme: b.theme, bookId: b.bookId, bookConfidence: b.bookConfidence, similarity: Number(b.similarity.toFixed(4)), concepts: [...b.conceitos], text: r.texto, truncation: r.truncado ? { strategy: r.estrategia, originalChars: r.original, keptChars: r.mantido } : null });
    });

    const { status, motivo } = statusDe(finais, cfg);
    const cobertos = plano.conceitos.filter((c) => finais.some((b) => b.concepts.includes(c.id))).length;
    return {
      status, motivo, queryPlan: resumoDoPlano(plano), blocks: status === 'none' ? [] : finais,
      diagnostics: diag({ candidatos: totalCandidatos, finais: finais.length, fontes: new Set(finais.map((b) => b.source)).size, cobertura: plano.conceitos.length ? cobertos / plano.conceitos.length : 0, truncados, descartadosPorLimiar, descartadosPorCaps, descartadosPorDuplicata, descartadosPorOrcamento, limiarCalibrado: cfg.limiares.calibrado, ms: Date.now() - t0, topSimilaridade: finais.length ? Math.max(...finais.map((b) => b.similarity)) : null })
    };
  } catch (e) {
    // erro técnico SANITIZADO: nunca propaga mensagem (pode conter texto do usuário); status explícito, nunca silencioso
    return { status: 'error', motivo: 'excecao', erroCodigo: String((e && (e.codigo || e.name)) || 'Error').slice(0, 40), queryPlan: null, blocks: [], diagnostics: diag({ candidatos: 0, finais: 0, fontes: 0, cobertura: 0, ms: Date.now() - t0 }) };
  }
}

// Plano SEM texto de usuário (o literal/fallback não entra no resumo): só ids de conceito, pesos e flags.
function resumoDoPlano(p) {
  return { modo: p.modo, conceitos: p.conceitos.map((c) => ({ id: c.id, weight: c.weight, origin: c.origin })), subconsultas: p.subconsultas.map((s) => ({ id: s.id, kind: s.kind })), temaSinal: p.temaSinal, usouHistorico: p.usouHistorico, continuacao: p.continuacao, fallbackUsado: p.fallbackUsado };
}

function diag(o) {
  return { candidateCount: o.candidatos, finalCount: o.finais, sourceDiversity: o.fontes, conceptCoverage: Number((o.cobertura || 0).toFixed(3)), truncatedCount: o.truncados || 0, droppedByThreshold: o.descartadosPorLimiar || 0, droppedByCaps: o.descartadosPorCaps || 0, droppedByDuplicate: o.descartadosPorDuplicata || 0, droppedByBudget: o.descartadosPorOrcamento || 0, thresholdCalibrated: Boolean(o.limiarCalibrado), topSimilarity: o.topSimilaridade == null ? null : Number(o.topSimilaridade.toFixed(4)), latencyMs: o.ms };
}

module.exports = { retrieveZuniKnowledge, aplicarTamanho, statusDe };
