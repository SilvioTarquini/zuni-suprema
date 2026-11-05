// Fase de estrutura (parte A) — rota protegida GET /livros/:livroId com o HTML vindo do bucket privado. Stub do Storage, sem rede.
//
// Sobe a rota REAL (src/routes/livros.js) numa porta local e troca só o '@supabase/supabase-js' por um falso em memória:
//   - tabela acessos_livros (mesmo formato do banco);
//   - Storage com download() que serve html/<livroId>.html de um mapa e conta as chamadas.
// As requisições são feitas com o `curl` de verdade (processo separado) e a saída é impressa literalmente.
//
// Confere: sem token → 403; token inválido → 403; token válido → 200 com o HTML do bucket; além disso: token de outro livro,
// revogado e vencido → 403; objeto inexistente no bucket → 404; falha do Storage → 500; e que as OBRAS ATUAIS (arquivo em
// private/livros/) continuam servidas do disco, sem tocar no bucket.
// Uso: node scripts/testar-html-bucket-rota.js

const assert = require('assert');
const { execFile } = require('child_process');

process.env.SUPABASE_URL = 'https://fake-project.invalid';
process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
delete process.env.LIVRO_HTML_BUCKET;
process.env.LIVRO_HTML_CACHE_SEGUNDOS = '0'; // sem cache: cada requisição prova a origem
globalThis.fetch = async () => { throw new Error('rede proibida no teste'); };

const agora = Date.now();
const NOVA = 'obra-nova-so-no-bucket';        // não existe em private/livros/
const FALHA = 'obra-nova-storage-com-falha';  // o stub devolve erro 500 do Storage
const SEM_OBJETO = 'obra-nova-sem-objeto';    // tem acesso, mas não tem objeto no bucket
const ATUAL = 'consequencias-edicao-essencial'; // obra atual: arquivo no disco

const HTML_BUCKET = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Obra Nova</title></head><body><h1>CONTEUDO-DO-BUCKET-PRIVADO</h1><p>texto da obra</p></body></html>';
const objetos = { [`html/${NOVA}.html`]: HTML_BUCKET };

const db = { acessos_livros: [] };
const base = { email: 'x@x', tipo_produto: 'livro', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null };
for (const id of [NOVA, FALHA, SEM_OBJETO, ATUAL]) {
  db.acessos_livros.push(
    { ...base, livro_id: id, token: `ok-${id}`, data_expiracao: new Date(agora + 86400000).toISOString() },
    { ...base, livro_id: id, token: `vencido-${id}`, data_expiracao: new Date(agora - 1000).toISOString() },
    { ...base, livro_id: id, token: `revogado-${id}`, data_expiracao: new Date(agora + 86400000).toISOString(), revogado_em: new Date(agora - 5000).toISOString() }
  );
}

