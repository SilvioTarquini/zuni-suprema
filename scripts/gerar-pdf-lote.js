#!/usr/bin/env node
// scripts/gerar-pdf-lote.js
//
// Gera o PDF de cada obra do lote A PARTIR DO TEXTO LIMPO (<saida>/<slug>/pdf-fonte.html, produzido por
// scripts/preparar-obras-lote.js) — nunca da máquina de impressão do leitor. Depois confere e registra no manifesto:
//   - páginas e tamanho;
//   - TRAVA DE RESÍDUOS no texto extraído do PDF (pdftotext): qualquer bloqueio = erro e o PDF não entra no manifesto;
//   - conferência texto × PDF: todas as letras/dígitos do texto aprovado precisam estar no PDF;
//   - hash do PDF, do texto e do HTML da loja (scripts/lote/manifesto.js).
// Só escreve na pasta de saída (fora do repositório). Sem rede: qualquer requisição externa é abortada.
//
// Uso: node scripts/gerar-pdf-lote.js [--saida=<pasta>] [slug ...]

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { NOMES_ARQUIVO } = require('../src/lib/pdfLivro');
const { textoVisivelDoLivro, letras, contar, sha256 } = require('./lote/extrairLivro');
const { varrer } = require('./lote/residuos');
const { lerManifesto, gravarManifesto, sha256Arquivo, PASTA_PADRAO } = require('./lote/manifesto');
const { slugsDoLote } = require('./preparar-obras-lote');
const { analisarTabelas } = require('./lote/analisePdf');

// Altura útil da página A5 com as margens do gabarito: 210 − 17 − 19 = 174 mm ≈ 657 px (96 dpi); largura do texto 118 mm ≈ 446 px.
const ALTURA_UTIL_PX = 657;
const LARGURA_UTIL_PX = 446;
const MAX_RODADAS = 4;

const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const contarPaginas = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;

