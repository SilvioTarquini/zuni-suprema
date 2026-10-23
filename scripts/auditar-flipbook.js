#!/usr/bin/env node
// scripts/auditar-flipbook.js
//
// Auditoria automática de um flipbook de private/livros/<livroId>/index.html, exatamente como o servidor o entrega
// (lerLivroComPatch: patch de celular aplicado, se houver). Só leitura: abre uma cópia temporária no Chromium
// (Playwright), com toda requisição externa abortada. Não sobe o servidor, não usa banco nem rede.
//
// Mede em 1366x768, 390x844, 390x664 e 360x640, na fonte padrão e no A+ máximo:
//   - páginas com texto cortado (conteúdo além da área visível da página);
//   - páginas com só um título;
//   - páginas com menos de 30% de preenchimento (só onde a página tem altura fixa);
//   - tamanho efetivo do texto de leitura (px na tela, já com a escala visual);
//   - sobreposição de botões (apenas informativo, não derruba o código de saída);
//   - ocorrência de [LEITOR_PATCH_FALHOU] ao aplicar o patch;
//   - livros à venda (lib/leitorSemImpressao.js): nenhum controle de imprimir / "Baixar em PDF" no HTML servido e o botão
//     "Baixar PDF" visível.
//
// CHECKLIST DE AUDITORIA de um livro à venda: "PDF gerado, com todo o texto, sem folhas em branco e com a rota de
// download funcionando":
//   1. node scripts/auditar-flipbook.js <livroId> --pdf   → leitura sem corte + PDF gerado (scripts/gerar-pdf-livro.js) com
//      todas as letras e dígitos do leitor no texto extraído, e só a capa sem texto (nenhuma folha em branco);
//   2. node scripts/testar-pdf-livro-rota.js              → rota GET /livros/:id/pdf (token válido, prazo vencido sem
//      reembolso, revogado, inexistente) e botão "Baixar PDF" dos 4 leitores;
//   3. node scripts/subir-pdfs-livros.js --enviar         → PDFs no Storage privado, acesso direto negado (a confirmar).
//
// Código de saída ≠ 0 quando houver texto cortado, patch falho, texto efetivo < 12 px em tela de celular ou (com --pdf)
// PDF incompleto.
//
// Uso: node scripts/auditar-flipbook.js <livroId> [--json] [--pdf]

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { lerLivroComPatch } = require('../src/lib/leitorMobile');
const { ehLivroSemImpressao } = require('../src/lib/leitorSemImpressao');

const RAIZ_LIVROS = path.join(__dirname, '..', 'private', 'livros');
const MIN_PX_CELULAR = 12;
const TELAS = [
  { nome: '1366x768', width: 1366, height: 768, celular: false },
  { nome: '390x844', width: 390, height: 844, celular: true },
  { nome: '390x664', width: 390, height: 664, celular: true },
  { nome: '360x640', width: 360, height: 640, celular: true }
];

const lista = (a, max = 14) => (a.length ? a.slice(0, max).join(',') + (a.length > max ? ',…' : '') : '-');

async function htmlServido(livroId, opcoes = {}) {
  const msgs = [];
  const original = console.error;
  console.error = (...a) => { msgs.push(a.join(' ')); };
  let html;
  try { html = await lerLivroComPatch(livroId, path.join(RAIZ_LIVROS, livroId, 'index.html'), opcoes); } finally { console.error = original; }
  return { html, patchFalhou: msgs.some((m) => m.includes('[LEITOR_PATCH_FALHOU]')), mensagens: msgs };
}

// ---------- medições dentro da página (funções serializadas pelo Playwright) ----------

