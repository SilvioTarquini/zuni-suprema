// Preload de TESTE (node -r): substitui Supabase, Anthropic e Resend por falsos em memória, para exercitar o servidor REAL
// (src/server.js) de ponta a ponta sem rede, sem banco, sem IA e sem e-mail de verdade.
// Controlado por: FAKE_DB_SEED (JSON de tabelas), FAKE_DB_DUMP (estado final, reescrito a cada escrita), FAKE_EMAIL_LOG (JSON por linha).
// NUNCA usar fora de testes.
const fs = require('fs');
const Module = require('module');

const tabelas = process.env.FAKE_DB_SEED && fs.existsSync(process.env.FAKE_DB_SEED) ? JSON.parse(fs.readFileSync(process.env.FAKE_DB_SEED, 'utf8')) : {};
const dump = () => { if (process.env.FAKE_DB_DUMP) fs.writeFileSync(process.env.FAKE_DB_DUMP, JSON.stringify(tabelas)); };
const tab = (n) => (tabelas[n] = tabelas[n] || []);
let autoId = 1;
const PADROES = { acessos_livros: { tipo_produto: 'livro' } }; // defaults do banco real

function casa(valor, padrao) { // ilike
  const re = new RegExp('^' + String(padrao).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
  return re.test(String(valor == null ? '' : valor));
}

function consulta(nome) {
  const q = { op: 'select', filtros: [], ordem: null, limite: null, payload: null, single: false, maybe: false, onConflict: null };
  const api = {
    select() { return api; },
    eq(c, v) { q.filtros.push((r) => r[c] === v); return api; },
    neq(c, v) { q.filtros.push((r) => r[c] !== v); return api; },
    is(c, v) { q.filtros.push((r) => (v === null ? r[c] == null : r[c] === v)); return api; },
    in(c, lista) { q.filtros.push((r) => lista.includes(r[c])); return api; },
    ilike(c, p) { q.filtros.push((r) => casa(r[c], p)); return api; },
    gt(c, v) { q.filtros.push((r) => r[c] > v); return api; },
    gte(c, v) { q.filtros.push((r) => r[c] >= v); return api; },
    lt(c, v) { q.filtros.push((r) => r[c] < v); return api; },
    lte(c, v) { q.filtros.push((r) => r[c] <= v); return api; },
    order(c, o) { q.ordem = { c, asc: !(o && o.ascending === false) }; return api; },
    limit(n) { q.limite = n; return api; },
    single() { q.single = true; return api; },
    maybeSingle() { q.maybe = true; return api; },
    insert(p) { q.op = 'insert'; q.payload = p; return api; },
    update(p) { q.op = 'update'; q.payload = p; return api; },
    upsert(p, o) { q.op = 'upsert'; q.payload = p; q.onConflict = o && o.onConflict; return api; },
    delete() { q.op = 'delete'; return api; },
    then(resolve, reject) { try { resolve(executar()); } catch (e) { reject ? reject(e) : resolve({ data: null, error: { message: e.message } }); } }
  };
  function executar() {
    const linhas = tab(nome);
    const filtrar = () => linhas.filter((r) => q.filtros.every((f) => f(r)));
    let data;
    if (q.op === 'insert') { const novos = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((p) => ({ id: autoId++, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...(PADROES[nome] || {}), ...p })); novos.forEach((n) => linhas.push(n)); dump(); data = novos; }
    else if (q.op === 'update') { data = filtrar(); data.forEach((r) => Object.assign(r, q.payload, { updated_at: new Date().toISOString() })); dump(); }
    else if (q.op === 'upsert') {
      const chave = q.onConflict || (nome === 'sessions' ? 'session_id' : 'id'); const p = Array.isArray(q.payload) ? q.payload : [q.payload]; data = [];
      for (const item of p) { const ex = linhas.find((r) => r[chave] !== undefined && r[chave] === item[chave]); if (ex) { Object.assign(ex, item, { updated_at: new Date().toISOString() }); data.push(ex); } else { const n = { created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...item }; linhas.push(n); data.push(n); } }
      dump();
    } else if (q.op === 'delete') { data = filtrar(); for (const r of data) linhas.splice(linhas.indexOf(r), 1); dump(); }
    else {
      data = filtrar();
      if (q.ordem) data = [...data].sort((a, b) => (a[q.ordem.c] > b[q.ordem.c] ? 1 : a[q.ordem.c] < b[q.ordem.c] ? -1 : 0) * (q.ordem.asc ? 1 : -1));
      if (q.limite != null) data = data.slice(0, q.limite);
    }
    if (q.single || q.maybe) { if (!data.length) return q.maybe ? { data: null, error: null } : { data: null, error: { code: 'PGRST116', message: 'sem linhas' } }; return { data: data[0], error: null }; }
    return { data, error: null };
  }
  return api;
}

const clienteFalso = { from: (n) => consulta(n), rpc: async () => ({ data: null, error: null }), auth: {}, storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: 'falso' } }) }) } };

const TEXTO_RELATORIO = '# Síntese ZUNI Direciona\n\n## 1. O que você trouxe\nTexto de teste do relatório, sem conteúdo real.\n\n## 2. Pontos de atenção\n- Item um\n- Item dois\n\n## 3. Próximos passos\nPasso a passo de teste.\n';
const loadOriginal = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@supabase/supabase-js') return { createClient: () => clienteFalso };
  if (request === '@anthropic-ai/sdk') { class A { constructor() { this.messages = { create: async () => ({ content: [{ type: 'text', text: TEXTO_RELATORIO }], usage: { input_tokens: 10, output_tokens: 20 } }) }; } } A.default = A; A.Anthropic = A; return A; }
  if (request === 'resend') return { Resend: class { constructor() { this.emails = { send: async (args) => { if (process.env.FAKE_EMAIL_LOG) fs.appendFileSync(process.env.FAKE_EMAIL_LOG, JSON.stringify({ to: args.to, subject: args.subject, html: args.html, anexos: (args.attachments || []).map((a) => a.filename) }) + '\n'); return { data: { id: 'fake-' + autoId++ }, error: null }; } }; } } };
  return loadOriginal.apply(this, arguments);
};
