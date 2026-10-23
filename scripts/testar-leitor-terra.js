// Teste local (sem rede externa, sem servidor, sem banco) do patch de leitura do Da Terra ao Resultado
// (src/lib/leitorMobileTerra.js), sobre o HTML exatamente como o servidor o entrega (lerLivroComPatch).
//   - o patch é aditivo: removidos os dois blocos injetados, o arquivo é idêntico ao original (texto do livro intacto);
//   - celular (<= 960 px): rolagem contínua; sumário, progresso, busca, "Capa", A+ e rolagem manual coerentes;
//   - computador: continua em duas páginas lado a lado, com as setas de página.
// Uso: node scripts/testar-leitor-terra.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { lerLivroComPatch } = require('../src/lib/leitorMobile');
const { tirarImpressaoDaTerra } = require('../src/lib/leitorSemImpressao');

const ARQUIVO = path.join(__dirname, '..', 'private', 'livros', 'da-terra-ao-resultado', 'index.html');
let passaram = 0;
const falhas = [];
async function teste(nome, fn) {
  try { await fn(); passaram++; console.log('  ok   ' + nome); } catch (e) { falhas.push(nome + ' — ' + e.message.split('\n')[0]); console.log('  FAIL ' + nome + ' — ' + e.message.split('\n')[0]); }
}

async function abrir(browser, arquivo, vp, query) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.route('**/*', (rt) => (/^(file|data|blob):/.test(rt.request().url()) ? rt.continue() : rt.abort()));
  await page.goto(pathToFileURL(arquivo).href + (query || ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1800);
  return { ctx, page, erros };
}

// topo da página n (1-based) em relação ao topo da área de rolagem
const topoRelativo = (page, n) => page.evaluate((n) => {
  const p = document.querySelectorAll('.page')[n - 1];
  return Math.round(p.getBoundingClientRect().top - document.querySelector('.viewport').getBoundingClientRect().top);
}, n);
const status = (page) => page.evaluate(() => document.getElementById('status').textContent);

