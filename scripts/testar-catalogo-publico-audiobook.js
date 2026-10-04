// Teste local (sem rede externa, sem banco, sem Stripe) de que as respostas
// públicas do catálogo não expõem a URL dos arquivos de audiobook, e de que a
// entrega autenticada (/audiolivros/:livroId) continua lendo os campos internos.
// Uso: node scripts/testar-catalogo-publico-audiobook.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const RAIZ = path.join(__dirname, '..');
const catalogoPath = require.resolve('../src/lib/catalogoLivros');
const acessoPath = require.resolve('../src/lib/acessoLivros');

// Mock do acesso: só o token 'token-ok' vale (nada de Supabase).
require.cache[acessoPath] = {
  id: acessoPath, filename: acessoPath, loaded: true,
  exports: { verificarAcesso: async (token) => (token === 'token-ok' ? { tipo_produto: 'livro' } : null) }
};

const { CATALOGO, buscarLivro, serializarLivroPublico, serializarLivroCatalogo } = require(catalogoPath);

let total = 0;
const falhas = [];
function teste(nome, fn) {
  total++;
  try { fn(); console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message}`); }
}
async function testeAsync(nome, fn) {
  total++;
  try { await fn(); console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message}`); }
}

const ids = Object.keys(CATALOGO).filter(id => !CATALOGO[id].teaser);
const idUnico = ids.find(id => CATALOGO[id].audiobookUrl);
const idPartes = ids.find(id => Array.isArray(CATALOGO[id].audiobookPartes) && CATALOGO[id].audiobookPartes.length);
const idSemAudio = ids.find(id => !CATALOGO[id].audiobookDisponivel && !CATALOGO[id].audiobookUrl && !CATALOGO[id].audiobookPartes);

// Reproduz exatamente o que /api/livros devolve (mesma composição do handler).
const listagem = Object.fromEntries(
  Object.entries(CATALOGO).filter(([, l]) => !l.teaser).map(([id, l]) => [id, serializarLivroPublico(l)])
);
const jsonListagem = JSON.stringify(listagem);

console.log('Catálogo público (listagem e individual)');
teste('A. listagem sem a chave audiobookUrl', () => {
  ids.forEach(id => assert.ok(!('audiobookUrl' in listagem[id]), id));
  assert.ok(!jsonListagem.includes('"audiobookUrl"'));
});
teste('B. listagem sem a chave audiobookPartes', () => {
  ids.forEach(id => assert.ok(!('audiobookPartes' in listagem[id]), id));
  assert.ok(!jsonListagem.includes('"audiobookPartes"'));
});
teste('A/B+. nenhuma URL de storage do audiobook em nenhum ponto da listagem', () => {
  assert.ok(!jsonListagem.includes('/storage/v1/object/'));
  assert.ok(!jsonListagem.includes('.mp3'));
});
const individuais = ids.map(id => JSON.stringify(serializarLivroCatalogo(id, buscarLivro(id))));
teste('C. individual sem audiobookUrl', () => {
  individuais.forEach(j => assert.ok(!j.includes('audiobookUrl')));
});
teste('D. individual sem audiobookPartes', () => {
  individuais.forEach(j => assert.ok(!j.includes('audiobookPartes') && !j.includes('/storage/v1/object/') && !j.includes('.mp3')));
});
teste('E. audiobookDisponivel preservado (listagem e individual)', () => {
  const esperado = ids.filter(id => CATALOGO[id].audiobookDisponivel === true);
  assert.strictEqual(esperado.length, 12);
  esperado.forEach(id => {
    assert.strictEqual(listagem[id].audiobookDisponivel, true, id);
    assert.strictEqual(serializarLivroCatalogo(id, buscarLivro(id)).audiobookDisponivel, true, id);
  });
});
teste('F. precoAudiobook preservado (listagem e individual)', () => {
  ids.filter(id => CATALOGO[id].precoAudiobook).forEach(id => {
    assert.strictEqual(listagem[id].precoAudiobook, CATALOGO[id].precoAudiobook, id);
    assert.strictEqual(serializarLivroCatalogo(id, buscarLivro(id)).precoAudiobook, CATALOGO[id].precoAudiobook, id);
  });
});
teste('G. obra sem audiobook continua normal', () => {
  assert.ok(idSemAudio);
  const pub = serializarLivroPublico(CATALOGO[idSemAudio]);
  assert.strictEqual(pub.titulo, CATALOGO[idSemAudio].titulo);
  assert.ok(!pub.audiobookDisponivel);
  const ind = serializarLivroCatalogo(idSemAudio, CATALOGO[idSemAudio]);
  assert.strictEqual(ind.audiobookDisponivel, false);
  assert.strictEqual(ind.precoAudiobook, null);
  assert.strictEqual(ind.preco, CATALOGO[idSemAudio].precoPromocional || CATALOGO[idSemAudio].preco);
});
teste('G+. metadata pública da loja preservada (título, preços, categoria, departamento, volume, capa, resumo, descrição, chat)', () => {
  ids.forEach(id => {
    const orig = CATALOGO[id], pub = listagem[id];
    ['titulo', 'preco', 'precoPromocional', 'precoOriginal', 'categoria', 'departamento', 'volume', 'capa', 'resumo', 'descricao', 'chatDisponivel', 'subtitulo']
      .forEach(campo => assert.strictEqual(pub[campo], orig[campo], `${id}.${campo}`));
  });
  assert.ok(!jsonListagem.includes('indicadoPara'));
  assert.ok(!(`${os_teaser()}` in listagem));
});
function os_teaser() { return Object.keys(CATALOGO).find(id => CATALOGO[id].teaser) || '__nenhum__'; }
teste('H. serialização não altera o catálogo interno', () => {
  const antes = JSON.stringify(CATALOGO);
  ids.forEach(id => { serializarLivroPublico(CATALOGO[id]); serializarLivroCatalogo(id, CATALOGO[id]); });
  assert.strictEqual(JSON.stringify(CATALOGO), antes);
  assert.ok(CATALOGO[idUnico].audiobookUrl.includes('/storage/v1/object/'));
  assert.ok(CATALOGO[idPartes].audiobookPartes.length >= 2);
  assert.ok(buscarLivro(idUnico).audiobookUrl);
});

