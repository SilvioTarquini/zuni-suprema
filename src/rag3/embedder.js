'use strict';
// rag3/embedder.js — contrato de embeddings. Implementações:
//   HashEmbedder          local, determinístico, SEM rede (testes e experimentos offline);
//   PrecomputedEmbedder   devolve vetores já conhecidos (benchmarks offline com vetores armazenados);
//   OpenAIEmbedder        real (text-embedding-3-small), BLOQUEADO pela trava de chamadas pagas.
const { tokens, normalizarVetor } = require('./util');
const { exigirAutorizacaoPaga } = require('./paidGuard');

class Embedder {
  // eslint-disable-next-line no-unused-vars
  async embed(textos) { throw new Error('RAG3_EMBEDDER_NAO_IMPLEMENTADO'); }
}

function hashPalavra(p, dim, salt) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < p.length; i++) { h ^= p.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % dim;
}

class HashEmbedder extends Embedder {
  constructor(dim = 256) { super(); this.dim = dim; }
  async embed(textos) {
    return textos.map((t) => {
      const v = new Array(this.dim).fill(0); const tk = tokens(t);
      tk.forEach((p, i) => { v[hashPalavra(p, this.dim, 1)] += 1; if (i + 1 < tk.length) v[hashPalavra(p + ' ' + tk[i + 1], this.dim, 7)] += 0.5; });
      return normalizarVetor(v);
    });
  }
}

class PrecomputedEmbedder extends Embedder {
  constructor(mapa) { super(); this.mapa = mapa; }
  async embed(textos) { return textos.map((t) => { const v = this.mapa.get(t); if (!v) throw new Error('RAG3_VETOR_PRECOMPUTADO_AUSENTE'); return v; }); }
}

class OpenAIEmbedder extends Embedder {
  constructor({ apiKey = null, fetchImpl = null, modelo = 'text-embedding-3-small', env = process.env } = {}) { super(); this.apiKey = apiKey; this.fetchImpl = fetchImpl; this.modelo = modelo; this.env = env; }
  async embed(textos) {
    exigirAutorizacaoPaga('openai-embeddings', this.env);
    if (!this.apiKey || typeof this.fetchImpl !== 'function') throw new Error('RAG3_OPENAI_NAO_CONFIGURADO');
    const resp = await this.fetchImpl('https://api.openai.com/v1/embeddings', { method: 'POST', headers: { Authorization: 'Bearer ' + this.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.modelo, input: textos }) });
    const json = await resp.json();
    if (!json || !Array.isArray(json.data)) throw new Error('RAG3_EMBEDDING_INVALIDO');
    return json.data.map((d) => normalizarVetor(d.embedding));
  }
}

module.exports = { Embedder, HashEmbedder, PrecomputedEmbedder, OpenAIEmbedder };
