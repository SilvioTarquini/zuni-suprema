#!/usr/bin/env node
// scripts/gerar-pdf-livro.js
//
// Gera o PDF para guardar de um dos livros à venda a partir do HTML exatamente como o servidor o entrega (lerLivroComPatch)
// e do Chromium (Playwright) em mídia "print". O leitor monta as próprias folhas de impressão (o HTML servido não tem mais
// o botão, então o script usa a variante { semImpressao:false } do MESMO patch, só para acionar a montagem das folhas).
// Sem rede: toda requisição externa é abortada, as fontes e imagens vêm embutidas no livro. Não grava nada no repositório.
//
// Confere o PDF: nº de páginas, páginas sem texto (capa e folhas só de imagem aparecem na lista), tamanho em MB e se TODAS
// as palavras que o leitor desenhou nas folhas de impressão aparecem no texto extraído do PDF (pdftotext).
//
// Uso: node scripts/gerar-pdf-livro.js <livroId> [--saida=<pasta>] [--json]
//   Pasta padrão: <temp do sistema>/zuni-pdfs. Código de saída ≠ 0 se faltar texto, houver página vazia fora da lista
//   permitida ou o patch falhar.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { lerLivroComPatch } = require('../src/lib/leitorMobile');
const { ehLivroSemImpressao } = require('../src/lib/leitorSemImpressao');

const RAIZ_LIVROS = path.join(__dirname, '..', 'private', 'livros');
const MAX_MB_SEM_COMPRIMIR = 15;

// Nomes amigáveis dos arquivos: os mesmos da rota de download (lib/pdfLivro.js).
const { NOMES_ARQUIVO: NOMES } = require('../src/lib/pdfLivro');

const contarPaginas = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

