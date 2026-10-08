'use strict';
// rag3/vectorStore.js — contrato de busca vetorial, SOMENTE LEITURA. Todo candidato devolvido preserva a PROVENIÊNCIA:
//   { id, title, source, path, theme, bookId, similarity, text }
// Implementações: InMemoryVectorStore (testes/offline) e SupabaseRpcVectorStore (RPCs de busca já existentes; sem escrita).
const { similaridadeL2 } = require('./util');
const { resolverObra } = require('./provenance');

class VectorStore {
  // eslint-disable-next-line no-unused-vars
  async search({ embedding, limit }) { throw new Error('RAG3_STORE_NAO_IMPLEMENTADO'); }
}

function enriquecer(b) {
  const obra = resolverObra({ source: b.source, title: b.title, bookId: b.bookId });
  return { id: String(b.id), title: b.title || '', source: b.source || '', path: b.path || '', theme: b.theme || null, bookId: obra.bookId, bookConfidence: obra.confianca, similarity: b.similarity, text: b.text || '' };
}

class InMemoryVectorStore extends VectorStore {
  // blocos: [{ id, title, source, path, theme, bookId?, text, embedding }]
  constructor(blocos) { super(); this.blocos = blocos; }
  async search({ embedding, limit }) {
    return this.blocos.map((b) => ({ b, s: similaridadeL2(embedding, b.embedding) })).sort((x, y) => y.s - x.s).slice(0, limit).map((x) => enriquecer({ ...x.b, similarity: x.s }));
  }
  // Emulação fiel da recuperação ATUAL de produção (buscar_documentos / buscar_documentos_ranqueado), usada só pelo adaptador CURRENT.
  async searchCurrent({ embedding, theme = null, total = 5 }) {
    const todos = this.blocos.map((b) => ({ b, s: similaridadeL2(embedding, b.embedding) })).sort((x, y) => y.s - x.s);
    if (!theme) return todos.slice(0, total).map((x) => enriquecer({ ...x.b, similarity: x.s }));
    const GRUPOS = { adolescentes: ['compreensao_da_vida_base_mentor', 'educar_filhos', 'sentimentos_adolescencia'] };
    const temas = GRUPOS[theme] || [theme]; const lim = Math.max(total * 5, 20);
    const pt = todos.filter((x) => temas.includes(x.b.theme)).slice(0, lim).map((x) => ({ ...x, o: 'tema' }));
    const ids = new Set(pt.map((x) => x.b.id));
    const pg = todos.filter((x) => !x.b.theme || !temas.includes(x.b.theme)).slice(0, lim).map((x) => ({ ...x, o: 'geral' })).filter((x) => !ids.has(x.b.id));
    const vistos = new Set(); const sd = [...pt, ...pg].sort((a, b) => b.s - a.s).filter((x) => { if (vistos.has(x.b.text)) return false; vistos.add(x.b.text); return true; });
    const porCam = {}; const ct = sd.filter((x) => { porCam[x.b.path] = (porCam[x.b.path] || 0) + 1; return porCam[x.b.path] <= 2; });
    const porT = {}; const grupo = ct.filter((x) => x.o === 'tema').filter((x) => { porT[x.b.theme] = (porT[x.b.theme] || 0) + 1; return porT[x.b.theme] <= 1; });
    const idsG = new Set(grupo.map((x) => x.b.id)); const piso = ct.filter((x) => x.o === 'tema' && !idsG.has(x.b.id)).slice(0, Math.max(Math.min(1, total) - grupo.length, 0));
    const sel = [...grupo, ...piso]; const idsS = new Set(sel.map((x) => x.b.id));
    const resto = ct.filter((x) => !idsS.has(x.b.id)).slice(0, Math.max(total - sel.length, 0));
    return [...sel, ...resto].sort((a, b) => b.s - a.s).slice(0, total).map((x) => enriquecer({ ...x.b, similarity: x.s }));
  }
}

const RPC_PERMITIDAS = Object.freeze(['buscar_documentos', 'buscar_documentos_ranqueado']);

class SupabaseRpcVectorStore extends VectorStore {
  // client: cliente supabase-js já criado pelo chamador. Esta classe só chama RPCs de BUSCA da lista permitida.
  constructor({ client }) { super(); if (!client || typeof client.rpc !== 'function') throw new Error('RAG3_CLIENTE_SUPABASE_AUSENTE'); this.client = client; }
  async _rpc(nome, args) {
    if (!RPC_PERMITIDAS.includes(nome)) throw new Error('RAG3_RPC_NAO_PERMITIDA');
    const { data, error } = await this.client.rpc(nome, args);
    if (error) { const e = new Error('RAG3_RPC_FALHOU'); e.codigo = 'rpc_error'; throw e; }
    return data || [];
  }
  _linha(r) { return enriquecer({ id: r.id, title: r.titulo, source: r.fonte, path: r.caminho, theme: r.tema_doc || null, text: r.corpo, similarity: r.similaridade }); }
  // Busca GLOBAL ampla (sem tema) com a RPC ranqueada: devolve tema_doc, fonte, caminho, título e similaridade.
  async search({ embedding, limit }) {
    const data = await this._rpc('buscar_documentos_ranqueado', { query_embedding: embedding, piso_tema: 0, total: limit, p_tema: null, teto_por_arquivo: 2, piso_por_tema: 0, teto_por_fonte: 0 });
    return data.map((r) => this._linha(r));
  }
  // Mesma chamada que a produção faz hoje (adaptador CURRENT).
  async searchCurrent({ embedding, theme = null, total = 5 }) {
    if (!theme) { const data = await this._rpc('buscar_documentos', { query_embedding: embedding, limite: total }); return data.map((r) => this._linha(r)); }
    const data = await this._rpc('buscar_documentos_ranqueado', { query_embedding: embedding, piso_tema: 1, total, p_tema: theme, teto_por_arquivo: 2, piso_por_tema: 1, teto_por_fonte: 0 });
    return data.map((r) => this._linha(r));
  }
}

module.exports = { VectorStore, InMemoryVectorStore, SupabaseRpcVectorStore, RPC_PERMITIDAS, enriquecer };