function medirEfetivo() {
  const visivel = (e) => {
    for (let n = e; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    return true;
  };
  // Parágrafos de leitura dos leitores conhecidos: não precisam estar na dobra da tela, só desenhados.
  const conhecido = [...document.querySelectorAll('#book .pg-p, .page .bodyp')].find((e) => e.offsetWidth > 0 && e.offsetHeight > 0 && visivel(e));
  if (conhecido) {
    const rc = conhecido.getBoundingClientRect();
    return Math.round(parseFloat(getComputedStyle(conhecido).fontSize) * (rc.width / conhecido.offsetWidth) * 10) / 10;
  }
  let melhor = null;
  let maior = 0;
  for (const e of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'BUTTON', 'INPUT', 'SVG'].includes(e.tagName)) continue;
    let proprio = 0;
    for (const n of e.childNodes) if (n.nodeType === 3) proprio += n.nodeValue.trim().length;
    if (proprio < 60 || proprio <= maior) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 5 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    if (!visivel(e)) continue;
    melhor = e;
    maior = proprio;
  }
  if (!melhor) return null;
  const r = melhor.getBoundingClientRect();
  const escala = melhor.offsetWidth ? r.width / melhor.offsetWidth : 1;
  return Math.round(parseFloat(getComputedStyle(melhor).fontSize) * escala * 10) / 10;
}

function medirSobreposicao() {
  const visivel = (e) => {
    for (let n = e; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    return true;
  };
  const els = [...document.querySelectorAll('button, [role=button], input, a, [id^=btn]')].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight && visivel(e);
  });
  const rects = els.map((e) => e.getBoundingClientRect());
  let n = 0;
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
      const ix = Math.min(rects[i].right, rects[j].right) - Math.max(rects[i].left, rects[j].left);
      const iy = Math.min(rects[i].bottom, rects[j].bottom) - Math.max(rects[i].top, rects[j].top);
      if (ix > 3 && iy > 3) n++;
    }
  }
  return n;
}

// Leitor estático (Da Terra ao Resultado): páginas <article class="page"> pré-montadas.
function medirEstatico() {
  const pages = [...document.querySelectorAll('.page')];
  const r = { paginas: pages.length, corpo: 0, cortadas: [], soTitulo: [], baixas: [], perda: {}, fixas: 0 };
  const esconde = (p) => p.style.setProperty('display', 'none', 'important');
  const mostra = (p) => p.style.setProperty('display', 'block', 'important');
  pages.forEach(esconde);
  for (const p of pages) {
    if (p.dataset.kind !== 'text') continue;
    const shell = p.querySelector('.text-shell');
    if (!shell) continue;
    mostra(p);
    r.corpo++;
    const n = Number(p.dataset.page);
    const cortaP = getComputedStyle(p).overflowY !== 'visible' && p.scrollHeight > p.clientHeight + 2;
    const cortaS = getComputedStyle(shell).overflowY !== 'visible' && shell.scrollHeight > shell.clientHeight + 2;
    const kids = [...shell.children];
    if (cortaP || cortaS) {
      r.cortadas.push(n);
      r.perda[n] = Math.max(cortaS ? shell.scrollHeight - shell.clientHeight : 0, cortaP ? p.scrollHeight - p.clientHeight : 0);
    }
    const alturaFixa = getComputedStyle(shell).overflowY !== 'visible';
    if (alturaFixa && shell.clientHeight > 0) {
      r.fixas++;
      const bottom = kids.length ? Math.max(...kids.map((k) => k.offsetTop + k.offsetHeight)) - shell.offsetTop : 0;
      if (bottom / shell.clientHeight < 0.3) r.baixas.push(n);
    }
    if (kids.length && kids.every((k) => /^H[1-6]$/.test(k.tagName))) r.soTitulo.push(n);
    esconde(p);
  }
  pages.forEach((p) => p.style.removeProperty('display'));
  return r;
}