const downloads = [];
function construtor(tabela) {
  const filtros = [];
  const b = {
    select() { return b; },
    update() { return b; },
    eq(c, v) { filtros.push([c, v]); return b; },
    single() {
      const linha = db[tabela].find((r) => filtros.every(([c, v]) => r[c] === v));
      return Promise.resolve(linha ? { data: { ...linha }, error: null } : { data: null, error: { message: 'not found' } });
    },
    then(res, rej) { return Promise.resolve({ error: null }).then(res, rej); }
  };
  return b;
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = {
  id: supaPath, filename: supaPath, loaded: true,
  exports: {
    createClient: () => ({
      from: construtor,
      storage: {
        from: (bucket) => ({
          download: async (caminho) => {
            downloads.push({ bucket, caminho });
            if (caminho.includes(FALHA)) return { data: null, error: { message: 'erro interno simulado do storage', statusCode: '500' } };
            if (!(caminho in objetos)) return { data: null, error: { message: 'Object not found', statusCode: '404' } };
            return { data: new Blob([objetos[caminho]], { type: 'text/html' }), error: null };
          }
        })
      }
    })
  }
};

const express = require('express');
const app = express();
app.use('/', require('../src/routes/livros'));

function curl(porta, caminho) {
  return new Promise((resolve, reject) => {
    const url = `http://127.0.0.1:${porta}${caminho}`;
    execFile('curl', ['-s', '-i', '-m', '15', '--max-filesize', '60000000', '-o', '-', url], { maxBuffer: 80 * 1024 * 1024, encoding: 'buffer' }, (err, stdout) => {
      if (err && !stdout) return reject(err);
      const txt = stdout.toString('utf8');
      const sep = txt.indexOf('\r\n\r\n');
      const cab = txt.slice(0, sep), corpo = txt.slice(sep + 4);
      const status = parseInt((cab.match(/^HTTP\/[\d.]+ (\d+)/) || [])[1], 10);
      resolve({ url, status, cab, corpo });
    });
  });
}

let total = 0;
const falhas = [];
const LITERAL = [];
async function teste(nome, porta, caminho, esperado, extra) {
  total++;
  const r = await curl(porta, caminho);
  const trecho = r.corpo.replace(/\s+/g, ' ').slice(0, 90);
  const linha = `$ curl -s -i http://127.0.0.1:PORTA${caminho.length > 110 ? caminho.slice(0, 110) + '…' : caminho}\n  → HTTP ${r.status}  | primeiros bytes: ${trecho}`;
  LITERAL.push(`[${nome}]\n${linha}`);
  try {
    assert.strictEqual(r.status, esperado, `esperado ${esperado}, veio ${r.status}`);
    if (extra) extra(r);
    console.log(`  ok   ${nome}\n       ${linha.replace(/\n/g, '\n       ')}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}\n       ${linha.replace(/\n/g, '\n       ')}`);
  }
}

(async () => {
  const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const porta = servidor.address().port;
  const L = (id, t) => `/livros/${id}${t === undefined ? '' : '?token=' + t}`;

  console.log('A. Obra nova (HTML só no bucket privado)');
  await teste('sem token → 403', porta, L(NOVA), 403, (r) => assert.ok(!r.corpo.includes('CONTEUDO-DO-BUCKET-PRIVADO')));
  await teste('token inválido → 403', porta, L(NOVA, 'nao-existe'), 403, (r) => assert.ok(!r.corpo.includes('CONTEUDO-DO-BUCKET-PRIVADO')));
  const baixouAntes = downloads.length;
  await teste('token de OUTRO livro → 403', porta, L(NOVA, `ok-${ATUAL}`), 403);
  await teste('token revogado (reembolso) → 403', porta, L(NOVA, `revogado-${NOVA}`), 403);
  await teste('prazo vencido → 403', porta, L(NOVA, `vencido-${NOVA}`), 403);
  total++;
  try { assert.strictEqual(downloads.length, baixouAntes, 'os 403 não podem baixar nada do bucket'); console.log('  ok   nenhum dos acessos negados chegou ao Storage'); }
  catch (e) { falhas.push('403 sem download'); console.log('  FALHOU ' + e.message); }
  await teste('token válido → 200 com o HTML do bucket', porta, L(NOVA, `ok-${NOVA}`), 200, (r) => {
    assert.ok(r.corpo.includes('CONTEUDO-DO-BUCKET-PRIVADO'), 'corpo não veio do bucket');
    assert.ok(/text\/html/.test(r.cab));
    const d = downloads[downloads.length - 1];
    assert.deepStrictEqual(d, { bucket: 'zuni-livros-html-private', caminho: `html/${NOVA}.html` });
  });
  await teste('token válido, objeto inexistente no bucket → 404', porta, L(SEM_OBJETO, `ok-${SEM_OBJETO}`), 404);
  await teste('token válido, Storage com falha → 500 (sem vazar detalhe)', porta, L(FALHA, `ok-${FALHA}`), 500, (r) => assert.ok(!/simulado/.test(r.corpo)));

  console.log('A. Obra atual (arquivo em private/livros/) — continua pelo disco');
  const n0 = downloads.length;
  await teste(`${ATUAL}: sem token → 403`, porta, L(ATUAL), 403);
  await teste(`${ATUAL}: token válido → 200, do disco`, porta, L(ATUAL, `ok-${ATUAL}`), 200, (r) => assert.ok(r.corpo.length > 100000, 'HTML do disco deveria ser grande'));
  total++;
  try { assert.strictEqual(downloads.length, n0, 'obra atual não pode ir ao bucket'); console.log('  ok   a obra atual não tocou no bucket'); }
  catch (e) { falhas.push('obra atual toca bucket'); console.log('  FALHOU ' + e.message); }

  servidor.close();
  console.log(`\n${total - falhas.length}/${total} ok` + (falhas.length ? `\nFalhas: ${falhas.join('; ')}` : ''));
  process.exit(falhas.length ? 1 : 0);
})();
