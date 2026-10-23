// Rodada 3A — rota GET /livros/:livroId/pdf e botão "Baixar PDF" dos 4 leitores. Mocks, sem rede externa.
//
// Sobe a rota real (src/routes/livros.js) numa porta local e troca só o '@supabase/supabase-js' por um falso em memória
// (tabela acessos_livros + Storage que só registra createSignedUrl). Confere:
//   - os 4 casos do PDF: token válido (302 para URL assinada, attachment, nome amigável), token com prazo vencido mas não
//     revogado (302: o PDF é do cliente), token revogado (página "Acesso encerrado") e token inexistente (403);
//   - extras: sem token, token só de audiolivro, livro sem PDF, falha ao assinar, id inválido, nada de token na URL assinada;
//   - a página de prazo vencido oferece o PDF; a leitura no site continua bloqueada com prazo vencido;
//   - nos 4 leitores servidos, o botão "Baixar PDF" navega para /livros/<id>/pdf?token=… (e não há mais imprimir).
// Uso: node scripts/testar-pdf-livro-rota.js

const assert = require('assert');
const http = require('http');

process.env.SUPABASE_URL = 'https://fake-project.invalid';
process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
delete process.env.LIVRO_PDF_BUCKET;
delete process.env.LIVRO_PDF_SIGNED_URL_TTL_SECONDS;
globalThis.fetch = async () => { throw new Error('rede proibida no teste'); };

const agora = Date.now();
const LIVROS = ['da-terra-ao-resultado', 'vender-bem-vender-sempre', 'toda-mesa-tem-dois-lados', 'toda-reuniao-tem-duas-pautas'];
const NOMES = {
  'da-terra-ao-resultado': 'Da-Terra-ao-Resultado-ZUNI.pdf',
  'vender-bem-vender-sempre': 'Vender-Bem-Vender-Sempre-ZUNI.pdf',
  'toda-mesa-tem-dois-lados': 'Toda-Mesa-Tem-Dois-Lados-ZUNI.pdf',
  'toda-reuniao-tem-duas-pautas': 'Toda-Reuniao-Tem-Duas-Pautas-ZUNI.pdf'
};
const OUTRO = 'a-arquitetura-da-decisao-humana'; // livro real, sem PDF configurado

const db = { acessos_livros: [] };
const base = { email: 'x@x', tipo_produto: 'livro', data_pagamento: new Date(agora).toISOString(), usado_em: new Date(agora).toISOString(), revogado_em: null };
for (const id of [...LIVROS, OUTRO]) {
  db.acessos_livros.push(
    { ...base, livro_id: id, token: `ok-${id}`, data_expiracao: new Date(agora + 86400000).toISOString() },
    { ...base, livro_id: id, token: `vencido-${id}`, data_expiracao: new Date(agora - 1000).toISOString() },
    { ...base, livro_id: id, token: `revogado-${id}`, data_expiracao: new Date(agora + 86400000).toISOString(), revogado_em: new Date(agora - 5000).toISOString() },
    { ...base, livro_id: id, token: `audio-${id}`, tipo_produto: 'audiolivro', data_expiracao: new Date(agora + 86400000).toISOString() }
  );
}

const assinaturas = [];
const estado = { falhaAoAssinar: false };
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
          createSignedUrl: async (caminho, ttl, opcoes) => {
            assinaturas.push({ bucket, caminho, ttl, opcoes });
            if (estado.falhaAoAssinar) return { data: null, error: { message: 'falha simulada interna do storage' } };
            const dl = opcoes && opcoes.download ? `&download=${encodeURIComponent(opcoes.download)}` : '';
            return { data: { signedUrl: `https://mock.invalid/storage/v1/object/sign/${bucket}/${caminho}?token=ASSINATURA${dl}` }, error: null };
          }
        })
      }
    })
  }
};

const express = require('express');
const { lerLivroComPatch } = require('../src/lib/leitorMobile');
const path = require('path');

const TEXTO_REVOGADO = 'Este acesso foi encerrado porque o pagamento foi reembolsado';
const TEXTO_EXPIRADO = 'O prazo de acesso a este livro expirou';

function get(porta, url) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: porta, path: url }, (res) => {
      let corpo = '';
      res.on('data', (d) => corpo += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, corpo }));
    }).on('error', reject);
  });
}

let total = 0;
const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); }
}