function pdftotext(pdf) {
  return execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

function resumirTabelas(t) {
  const ok = t.filter((x) => x.achou);
  return {
    total: t.length, localizadas: ok.length,
    cortadas: ok.filter((x) => x.cortada).length,
    cortadasQueCabiam: ok.filter((x) => x.cortada && x.cabe).length,
    maioresQueUmaPagina: ok.filter((x) => !x.cabe).map((x) => ({ n: x.n, cabecalho: x.cabecalho, linhas: x.linhas, alturaPx: x.alturaPx, paginas: x.pagIni + '–' + x.pagFim })),
    quebraLivrePorPaginaVazia: ok.filter((x) => x.livre).map((x) => x.n)
  };
}

// Renderiza o HTML-fonte no Chromium (sem rede). ajustar: aplica a regra "o que cabe numa página não parte";
// marcar: injeta marcadores invisíveis nas tabelas (só para análise).
async function renderizar(browser, fonteHtml, { livres = [], ajustar = true, marcar = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: LARGURA_UTIL_PX, height: 900 } });
  const page = await ctx.newPage();
  let externas = 0;
  await page.route('**/*', (rt) => { if (/^(file|data|blob):/.test(rt.request().url())) return rt.continue(); externas++; return rt.abort(); });
  await page.goto(pathToFileURL(fonteHtml).href, { waitUntil: 'load', timeout: 120000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  const medidas = await page.evaluate(({ H, livresArr, ajustar: aj, marcar: mc }) => {
    const info = [];
    document.querySelectorAll('table').forEach((t, i) => {
      const n = i + 1;
      const h = t.getBoundingClientRect().height; const cabe = h <= H - 8;
      if (aj && cabe && !livresArr.includes(n)) t.classList.add('evita');
      info.push({ n, alturaPx: Math.round(h), cabe, livre: livresArr.includes(n) });
      if (mc) {
        const marca = (cel, txt) => { cel.style.position = 'relative'; const sp = document.createElement('span'); sp.textContent = txt; sp.style.cssText = 'position:absolute;left:0;top:0;font-size:1px;line-height:1px;color:#fff;'; cel.appendChild(sp); };
        const th = t.querySelector('th'); const linhas = t.querySelectorAll('tbody tr'); const ult = linhas[linhas.length - 1];
        marca(th, 'zzt' + n + 'azz'); marca(ult.querySelector('td:last-child'), 'zzt' + n + 'fzz');
      }
    });
    if (aj) document.querySelectorAll('ul, ol, blockquote, .aside').forEach((e) => { if (e.getBoundingClientRect().height <= H * 0.4) e.classList.add('evita'); });
    return info;
  }, { H: ALTURA_UTIL_PX, livresArr: livres, ajustar, marcar });
  const buf = await page.pdf({ preferCSSPageSize: true, printBackground: true, outline: true, tagged: true });
  await ctx.close();
  return { buf, medidas, externas };
}

async function gerar(slug, saida, browser) {
  const manifesto = lerManifesto(saida);
  const obra = manifesto.obras[slug];
  if (!obra) throw new Error(`${slug}: rode scripts/preparar-obras-lote.js antes (não consta no manifesto)`);
  if (!NOMES_ARQUIVO[slug]) throw new Error(`${slug}: sem nome de arquivo em src/lib/pdfLivro.js (NOMES_ARQUIVO)`);
  const pastaObra = path.join(saida, slug);
  const fonteHtml = path.join(pastaObra, 'pdf-fonte.html');
  if (sha256(fs.readFileSync(fonteHtml, 'utf8')) !== obra.pdfFonte.sha256) throw new Error(`${slug}: pdf-fonte.html não bate com o manifesto (rode preparar-obras-lote.js de novo)`);
  const modelo = JSON.parse(fs.readFileSync(path.join(pastaObra, 'modelo.json'), 'utf8'));

  const tabelasModelo = modelo.secoes.flatMap((sec) => sec.blocos.filter((x) => x.t === 'tabela'));
  fs.mkdirSync(path.join(saida, 'pdf'), { recursive: true });
  const arqPdf = path.join(saida, 'pdf', NOMES_ARQUIVO[slug]);
  // Rodadas: (1) tabela/lista/quadro que CABE numa página não parte; o que é maior parte com o cabeçalho repetido;
  // (2) se mover uma tabela deixou mais da metade da página anterior em branco, essa tabela volta a poder partir.
  const livres = new Set();
  let buf; let externas = 0; let medidas = []; let tabelas = [];
  for (let rodada = 1; rodada <= MAX_RODADAS; rodada++) {
    const r = await renderizar(browser, fonteHtml, { livres: [...livres], ajustar: true, marcar: false });
    buf = r.buf; externas += r.externas; medidas = r.medidas;
    fs.writeFileSync(arqPdf, buf);
    if (!tabelasModelo.length) break;
    // mesma renderização, com marcadores invisíveis, só para localizar as tabelas
    const m = await renderizar(browser, fonteHtml, { livres: [...livres], ajustar: true, marcar: true });
    const tmp = path.join(require('os').tmpdir(), 'zuni-marcado-' + slug + '.pdf');
    fs.writeFileSync(tmp, m.buf);
    const nPaginasFinal = contarPaginas(buf);
    if (contarPaginas(m.buf) !== nPaginasFinal) throw new Error(slug + ': a renderização de análise tem ' + contarPaginas(m.buf) + ' páginas, o PDF final ' + nPaginasFinal);
    tabelas = analisarTabelas(tmp, tabelasModelo.length).map((t, i) => ({ ...t, ...medidas[i], linhas: tabelasModelo[i].linhas.length, cabecalho: tabelasModelo[i].headers.slice(0, 2).join(' / ').slice(0, 60) }));
    try { fs.unlinkSync(tmp); } catch (e) { /* temporário */ }
    const novas = tabelas.filter((t) => t.achou && t.cabe && !t.livre && t.brancoAntes !== null && t.brancoAntes > 50).map((t) => t.n);
    if (!novas.length) break;
    novas.forEach((n) => livres.add(n));
  }

  const textoPdf = pdftotext(arqPdf);
  const trava = varrer(textoPdf, { rotulo: 'pdf', slug });
  const esperado = contar(letras(textoVisivelDoLivro(modelo)));
  const obtido = contar(letras(textoPdf));
  let faltam = 0; const exemplos = [];
  for (const [c, n] of esperado) { const d = n - (obtido.get(c) || 0); if (d > 0) { faltam += d; if (exemplos.length < 6) exemplos.push(`${c}×${d}`); } }
  const paginas = contarPaginas(buf);
  const semTexto = [];
  for (let n = 1; n <= paginas; n++) {
    const t = execFileSync('pdftotext', ['-f', String(n), '-l', String(n), '-enc', 'UTF-8', arqPdf, '-'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (!t.replace(/\s+/g, '')) semTexto.push(n);
  }

  const registro = {
    arquivo: arqPdf, sha256: sha256Arquivo(arqPdf), bytes: buf.length, paginas,
    paginasSemTexto: semTexto, textoSha256: obra.texto.sha256, htmlLojaSha256: obra.htmlLoja.sha256, pdfFonteSha256: obra.pdfFonte.sha256,
    residuosBloqueantes: trava.bloqueios.length, residuosAvisos: trava.avisos.length,
    conferenciaTexto: { letrasEsperadas: [...esperado.values()].reduce((a, b) => a + b, 0), faltam, exemplos },
    tabelas: resumirTabelas(tabelas), redeAbortada: externas, geradoEm: new Date().toISOString()
  };
  if (trava.bloqueios.length) throw new Error(`${slug}: resíduos BLOQUEANTES no PDF: ${JSON.stringify(trava.bloqueios)}`);
  if (faltam > 0) throw new Error(`${slug}: ${faltam} letras do texto aprovado ausentes no PDF (${exemplos.join(', ')})`);
  // Só chega ao manifesto quem passou nas travas.
  const m2 = lerManifesto(saida);
  m2.obras[slug].pdf = registro;
  m2.atualizadoEm = new Date().toISOString();
  gravarManifesto(m2, saida);
  return registro;
}

if (require.main === module) {
  const saida = arg('saida') || PASTA_PADRAO;
  const pedidos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const slugs = slugsDoLote(pedidos);
  (async () => {
    const browser = await chromium.launch();
    let falhou = false;
    for (const slug of slugs) {
      try {
        const r = await gerar(slug, saida, browser);
        console.log(`ok  ${slug}: ${r.paginas} páginas, ${(r.bytes / 1048576).toFixed(2)} MB, resíduos bloqueantes ${r.residuosBloqueantes}, letras ausentes ${r.conferenciaTexto.faltam}/${r.conferenciaTexto.letrasEsperadas}, páginas sem texto [${r.paginasSemTexto.join(',')}]\n     ${r.arquivo}\n     sha256 ${r.sha256.slice(0, 16)}…`);
      } catch (e) { falhou = true; console.error(`ERRO ${slug}: ${e.message}`); }
    }
    await browser.close();
    process.exitCode = falhou ? 1 : 0;
  })();
}

module.exports = { gerar, resumirTabelas, renderizar, contarPaginas, ALTURA_UTIL_PX };