// Leitor com paginação em JS e área de impressão (#printRoot): Vender Bem e Toda Reunião.
function medirReact() {
  const sheets = [...document.querySelectorAll('#printRoot .print-page')];
  const holder = document.createElement('div');
  holder.className = 'page';
  holder.style.cssText = 'position:absolute;left:0;top:0;width:470px;height:668px;overflow:hidden;visibility:hidden;z-index:-1';
  (document.querySelector('#book') || document.body).appendChild(holder);
  const r = { paginas: sheets.length, corpo: 0, cortadas: [], soTitulo: [], baixas: [], perda: {}, fixas: 0 };
  sheets.forEach((s, i) => {
    holder.innerHTML = s.innerHTML;
    const pc = holder.querySelector('.pg-content');
    if (!pc) return;
    r.corpo++;
    r.fixas++;
    const n = i + 1;
    const filhos = [...pc.children];
    const bottom = filhos.length ? Math.max(...filhos.map((k) => k.offsetTop + k.offsetHeight)) : 0;
    const ch = pc.clientHeight;
    if (pc.scrollHeight > ch + 2 || bottom > ch + 2) { r.cortadas.push(n); r.perda[n] = Math.max(pc.scrollHeight - ch, bottom - ch); }
    if (bottom / ch < 0.3) r.baixas.push(n);
    const corpo = pc.querySelectorAll('.pg-p, .pg-aside, .pg-quote, li, td, .pg-callout-body, .pg-def, .pg-practice-body');
    if (!corpo.length && pc.innerText.trim()) r.soTitulo.push(n);
  });
  holder.remove();
  return r;
}

// Leitor de componente (Toda Mesa Tem Dois Lados): #printPages guarda todas as páginas 680x960.
function medirComponente() {
  const raiz = document.querySelector('#printPages');
  if (!raiz) return null;
  raiz.style.display = 'block';
  const folhas = [...raiz.children].filter((e) => e.offsetHeight >= 900);
  const r = { paginas: folhas.length, corpo: 0, cortadas: [], soTitulo: [], baixas: [], perda: {}, fixas: 0 };
  folhas.forEach((f, i) => {
    const n = i + 1;
    const fr = f.getBoundingClientRect();
    const w = document.createTreeWalker(f, NodeFilter.SHOW_TEXT);
    let max = 0, minTop = 1e9, temCorpo = false, temTexto = false, estoura = false;
    while (w.nextNode()) {
      const t = w.currentNode;
      if (!t.nodeValue.trim()) continue;
      const rg = document.createRange();
      rg.selectNodeContents(t);
      const rc = rg.getBoundingClientRect();
      if (!rc.height) continue;
      temTexto = true;
      const rel = rc.bottom - fr.top;
      if (rc.top - fr.top <= 880) { max = Math.max(max, rel); minTop = Math.min(minTop, rc.top - fr.top); }
      if (rel > 962) estoura = true;
      const px = parseFloat(getComputedStyle(t.parentElement).fontSize);
      if ((px === 16.5 || px === 15.5) && t.nodeValue.trim().length > 40) temCorpo = true;
    }
    if (!temTexto) return;
    r.corpo++;
    r.fixas++;
    if (estoura) { r.cortadas.push(n); r.perda[n] = Math.round(max - 960); }
    if ((max - (minTop < 1e9 ? minTop : 0)) / 860 < 0.3) r.baixas.push(n);
    if (!temCorpo) r.soTitulo.push(n);
  });
  raiz.style.display = '';
  return r;
}

// ---------- orquestração ----------