(async () => {
  const app = express();
  app.use('/', require('../src/routes/livros'));
  const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const porta = servidor.address().port;
  const L = LIVROS[1]; // vender-bem-vender-sempre
  const pdf = (id, t) => `/livros/${id}/pdf${t === undefined ? '' : '?token=' + t}`;

  console.log('Rota /livros/:livroId/pdf — os 4 casos');
  await teste('1. token válido: 302 para URL assinada, attachment com nome amigável, sem cache', async () => {
    const antes = assinaturas.length;
    const r = await get(porta, pdf(L, `ok-${L}`));
    assert.strictEqual(r.status, 302);
    assert.ok(r.headers.location.startsWith('https://mock.invalid/storage/v1/object/sign/zuni-livros-pdf-private/pdf/' + L + '.pdf?token='), r.headers.location);
    assert.ok(r.headers.location.includes('download=' + encodeURIComponent(NOMES[L])), 'sem download= na URL assinada');
    assert.strictEqual(r.headers['cache-control'], 'no-store');
    const a = assinaturas[assinaturas.length - 1];
    assert.strictEqual(assinaturas.length, antes + 1);
    assert.deepStrictEqual(a, { bucket: 'zuni-livros-pdf-private', caminho: `pdf/${L}.pdf`, ttl: 300, opcoes: { download: NOMES[L] } });
  });
  await teste('2. prazo vencido, NÃO revogado: PERMITE o download (302)', async () => {
    const r = await get(porta, pdf(L, `vencido-${L}`));
    assert.strictEqual(r.status, 302);
    assert.ok(r.headers.location.includes('/pdf/' + L + '.pdf'));
  });
  await teste('3. token revogado (reembolso): 403 com a página "Acesso encerrado", sem assinar nada', async () => {
    const antes = assinaturas.length;
    const r = await get(porta, pdf(L, `revogado-${L}`));
    assert.strictEqual(r.status, 403);
    assert.ok(r.corpo.includes(TEXTO_REVOGADO));
    assert.ok(r.corpo.includes('Voltar à loja') && r.corpo.includes('https://wa.me/5515996088895'));
    assert.strictEqual(assinaturas.length, antes, 'não deveria gerar URL assinada');
  });
  await teste('4. token inexistente: 403, sem assinar nada', async () => {
    const antes = assinaturas.length;
    const r = await get(porta, pdf(L, 'nao-existe'));
    assert.strictEqual(r.status, 403);
    assert.ok(!r.corpo.includes(TEXTO_REVOGADO));
    assert.strictEqual(assinaturas.length, antes);
  });

  console.log('Rota do PDF — extras');
  await teste('os 4 livros: cada um abre o seu próprio PDF com o nome amigável', async () => {
    for (const id of LIVROS) {
      const r = await get(porta, pdf(id, `ok-${id}`));
      assert.strictEqual(r.status, 302, id);
      const a = assinaturas[assinaturas.length - 1];
      assert.strictEqual(a.caminho, `pdf/${id}.pdf`);
      assert.strictEqual(a.opcoes.download, NOMES[id]);
    }
  });
  await teste('sem token: 403', async () => { assert.strictEqual((await get(porta, pdf(L))).status, 403); });
  await teste('token de OUTRO livro: 403 (o token é amarrado ao livro)', async () => {
    assert.strictEqual((await get(porta, pdf(L, `ok-${LIVROS[0]}`))).status, 403);
  });
  await teste('token só de audiolivro: 403 (quem comprou só o áudio não leva o PDF)', async () => {
    assert.strictEqual((await get(porta, pdf(L, `audio-${L}`))).status, 403);
  });
  await teste('livro sem PDF configurado (token válido): 404, sem assinar nada', async () => {
    const antes = assinaturas.length;
    const r = await get(porta, pdf(OUTRO, `ok-${OUTRO}`));
    assert.strictEqual(r.status, 404);
    assert.strictEqual(assinaturas.length, antes);
  });
  await teste('falha ao assinar: 503 com mensagem simples, sem vazar o erro interno', async () => {
    estado.falhaAoAssinar = true;
    const r = await get(porta, pdf(L, `ok-${L}`));
    estado.falhaAoAssinar = false;
    assert.strictEqual(r.status, 503);
    assert.ok(!/falha simulada|storage/i.test(r.corpo), r.corpo);
  });
  await teste('id de livro inválido: 400', async () => { assert.strictEqual((await get(porta, '/livros/..%2Fx/pdf?token=a')).status, 400); });
  await teste('o token do cliente não vai para a URL assinada', async () => {
    const r = await get(porta, pdf(L, `ok-${L}`));
    assert.ok(!r.headers.location.includes(`ok-${L}`), r.headers.location);
  });

  console.log('Páginas de acesso');
  await teste('leitura no site com prazo vencido: 403 e a página oferece o PDF (link só aparece com token na URL)', async () => {
    const r = await get(porta, `/livros/${L}?token=vencido-${L}`);
    assert.strictEqual(r.status, 403);
    assert.ok(r.corpo.includes(TEXTO_EXPIRADO));
    assert.ok(/O seu PDF continua disponível/.test(r.corpo));
    assert.ok(/id="baixar-pdf"[^>]*hidden/.test(r.corpo) && r.corpo.includes("'/pdf?token='"));
  });
  await teste('leitura no site com token inexistente: 403 com a página "Não encontramos este acesso" (sem oferecer PDF)', async () => {
    const r = await get(porta, `/livros/${L}?token=nao-existe`);
    assert.strictEqual(r.status, 403);
    assert.ok(r.corpo.includes('Não encontramos este acesso'));
    assert.ok(!/baixar-pdf|PDF/.test(r.corpo));
  });
  await teste('leitura no site com token revogado continua com a página de reembolso', async () => {
    const r = await get(porta, `/livros/${L}?token=revogado-${L}`);
    assert.strictEqual(r.status, 403);
    assert.ok(r.corpo.includes(TEXTO_REVOGADO));
  });

  console.log('Botão "Baixar PDF" nos 4 leitores servidos (navegador)');
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  async function cliqueNoBotao(id, vp, abrir) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    const pedidos = [];
    await page.route('**/*', (rt) => {
      const u = rt.request().url();
      if (new URL(u).pathname.endsWith('/pdf')) { pedidos.push(u); return rt.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }); }
      if (/^(http:\/\/127\.0\.0\.1|file:|data:|blob:)/.test(u)) return rt.continue();
      return rt.abort();
    });
    await page.goto(`http://127.0.0.1:${porta}/livros/${id}?token=ok-${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(id === 'da-terra-ao-resultado' ? 3000 : 7000);
    const botoes = await page.evaluate(() => [...document.querySelectorAll('button, a')].map((b) => (b.textContent || '').trim()).filter((t) => /pdf|imprimir|baixar/i.test(t)));
    await abrir(page);
    await page.waitForTimeout(800);
    // Rótulos de download/impressão VISÍVEIS (no Toda Mesa do celular, o botão do computador fica escondido sob a rolagem).
    const rotulos = await page.evaluate(() => [...document.querySelectorAll('button, a')].filter((b) => b.offsetWidth > 0 && b.offsetHeight > 0).map((b) => b.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /pdf|imprimir|baixar/i.test(t)));
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetWidth > 0 && /^\s*(Baixar PDF)\s*$/i.test(x.textContent.replace(/\s+/g, ' ')));
      if (!b) throw new Error('botão "Baixar PDF" visível não encontrado');
      b.click();
    });
    await page.waitForTimeout(1500);
    await ctx.close();
    return { pedidos, rotulos, botoes };
  }
  const abrirReact = (page) => page.evaluate(() => { const b = document.getElementById('openBtn'); if (b) b.click(); });
  const nada = async () => {};
  const abrirMesa = (page) => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^›$/.test(x.textContent.trim())); if (b) b.click(); });

  for (const [id, vp, abrir, rotuloEsperado] of [
    ['vender-bem-vender-sempre', { width: 1366, height: 768 }, nada, 'Baixar PDF'],
    ['toda-reuniao-tem-duas-pautas', { width: 1366, height: 768 }, nada, 'Baixar PDF'],
    ['da-terra-ao-resultado', { width: 1366, height: 768 }, nada, 'Baixar PDF'],
    ['toda-mesa-tem-dois-lados', { width: 1366, height: 768 }, abrirMesa, 'Baixar PDF'],
    ['toda-mesa-tem-dois-lados', { width: 390, height: 844 }, nada, 'Baixar PDF']
  ]) {
    await teste(`${id} (${vp.width}px): único botão de download é "Baixar PDF" e leva a /livros/${id}/pdf?token=…`, async () => {
      const r = await cliqueNoBotao(id, vp, abrir);
      assert.strictEqual(r.pedidos.length, 1, 'pedidos ao /pdf: ' + JSON.stringify(r.pedidos));
      assert.strictEqual(new URL(r.pedidos[0]).pathname, `/livros/${id}/pdf`);
      assert.strictEqual(new URL(r.pedidos[0]).search, `?token=ok-${id}`);
      assert.deepStrictEqual([...new Set(r.rotulos)], [rotuloEsperado], 'rótulos com pdf/baixar/imprimir: ' + JSON.stringify(r.rotulos));
    });
  }
  await browser.close();

  servidor.close();
  console.log(`\nTotal: ${total} | Passaram: ${total - falhas.length} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exitCode = 1; }
  else console.log('OK — rota do PDF (4 casos + extras) e botão "Baixar PDF" dos 4 leitores.');
})().catch((e) => { console.error(e); process.exitCode = 2; });
