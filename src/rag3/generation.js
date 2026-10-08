'use strict';
// rag3/generation.js — requisição de geração NEUTRA (independente de fornecedor) + baseline + verificação de equivalência.
// A mesma requisição neutra alimenta os adaptadores OpenAI e Claude: só o envelope muda (campo system vs. mensagem system, etc.).
const { sha256 } = require('./util');
const { BASELINE_MINIMO, BASELINE_COM_POLITICA_SEM_ACERVO } = require('./editorialPolicy');

const MAX_TURNOS = 12;
const MAX_CHARS_POR_TURNO = 4000;

// Histórico válido e IDÊNTICO para todos os providers: só user/assistant, trunca turnos longos, não começa em "assistant"
// e junta turnos consecutivos do mesmo papel (assim nenhum provider reescreve a conversa de um jeito diferente do outro).
function limparHistorico(historico) {
  const base = (Array.isArray(historico) ? historico : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNOS).map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS_POR_TURNO) }));
  const out = [];
  for (const m of base) { if (!out.length && m.role !== 'user') continue; if (out.length && out[out.length - 1].role === m.role) out[out.length - 1] = { role: m.role, content: out[out.length - 1].content + '\n\n' + m.content }; else out.push(m); }
  return out;
}

// A mensagem atual é sempre "user": se o histórico termina em "user", a fala é unida a ela em vez de gerar dois turnos seguidos.
function anexarMensagemAtual(historico, conteudoAtual) {
  const h = [...historico];
  if (h.length && h[h.length - 1].role === 'user') { const ult = h.pop(); return [...h, { role: 'user', content: ult.content + '\n\n' + conteudoAtual }]; }
  return [...h, { role: 'user', content: conteudoAtual }];
}

// Envelope neutro da mensagem atual. C2-B: antes do knowledge pack vão (opcionais) o modo de conhecimento e a orientação investigativa;
// são blocos de TEXTO idênticos para qualquer provider.
function envelopeDaMensagem(pack, mensagem, extras = {}) {
  if (!pack) return mensagem;
  const partes = [];
  if (extras.modo && extras.modo.bloco) partes.push(extras.modo.bloco);
  if (extras.orientacao && extras.orientacao.texto) partes.push(`<zuni_investigacao>\n${extras.orientacao.texto}\n</zuni_investigacao>`);
  partes.push(pack.text, `<mensagem_da_pessoa>\n${mensagem}\n</mensagem_da_pessoa>`);
  return partes.join('\n\n');
}

// Variante ZUNI: política única + knowledge pack + histórico + mensagem.
function buildGenerationRequest({ editorialPolicy, conversationContext = {}, knowledgePack, userMessage, modo = null, orientacao = null }) {
  if (!editorialPolicy || !editorialPolicy.texto) throw new Error('RAG3_POLITICA_AUSENTE');
  if (!knowledgePack || !knowledgePack.text) throw new Error('RAG3_KNOWLEDGE_PACK_AUSENTE');
  const historico = limparHistorico(conversationContext.history);
  const mensagens = anexarMensagemAtual(historico, envelopeDaMensagem(knowledgePack, String(userMessage || ''), { modo, orientacao }));
  return { variante: 'zuni', systemText: editorialPolicy.texto, messages: mensagens, hashes: { politica: editorialPolicy.hash, knowledgePack: knowledgePack.hash, modo: modo ? modo.hash : null, orientacao: orientacao && orientacao.texto ? sha256(orientacao.texto) : null, mensagens: sha256(JSON.stringify(mensagens)) }, meta: { statusConhecimento: knowledgePack.status, knowledgeMode: modo ? modo.modo : null, contribuicaoProprietaria: modo ? modo.contribuicaoProprietaria : null } };
}

// Baseline SEM RAG ZUNI. comPolitica=false → "IA generalista gratuita"; true → mesmas regras de segurança/estilo, sem acervo.
function buildBaselineRequest({ conversationContext = {}, userMessage, comPolitica = false }) {
  const historico = limparHistorico(conversationContext.history);
  const mensagens = anexarMensagemAtual(historico, String(userMessage || ''));
  return { variante: comPolitica ? 'baseline-politica' : 'baseline-generico', systemText: comPolitica ? BASELINE_COM_POLITICA_SEM_ACERVO : BASELINE_MINIMO, messages: mensagens, hashes: { politica: sha256(comPolitica ? BASELINE_COM_POLITICA_SEM_ACERVO : BASELINE_MINIMO), knowledgePack: null, mensagens: sha256(JSON.stringify(mensagens)) }, meta: { statusConhecimento: 'none' } };
}

// Os dois providers precisam ver exatamente a mesma política, o mesmo knowledge pack e as mesmas mensagens.
function verificarEquivalencia(a, b) {
  const problemas = [];
  if (a.hashes.politica !== b.hashes.politica) problemas.push('politica_diferente');
  if (a.hashes.knowledgePack !== b.hashes.knowledgePack) problemas.push('knowledge_pack_diferente');
  if ((a.hashes.modo || null) !== (b.hashes.modo || null)) problemas.push('modo_de_conhecimento_diferente');
  if ((a.hashes.orientacao || null) !== (b.hashes.orientacao || null)) problemas.push('orientacao_investigativa_diferente');
  if (a.hashes.mensagens !== b.hashes.mensagens) problemas.push('mensagens_diferentes');
  if (a.systemText !== b.systemText) problemas.push('system_diferente');
  return { equivalentes: problemas.length === 0, problemas };
}

// Erro de provider sempre sanitizado: nunca devolve a mensagem (pode conter trechos da requisição).
class ProviderError extends Error {
  constructor(codigo, retryable = false) { super('RAG3_PROVIDER_ERRO'); this.name = 'ProviderError'; this.codigo = codigo; this.retryable = retryable; }
}
function normalizarErroDeProvider(e) {
  if (e && e.name === 'PaidCallBlockedError') return { codigo: 'paid_call_blocked', retryable: false };
  const status = e && (e.status || e.statusCode);
  if (status === 429) return { codigo: 'rate_limited', retryable: true };
  if (status >= 500) return { codigo: 'provider_5xx', retryable: true };
  if (status >= 400) return { codigo: 'provider_4xx', retryable: false };
  return { codigo: String((e && (e.codigo || e.code || e.name)) || 'unknown').slice(0, 40), retryable: false };
}

module.exports = { buildGenerationRequest, buildBaselineRequest, verificarEquivalencia, ProviderError, normalizarErroDeProvider, limparHistorico, envelopeDaMensagem };
