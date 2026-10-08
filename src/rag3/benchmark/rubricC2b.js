'use strict';
// rag3/benchmark/rubricC2b.js — rubrica da rodada C2-B (avaliação humana CEGA). Estende a da C2-A sem alterá-la:
//   +naturalidade_elegancia_conversacional (0–5), +percepcao_de_fatores_nao_explicitados (0–5), +adequacao_ao_nivel_do_usuario (0–5, todos os casos),
//   penalidades: ai_like_style_penalty (0 a −2) e evasion_penalty (0 a −2).
// Nenhum PASS automático: as métricas são para decisão HUMANA.
const base = require('./rubric');

const DIMENSOES_C2B = Object.freeze([...base.DIMENSOES, 'naturalidade_elegancia_conversacional', 'percepcao_de_fatores_nao_explicitados', 'adequacao_ao_nivel_do_usuario']);
const PENALIDADES = Object.freeze(['ai_like_style_penalty', 'evasion_penalty']);
const CLASSIFICACOES = base.CLASSIFICACOES;
const OPCOES_PAGARIA = base.OPCOES_PAGARIA;

const PERGUNTAS = Object.freeze({
  acrescentou: 'O que esta resposta acrescentou além de uma resposta genérica?',
  pagaria: 'Esta resposta justificaria pagar pelo ZUNI Direciona? (YES / MAYBE / NO)',
  classificacao: 'Esta resposta parece: GENÉRICA / BOA / DIFERENCIADA / EXCEPCIONAL',
  nao_explicitado: 'Esta resposta percebeu algo importante que o usuário não perguntou explicitamente, mas que poderia mudar a compreensão do problema?',
  adequacao: 'A resposta ajustou linguagem, profundidade, quantidade de informação e orientação prática ao nível aparente de conhecimento e segurança do usuário, sem infantilizá-lo?',
  investigou: 'Esta resposta investigou ou percebeu algo que poderia mudar substancialmente a compreensão da situação?'
});

const GUIA_ADEQUACAO = Object.freeze({ 0: 'completamente inadequada ao usuário', 1: 'linguagem/profundidade claramente inadequadas', 2: 'alguma adaptação, mas ainda excessivamente técnica, simplista ou desorganizada', 3: 'adequada e compreensível', 4: 'muito bem adaptada ao contexto e ao usuário', 5: 'excepcionalmente calibrada: torna o assunto complexo compreensível sem empobrecê-lo nem infantilizar' });

// Critério de EXCELÊNCIA ZUNI — somente para avaliação humana; NÃO é instrução de geração e não entra em nenhum prompt.
const CRITERIO_ZUNI = 'Uma resposta ZUNI excepcional não é necessariamente a que demonstra mais conhecimento. É aquela que compreende melhor o que está acontecendo, utiliza o conhecimento pertinente, percebe fatores importantes que podem não ter sido explicitados e explica de maneira que aquela pessoa consiga realmente aproveitar.';

const GUIA_PENALIDADES = Object.freeze({
  ai_like_style_penalty: '0 a −2. Penalize, quando excessivos: listas artificiais, seções simétricas desnecessárias, emojis decorativos, repetição da pergunta, frases padronizadas de assistente, elogios artificiais, excesso de headings, estrutura previsível de chatbot, linguagem de template. Listas e estrutura continuam válidas quando melhoram genuinamente a resposta.',
  evasion_penalty: '0 a −2. Penalize quando a resposta poderia dar informação útil e segura, mas se limita desnecessariamente a "procure um profissional", "isso está fora do escopo", "não posso ajudar", redirecionamento genérico ou encaminhamento sem compreensão útil. Salvaguardas legítimas NÃO são penalizadas.'
});

const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