console.log('Código-fonte das rotas públicas');
const serverSrc = fs.readFileSync(path.join(RAIZ, 'src/server.js'), 'utf8');
teste('server.js não referencia audiobookUrl/audiobookPartes em código (só em comentário)', () => {
  const codigo = serverSrc.split(/\r?\n/).filter(l => !l.trim().startsWith('//')).join(' ');
  assert.ok(!/audiobookUrl|audiobookPartes/.test(codigo));
});
teste('as duas rotas públicas usam os serializadores', () => {
  assert.ok(/serializarLivroPublico\(livro\)/.test(serverSrc));
  assert.ok(/res\.json\(serializarLivroCatalogo\(req\.params\.livroId, livro\)\)/.test(serverSrc));
});
teste('nenhum frontend público (public/, templates/) usa audiobookUrl/audiobookPartes', () => {
  const achados = [];
  (function varrer(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) varrer(p);
      else if (/\.(html|js)$/.test(e.name) && /audiobookUrl|audiobookPartes/.test(fs.readFileSync(p, 'utf8'))) achados.push(p);
    }
  })(path.join(RAIZ, 'public'));
  assert.deepStrictEqual(achados, []);
});

(async () => {
  console.log('Entrega autenticada /audiolivros/:livroId (router real, acesso simulado)');
  const express = require('express');
  const app = express();
  app.use('/', require('../src/routes/livros'));
  const servidor = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const porta = servidor.address().port;
  const get = (url) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: porta, path: url }, res => {
      let corpo = ''; res.on('data', d => corpo += d); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, corpo }));
    }).on('error', reject);
  });

  try {
    await testeAsync('I1. token válido + obra em parte única: redireciona para a URL interna', async () => {
      const r = await get(`/audiolivros/${idUnico}?token=token-ok`);
      assert.strictEqual(r.status, 302);
      assert.strictEqual(r.headers.location, CATALOGO[idUnico].audiobookUrl);
    });
    await testeAsync('I2. token válido + obra em partes: página lista as partes internas', async () => {
      const r = await get(`/audiolivros/${idPartes}?token=token-ok`);
      assert.strictEqual(r.status, 200);
      CATALOGO[idPartes].audiobookPartes.forEach(u => assert.ok(r.corpo.includes(u)));
    });
    await testeAsync('I3. sem token / token inválido continua bloqueado (403), sem vazar a URL', async () => {
      for (const q of ['', '?token=errado']) {
        const r = await get(`/audiolivros/${idUnico}${q}`);
        assert.strictEqual(r.status, 403);
        assert.ok(!r.corpo.includes('/storage/v1/object/'));
        assert.ok(!(r.headers.location || '').includes('/storage/'));
      }
    });
  } finally {
    servidor.close();
  }

  console.log(`\nTotal: ${total} | Passaram: ${total - falhas.length} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join(' | ')); process.exit(1); }
  console.log('OK — catálogo público sem URLs de audiobook; entrega autenticada preservada.');
})().catch(e => { console.error('ERRO NO TESTE:', e.message); process.exit(1); });
