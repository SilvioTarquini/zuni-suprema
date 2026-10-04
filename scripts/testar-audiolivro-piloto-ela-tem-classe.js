// Piloto do storage privado (Stage 3B): "Ela Tem Classe" = PRIVATE, as outras 11 obras com áudio = LEGACY.
// Tudo com mocks, sem rede, sem banco: o '@supabase/supabase-js' é trocado por um falso em memória e a
// rota REAL (src/routes/livros.js) roda numa porta local, com o catálogo REAL.
//
// Uso: node scripts/testar-audiolivro-piloto-ela-tem-classe.js
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CHAVE_FALSA = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
const URL_FALSA = 'https://fake-project.invalid';
process.env.SUPABASE_URL = URL_FALSA;
process.env.SUPABASE_KEY = CHAVE_FALSA;
delete process.env.AUDIOLIVRO_SIGNED_URL_TTL_SECONDS;

const PILOTO = 'ela-tem-classe';
const BUCKET_PRIVADO = 'zuni-audiobooks-private';
const FORMATO_PATH = /^audio\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp3$/;
// SHA-256 das páginas de partes LEGACY geradas pela rota ORIGINAL de produção (commit 2d0c08c),
// com o catálogo real. Se as URLs dessas obras mudarem de propósito, atualize os valores.
const GOLDEN_LEGACY = {
  'alem-do-que-voce-ve': '5a202fb3df0368c5ee506ddae1165bb374a8d5a931cfe8c23fcbf0893d8c10bd',
  'alem-do-que-voce-sente': 'b9ba7678d848d3b38f35d55f7235c261e1a75d1ff7c6c67b740f8ee66e8ae98b'
};

// ── Mocks ────────────────────────────────────────────────────────────────
const eventos = [];
const estado = { chamadasFetch: 0 };
const db = { acessos_livros: [] };
globalThis.fetch = async () => { estado.chamadasFetch++; throw new Error('rede proibida no teste'); };

function construtor(tabela) {
  const filtros = []; let patch = null;
  const casa = r => filtros.every(([c, v]) => r[c] === v);
  const b = {
    select() { return b; }, update(p) { patch = p; return b; }, eq(c, v) { filtros.push([c, v]); return b; },
    single() {
      const linha = db[tabela].find(casa);
      eventos.push(`auth:${(filtros.find(([c]) => c === 'token') || [])[1]}:${linha ? 'ok' : 'fail'}`);
      return Promise.resolve(linha ? { data: { ...linha }, error: null } : { data: null, error: { message: 'not found' } });
    },
    then(res, rej) { if (patch) db[tabela].filter(casa).forEach(r => Object.assign(r, patch)); return Promise.resolve({ error: null }).then(res, rej); }
  };
  return b;
}
function createClientFalso() {
  return {
    from: tabela => construtor(tabela),
    storage: { from: bucket => ({ createSignedUrl: async (caminho, ttl) => {
      eventos.push(`sign:${bucket}:${caminho}:${ttl}`);
      return { data: { signedUrl: `https://mock.invalid/storage/v1/object/sign/${bucket}/${caminho}?token=MOCKSIG&ttl=${ttl}` }, error: null };
    } }) }
  };
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: createClientFalso } };

const { CATALOGO, buscarLivro, serializarLivroPublico, serializarLivroCatalogo } = require('../src/lib/catalogoLivros');
const storage = require('../src/lib/audiolivroStorage');

const idsReais = Object.keys(CATALOGO).filter(id => !CATALOGO[id].teaser);
const comAudio = idsReais.filter(id => CATALOGO[id].audiobookDisponivel === true);
const legacy = comAudio.filter(id => id !== PILOTO);
const snapshotCatalogo = JSON.stringify(CATALOGO);
const piloto = CATALOGO[PILOTO];

const agora = Date.now();
[PILOTO, ...legacy].forEach(id => {
  const base = { livro_id: id, email: 'x@x', data_pagamento: new Date(agora).toISOString(), usado_em: null, revogado_em: null };
  db.acessos_livros.push(
    { ...base, token: `ok-${id}`, tipo_produto: 'livro', data_expiracao: new Date(agora + 86400000).toISOString() },
    { ...base, token: `aud-${id}`, tipo_produto: 'audiolivro', data_expiracao: new Date(agora + 86400000).toISOString() },
    { ...base, token: `exp-${id}`, tipo_produto: 'livro', data_expiracao: new Date(agora - 1000).toISOString() },
    { ...base, token: `rev-${id}`, tipo_produto: 'livro', data_expiracao: new Date(agora + 86400000).toISOString(), revogado_em: new Date(agora - 5000).toISOString() }
  );
});