async function abrirPagina(browser, tela, arquivo, sufixo) {
  const ctx = await browser.newContext({ viewport: { width: tela.width, height: tela.height } });
  const page = await ctx.newPage();
  await page.route('**/*', (rt) => (/^(file|data|blob):/.test(rt.request().url()) ? rt.continue() : rt.abort()));
  await page.goto(pathToFileURL(arquivo).href + (sufixo || ''), { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { ctx, page };
}

async function detectarMotor(page) {
  return page.evaluate(() => {
    if (document.querySelector('.page[data-kind]')) return 'estatico';
    if (document.getElementById('openBtn') && document.getElementById('btnNext')) return 'react';
    if ([...document.querySelectorAll('button')].some((b) => /baixar em pdf/i.test(b.textContent))) return 'componente';
    return 'desconhecido';
  });
}

async function auditarCenario(browser, arquivo, tela, fonteMax, motor) {
  const espera = motor === 'estatico' ? 2500 : 6500;
  const { ctx, page } = await abrirPagina(browser, tela, arquivo, motor === 'estatico' ? '?p=16' : '');
  await page.waitForTimeout(espera);
  const saida = { tela: tela.nome, fonte: fonteMax ? 'A+ máx' : 'padrão', motor };
  try {
    await page.evaluate(() => { window.print = () => {}; });
    if (motor === 'estatico') {
      if (fonteMax) {
        for (let i = 0; i < 8; i++) { await page.evaluate(() => document.getElementById('fontPlus').click()); await page.waitForTimeout(120); }
      }
      saida.efetivo = await page.evaluate(medirEfetivo);
      saida.sobrepoe = await page.evaluate(medirSobreposicao);
      Object.assign(saida, await page.evaluate(medirEstatico));
    } else if (motor === 'react') {
      await page.evaluate(() => document.getElementById('openBtn').click());
      await page.waitForTimeout(2500);
      if (fonteMax) {
        for (let i = 0; i < 12; i++) { await page.evaluate(() => document.getElementById('btnFontUp').click()); await page.waitForTimeout(900); }
      }
      for (let i = 0; i < 8; i++) {
        const ok = await page.evaluate(() => [...document.querySelectorAll('#book .pg-p')].some((e) => e.offsetWidth > 0 && e.offsetHeight > 0 && getComputedStyle(e).visibility !== 'hidden'));
        if (ok) break;
        await page.evaluate(() => document.getElementById('btnNext').click());
        await page.waitForTimeout(1100);
      }
      saida.efetivo = await page.evaluate(medirEfetivo);
      saida.sobrepoe = await page.evaluate(medirSobreposicao);
      await page.evaluate(() => document.getElementById('btnPrint').click());
      await page.waitForTimeout(900);
      Object.assign(saida, await page.evaluate(medirReact));
    } else if (motor === 'componente') {
      if (fonteMax) { saida.indisponivel = true; await ctx.close(); return saida; }
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /clique para abrir|^›$/i.test(x.textContent.trim())); if (b) b.click(); });
      await page.waitForTimeout(1500);
      for (let i = 0; i < 10; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(750); }
      saida.efetivo = await page.evaluate(medirEfetivo);
      saida.sobrepoe = await page.evaluate(medirSobreposicao);
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /baixar em pdf/i.test(x.textContent)); if (b) b.click(); });
      await page.waitForTimeout(2000);
      const m = await page.evaluate(medirComponente);
      if (m) Object.assign(saida, m); else saida.erro = '#printPages ausente';
    } else {
      saida.erro = 'motor de leitor não reconhecido pela auditoria';
    }
  } catch (e) {
    saida.erro = String(e.message).split('\n')[0].slice(0, 140);
  }
  await ctx.close();
  return saida;
}

// Os 4 livros à venda não podem ter controle de imprimir nem "Baixar em PDF" no HTML servido (rota /livros/:id) e precisam
// do botão "Baixar PDF" visível (na capa ou, depois de aberto o livro, na barra). Devolve { proibidos, baixarPdfVisivel }.
async function controlesDeImpressao(browser, arquivo, tela) {
  const { ctx, page } = await abrirPagina(browser, tela, arquivo);
  await page.waitForTimeout(3500);
  const medir = () => page.evaluate(() => {
    const todos = [...document.querySelectorAll('button, a, [role=button]')];
    const rotulo = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      proibidos: todos
        .filter((e) => /^(btnPrint|printBtn)$/.test(e.id) || /imprimir|baixar em pdf/i.test(rotulo(e) + ' ' + (e.getAttribute('title') || '') + ' ' + (e.getAttribute('aria-label') || '')))
        .map((e) => (e.id || rotulo(e)).slice(0, 40)),
      baixarPdf: todos.filter((e) => /^baixar pdf$/i.test(rotulo(e)) && e.offsetWidth > 0 && e.offsetHeight > 0).length
    };
  });
  try {
    const antes = await medir();
    await page.evaluate(() => { const b = document.getElementById('openBtn') || [...document.querySelectorAll('button')].find((x) => /clique para abrir|^›$/i.test(x.textContent.trim())); if (b) b.click(); });
    await page.waitForTimeout(2500);
    const depois = await medir();
    return { proibidos: [...new Set([...antes.proibidos, ...depois.proibidos])], baixarPdfVisivel: Math.max(antes.baixarPdf, depois.baixarPdf) };
  } finally { await ctx.close(); }
}

