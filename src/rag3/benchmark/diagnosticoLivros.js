'use strict';
// rag3/benchmark/diagnosticoLivros.js — DIAGNÓSTICO (offline, sem API) das recomendações de obra: para cada caso, qual gate bloqueou,
// se o bloqueio foi adequado e o que mudaria sob contrafactuais. NÃO altera limiares nem o comportamento do recomendador.
const { recommendBooks } = require('../bookRecommendation');
const { resolverConfig } = require('../config');
const { resolverObra } = require('../provenance');

// retrieval: entrada sanitizada (formato do retrieval.json da C2-A): { status, conceitos:[{id}], blocos:[{id,titulo,fonte,obra,similaridade}] }
function blocosParaRecomendador(retrieval) {
  return (retrieval.blocos || []).map((b) => { const o = resolverObra({ source: b.fonte, title: b.titulo, bookId: b.obra }); return { id: b.id, source: b.fonte, title: b.titulo, similarity: b.similaridade, bookId: o.bookId, bookConfidence: o.confianca }; });
}

const CONTRAFACTUAIS = Object.freeze({
  atual: {},
  aceitar_weak: { statusComoFound: true },
  turno_3: { turnIndex: 3 },
  aceitar_weak_e_turno_3: { statusComoFound: true, turnIndex: 3 },
  prov_min_1_bloco: { minBlocos: 1 },
  aceitar_weak_turno_3_prov_1: { statusComoFound: true, turnIndex: 3, minBlocos: 1 },
  lexical_min_0_5_turno_3: { turnIndex: 3, pontuacaoMinima: 0.5 },
  aceitar_weak_lexical_0_5_turno_3: { statusComoFound: true, turnIndex: 3, pontuacaoMinima: 0.5 }
});

function rodar(caso, retrieval, mod, config) {
  const cfg = resolverConfig({ recomendacao: { ...(config.recomendacao), ...(mod.minBlocos ? { minBlocosComProveniencia: mod.minBlocos } : {}), ...(mod.pontuacaoMinima ? { pontuacaoMinima: mod.pontuacaoMinima } : {}) } });
  const r = recommendBooks({ blocks: blocosParaRecomendador(retrieval), concepts: (retrieval.conceitos || []).map((c) => c.id), retrievalStatus: mod.statusComoFound && retrieval.status === 'weak' ? 'found' : retrieval.status, turnIndex: mod.turnIndex != null ? Math.max(mod.turnIndex, caso.turn_index) : caso.turn_index, userAskedForReading: false, parentContext: false, alreadyRecommended: [] }, { config: cfg });
  return { livros: r.books.map((b) => b.bookId), suprimidas: r.suppressed.map((s) => (s.bookId ? s.bookId + ':' + s.motivo : s.motivo)) };
}

const esperado = (caso, ids) => (caso.book_candidate_expected === 'NONE' ? ids.length === 0 : ids.length > 0 && ids.every((i) => caso.book_candidate_expected.includes(i)));

/** @returns {Object[]} um registro por caso, com bloqueio atual, adequação e resultado de cada contrafactual */
function diagnosticar({ casos, retrievals, config = resolverConfig() }) {
  const out = [];
  for (const caso of casos) {
    const rt = retrievals.find((r) => r.case_id === caso.id); if (!rt) continue;
    const porCenario = {}; for (const [nome, mod] of Object.entries(CONTRAFACTUAIS)) porCenario[nome] = rodar(caso, rt, mod, config);
    const atual = porCenario.atual; const gate = atual.suprimidas[0] || (atual.livros.length ? 'nenhum (recomendou)' : 'desconhecido');
    out.push({ case_id: caso.id, status_recuperacao: rt.status, topo: rt.diagnostico && rt.diagnostico.topSimilarity, turno: caso.turn_index, esperado: caso.book_candidate_expected, gate_que_bloqueou: gate, todas_as_supressoes: atual.suprimidas, obras_com_proveniencia: [...new Set(blocosParaRecomendador(rt).filter((b) => b.bookId).map((b) => b.bookId))], cenarios: Object.fromEntries(Object.entries(porCenario).map(([n, v]) => [n, { livros: v.livros, correto: esperado(caso, v.livros) }])) });
  }
  return out;
}

module.exports = { diagnosticar, blocosParaRecomendador, CONTRAFACTUAIS };
