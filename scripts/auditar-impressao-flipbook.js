#!/usr/bin/env node
// scripts/auditar-impressao-flipbook.js
//
// Gera, no Chromium (mídia "print", A4), o PDF de impressão do flipbook COMO O SERVIDOR O ENTREGA e informa o número
// de folhas e quantas estão sem texto (via pdftotext, quando instalado). Só leitura: o PDF vai para a pasta temporária.
// Roda em viewport de computador (1366x768) e de celular (390x844).
//
// Uso: node scripts/auditar-impressao-flipbook.js <livroId> [--max-folhas=N] [--max-sem-texto=N]
//   Código de saída ≠ 0 se passar de --max-folhas ou --max-sem-texto (quando informados).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { lerLivroComPatch } = require('../src/lib/leitorMobile');

const livroId = process.argv[2];
const opcao = (nome) => { const a = process.argv.find((x) => x.startsWith(`--${nome}=`)); return a ? Number(a.split('=')[1]) : null; };
const maxFolhas = opcao('max-folhas');
const maxSemTexto = opcao('max-sem-texto');
if (!livroId) { console.error('Uso: node scripts/auditar-impressao-flipbook.js <livroId> [--max-folhas=N] [--max-sem-texto=N]'); process.exit(2); }

const contarPaginas = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

function folhasSemTexto(pdf, total) {
  try {
    const vazias = [];
    for (let n = 1; n <= total; n++) {
      const t = execFileSync('pdftotext', ['-f', String(n), '-l', String(n), pdf, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      if (!t.replace(/\s+/g, '')) vazias.push(n);
    }
    return vazias;
  } catch (e) { return null; }
}

(async () => {
  const html = await lerLivroComPatch(livroId, path.join(__dirname, '..', 'private', 'livros', livroId, 'index.html'));
  const arquivo = path.join(os.tmpdir(), `zuni-impressao-${livroId}.html`);
  fs.writeFileSync(arquivo, html);
  const browser = await chromium.launch();
  let reprovou = false;
  for (const [nome, vp] of [['computador 1366x768', { width: 1366, height: 768 }], ['celular 390x844', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.route('**/*', (rt) => (/^(file|data|blob):/.test(rt.request().url()) ? rt.continue() : rt.abort()));
    await page.goto(pathToFileURL(arquivo).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.emulateMedia({ media: 'print' });
    const pdfBuf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    const pdf = path.join(os.tmpdir(), `zuni-impressao-${livroId}-${vp.width}.pdf`);
    fs.writeFileSync(pdf, pdfBuf);
    const total = contarPaginas(pdfBuf);
    const vazias = folhasSemTexto(pdf, total);
    console.log(`${nome}: ${total} folhas A4 (${Math.round(pdfBuf.length / 1024)} KB); folhas sem texto: ${vazias === null ? 'n/d (pdftotext ausente)' : vazias.length + (vazias.length ? ' [' + vazias.slice(0, 30).join(',') + (vazias.length > 30 ? ',…' : '') + ']' : '')}`);
    if (maxFolhas != null && total > maxFolhas) { reprovou = true; console.log(`  FALHA: ${total} > ${maxFolhas} folhas`); }
    if (maxSemTexto != null && vazias && vazias.length > maxSemTexto) { reprovou = true; console.log(`  FALHA: ${vazias.length} > ${maxSemTexto} folhas sem texto`); }
    await ctx.close();
  }
  await browser.close();
  try { fs.unlinkSync(arquivo); } catch (e) { /* temporário */ }
  process.exit(reprovou ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(2); });