async function auditar(livroId, opcoes = {}) {
  const arquivoOriginal = path.join(RAIZ_LIVROS, livroId, 'index.html');
  if (!fs.existsSync(arquivoOriginal)) throw new Error(`Livro não encontrado: ${arquivoOriginal}`);
  const { html, patchFalhou, mensagens } = await htmlServido(livroId);
  const temp = path.join(os.tmpdir(), `zuni-auditoria-${livroId}.html`);
  fs.writeFileSync(temp, html);
  // As folhas de impressão (cortes de página) só existem com o botão de impressão: nos livros sem ele, o texto é medido
  // no HTML com impressão (mesmo patch, só sem a remoção). Quem lê continua sendo o HTML servido (conferido abaixo).
  let tempMedicao = temp;
  if (ehLivroSemImpressao(livroId)) {
    tempMedicao = path.join(os.tmpdir(), `zuni-auditoria-${livroId}-com-impressao.html`);
    fs.writeFileSync(tempMedicao, (await htmlServido(livroId, { semImpressao: false })).html);
  }

  const browser = await chromium.launch();
  let motor = 'desconhecido';
  {
    const { ctx, page } = await abrirPagina(browser, TELAS[0], tempMedicao);
    await page.waitForTimeout(3000);
    motor = await detectarMotor(page);
    await ctx.close();
  }
  const linhas = [];
  for (const tela of TELAS) {
    for (const fonteMax of [false, true]) {
      if (motor === 'componente' && fonteMax) continue; // sem A−/A+ nesse leitor
      linhas.push({ ...(await auditarCenario(browser, motor === 'estatico' ? temp : tempMedicao, tela, fonteMax, motor)), celular: tela.celular });
    }
  }
  const impressao = [];
  if (ehLivroSemImpressao(livroId)) {
    for (const tela of [TELAS[0], TELAS[1]]) {
      const achados = await controlesDeImpressao(browser, temp, tela);
      if (achados.proibidos.length) impressao.push(`${tela.nome}: ${achados.proibidos.join(', ')}`);
      if (achados.baixarPdfVisivel < 1) impressao.push(`${tela.nome}: botão "Baixar PDF" não está visível`);
    }
  }
  await browser.close();
  for (const f of [temp, tempMedicao]) { try { fs.unlinkSync(f); } catch (e) { /* temporário */ } }

  const falhas = [];
  let pdf = null;
  if (patchFalhou) falhas.push('[LEITOR_PATCH_FALHOU] ' + mensagens.join(' ').slice(0, 160));
  if (impressao.length) falhas.push('botões de imprimir/PDF no HTML servido: ' + impressao.join(' | '));
  if (opcoes.pdf) {
    // Etapa do checklist: PDF gerado, com todo o texto e sem folhas em branco (só a capa, em imagem, não tem texto).
    const { gerar } = require('./gerar-pdf-livro');
    const { resolverPdf } = require('../src/lib/pdfLivro');
    const g = await gerar(livroId, path.join(os.tmpdir(), 'zuni-pdfs-auditoria'));
    pdf = { paginas: g.paginas, mb: g.mb, semTexto: g.semTexto, letrasEsperadas: g.letrasEsperadas, letrasFaltando: g.letrasFaltando, rota: !!resolverPdf(livroId) };
    if (g.patchFalhou) falhas.push('PDF: patch falhou ao gerar');
    if (g.letrasFaltando > 0) falhas.push(`PDF: ${g.letrasFaltando} letra(s)/dígito(s) do leitor ausentes no texto do PDF`);
    const folhasEmBranco = g.semTexto.filter((n) => n !== 1);
    if (folhasEmBranco.length) falhas.push(`PDF: ${folhasEmBranco.length} folha(s) sem texto além da capa [${folhasEmBranco.slice(0, 10).join(',')}]`);
    if (!pdf.rota) falhas.push('PDF: livro sem PDF configurado na rota /livros/:id/pdf (lib/pdfLivro.js)');
  }
  for (const l of linhas) {
    if (l.erro) falhas.push(`${l.tela}/${l.fonte}: erro de medição: ${l.erro}`);
    if (l.cortadas && l.cortadas.length) falhas.push(`${l.tela}/${l.fonte}: ${l.cortadas.length} página(s) com texto cortado`);
    if (l.celular && !l.indisponivel && (l.efetivo == null || l.efetivo < MIN_PX_CELULAR)) falhas.push(`${l.tela}/${l.fonte}: texto efetivo ${l.efetivo == null ? 'não medido' : l.efetivo + ' px'} (< ${MIN_PX_CELULAR} px)`);
  }
  return { livroId, motor, patchFalhou, linhas, falhas, pdf };
}