function validarAvaliacaoC2b(av) {
  const erros = [];
  for (const d of DIMENSOES_C2B) { const v = av.notas && av.notas[d]; if (!Number.isInteger(v) || v < 0 || v > 5) erros.push('nota inválida: ' + d); }
  for (const p of PENALIDADES) { const v = av[p]; if (!Number.isInteger(v) || v > 0 || v < -2) erros.push('penalidade inválida (0 a −2): ' + p); }
  for (const k of ['acrescentou', 'nao_explicitado', 'investigou']) if (typeof av[k] !== 'string' || av[k].trim().length < 2) erros.push('pergunta obrigatória sem resposta: ' + k);
  if (!OPCOES_PAGARIA.includes(av.pagaria)) erros.push('pagaria deve ser YES|MAYBE|NO');
  if (!CLASSIFICACOES.includes(av.classificacao)) erros.push('classificacao inválida');
  if (typeof av.resposta_generica !== 'boolean' || typeof av.erro_grave !== 'boolean') erros.push('flags booleanas ausentes');
  return { ok: erros.length === 0, erros };
}

// A nota ajustada soma as penalidades (negativas) à média das 13 dimensões; a recomendação de livro NÃO entra.
function notaAjustada(av) { return media(DIMENSOES_C2B.map((d) => av.notas[d])) + av.ai_like_style_penalty + av.evasion_penalty; }

function calcularMetricasC2b(avaliacoes, chave) {
  const porVariante = {}; const porCaso = {};
  for (const av of avaliacoes) {
    const variante = chave[av.item_id] && chave[av.item_id].mapa && chave[av.item_id].mapa[av.rotulo] && chave[av.item_id].mapa[av.rotulo].variante; if (!variante) continue;
    const ajustada = notaAjustada(av); const bruta = media(DIMENSOES_C2B.map((d) => av.notas[d]));
    (porVariante[variante] = porVariante[variante] || []).push({ ...av, ajustada, bruta });
    (porCaso[av.item_id] = porCaso[av.item_id] || {})[variante] = { ajustada, generica: av.resposta_generica };
  }
  const resumo = {};
  for (const [v, l] of Object.entries(porVariante)) {
    resumo[v] = { n: l.length, media_bruta: Number(media(l.map((x) => x.bruta)).toFixed(2)), media_ajustada: Number(media(l.map((x) => x.ajustada)).toFixed(2)), por_dimensao: Object.fromEntries(DIMENSOES_C2B.map((d) => [d, Number(media(l.map((x) => x.notas[d])).toFixed(2))])),
      ai_like_medio: Number(media(l.map((x) => x.ai_like_style_penalty)).toFixed(2)), evasion_medio: Number(media(l.map((x) => x.evasion_penalty)).toFixed(2)),
      pagaria: { YES: l.filter((x) => x.pagaria === 'YES').length, MAYBE: l.filter((x) => x.pagaria === 'MAYBE').length, NO: l.filter((x) => x.pagaria === 'NO').length },
      classificacao: Object.fromEntries(CLASSIFICACOES.map((c) => [c, l.filter((x) => x.classificacao === c).length])), erros_graves: l.filter((x) => x.erro_grave).length, genericas: l.filter((x) => x.resposta_generica).length };
  }
  const vs = {};
  for (const v of Object.keys(resumo)) { if (v === 'generic') continue; let vit = 0, emp = 0, der = 0; for (const d of Object.values(porCaso)) { if (!d[v] || !d.generic) continue; const delta = d[v].ajustada - d.generic.ajustada; if (d[v].generica) { if (delta > 0) emp++; else der++; continue; } if (delta > 0.25) vit++; else if (delta < -0.25) der++; else emp++; } vs[v] = { vitorias: vit, empates: emp, derrotas: der }; }
  return { resumo, contra_baseline: vs, aviso: 'Números para decisão HUMANA; nenhum PASS automático. A recomendação de livro é avaliada à parte.' };
}

module.exports = { DIMENSOES_C2B, PENALIDADES, PERGUNTAS, GUIA_PENALIDADES, GUIA_ADEQUACAO, CRITERIO_ZUNI, CLASSIFICACOES, OPCOES_PAGARIA, validarAvaliacaoC2b, notaAjustada, calcularMetricasC2b };