function textoPorPagina(pdf, total) {
  const out = [];
  for (let n = 1; n <= total; n++) {
    out.push(execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-enc', 'UTF-8', pdf, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }));
  }
  return out;
}

// Letras e dígitos comparáveis (sem caixa, ligaduras desfeitas, sem espaços nem pontuação). Não compara palavras porque o
// pdftotext parte títulos com espaçamento entre letras ("U M A  P A L A V R A S") e isso não é texto perdido.
function palavras(texto) {
  return [...texto.normalize('NFKC').replace(/­/g, '').toLowerCase()].filter((c) => /[\p{L}\p{N}]/u.test(c));
}
function contar(lista) {
  const m = new Map();
  for (const w of lista) m.set(w, (m.get(w) || 0) + 1);
  return m;
}

async function detectarMotor(page) {
  return page.evaluate(() => {
    if (document.querySelector('.page[data-kind]')) return 'estatico';
    if (document.getElementById('openBtn') && document.getElementById('btnPrint')) return 'react';
    if ([...document.querySelectorAll('button')].some((b) => /baixar em pdf/i.test(b.textContent))) return 'componente';
    return 'desconhecido';
  });
}

// Uma entrada por folha de impressão (para apontar a página com palavra faltando).
function textosPorFolha() {
  const sel = document.querySelector('#printRoot .print-page') ? '#printRoot .print-page' : (document.querySelector('#printPages') ? null : '.page[data-kind]');
  if (sel) return [...document.querySelectorAll(sel)].map((p) => p.innerText);
  const raiz = document.querySelector('#printPages');
  return [...raiz.children].filter((e) => e.offsetHeight >= 900).map((p) => p.innerText);
}

// Texto que o leitor realmente desenhou nas folhas de impressão (innerText inclui o que o overflow esconderia).
function textoDasFolhas() {
  const raiz = document.querySelector('#printRoot') || document.querySelector('#printPages');
  if (raiz) return raiz.innerText;
  return [...document.querySelectorAll('.page[data-kind]')].map((p) => p.innerText).join('\n');
}

async function gerar(livroId, pastaSaida) {
  const arquivoOriginal = path.join(RAIZ_LIVROS, livroId, 'index.html');
  if (!fs.existsSync(arquivoOriginal)) throw new Error(`Livro não encontrado: ${arquivoOriginal}`);
  fs.mkdirSync(pastaSaida, { recursive: true });

  const mensagens = [];
  const original = console.error;
  console.error = (...a) => { mensagens.push(a.join(' ')); };
  let html;
  try { html = await lerLivroComPatch(livroId, arquivoOriginal, { semImpressao: false }); } finally { console.error = original; }
  const patchFalhou = mensagens.some((m) => m.includes('[LEITOR_PATCH_FALHOU]'));

  const temp = path.join(os.tmpdir(), `zuni-pdf-${livroId}.html`);
  fs.writeFileSync(temp, html);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  const externas = [];
  await page.route('**/*', (rt) => {
    const u = rt.request().url();
    if (/^(file|data|blob):/.test(u)) return rt.continue();
    externas.push(u.slice(0, 80));
    return rt.abort();
  });
  await page.goto(pathToFileURL(temp).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(7000);
  await page.evaluate(() => { window.print = () => {}; });
  const motor = await detectarMotor(page);

  if (motor === 'react') {
    await page.evaluate(() => document.getElementById('openBtn').click());
    await page.waitForTimeout(2500);
    await page.evaluate(() => document.getElementById('btnPrint').click());
    await page.waitForTimeout(2500);
    // A capa do leitor é uma imagem à parte (#coverImg) e não faz parte das folhas de impressão: entra como página 1.
    const capaOk = await page.evaluate(async () => {
      const img = document.getElementById('coverImg');
      const raiz = document.getElementById('printRoot');
      if (!img || !raiz || !img.currentSrc) return false;
      if (!img.complete) await new Promise((r) => { img.onload = r; img.onerror = r; });
      if (!img.naturalWidth) return false;
      const folha = document.createElement('div');
      folha.className = 'print-page';
      folha.style.cssText = 'background:#0f0f0f;';
      const c = document.createElement('img');
      c.src = img.currentSrc;
      c.alt = '';
      c.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;object-position:center top;';
      folha.appendChild(c);
      raiz.insertBefore(folha, raiz.firstChild);
      if (!c.complete) await new Promise((r) => { c.onload = r; c.onerror = r; });
      return c.naturalWidth > 0;
    });
    if (!capaOk) throw new Error('capa (#coverImg) não pôde ser colocada como primeira página');
  } else if (motor === 'componente') {
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /clique para abrir|^›$/i.test(x.textContent.trim())); if (b) b.click(); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => /baixar em pdf/i.test(x.textContent)).click());
    await page.waitForTimeout(4000);
  } else if (motor !== 'estatico') {
    throw new Error('leitor não reconhecido pelo gerador de PDF');
  }

  if (motor === 'componente') {
    // Toda Mesa: #printPages fica dentro de um contêiner de 100vh com overflow:hidden e o CSS de impressão do livro não o
    // libera, então a impressão original sai com 1 página só. Só para gerar o PDF, o contêiner vira fluxo normal.
    await page.evaluate(() => {
      for (let e = document.getElementById('printPages').parentElement; e && e !== document.documentElement; e = e.parentElement) {
        for (const [k, v] of [['height', 'auto'], ['min-height', '0'], ['overflow', 'visible'], ['display', 'block'], ['position', 'static']]) e.style.setProperty(k, v, 'important');
      }
    });
  }
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const esperado = palavras(await page.evaluate(textoDasFolhas));
  const folhas = (await page.evaluate(textosPorFolha)).map(palavras);

  const arquivoPdf = path.join(pastaSaida, NOMES[livroId] || `${livroId}.pdf`);
  const buf = await page.pdf({ preferCSSPageSize: true, format: 'A4', printBackground: true, displayHeaderFooter: false });
  fs.writeFileSync(arquivoPdf, buf);
  await ctx.close();
  await browser.close();
  try { fs.unlinkSync(temp); } catch (e) { /* temporário */ }

  const paginas = contarPaginas(buf);
  const textos = textoPorPagina(arquivoPdf, paginas);
  const semTexto = textos.map((t, i) => (t.replace(/\s+/g, '') ? 0 : i + 1)).filter(Boolean);
  const obtido = contar(palavras(textos.join('\n')));
  const esp = contar(esperado);
  let faltam = 0;
  const exemplos = [];
  for (const [w, n] of esp) {
    const d = n - (obtido.get(w) || 0);
    if (d > 0) { faltam += d; if (exemplos.length < 8) exemplos.push(`${w}×${d}`); }
  }
  // Folha a folha (quando o nº de folhas do leitor bate com o das páginas do PDF): onde faltam palavras.
  const porPagina = [];
  if (folhas.length === paginas) {
    folhas.forEach((fw, i) => {
      const o = contar(palavras(textos[i]));
      const faltando = [];
      for (const [w, n] of contar(fw)) { const d = n - (o.get(w) || 0); if (d > 0) faltando.push(`${w}×${d}`); }
      if (faltando.length) porPagina.push({ pagina: i + 1, faltando: faltando.slice(0, 6) });
    });
  }
  return {
    porPagina, folhasNoLeitor: folhas.length,
    livroId, motor, arquivo: arquivoPdf, patchFalhou,
    paginas, mb: Math.round((buf.length / 1048576) * 10) / 10,
    semTexto, letrasEsperadas: esperado.length, letrasFaltando: faltam, exemplosFaltando: exemplos,
    redeAbortada: externas.length
  };
}

