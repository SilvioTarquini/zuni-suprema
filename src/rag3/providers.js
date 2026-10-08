'use strict';
// rag3/providers.js — adaptadores de geração. NESTA FASE só montam e validam o payload (nenhuma chamada de rede).
// generate() exige a trava de chamadas pagas E um transporte HTTP injetado; sem isso, lança PaidCallBlockedError.
const { exigirAutorizacaoPaga } = require('./paidGuard');
const { ProviderError, normalizarErroDeProvider } = require('./generation');
const { estimarTokens } = require('./util');

class GenerationProvider {
  constructor(nome, cfg) { this.nome = nome; this.cfg = cfg; }
  // eslint-disable-next-line no-unused-vars
  toPayload(req) { throw new Error('RAG3_PROVIDER_NAO_IMPLEMENTADO'); }
  // eslint-disable-next-line no-unused-vars
  parseResposta(json) { throw new Error('RAG3_PROVIDER_NAO_IMPLEMENTADO'); }
  estimarEntrada(req) { return estimarTokens(req.systemText.length + req.messages.reduce((s, m) => s + m.content.length, 0)); }

  // transporte: async (payload) => json   (injetado pelo chamador do benchmark pago; nunca criado aqui)
  async generate(req, { transporte = null, env = process.env } = {}) {
    exigirAutorizacaoPaga('generate:' + this.nome, env);
    if (typeof transporte !== 'function') throw new ProviderError('transporte_ausente');
    const t0 = Date.now();
    try {
      const json = await transporte(this.toPayload(req));
      const r = this.parseResposta(json);
      return { provider: this.nome, model: this.cfg.modelo, text: r.text, usage: r.usage, latencyMs: Date.now() - t0 };
    } catch (e) { const n = normalizarErroDeProvider(e); throw new ProviderError(n.codigo, n.retryable); }
  }
}

// Anthropic exige que a conversa comece em "user" e alterna papéis: junta turnos consecutivos do mesmo papel.
function normalizarParaAnthropic(msgs) {
  const out = [];
  for (const m of msgs) { if (!out.length && m.role !== 'user') continue; if (out.length && out[out.length - 1].role === m.role) out[out.length - 1] = { role: m.role, content: out[out.length - 1].content + '\n\n' + m.content }; else out.push({ role: m.role, content: m.content }); }
  return out;
}

class AnthropicProvider extends GenerationProvider {
  constructor(cfg) { super('anthropic', cfg); }
  toPayload(req) {
    if (!this.cfg.modelo) throw new ProviderError('modelo_nao_definido');
    return { model: this.cfg.modelo, max_tokens: this.cfg.maxTokensSaida, system: req.systemText, messages: normalizarParaAnthropic(req.messages) };
  }
  parseResposta(json) {
    const bloco = json && Array.isArray(json.content) ? json.content.find((b) => b.type === 'text') : null;
    if (!bloco) throw new ProviderError('resposta_invalida');
    return { text: bloco.text, usage: { inputTokens: json.usage ? json.usage.input_tokens : null, outputTokens: json.usage ? json.usage.output_tokens : null } };
  }
}

class OpenAIProvider extends GenerationProvider {
  constructor(cfg) { super('openai', cfg); }
  toPayload(req) {
    if (!this.cfg.modelo) throw new ProviderError('modelo_nao_definido');
    return { model: this.cfg.modelo, max_completion_tokens: this.cfg.maxTokensSaida, messages: [{ role: 'system', content: req.systemText }, ...req.messages.map((m) => ({ role: m.role, content: m.content }))] };
  }
  parseResposta(json) {
    const msg = json && Array.isArray(json.choices) && json.choices[0] && json.choices[0].message;
    if (!msg || typeof msg.content !== 'string') throw new ProviderError('resposta_invalida');
    return { text: msg.content, usage: { inputTokens: json.usage ? json.usage.prompt_tokens : null, outputTokens: json.usage ? json.usage.completion_tokens : null } };
  }
}

// Extrai o conteúdo editorial de um payload (para provar equivalência entre envelopes diferentes).
function conteudoEditorialDoPayload(payload) {
  if (payload.system !== undefined) return { system: payload.system, messages: payload.messages.map((m) => ({ role: m.role, content: m.content })) };
  const [sys, ...resto] = payload.messages; return { system: sys.content, messages: resto.map((m) => ({ role: m.role, content: m.content })) };
}

module.exports = { GenerationProvider, AnthropicProvider, OpenAIProvider, normalizarParaAnthropic, conteudoEditorialDoPayload };
