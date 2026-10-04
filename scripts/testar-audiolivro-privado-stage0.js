// Stage 0 — entrega privada de audiolivro (URL assinada), TUDO com mocks, sem rede.
//
// Sobe a rota real (src/routes/livros.js) numa porta local e troca só o
// '@supabase/supabase-js' por um falso em memória (tabela acessos_livros + Storage),
// de modo que verificarAcesso (prazo, revogação, tipo) e o helper de URL assinada
// rodam o código de verdade. Obras privadas existem SÓ aqui, como fixtures em
// memória; o catálogo real não é alterado (e o teste confere isso).
//
// Uso: node scripts/testar-audiolivro-privado-stage0.js
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

// ── Mocks ────────────────────────────────────────────────────────────────
const eventos = [];            // 'auth:<token>:ok|fail' e 'sign:<bucket>:<path>:<ttl>'
const estado = { clientes: 0, falhaAoAssinar: false, chamadasFetch: 0 };
const db = { acessos_livros: [] };

globalThis.fetch = async () => { estado.chamadasFetch++; throw new Error('rede proibida no teste'); };

function construtor(tabela) {
  const filtros = [];
  let patch = null;
  const casa = r => filtros.every(([c, v]) => r[c] === v);
  const b = {
    select() { return b; },
    update(p) { patch = p; return b; },
    eq(c, v) { filtros.push([c, v]); return b; },
    single() {
      const linha = db[tabela].find(casa);
      const token = (filtros.find(([c]) => c === 'token') || [])[1];
      eventos.push(`auth:${token}:${linha ? 'ok' : 'fail'}`);
      return Promise.resolve(linha ? { data: { ...linha }, error: null } : { data: null, error: { message: 'not found' } });
    },
    then(res, rej) {
      if (patch) db[tabela].filter(casa).forEach(r => Object.assign(r, patch));
      return Promise.resolve({ error: null }).then(res, rej);
    }
  };
  return b;
}
function createClientFalso() {
  estado.clientes++;
  return {
    from: tabela => construtor(tabela),
    storage: {
      from: bucket => ({
        createSignedUrl: async (caminho, ttl) => {
          eventos.push(`sign:${bucket}:${caminho}:${ttl}`);
          if (estado.falhaAoAssinar) return { data: null, error: { message: 'falha simulada interna do storage' } };
          return { data: { signedUrl: `https://mock.invalid/storage/v1/object/sign/${bucket}/${caminho}?token=MOCKSIG&ttl=${ttl}` }, error: null };
        }
      })
    }
  };
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: createClientFalso } };

// ── Carrega o helper ANTES do resto: importar não pode abrir cliente ────────
const storage = require('../src/lib/audiolivroStorage');
const clientesAposImportarHelper = estado.clientes;

const { CATALOGO, serializarLivroPublico, serializarLivroCatalogo } = require('../src/lib/catalogoLivros');

// ── Fixtures (somente em memória) ─────────────────────────────────────────
const FX = {
  single: 'fx-priv-single',
  multi: 'fx-priv-multi',
  ambos: 'fx-priv-e-legacy',
  malformado: 'fx-priv-malformado',
  legacyMulti: 'fx-legacy-multi'
};
const BUCKET = 'fx-bucket-privado';
const fixtures = {
  [FX.single]: { titulo: 'Fixture Privada Única', audiobookDisponivel: true, precoAudiobook: 9.9, audiobookStorage: { bucket: BUCKET, path: 'obra-unica/obra-unica.mp3' } },
  [FX.multi]: { titulo: 'Fixture Privada Multipartes', audiobookDisponivel: true, precoAudiobook: 9.9, audiobookStorage: { bucket: BUCKET, parts: [{ path: 'obra-multi/p1.mp3' }, { path: 'obra-multi/p2.mp3' }, { path: 'obra-multi/p3.mp3' }] } },
  [FX.ambos]: { titulo: 'Fixture Privada e Legacy', audiobookDisponivel: true, precoAudiobook: 9.9, audiobookUrl: 'https://legacy.invalid/ambos.mp3', audiobookStorage: { bucket: BUCKET, path: 'ambos/ambos.mp3' } },
  [FX.malformado]: { titulo: 'Fixture Privada Malformada', audiobookDisponivel: true, audiobookUrl: 'https://legacy.invalid/malformado.mp3', audiobookStorage: { bucket: '', path: 'x.mp3' } },
  [FX.legacyMulti]: { titulo: 'Fixture Legacy Multi', audiobookDisponivel: true, audiobookPartes: ['https://legacy.invalid/a-parte1.mp3', 'https://legacy.invalid/a-parte2.mp3'] }
};
const idsReais = Object.keys(CATALOGO).filter(id => !CATALOGO[id].teaser);
const idLegacyUnico = idsReais.find(id => CATALOGO[id].audiobookUrl);
const idLegacyPartes = idsReais.find(id => Array.isArray(CATALOGO[id].audiobookPartes) && CATALOGO[id].audiobookPartes.length);
const snapshotCatalogoReal = JSON.stringify(CATALOGO);
const snapshotFixtures = JSON.stringify(fixtures);
Object.assign(CATALOGO, JSON.parse(JSON.stringify(fixtures)));   // cópia: o objeto original nunca é tocado

