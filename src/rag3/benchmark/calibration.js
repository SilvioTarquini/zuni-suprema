'use strict';
// rag3/benchmark/calibration.js — MODO DE CALIBRAÇÃO do limiar de relevância. Nada de número arbitrário: coleta a distribuição das
// similaridades do melhor bloco (top-1) para perguntas dentro / parcialmente dentro / fora do domínio e SUGERE limiares a partir dela.
// Com embeddings reais (benchmark pago) a distribuição será a verdadeira; com vetores de proxy serve só para validar o mecanismo.
const { percentil } = require('../util');
const { retrieveZuniKnowledge } = require('../retrieval');
const { resolverConfig } = require('../config');

function estatisticas(valores) {
  if (!valores.length) return { n: 0 };
  const r = (x) => Number(x.toFixed(4));
  return { n: valores.length, min: r(Math.min(...valores)), p10: r(percentil(valores, 0.1)), mediana: r(percentil(valores, 0.5)), p90: r(percentil(valores, 0.9)), max: r(Math.max(...valores)) };
}

// amostras: [{ categoria: 'in'|'partial'|'out', topo: number, topK: number[] }]
function resumirSimilaridades(amostras) {
  const por = { in: [], partial: [], out: [] }; for (const a of amostras) if (por[a.categoria] && Number.isFinite(a.topo)) por[a.categoria].push(a.topo);
  return { in: estatisticas(por.in), partial: estatisticas(por.partial), out: estatisticas(por.out) };
}

function sugerirLimiares(resumo) {
  const inn = resumo.in; const out = resumo.out; const par = resumo.partial;
  if (!inn.n || !out.n) return { suficiente: false, aviso: 'precisa de amostras dentro E fora do domínio' };
  const separavel = inn.p10 > out.p90;
  const fraco = Number(((out.p90 + (par.n ? par.p10 : inn.p10)) / 2).toFixed(4));
  const encontrado = Number((((par.n ? par.p90 : out.p90) + inn.p10) / 2).toFixed(4));
  return { suficiente: true, separavel, folga: Number((inn.p10 - out.p90).toFixed(4)), sugestao: { fraco: Math.min(fraco, encontrado), encontrado: Math.max(fraco, encontrado) }, aviso: separavel ? 'Sugestão baseada nos dados; a decisão do limiar final é humana.' : 'Distribuições sobrepostas: o limiar não separa bem; investigar planner/embeddings antes de fixar.' };
}

// Roda o retrieval com o limiar DESLIGADO (fraco=0) para observar top-1 de cada caso; não usa fornecedor de geração.
async function calibrarComRecuperacao({ casos, deps, config = resolverConfig() }) {
  const cfg = resolverConfig({ limiares: { fraco: 0, encontrado: 0.0001, minBlocosParaEncontrado: 1 } });
  const amostras = [];
  for (const c of casos) {
    const r = await retrieveZuniKnowledge({ currentMessage: c.message, recentHistory: c.history || [], selectedTheme: c.selected_theme || null }, { ...deps, config: { ...config, limiares: cfg.limiares } });
    const sims = (r.blocks || []).map((b) => b.similarity);
    amostras.push({ categoria: c.domain_fit, topo: sims.length ? Math.max(...sims) : NaN, topK: sims, caso: c.id });
  }
  const resumo = resumirSimilaridades(amostras);
  return { amostras, resumo, sugestao: sugerirLimiares(resumo) };
}

module.exports = { resumirSimilaridades, sugerirLimiares, calibrarComRecuperacao, estatisticas };