function imprimir(r) {
  console.log(`\n## ${r.livroId}  (leitor: ${r.motor}; patch: ${r.patchFalhou ? 'FALHOU' : 'ok/não aplicável'})`);
  console.log('tela      fonte   págs corpo | cortadas | só-título | <30% (n/fixas) | texto px | botões sobrepostos');
  for (const l of r.linhas) {
    if (l.indisponivel) { console.log(`${l.tela.padEnd(9)} ${l.fonte.padEnd(7)} (sem A−/A+ neste leitor)`); continue; }
    if (l.erro && l.paginas == null) { console.log(`${l.tela.padEnd(9)} ${l.fonte.padEnd(7)} ERRO ${l.erro}`); continue; }
    console.log(`${l.tela.padEnd(9)} ${l.fonte.padEnd(7)} ${String(l.paginas).padStart(4)} ${String(l.corpo).padStart(5)} | ${String(l.cortadas.length).padStart(3)} [${lista(l.cortadas)}] | ${l.soTitulo.length} [${lista(l.soTitulo, 8)}] | ${l.baixas.length}/${l.fixas} | ${l.efetivo == null ? 'n/d' : l.efetivo} | ${l.sobrepoe == null ? 'n/d' : l.sobrepoe}`);
  }
  if (r.pdf) console.log(`PDF: ${r.pdf.paginas} páginas | ${r.pdf.mb} MB | sem texto: ${r.pdf.semTexto.length ? '[' + r.pdf.semTexto.slice(0, 8).join(',') + ']' : '-'} (a capa em imagem é a página 1) | letras ausentes: ${r.pdf.letrasFaltando}/${r.pdf.letrasEsperadas} | rota configurada: ${r.pdf.rota ? 'sim' : 'NÃO'}`);
  console.log(r.falhas.length ? 'FALHAS:\n  - ' + r.falhas.join('\n  - ') : 'OK — nenhuma falha.');
}

if (require.main === module) {
  const livroId = process.argv[2];
  if (!livroId || livroId.startsWith('--')) {
    console.error('Uso: node scripts/auditar-flipbook.js <livroId> [--json] [--pdf]');
    process.exit(2);
  }
  auditar(livroId, { pdf: process.argv.includes('--pdf') }).then((r) => {
    if (process.argv.includes('--json')) console.log(JSON.stringify(r));
    else imprimir(r);
    process.exit(r.falhas.length ? 1 : 0);
  }).catch((e) => { console.error(e.message); process.exit(2); });
}

module.exports = { auditar, TELAS, MIN_PX_CELULAR };