let total = 0; const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message}`); }
}
const respostas = [];
function criarCliente(porta) {
  return url => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: porta, path: url }, res => {
      let corpo = ''; res.on('data', d => corpo += d);
      res.on('end', () => { const r = { status: res.statusCode, headers: res.headers, corpo }; respostas.push(JSON.stringify(r)); resolve(r); });
    }).on('error', reject);
  });
}
const marca = () => eventos.length;
const assinaturasDesde = m => eventos.slice(m).filter(e => e.startsWith('sign:')).length;

(async () => {
  console.log('Catálogo real');
  await teste('só "Ela Tem Classe" tem audiobookStorage (1 privada, 11 legacy)', () => {
    assert.strictEqual(comAudio.length, 12);
    assert.deepStrictEqual(idsReais.filter(id => 'audiobookStorage' in CATALOGO[id]), [PILOTO]);
    assert.strictEqual(storage.classificarAudiolivro(piloto).modelo, 'private');
    assert.strictEqual(legacy.length, 11);
    legacy.forEach(id => assert.strictEqual(storage.classificarAudiolivro(CATALOGO[id]).modelo, 'legacy', id));
  });
  await teste('piloto: bucket privado e path opaco (audio/<uuid>.mp3), sem PII; legacy mantido como fallback', () => {
    assert.strictEqual(piloto.audiobookStorage.bucket, BUCKET_PRIVADO);
    assert.match(piloto.audiobookStorage.path, FORMATO_PATH);
    assert.ok(!/ela|classe|@|token|payment/i.test(piloto.audiobookStorage.path));
    assert.ok(piloto.audiobookUrl.includes('/audiolivros/ela-tem-classe/'));
    assert.deepStrictEqual(Object.keys(piloto.audiobookStorage).sort(), ['bucket', 'path']);
  });
  await teste('piloto: preço, audiobookDisponivel e precoAudiobook inalterados', () => {
    assert.strictEqual(piloto.preco, 37.9);
    assert.strictEqual(piloto.audiobookDisponivel, true);
    assert.strictEqual(piloto.precoAudiobook, 19.9);
  });
  await teste('se o mapa local existir, o path do catálogo é exatamente o do mapa (senão, ignorado)', () => {
    const mapa = path.join(RAIZ, '..', 'audiolivros-migracao-privada', 'mapa-migracao.json');
    if (!fs.existsSync(mapa)) { console.log('       (mapa local ausente — verificação ignorada)'); return; }
    const itens = JSON.parse(fs.readFileSync(mapa, 'utf8')).itens.filter(i => i.livroId === PILOTO);
    assert.strictEqual(itens.length, 1);
    assert.strictEqual(piloto.audiobookStorage.path, itens[0].destinationPath);
  });

  console.log('APIs públicas não expõem o storage');
  await teste('listagem e individual de TODAS as obras: sem audiobookStorage, bucket, path, .mp3 nem URL do Supabase', () => {
    const textos = [JSON.stringify(idsReais.map(id => serializarLivroPublico(CATALOGO[id]))), ...idsReais.map(id => JSON.stringify(serializarLivroCatalogo(id, CATALOGO[id])))];
    textos.forEach(t => {
      ['audiobookStorage', BUCKET_PRIVADO, piloto.audiobookStorage.path, 'audiobookUrl', 'audiobookPartes', '.mp3', 'supabase.co', '/storage/v1/'].forEach(x => assert.ok(!t.includes(x), x));
      assert.ok(!/"bucket"/.test(t));
    });
  });
  await teste('metadata comercial do piloto continua pública (audiobookDisponivel, precoAudiobook)', () => {
    const lista = serializarLivroPublico(piloto), indiv = serializarLivroCatalogo(PILOTO, piloto);
    assert.strictEqual(lista.audiobookDisponivel, true); assert.strictEqual(lista.precoAudiobook, 19.9);
    assert.strictEqual(indiv.audiobookDisponivel, true); assert.strictEqual(indiv.precoAudiobook, 19.9); assert.strictEqual(indiv.preco, 37.9);
  });

  const express = require('express');
  const app = express();
  app.use('/', require('../src/routes/livros'));
  const servidor = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const get = criarCliente(servidor.address().port);

  try {
    console.log('Rota privada (piloto)');
    await teste('token válido: autentica, assina uma vez e redireciona com Cache-Control: no-store', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${PILOTO}?token=ok-${PILOTO}`);
      assert.strictEqual(r.status, 302);
      assert.strictEqual(r.headers.location, `https://mock.invalid/storage/v1/object/sign/${BUCKET_PRIVADO}/${piloto.audiobookStorage.path}?token=MOCKSIG&ttl=14400`);
      assert.match(r.headers['cache-control'], /no-store/);
      assert.deepStrictEqual(eventos.slice(m), [`auth:ok-${PILOTO}:ok`, `sign:${BUCKET_PRIVADO}:${piloto.audiobookStorage.path}:14400`]);
    });
    await teste('token do tipo audiolivro também abre (mesma regra de antes)', async () => {
      assert.strictEqual((await get(`/audiolivros/${PILOTO}?token=aud-${PILOTO}`)).status, 302);
    });
    await teste('o redirect não aponta para o bucket público antigo', async () => {
      const r = await get(`/audiolivros/${PILOTO}?token=ok-${PILOTO}`);
      assert.ok(!r.headers.location.includes('/object/public/') && !r.headers.location.includes('audiolivros/ela-tem-classe'));
    });
    await teste('token inválido (ausente, lixo, de outra obra): 403, sem assinar e sem vazar storage', async () => {
      const m = marca();
      for (const q of ['', '?token=lixo', `?token=ok-${legacy[0]}`]) {
        const r = await get(`/audiolivros/${PILOTO}${q}`);
        assert.strictEqual(r.status, 403);
        [BUCKET_PRIVADO, piloto.audiobookStorage.path, 'MOCKSIG'].forEach(x => assert.ok(!r.corpo.includes(x) && !(r.headers.location || '').includes(x)));
      }
      assert.strictEqual(assinaturasDesde(m), 0);
    });
    await teste('token expirado e token revogado: 403 e nenhuma assinatura', async () => {
      const m = marca();
      for (const t of ['exp', 'rev']) assert.strictEqual((await get(`/audiolivros/${PILOTO}?token=${t}-${PILOTO}`)).status, 403);
      assert.strictEqual(assinaturasDesde(m), 0);
    });
    await teste('ROLLBACK: se audiobookStorage for removido, a obra volta ao redirect legacy', async () => {
      const original = CATALOGO[PILOTO];
      const { audiobookStorage, ...semStorage } = original;
      CATALOGO[PILOTO] = semStorage;
      try {
        const m = marca();
        const r = await get(`/audiolivros/${PILOTO}?token=ok-${PILOTO}`);
        assert.strictEqual(r.status, 302);
        assert.strictEqual(r.headers.location, original.audiobookUrl);
        assert.strictEqual(assinaturasDesde(m), 0);
      } finally { CATALOGO[PILOTO] = original; }
      assert.strictEqual(JSON.stringify(CATALOGO), snapshotCatalogo);
    });

    console.log('Coexistência: as outras 11 obras seguem LEGACY');
    await teste('obras de parte única legacy: redirect para a URL pública atual, sem assinar, sem no-store', async () => {
      const unicas = legacy.filter(id => CATALOGO[id].audiobookUrl);
      assert.strictEqual(unicas.length, 9);
      for (const id of unicas) {
        const m = marca();
        const r = await get(`/audiolivros/${id}?token=ok-${id}`);
        assert.strictEqual(r.status, 302, id);
        assert.strictEqual(r.headers.location, CATALOGO[id].audiobookUrl, id);
        assert.ok(!r.headers['cache-control'] || !/no-store/.test(r.headers['cache-control']), id);
        assert.strictEqual(assinaturasDesde(m), 0, id);
      }
    });
    await teste('Além do Que Você Vê/Sente (multipartes): página legacy idêntica byte a byte à da rota original (2d0c08c)', async () => {
      for (const id of ['alem-do-que-voce-ve', 'alem-do-que-voce-sente']) {
        const m = marca();
        const r = await get(`/audiolivros/${id}?token=ok-${id}`);
        assert.strictEqual(r.status, 200, id);
        assert.ok(!('audiobookStorage' in CATALOGO[id]) && !CATALOGO[id].audiobookUrl, id);
        CATALOGO[id].audiobookPartes.forEach((u, i) => assert.ok(r.corpo.includes(`<a href="${u}" class="parte-audiolivro">Parte ${i + 1} de ${CATALOGO[id].audiobookPartes.length}</a>`), id));
        assert.strictEqual(crypto.createHash('sha256').update(r.corpo).digest('hex'), GOLDEN_LEGACY[id], id);
        assert.strictEqual(assinaturasDesde(m), 0, id);
        assert.strictEqual((await get(`/audiolivros/${id}/parte/1?token=ok-${id}`)).status, 404, id);
      }
    });
    await teste('coexistência na mesma instância: piloto privado e legacy respondem cada um no seu modelo', async () => {
      const a = await get(`/audiolivros/${PILOTO}?token=ok-${PILOTO}`);
      const b = await get(`/audiolivros/${legacy[0]}?token=ok-${legacy[0]}`);
      assert.ok(a.headers.location.startsWith('https://mock.invalid/'));
      assert.strictEqual(b.headers.location, CATALOGO[legacy[0]].audiobookUrl);
    });

    console.log('Invariantes');
    await teste('toda assinatura foi precedida por uma autenticação ok', () => {
      let ult = null, n = 0;
      eventos.forEach(e => { if (e.startsWith('auth:')) ult = e; else if (e.startsWith('sign:')) { n++; assert.ok(ult && ult.endsWith(':ok'), e); ult = null; } });
      assert.ok(n >= 4);
    });
    await teste('nenhuma chave/URL de projeto em respostas; nenhuma chamada de rede; catálogo real intacto', () => {
      respostas.forEach(r => { assert.ok(!r.includes(CHAVE_FALSA)); assert.ok(!r.includes(URL_FALSA)); });
      assert.strictEqual(estado.chamadasFetch, 0);
      assert.strictEqual(JSON.stringify(CATALOGO), snapshotCatalogo);
    });
  } finally {
    servidor.close();
  }

  console.log(`\nTotal: ${total} | Passaram: ${total - falhas.length} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join(' | ')); process.exit(1); }
  console.log('OK — piloto: Ela Tem Classe privada; as outras 11 obras legacy; APIs públicas sem storage.');
})().catch(e => { console.error('ERRO NO TESTE:', e.stack || e.message); process.exit(1); });