(async () => {
  const original = fs.readFileSync(ARQUIVO, 'utf8');
  const servido = await lerLivroComPatch('da-terra-ao-resultado', ARQUIVO);
  const temp = path.join(os.tmpdir(), 'zuni-teste-leitor-terra.html');
  fs.writeFileSync(temp, servido);
  const browser = await chromium.launch();

  await teste('patch aditivo: sem os dois blocos injetados, o arquivo é idêntico ao original (menos o botão de imprimir, retirado de propósito)', async () => {
    const sem = servido.replace(/<style id="zs-leitor-terra">[\s\S]*?<\/style>\n/, '').replace(/<script id="zs-leitor-terra">[\s\S]*?<\/script>\n/, '');
    assert.ok(servido.length > original.length, 'patch não foi aplicado');
    assert.strictEqual(sem, tirarImpressaoDaTerra(original));
  });

  const m = await abrir(browser, temp, { width: 390, height: 844 }, '?p=16');
  await teste('celular: página pedida (?p=16) aparece no topo e o indicador mostra o capítulo', async () => {
    const t = await topoRelativo(m.page, 16);
    assert.ok(Math.abs(t) <= 12, 'topo da pág. 16 em ' + t + 'px');
    assert.strictEqual(await status(m.page), 'Cap. 1 · 16/239');
  });
  await teste('celular: todas as páginas têm altura natural e nenhuma é cortada (overflow visível)', async () => {
    const r = await m.page.evaluate(() => [...document.querySelectorAll('.page[data-kind="text"]')].filter((p) => {
      const s = p.querySelector('.text-shell');
      return getComputedStyle(p).overflowY !== 'visible' || getComputedStyle(s).overflowY !== 'visible' || getComputedStyle(p).display === 'none';
    }).length);
    assert.strictEqual(r, 0);
  });
  await teste('celular: sumário leva ao capítulo 4 (pág. 35) e atualiza o indicador', async () => {
    await m.page.click('#tocBtn');
    await m.page.evaluate(() => document.querySelector('.toc-link[data-go="35"]').click());
    await m.page.waitForTimeout(500);
    const t = await topoRelativo(m.page, 35);
    assert.ok(Math.abs(t) <= 12, 'topo da pág. 35 em ' + t + 'px');
    assert.strictEqual(await status(m.page), 'Cap. 4 · 35/239');
    assert.ok(!(await m.page.evaluate(() => document.getElementById('tocOverlay').classList.contains('open'))), 'sumário continuou aberto');
  });
  await teste('celular: barra de progresso leva à pág. 100', async () => {
    await m.page.evaluate(() => { const r = document.getElementById('progress'); r.value = 100; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await m.page.waitForTimeout(500);
    assert.ok(Math.abs(await topoRelativo(m.page, 100)) <= 12);
    assert.ok((await status(m.page)).endsWith('100/239'));
  });
  await teste('celular: rolagem manual atualiza índice, indicador e a barra de progresso', async () => {
    await m.page.evaluate(() => { document.querySelector('.viewport').scrollTop += 4000; });
    await m.page.waitForTimeout(900);
    const r = await m.page.evaluate(() => ({ s: document.getElementById('status').textContent, v: Number(document.getElementById('progress').value) }));
    const n = Number(r.s.split('·').pop().split('/')[0]);
    assert.ok(n > 100 && r.v === n, JSON.stringify(r));
  });
  await teste('celular: busca encontra um termo e rola até a página', async () => {
    await m.page.fill('#searchBox', 'glossário');
    m.page.on('dialog', (d) => d.dismiss());
    await m.page.click('#searchBtn');
    await m.page.waitForTimeout(600);
    const n = Number((await status(m.page)).split('·').pop().split('/')[0]);
    const achou = await m.page.evaluate((n) => document.querySelectorAll('.page')[n - 1].innerText.toLowerCase().includes('glossário'), n);
    assert.ok(achou, 'página ' + n + ' não contém o termo');
    assert.ok(Math.abs(await topoRelativo(m.page, n)) <= 12);
  });
  await teste('celular: A+ mantém a página atual na tela', async () => {
    const antes = Number((await status(m.page)).split('·').pop().split('/')[0]);
    await m.page.click('#fontPlus');
    await m.page.click('#fontPlus');
    await m.page.waitForTimeout(500);
    assert.ok(Math.abs(await topoRelativo(m.page, antes)) <= 12, 'página ' + antes + ' saiu do topo');
  });
  await teste('celular: "Capa" volta ao início', async () => {
    await m.page.click('#coverBtn');
    await m.page.waitForTimeout(500);
    assert.ok((await status(m.page)).endsWith('1/239'));
    assert.ok(await m.page.evaluate(() => document.querySelector('.viewport').scrollTop < 20));
  });
  await teste('celular: sem erro de JavaScript', async () => { assert.deepStrictEqual(m.erros, []); });
  await m.ctx.close();

  const d = await abrir(browser, temp, { width: 1366, height: 768 }, '');
  await teste('computador: duas páginas lado a lado e setas de página visíveis (inalterado)', async () => {
    const r = await d.page.evaluate(() => ({
      ativas: document.querySelectorAll('.page.active').length,
      seta: getComputedStyle(document.getElementById('next')).display,
      status: document.getElementById('status').textContent
    }));
    assert.strictEqual(r.ativas, 2);
    assert.notStrictEqual(r.seta, 'none');
    assert.ok(/^\d+ \/ 239$/.test(r.status), r.status);
    await d.page.click('#next');
    assert.ok(/^3 \/ 239$/.test(await status(d.page)), await status(d.page));
  });
  await teste('computador: sem erro de JavaScript', async () => { assert.deepStrictEqual(d.erros, []); });
  await d.ctx.close();

  await browser.close();
  try { fs.unlinkSync(temp); } catch (e) { /* temporário */ }
  console.log('\nTotal: ' + (passaram + falhas.length) + ' | Passaram: ' + passaram + ' | Falharam: ' + falhas.length);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — leitor do Da Terra (rolagem no celular, desktop inalterado).');
})().catch((e) => { console.error(e); process.exit(2); });
