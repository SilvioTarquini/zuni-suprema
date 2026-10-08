'use strict';
// rag3/paidGuard.js — trava de segurança: NENHUMA chamada paga (OpenAI/Anthropic) acontece sem autorização explícita.
// A autorização é uma variável de ambiente com valor literal, que só o operador define para o benchmark pago.
class PaidCallBlockedError extends Error {
  constructor(contexto) { super('RAG3_CHAMADA_PAGA_BLOQUEADA'); this.name = 'PaidCallBlockedError'; this.contexto = contexto || 'desconhecido'; }
}

const VALOR_AUTORIZACAO = 'I_AUTHORIZE_PAID_CALLS';

function chamadasPagasAutorizadas(env = process.env) { return env.RAG3_ALLOW_PAID_CALLS === VALOR_AUTORIZACAO; }

function exigirAutorizacaoPaga(contexto, env = process.env) {
  if (!chamadasPagasAutorizadas(env)) throw new PaidCallBlockedError(contexto);
}

module.exports = { PaidCallBlockedError, exigirAutorizacaoPaga, chamadasPagasAutorizadas, VALOR_AUTORIZACAO };