// ── Acessos simulados: um conjunto de tokens por obra ────────────────────────
const agora = Date.now();
const idsComAcesso = [idLegacyUnico, idLegacyPartes, ...Object.values(FX)];
idsComAcesso.forEach(id => {
  const base = { livro_id: id, email: 'x@x', data_pagamento: new Date(agora).toISOString(), usado_em: null, revogado_em: null };
  db.acessos_livros.push(
    { ...base, token: `ok-${id}`, tipo_produto: 'livro', data_expiracao: new Date(agora + 86400000).toISOString() },
    { ...base, token: `aud-${id}`, tipo_produto: 'audiolivro', data_expiracao: new Date(agora + 86400000).toISOString() },
    { ...base, token: `exp-${id}`, tipo_produto: 'livro', data_expiracao: new Date(agora - 1000).toISOString() },
    { ...base, token: `rev-${id}`, tipo_produto: 'livro', data_expiracao: new Date(agora + 86400000).toISOString(), revogado_em: new Date(agora - 5000).toISOString() },
    { ...base, token: `tipo-${id}`, tipo_produto: 'mentor', data_expiracao: new Date(agora + 86400000).toISOString() }
  );
});

// ── Runner ────────────────────────────────────────────────────────────────
let total = 0;
const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message}`); }
}

const respostas = [];   // tudo que o "cliente" recebeu, para procurar vazamentos
function criarCliente(porta) {
  return (url) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: porta, path: url }, res => {
      let corpo = '';
      res.on('data', d => corpo += d);
      res.on('end', () => {
        const r = { status: res.statusCode, headers: res.headers, corpo };
        respostas.push(JSON.stringify(r));
        resolve(r);
      });
    }).on('error', reject);
  });
}
function marca() { return eventos.length; }
function desde(m) { return eventos.slice(m); }

(async () => {
  console.log('Helper e catálogo');
  await teste('helper: importar não abre cliente Supabase', () => assert.strictEqual(clientesAposImportarHelper, 0));
  await teste('TTL padrão = 14400 (constante e função)', () => {
    assert.strictEqual(storage.TTL_PADRAO_SEGUNDOS, 14400);
    assert.strictEqual(storage.obterTtlSegundos({}), 14400);
  });
  await teste('TTL configurável por AUDIOLIVRO_SIGNED_URL_TTL_SECONDS (valor válido)', () => {
    assert.strictEqual(storage.obterTtlSegundos({ AUDIOLIVRO_SIGNED_URL_TTL_SECONDS: '900' }), 900);
  });
  await teste('TTL inválido/zero/negativo/decimal cai no padrão', () => {
    ['', ' ', 'abc', '0', '-5', '1.5', '10s'].forEach(v =>
      assert.strictEqual(storage.obterTtlSegundos({ AUDIOLIVRO_SIGNED_URL_TTL_SECONDS: v }), 14400, `"${v}"`));
  });
  await teste('classificação: legacy, private, ambos (private vence), malformado (cai no legacy), nenhum', () => {
    assert.deepStrictEqual(storage.classificarAudiolivro(CATALOGO[idLegacyUnico]), { modelo: 'legacy', multipartes: false, total: 1 });
    assert.strictEqual(storage.classificarAudiolivro(CATALOGO[idLegacyPartes]).modelo, 'legacy');
    assert.strictEqual(storage.classificarAudiolivro(CATALOGO[idLegacyPartes]).multipartes, true);
    assert.deepStrictEqual(storage.classificarAudiolivro(CATALOGO[FX.single]), { modelo: 'private', multipartes: false, total: 1 });
    assert.deepStrictEqual(storage.classificarAudiolivro(CATALOGO[FX.multi]), { modelo: 'private', multipartes: true, total: 3 });
    assert.strictEqual(storage.classificarAudiolivro(CATALOGO[FX.ambos]).modelo, 'private');
    assert.strictEqual(storage.classificarAudiolivro(CATALOGO[FX.malformado]).modelo, 'legacy');
    assert.strictEqual(storage.classificarAudiolivro({}).modelo, 'nenhum');
    assert.strictEqual(storage.classificarAudiolivro(null).modelo, 'nenhum');
  });
  await teste('metadata private malformada nunca vira private', () => {
    const ruins = [
      { bucket: '', path: 'a.mp3' }, { bucket: 'b' }, { bucket: 'b', path: '' }, { bucket: 'b', parts: [] },
      { bucket: 'b', parts: [{}] }, { bucket: 'b', parts: [{ path: 'a' }, { path: ' ' }] }, 'texto', 42, []
    ];
    ruins.forEach(s => assert.strictEqual(storage.classificarAudiolivro({ audiobookStorage: s }).modelo, 'nenhum', JSON.stringify(s)));
  });
  await teste('resolverObjetoPrivado: partes 1..N válidas; fora do intervalo/inválidas = null', () => {
    assert.deepStrictEqual(storage.resolverObjetoPrivado(CATALOGO[FX.multi], 1), { bucket: BUCKET, path: 'obra-multi/p1.mp3' });
    assert.deepStrictEqual(storage.resolverObjetoPrivado(CATALOGO[FX.multi], 3), { bucket: BUCKET, path: 'obra-multi/p3.mp3' });
    [0, 4, -1, 1.5, NaN, '1', undefined].slice(0, 6).forEach(n => assert.strictEqual(storage.resolverObjetoPrivado(CATALOGO[FX.multi], n), null, String(n)));
    assert.strictEqual(storage.resolverObjetoPrivado(CATALOGO[idLegacyUnico], 1), null);
  });

  console.log('Vazamento no catálogo público');
  await teste('metadata privada não sai no catálogo público (listagem e individual)', () => {
    [FX.single, FX.multi, FX.ambos].forEach(id => {
      const lista = JSON.stringify(serializarLivroPublico(CATALOGO[id]));
      const indiv = JSON.stringify(serializarLivroCatalogo(id, CATALOGO[id]));
      [lista, indiv].forEach(j => {
        assert.ok(!j.includes('audiobookStorage'));
        assert.ok(!j.includes(BUCKET) && !j.includes('.mp3') && !j.includes('obra-'));
        assert.ok(!j.includes('audiobookUrl') && !j.includes('audiobookPartes'));
      });
      assert.strictEqual(serializarLivroPublico(CATALOGO[id]).audiobookDisponivel, true);
      assert.strictEqual(serializarLivroPublico(CATALOGO[id]).precoAudiobook, 9.9);
    });
  });
  await teste('catálogo real: 12 audiobooks continuam legacy, nenhum com audiobookStorage', () => {
    const comAudio = idsReais.filter(id => CATALOGO[id].audiobookDisponivel === true);
    assert.strictEqual(comAudio.length, 12);
    comAudio.forEach(id => {
      assert.ok(!('audiobookStorage' in CATALOGO[id]), id);
      assert.strictEqual(storage.classificarAudiolivro(CATALOGO[id]).modelo, 'legacy', id);
    });
    const listaPublica = JSON.stringify(idsReais.map(id => serializarLivroPublico(CATALOGO[id])));
    assert.ok(!listaPublica.includes('audiobookStorage') && !listaPublica.includes('"bucket"'));
  });
  await teste('nenhum arquivo de public/ ou templates/ conhece a chave nem audiobookStorage', () => {
    const achados = [];
    ['public', 'templates'].forEach(pasta => (function varrer(dir) {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) varrer(p);
        else if (/\.(html|js)$/.test(e.name)) {
          const t = fs.readFileSync(p, 'utf8');
          if (/audiobookStorage|SUPABASE_KEY|createSignedUrl/.test(t)) achados.push(p);
        }
      }
    })(path.join(RAIZ, pasta)));
    assert.deepStrictEqual(achados, []);
  });

  // ── Rota real ─────────────────────────────────────────────────────────────
  const express = require('express');
  const app = express();
  app.use('/', require('../src/routes/livros'));
  const servidor = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const get = criarCliente(servidor.address().port);
  const sessao = (id, tipo = 'ok') => `${tipo}-${id}`;

  try {
    console.log('Modelo LEGACY (comportamento atual preservado)');
    await teste('LEGACY SINGLE: redirect para a URL pública, sem assinatura, sem no-store', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${idLegacyUnico}?token=${sessao(idLegacyUnico)}`);
      assert.strictEqual(r.status, 302);
      assert.strictEqual(r.headers.location, CATALOGO[idLegacyUnico].audiobookUrl);
      assert.ok(!r.headers['cache-control'] || !/no-store/.test(r.headers['cache-control']));
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 0);
    });
    await teste('LEGACY MULTIPART (obra real): lista as URLs públicas atuais, sem assinatura', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${idLegacyPartes}?token=${sessao(idLegacyPartes)}`);
      assert.strictEqual(r.status, 200);
      CATALOGO[idLegacyPartes].audiobookPartes.forEach((u, i) => {
        assert.ok(r.corpo.includes(`<a href="${u}" class="parte-audiolivro">Parte ${i + 1} de ${CATALOGO[idLegacyPartes].audiobookPartes.length}</a>`));
      });
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 0);
    });
    await teste('LEGACY MULTIPART: HTML idêntico (SHA-256) ao gerado pela rota anterior ao Stage 0', async () => {
      const r = await get(`/audiolivros/${FX.legacyMulti}?token=${sessao(FX.legacyMulti)}`);
      assert.strictEqual(crypto.createHash('sha256').update(r.corpo).digest('hex'), '55f9229380a1a10c956d87d08fbb6a9e8e515ba59b74beeaa005de8cc7f5fd54');
    });
    await teste('LEGACY FALLBACK: metadata private malformada + audiobookUrl → redirect legacy', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${FX.malformado}?token=${sessao(FX.malformado)}`);
      assert.strictEqual(r.status, 302);
      assert.strictEqual(r.headers.location, 'https://legacy.invalid/malformado.mp3');
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 0);
    });
    await teste('LEGACY: rota de parte não existe para obra legacy (404 genérico, sem assinar)', async () => {
      const m = marca();
      for (const id of [idLegacyUnico, idLegacyPartes, FX.legacyMulti]) {
        const r = await get(`/audiolivros/${id}/parte/1?token=${sessao(id)}`);
        assert.strictEqual(r.status, 404);
        assert.strictEqual(r.corpo, 'Parte não encontrada.');
      }
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 0);
    });

    console.log('Modelo PRIVATE');
    await teste('PRIVATE SINGLE: autentica, assina uma vez (TTL 14400) e redireciona para a URL assinada', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${FX.single}?token=${sessao(FX.single)}`);
      assert.strictEqual(r.status, 302);
      assert.strictEqual(r.headers.location, `https://mock.invalid/storage/v1/object/sign/${BUCKET}/obra-unica/obra-unica.mp3?token=MOCKSIG&ttl=14400`);
      assert.match(r.headers['cache-control'], /no-store/);
      const ev = desde(m);
      assert.deepStrictEqual(ev, [`auth:${sessao(FX.single)}:ok`, `sign:${BUCKET}:obra-unica/obra-unica.mp3:14400`]);
    });
    await teste('PRIVATE SINGLE: token do tipo audiolivro também vale (mesma regra da rota)', async () => {
      const r = await get(`/audiolivros/${FX.single}?token=${sessao(FX.single, 'aud')}`);
      assert.strictEqual(r.status, 302);
    });
    await teste('PRIVATE + LEGACY na mesma obra: o privado vence', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${FX.ambos}?token=${sessao(FX.ambos)}`);
      assert.strictEqual(r.status, 302);
      assert.ok(r.headers.location.startsWith('https://mock.invalid/'));
      assert.ok(!r.headers.location.includes('legacy.invalid'));
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 1);
    });
    await teste('PRIVATE MULTIPART: a página lista links ZUNI e NÃO contém URL assinada, bucket nem caminho', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${FX.multi}?token=${sessao(FX.multi)}`);
      assert.strictEqual(r.status, 200);
      assert.match(r.headers['cache-control'], /no-store/);
      for (let n = 1; n <= 3; n++) {
        assert.ok(r.corpo.includes(`<a href="/audiolivros/${FX.multi}/parte/${n}?token=${sessao(FX.multi)}" class="parte-audiolivro">Parte ${n} de 3</a>`), `parte ${n}`);
      }
      ['mock.invalid', BUCKET, 'obra-multi', '.mp3', 'MOCKSIG', 'sign'].forEach(t => assert.ok(!r.corpo.includes(t), t));
      assert.deepStrictEqual(desde(m), [`auth:${sessao(FX.multi)}:ok`]);   // autenticou; nenhuma assinatura na listagem
    });
    await teste('PRIVATE PART 1: autentica, assina só a parte 1 e redireciona', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${FX.multi}/parte/1?token=${sessao(FX.multi)}`);
      assert.strictEqual(r.status, 302);
      assert.strictEqual(r.headers.location, `https://mock.invalid/storage/v1/object/sign/${BUCKET}/obra-multi/p1.mp3?token=MOCKSIG&ttl=14400`);
      assert.deepStrictEqual(desde(m), [`auth:${sessao(FX.multi)}:ok`, `sign:${BUCKET}:obra-multi/p1.mp3:14400`]);
    });
    await teste('PRIVATE PART N (última): assina só a parte 3', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${FX.multi}/parte/3?token=${sessao(FX.multi)}`);
      assert.strictEqual(r.status, 302);
      assert.ok(r.headers.location.includes('/obra-multi/p3.mp3?'));
      assert.deepStrictEqual(desde(m), [`auth:${sessao(FX.multi)}:ok`, `sign:${BUCKET}:obra-multi/p3.mp3:14400`]);
    });
    await teste('INVALID PART: 0, 4, -1, 1.5, abc → 404 genérico, sem assinar', async () => {
      const m = marca();
      for (const n of ['0', '4', '-1', '1.5', 'abc', '99999999999999999999']) {
        const r = await get(`/audiolivros/${FX.multi}/parte/${n}?token=${sessao(FX.multi)}`);
        assert.strictEqual(r.status, 404, n);
        assert.strictEqual(r.corpo, 'Parte não encontrada.', n);
        ['mock.invalid', BUCKET, 'obra-multi', 'mp3'].forEach(t => assert.ok(!r.corpo.includes(t)));
      }
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 0);
    });
    await teste('INVALID PART: obra privada de parte única não tem rota de parte (404)', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${FX.single}/parte/1?token=${sessao(FX.single)}`);
      assert.strictEqual(r.status, 404);
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 0);
    });

    console.log('Autenticação antes de assinar');
    const rotas = [
      id => `/audiolivros/${id}`,
      id => `/audiolivros/${id}/parte/1`
    ];
    await teste('INVALID TOKEN (ausente, lixo, de outra obra): 403 e nenhuma assinatura', async () => {
      const m = marca();
      for (const montar of rotas) {
        for (const q of ['', '?token=lixo', `?token=${sessao(FX.single)}`]) {
          const r = await get(`${montar(FX.multi)}${q}`);
          assert.strictEqual(r.status, 403, `${montar(FX.multi)}${q}`);
          ['mock.invalid', BUCKET, 'obra-multi', 'MOCKSIG'].forEach(t => assert.ok(!r.corpo.includes(t) && !(r.headers.location || '').includes(t)));
        }
      }
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 0);
    });
    await teste('EXPIRED TOKEN: 403 e nenhuma assinatura (página e parte)', async () => {
      const m = marca();
      for (const montar of rotas) {
        const r = await get(`${montar(FX.multi)}?token=${sessao(FX.multi, 'exp')}`);
        assert.strictEqual(r.status, 403);
      }
      const r2 = await get(`/audiolivros/${FX.single}?token=${sessao(FX.single, 'exp')}`);
      assert.strictEqual(r2.status, 403);
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 0);
    });
    await teste('REVOKED TOKEN: 403 e nenhuma assinatura (página e parte)', async () => {
      const m = marca();
      for (const montar of rotas) {
        const r = await get(`${montar(FX.multi)}?token=${sessao(FX.multi, 'rev')}`);
        assert.strictEqual(r.status, 403);
      }
      const r2 = await get(`/audiolivros/${FX.single}?token=${sessao(FX.single, 'rev')}`);
      assert.strictEqual(r2.status, 403);
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 0);
    });
    await teste('TIPO DE PRODUTO não permitido: 403 e nenhuma assinatura', async () => {
      const m = marca();
      const r = await get(`/audiolivros/${FX.single}?token=${sessao(FX.single, 'tipo')}`);
      assert.strictEqual(r.status, 403);
      assert.strictEqual(desde(m).filter(e => e.startsWith('sign:')).length, 0);
    });

    console.log('TTL e falhas');
    await teste('TTL CONFIG: AUDIOLIVRO_SIGNED_URL_TTL_SECONDS=900 chega ao createSignedUrl', async () => {
      process.env.AUDIOLIVRO_SIGNED_URL_TTL_SECONDS = '900';
      try {
        const m = marca();
        const r = await get(`/audiolivros/${FX.single}?token=${sessao(FX.single)}`);
        assert.ok(r.headers.location.endsWith('ttl=900'));
        assert.ok(desde(m).includes(`sign:${BUCKET}:obra-unica/obra-unica.mp3:900`));
        const r2 = await get(`/audiolivros/${FX.multi}/parte/2?token=${sessao(FX.multi)}`);
        assert.ok(r2.headers.location.endsWith('ttl=900'));
      } finally { delete process.env.AUDIOLIVRO_SIGNED_URL_TTL_SECONDS; }
    });
    await teste('TTL DEFAULT = 14400 na rota quando a variável não existe', async () => {
      const r = await get(`/audiolivros/${FX.single}?token=${sessao(FX.single)}`);
      assert.ok(r.headers.location.endsWith('ttl=14400'));
    });
    await teste('FALHA ao assinar: 500 genérico, sem vazar bucket, caminho nem mensagem interna', async () => {
      estado.falhaAoAssinar = true;
      const originalErr = console.error; console.error = () => {};
      try {
        for (const url of [`/audiolivros/${FX.single}?token=${sessao(FX.single)}`, `/audiolivros/${FX.multi}/parte/1?token=${sessao(FX.multi)}`]) {
          const r = await get(url);
          assert.strictEqual(r.status, 500);
          assert.strictEqual(r.corpo, 'Erro ao acessar o audiolivro. Tente novamente em instantes.');
          ['falha simulada', BUCKET, 'obra-', 'mock.invalid', CHAVE_FALSA].forEach(t => assert.ok(!r.corpo.includes(t)));
        }
      } finally { estado.falhaAoAssinar = false; console.error = originalErr; }
    });

    console.log('Invariantes globais');
    await teste('SIGNED URL só depois da autenticação: todo "sign" é precedido por um "auth ok"', () => {
      let ultimoAuth = null, nSign = 0;
      eventos.forEach(e => {
        if (e.startsWith('auth:')) ultimoAuth = e;
        else if (e.startsWith('sign:')) { nSign++; assert.ok(ultimoAuth && ultimoAuth.endsWith(':ok'), `sign sem auth ok: ${e}`); ultimoAuth = null; }
      });
      assert.ok(nSign >= 8);
    });
    await teste('NENHUMA chave/URL de projeto Supabase em qualquer resposta recebida', () => {
      respostas.forEach(r => { assert.ok(!r.includes(CHAVE_FALSA)); assert.ok(!r.includes(URL_FALSA)); });
      assert.ok(respostas.length > 30);
    });
    await teste('NENHUMA chamada de rede (fetch) durante os testes', () => assert.strictEqual(estado.chamadasFetch, 0));
    await teste('INTERNAL OBJECT NOT MUTATED: fixtures e catálogo real intactos', () => {
      ['single', 'multi', 'ambos', 'malformado', 'legacyMulti'].forEach(k => {
        assert.strictEqual(JSON.stringify(CATALOGO[FX[k]]), JSON.stringify(fixtures[FX[k]]), k);
      });
      assert.strictEqual(JSON.stringify(fixtures), snapshotFixtures);
      Object.values(FX).forEach(id => delete CATALOGO[id]);
      assert.strictEqual(JSON.stringify(CATALOGO), snapshotCatalogoReal);
    });
  } finally {
    servidor.close();
  }

  console.log(`\nTotal: ${total} | Passaram: ${total - falhas.length} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join(' | ')); process.exit(1); }
  console.log('OK — Stage 0: modelos legacy e private, assinatura só após autenticação, tudo com mocks.');
})().catch(e => { console.error('ERRO NO TESTE:', e.stack || e.message); process.exit(1); });
