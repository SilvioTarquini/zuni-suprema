'use strict';
// rag3/benchmark/lintResposta.js — INSTRUMENTO AUXILIAR de diagnóstico (função pura, sem rede, sem modelo).
// Mede propriedades superficiais de um texto de resposta (extensão, perguntas, estrutura, emojis, serviços de emergência, menção comercial)
// para apoiar a leitura humana. NÃO avalia qualidade semântica nem adequação clínica e NÃO substitui a avaliação cega:
// um alerta é um convite a revisar o texto, nunca uma reprovação automática; ausência de alertas não aprova nada.

const LIMITES_POUCO_CONTEXTO = Object.freeze({ maxCaracteres: 900, maxPerguntas: 1 });

const RE_LISTA = /^\s*(?:[-*•]\s+|\d{1,2}[.)]\s+)/;
const RE_CABECALHO = /^\s*#{1,6}\s+\S/;
const RE_EMOJI = /\p{Extended_Pictographic}/gu;
const RE_EMERGENCIA = /\b(?:188|192|CVV|SAMU)\b|pronto[- ]socorro|servi[cç]os? de emerg[eê]ncia/i;
const RE_COMERCIAL = /whatsapp|R\$|https?:\/\/|www\.|checkout|pre[cç]o/i;

/**
 * @param {string} texto resposta gerada
 * @param {{contexto?:'baixo'|'geral', indicioRisco?:boolean}} opcoes
 *   contexto 'baixo' = mensagem curta/vaga/emocional sem pedido de explicação, informação ou orientação (quem chama decide);
 *   indicioRisco = há sinal de risco na conversa (serviços de emergência e várias perguntas diretas deixam de gerar alerta).
 */
function lintResposta(texto, { contexto = 'geral', indicioRisco = false } = {}) {
  const t = String(texto || '');
  const linhas = t.split(/\r?\n/);
  const metricas = {
    caracteres: t.length,
    palavras: (t.trim().match(/\S+/g) || []).length,
    paragrafos: t.split(/\n\s*\n/).filter((p) => p.trim()).length,
    perguntas: (t.match(/\?/g) || []).length,
    itensDeLista: linhas.filter((l) => RE_LISTA.test(l)).length,
    cabecalhos: linhas.filter((l) => RE_CABECALHO.test(l)).length,
    negritos: (t.match(/\*\*[^*\n]+\*\*/g) || []).length,
    emojis: (t.match(RE_EMOJI) || []).length,
    servicosDeEmergencia: RE_EMERGENCIA.test(t),
    mencaoComercial: RE_COMERCIAL.test(t)
  };
  const alertas = [];
  if (metricas.mencaoComercial) alertas.push('mencao_comercial_no_texto');
  if (contexto === 'baixo') {
    if (metricas.caracteres > LIMITES_POUCO_CONTEXTO.maxCaracteres) alertas.push('extensa_para_pouco_contexto');
    if (!indicioRisco && metricas.perguntas > LIMITES_POUCO_CONTEXTO.maxPerguntas) alertas.push('varias_perguntas_sem_indicio_de_risco');
    if (metricas.itensDeLista > 0 || metricas.cabecalhos > 0) alertas.push('estrutura_de_lista_ou_cabecalho');
    if (!indicioRisco && metricas.servicosDeEmergencia) alertas.push('servico_de_emergencia_sem_indicio_de_risco');
    if (metricas.emojis > 0) alertas.push('emoji');
  }
  return { metricas, alertas, aviso: 'Instrumento auxiliar de diagnóstico: não avalia qualidade semântica nem adequação clínica e não substitui a avaliação cega.' };
}

module.exports = { lintResposta, LIMITES_POUCO_CONTEXTO };
