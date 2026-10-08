'use strict';
// rag3/benchmark/rubric.js — rubrica de SUPERIORIDADE ZUNI para avaliação CEGA (0–5) + métricas para a decisão HUMANA.
// O gate NÃO é automático: as funções aqui só organizam números e um checklist sugerido.
const DIMENSOES = Object.freeze(['profundidade', 'especificidade', 'compreensao_da_situacao', 'integracao_multidisciplinar', 'utilizacao_do_conhecimento', 'utilidade_pratica', 'clareza', 'seguranca', 'capacidade_de_revelar_algo_novo', 'valor_percebido']);
const PERGUNTA_ACRESCENTOU = 'O QUE ESTA RESPOSTA ACRESCENTOU QUE UMA IA GENERALISTA PROVAVELMENTE NÃO ACRESCENTARIA?';
const PERGUNTA_PAGARIA = 'ESTA RESPOSTA JUSTIFICARIA PAGAR PELO ZUNI DIRECIONA?';
const OPCOES_PAGARIA = Object.freeze(['YES', 'MAYBE', 'NO']);

function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function sementeDeTexto(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// Embaralha as variantes de cada caso (cego) de forma determinística pela semente; a CHAVE fica separada e só é aberta na análise.
function gerarFormularioCego({ artefatos, semente = 'zuni-rag3' }) {
  const porCaso = new Map(); for (const a of artefatos) { if (!a.response) continue; (porCaso.get(a.case_id) || porCaso.set(a.case_id, []).get(a.case_id)).push(a); }
  const itens = []; const chave = {};
  for (const [caso, lista] of porCaso) {
    const rnd = mulberry32(sementeDeTexto(semente + ':' + caso)); const ordem = [...lista];
    for (let i = ordem.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
    const rotulos = ordem.map((_, i) => String.fromCharCode(65 + i)); const itemId = 'item-' + caso;
    chave[itemId] = Object.fromEntries(ordem.map((a, i) => [rotulos[i], a.variant]));
    itens.push({ item_id: itemId, case_id: caso, respostas: ordem.map((a, i) => ({ rotulo: rotulos[i], texto: a.response })), campos_por_resposta: { notas: Object.fromEntries(DIMENSOES.map((d) => [d, '0-5'])), resposta_generica: 'true|false', erro_grave: 'true|false', acrescentou: PERGUNTA_ACRESCENTOU, pagaria: PERGUNTA_PAGARIA + ' (' + OPCOES_PAGARIA.join('|') + ')' } });
  }
  return { instrucoes: 'Avalie cada resposta de 0 a 5 em cada dimensão, sem saber qual sistema a gerou. Respostas genéricas não contam como vitória.', dimensoes: DIMENSOES, itens, chave };
}

function renderizarMarkdown(formulario) {
  const linhas = [`# Avaliação cega — ZUNI Superiority\n\n${formulario.instrucoes}\n`];
  for (const it of formulario.itens) {
    linhas.push(`\n## ${it.item_id} (${it.case_id})\n`);
    for (const r of it.respostas) { linhas.push(`### Resposta ${r.rotulo}\n\n${r.texto}\n`); linhas.push('Notas (0–5): ' + DIMENSOES.map((d) => `${d}: __`).join(' · ')); linhas.push(`Resposta genérica? __   Erro grave? __`); linhas.push(`${PERGUNTA_ACRESCENTOU}\n> __`); linhas.push(`${PERGUNTA_PAGARIA}  YES / MAYBE / NO: __\n`); }
  }
  return linhas.join('\n');
}

function validarAvaliacao(av) {
  const erros = [];
  for (const d of DIMENSOES) { const v = av.notas && av.notas[d]; if (!Number.isInteger(v) || v < 0 || v > 5) erros.push('nota inválida: ' + d); }
  if (typeof av.acrescentou !== 'string' || av.acrescentou.trim().length < 3) erros.push('pergunta obrigatória sem resposta: o que acrescentou');
  if (!OPCOES_PAGARIA.includes(av.pagaria)) erros.push('pergunta obrigatória sem resposta: pagaria (YES|MAYBE|NO)');
  if (typeof av.resposta_generica !== 'boolean' || typeof av.erro_grave !== 'boolean') erros.push('flags booleanas ausentes');
  return { ok: erros.length === 0, erros };
}

const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// avaliacoes: [{ item_id, rotulo, notas, resposta_generica, erro_grave, acrescentou, pagaria }]; chave: do formulário
function calcularMetricas(avaliacoes, chave) {
  const porVariante = {}; const porCaso = {};
  for (const av of avaliacoes) {
    const variante = chave[av.item_id] && chave[av.item_id][av.rotulo]; if (!variante) continue;
    const geral = media(DIMENSOES.map((d) => av.notas[d]));
    (porVariante[variante] = porVariante[variante] || []).push({ ...av, geral });
    const caso = av.item_id.replace('item-', ''); (porCaso[caso] = porCaso[caso] || {})[variante] = { geral, seguranca: av.notas.seguranca, generica: av.resposta_generica };
  }
  const resumo = {};
  for (const [v, lista] of Object.entries(porVariante)) {
    resumo[v] = { n: lista.length, media_geral: Number(media(lista.map((x) => x.geral)).toFixed(2)), por_dimensao: Object.fromEntries(DIMENSOES.map((d) => [d, Number(media(lista.map((x) => x.notas[d])).toFixed(2))])),
      pagaria: { YES: lista.filter((x) => x.pagaria === 'YES').length, MAYBE: lista.filter((x) => x.pagaria === 'MAYBE').length, NO: lista.filter((x) => x.pagaria === 'NO').length }, genericas: lista.filter((x) => x.resposta_generica).length, erros_graves: lista.filter((x) => x.erro_grave).length };
  }
  const vs = {};
  for (const v of Object.keys(resumo)) {
    if (v === 'generic') continue; let vit = 0, emp = 0, der = 0;
    for (const dados of Object.values(porCaso)) { if (!dados[v] || !dados.generic) continue; const d = dados[v].geral - dados.generic.geral; if (dados[v].generica) { if (d > 0) emp++; else der++; continue; } if (d > 0.25) vit++; else if (d < -0.25) der++; else emp++; }
    const gen = resumo.generic; const r = resumo[v];
    vs[v] = { vitorias: vit, empates: emp, derrotas: der, delta_seguranca: gen ? Number((r.por_dimensao.seguranca - gen.por_dimensao.seguranca).toFixed(2)) : null, delta_conhecimento_utilidade: gen ? Number((((r.por_dimensao.utilizacao_do_conhecimento + r.por_dimensao.utilidade_pratica) - (gen.por_dimensao.utilizacao_do_conhecimento + gen.por_dimensao.utilidade_pratica)) / 2).toFixed(2)) : null };
  }
  return { resumo, contra_baseline: vs, aviso: 'Números para decisão HUMANA; nenhum PASS automático.' };
}

// Sugestão inicial (NÃO impõe): o humano decide.
function sugerirGate(metricas, totalCasos) {
  const out = {};
  for (const [v, m] of Object.entries(metricas.contra_baseline)) {
    out[v] = {
      vence_em_maioria_clara: m.vitorias / totalCasos >= 0.7, nao_perde_em_seguranca: m.delta_seguranca !== null && m.delta_seguranca >= 0,
      ganho_perceptivel_conhecimento_utilidade: m.delta_conhecimento_utilidade !== null && m.delta_conhecimento_utilidade >= 0.5, sem_erro_grave: metricas.resumo[v].erros_graves === 0,
      genericas_nao_contam_como_vitoria: true, decisao: 'HUMANA', sugestao_apenas: true
    };
  }
  return out;
}

const CLASSIFICACOES = Object.freeze(['GENERICA', 'BOA', 'DIFERENCIADA', 'EXCEPCIONAL']);

module.exports = { mulberry32, sementeDeTexto, CLASSIFICACOES, DIMENSOES, PERGUNTA_ACRESCENTOU, PERGUNTA_PAGARIA, OPCOES_PAGARIA, gerarFormularioCego, renderizarMarkdown, validarAvaliacao, calcularMetricas, sugerirGate };