function imprimir(r) {
  console.log(`\n## ${r.livroId}  (leitor: ${r.motor}; patch: ${r.patchFalhou ? 'FALHOU' : 'ok'})`);
  console.log(`arquivo: ${r.arquivo}`);
  console.log(`páginas: ${r.paginas} | MB: ${r.mb} | páginas sem texto: ${r.semTexto.length}${r.semTexto.length ? ' [' + r.semTexto.slice(0, 20).join(',') + (r.semTexto.length > 20 ? ',…' : '') + ']' : ''}`);
  if (r.porPagina.length) console.log('folhas com letra faltando (' + r.porPagina.length + '; leitor tem ' + r.folhasNoLeitor + ' folhas): ' + r.porPagina.slice(0, 12).map((p) => 'p.' + p.pagina + ' [' + p.faltando.join(' ') + ']').join(' | '));
  else if (r.letrasFaltando) console.log('(nº de folhas do leitor ' + r.folhasNoLeitor + ' ≠ páginas do PDF ' + r.paginas + ': sem comparação folha a folha)');
  console.log(`letras e dígitos no leitor: ${r.letrasEsperadas} | ausentes no PDF: ${r.letrasFaltando}${r.exemplosFaltando.length ? ' (' + r.exemplosFaltando.join(', ') + ')' : ''} | requisições externas abortadas: ${r.redeAbortada}`);
}

if (require.main === module) {
  const livroId = process.argv[2];
  const opSaida = process.argv.find((a) => a.startsWith('--saida='));
  if (!livroId || livroId.startsWith('--') || !ehLivroSemImpressao(livroId)) {
    console.error('Uso: node scripts/gerar-pdf-livro.js <livroId> [--saida=<pasta>] [--json]\n  livroId: ' + Object.keys(NOMES).join(' | '));
    process.exit(2);
  }
  const pasta = opSaida ? opSaida.split('=')[1] : path.join(os.tmpdir(), 'zuni-pdfs');
  gerar(livroId, pasta).then((r) => {
    if (process.argv.includes('--json')) console.log(JSON.stringify(r)); else imprimir(r);
    process.exit(r.patchFalhou || r.letrasFaltando > 0 ? 1 : 0);
  }).catch((e) => { console.error(e.message); process.exit(2); });
}

module.exports = { gerar, NOMES, MAX_MB_SEM_COMPRIMIR };
