'use strict';
// rag3/benchmark/cost.js — estimativa de custo do benchmark PAGO (sem executar nada). Preços em US$ por 1 milhão de tokens.
// Os preços são parâmetros: o da OpenAI NÃO é assumido pelo código (o modelo ainda será escolhido na autorização).
const PRECOS_PADRAO = Object.freeze({ anthropic: { entrada: 3, saida: 15 }, openai: { entrada: null, saida: null }, embedding: { entrada: 0.02 } });

function estimarCustoBenchmark({ artefatos, precos = PRECOS_PADRAO, saidaTipicaTokens = 700, fatorPiorCasoEntrada = 1.5, subconsultasPorCaso = 4, tokensPorSubconsulta = 60 }) {
  const porProvider = {}; let chamadas = 0;
  for (const a of artefatos) {
    chamadas++; const p = a.provider; const e = a.estimated_tokens || {};
    const x = (porProvider[p] = porProvider[p] || { chamadas: 0, entradaTokens: 0, saidaTipica: 0, saidaMax: 0 });
    x.chamadas++; x.entradaTokens += e.input || 0; x.saidaTipica += Math.min(saidaTipicaTokens, e.output_max || saidaTipicaTokens); x.saidaMax += e.output_max || saidaTipicaTokens;
  }
  const usd = (tokens, preco) => (preco == null ? null : (tokens / 1e6) * preco);
  const detalhe = {}; let totalTipico = 0; let totalMax = 0; let semPreco = false;
  for (const [p, x] of Object.entries(porProvider)) {
    const pr = precos[p] || {};
    const tipico = usd(x.entradaTokens, pr.entrada) == null || usd(x.saidaTipica, pr.saida) == null ? null : usd(x.entradaTokens, pr.entrada) + usd(x.saidaTipica, pr.saida);
    const max = usd(x.entradaTokens * fatorPiorCasoEntrada, pr.entrada) == null || usd(x.saidaMax, pr.saida) == null ? null : usd(x.entradaTokens * fatorPiorCasoEntrada, pr.entrada) + usd(x.saidaMax, pr.saida);
    detalhe[p] = { ...x, usdTipico: tipico == null ? null : Number(tipico.toFixed(3)), usdMaximo: max == null ? null : Number(max.toFixed(3)), precoAusente: tipico == null };
    if (tipico == null) semPreco = true; else { totalTipico += tipico; totalMax += max; }
  }
  const casos = new Set(artefatos.map((a) => a.case_id)).size;
  const embTokens = casos * subconsultasPorCaso * tokensPorSubconsulta * 2; // candidato + current, ambos embedam
  const embUsd = usd(embTokens, (precos.embedding || {}).entrada);
  return { chamadasDeGeracao: chamadas, chamadasDeEmbedding: casos * 2, detalhe, embeddingUsd: embUsd == null ? null : Number(embUsd.toFixed(5)), totalTipicoUsd: semPreco ? null : Number((totalTipico + (embUsd || 0)).toFixed(3)), totalMaximoUsd: semPreco ? null : Number((totalMax + (embUsd || 0)).toFixed(3)), observacao: semPreco ? 'Preço de pelo menos um provider não informado: informe `precos` para obter o total.' : 'Estimativa; piora a entrada em ' + fatorPiorCasoEntrada + 'x e usa o teto de tokens de saída no cenário máximo.' };
}

module.exports = { estimarCustoBenchmark, PRECOS_PADRAO };
