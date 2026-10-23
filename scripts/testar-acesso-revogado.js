// R2.8 — mensagem própria para acesso encerrado por reembolso. Mocks, sem rede.
//
// Sobe a rota real /livros/:livroId e troca só o '@supabase/supabase-js' por um
// falso em memória. Confere os três casos: token válido (200), vencido (403 com
// o texto de prazo expirado) e revogado (403 com o texto de reembolso).
//
// Uso: node scripts/testar-acesso-revogado.js
const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

process.env.SUPABASE_URL = 'https://fake-project.invalid';
process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
globalThis.fetch = async () => { throw new Error('rede proibida no teste'); };

const LIVRO = fs.readdirSync(path.join(__dirname, '..', 'private', 'livros')).find(d => !d.startsWith('_'));
const agora = Date.now();
const base = { livro_id: LIVRO, email: 'x@x', tipo_produto: 'livro', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null };
const db = {
  acessos_livros: [
    { ...base, token: 'valido', data_expiracao: new Date(agora + 86400000).toISOString() },
    { ...base, token: 'vencido', data_expiracao: new Date(agora - 1000).toISOString() },
    { ...base, token: 'revogado', data_expiracao: new Date(agora + 86400000).toISOString(), revogado_em: new Date(agora - 5000).toISOString() },
    { ...base, token: 'revogado-e-vencido', data_expiracao: new Date(agora - 1000).toISOString(), revogado_em: new Date(agora - 5000).toISOString() }
  ]
};

function construtor(tabela) {
  const filtros = [];
  const b = {
    select() { return b; },
    update() { return b; },
    eq(c, v) { filtros.push([c, v]); return b; },
    single() {
      const linha = db[tabela].find(r => filtros.every(([c, v]) => r[c] === v));
      return Promise.resolve(linha ? { data: { ...linha }, error: null } : { data: null, error: { message: 'not found' } });
    },
    then(res, rej) { return Promise.resolve({ error: null }).then(res, rej); }
  };
  return b;
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: () => ({ from: construtor }) } };

const express = require('express');
const { motivoNegacaoAcesso } = require('../src/lib/acessoLivros');

const TEXTO_REVOGADO = 'Este acesso foi encerrado porque o pagamento foi reembolsado';
const TEXTO_EXPIRADO = 'O prazo de acesso a este livro expirou';

function get(porta, url) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: porta, path: url }, res => {
      let corpo = '';
      res.on('data', d => corpo += d);
      res.on('end', () => resolve({ status: res.statusCode, corpo }));
    }).on('error', reject);
  });
}

let total = 0;
const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message}`); }
}

(async () => {
  const app = express();
  app.use('/', require('../src/routes/livros'));
  const servidor = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const porta = servidor.address().port;
  const url = t => `/livros/${LIVRO}?token=${t}`;

  console.log(`Rota /livros/${LIVRO}`);
  await teste('token válido: 200 e sem página de bloqueio', async () => {
    const r = await get(porta, url('valido'));
    assert.strictEqual(r.status, 200);
    assert(!r.corpo.includes(TEXTO_EXPIRADO) && !r.corpo.includes(TEXTO_REVOGADO));
  });
  await teste('token vencido: 403 com o texto de prazo expirado', async () => {
    const r = await get(porta, url('vencido'));
    assert.strictEqual(r.status, 403);
    assert(r.corpo.includes(TEXTO_EXPIRADO));
    assert(!r.corpo.includes(TEXTO_REVOGADO));
  });
  await teste('token revogado: 403 com o texto de reembolso, WhatsApp e botão', async () => {
    const r = await get(porta, url('revogado'));
    assert.strictEqual(r.status, 403);
    assert(r.corpo.includes(TEXTO_REVOGADO));
    assert(!r.corpo.includes(TEXTO_EXPIRADO));
    assert(r.corpo.includes('https://wa.me/5515996088895'));
    assert(r.corpo.includes('Voltar à loja'));
  });
  await teste('revogado e vencido ao mesmo tempo: vale o reembolso', async () => {
    const r = await get(porta, url('revogado-e-vencido'));
    assert(r.corpo.includes(TEXTO_REVOGADO));
  });
  await teste('token inexistente: 403 com a página "Não encontramos este acesso" (não diz que expirou nem que foi reembolsado)', async () => {
    const r = await get(porta, url('nao-existe'));
    assert.strictEqual(r.status, 403);
    assert(r.corpo.includes('Não encontramos este acesso'));
    assert(!r.corpo.includes(TEXTO_EXPIRADO) && !r.corpo.includes(TEXTO_REVOGADO));
  });
  await teste('sem token: 403 com a página "Não encontramos este acesso"', async () => {
    const r = await get(porta, `/livros/${LIVRO}`);
    assert.strictEqual(r.status, 403);
    assert(r.corpo.includes('Não encontramos este acesso'));
  });

  console.log('Helper motivoNegacaoAcesso (usado também pelo Livro-Vivo)');
  await teste('válido → null, vencido → expirado, revogado → revogado', async () => {
    assert.strictEqual(await motivoNegacaoAcesso('valido', LIVRO), null);
    assert.strictEqual(await motivoNegacaoAcesso('vencido', LIVRO), 'expirado');
    assert.strictEqual(await motivoNegacaoAcesso('revogado', LIVRO), 'revogado');
    assert.strictEqual(await motivoNegacaoAcesso('nao-existe', LIVRO), null);
    assert.strictEqual(await motivoNegacaoAcesso('', LIVRO), null);
  });

  servidor.close();
  console.log(`\n${total - falhas.length}/${total} testes passaram`);
  process.exit(falhas.length ? 1 : 0);
})();
