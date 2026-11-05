// Fase de estrutura (parte B) — leitor no celular e sem impressão, em Chromium a 390 px. Sem rede, um arquivo por vez.
//
// Para cada obra: aplica o patch REAL do servidor (aplicarPatchLeitor, com semImpressao:true), grava o HTML numa pasta
// temporária, abre a 390×844 (celular, toque), abre o livro e mede:
//   - o leitor entrou em página única (#reader.zs-single);
//   - tamanho efetivo do texto na tela (px) — antes (HTML sem patch) e depois — mínimo aceito: 12 px;
//   - sem rolagem horizontal da página (scrollWidth <= 390);
//   - botão "Baixar PDF" presente na capa, nenhum botão de imprimir/baixar .html, e o clique navega para /pdf;
//   - nenhum erro de JavaScript.
// Grava capturas (capa e leitura) em relatorios/capturas_estrutura/.
//
// Uso: node scripts/testar-celular-estrutura.js [--obras-dir=<pasta com <slug>.html das 5 ilegíveis>]
// Por padrão procura as 5 obras em Documentos\Prontas para subir à loja\_staging.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');
const { aplicarPatchLeitor } = require('../src/lib/leitorMobile');

const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'relatorios', 'capturas_estrutura');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : null; };
const STAGING = arg('obras-dir') || path.join(os.homedir(), 'Documents', 'Prontas para subir à loja', '_staging');

const ILEGIVEIS = ['a-segunda-margem', 'ninguem-avisou-que-ele-morreu', 'o-disfarce-da-alma', 'o-falecido-esta-a-mesa', 'o-lugar-a-mesa']
  .map((slug) => ({ slug, arquivo: path.join(STAGING, slug + '.html'), grupo: 'ilegível hoje' }));
const ATUAIS = ['toda-reuniao-tem-duas-pautas', 'vender-bem-vender-sempre']
  .map((slug) => ({ slug, arquivo: path.join(RAIZ, 'private', 'livros', slug, 'index.html'), grupo: 'obra atual da Loja' }));

const VW = 390, VH = 844, MIN_PX = 12;

async function medir(page) {
  return page.evaluate(({ VW, VH }) => {
    const reader = document.getElementById('reader');
    // primeiro parágrafo visível com texto de verdade; px = tamanho da fonte × escala visual aplicada pelo leitor
    let px = null;
    for (const p of document.querySelectorAll('p')) {
      const r = p.getBoundingClientRect();
      if ((p.textContent || '').trim().length < 60 || r.width < 40 || r.height < 8 || r.right < 0 || r.left > VW || r.top > VH) continue;
      const k = p.offsetWidth ? r.width / p.offsetWidth : 1;
      px = +(parseFloat(getComputedStyle(p).fontSize) * k).toFixed(1);
      break;
    }
    return { single: !!(reader && reader.classList.contains('zs-single')), px, sw: document.documentElement.scrollWidth };
  }, { VW, VH });
}

// Avança (botão de próxima página) até aparecer um parágrafo de texto corrido.
async function lerAteTexto(page, espera) {
  let m = await medir(page);
  for (let i = 0; i < 16 && m.px === null; i++) {
    const nx = await page.$('#btnNext');
    if (!nx) break;
    await nx.click().catch(() => {});
    await page.waitForTimeout(espera);
    m = await medir(page);
  }
  return m;
}

async function abrir(browser, arquivo, errs) {
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
  await page.route(/^https?:/, (r) => r.abort());
  await page.goto('file:///' + arquivo.replace(/\\/g, '/').replace(/ /g, '%20'));
  await page.waitForTimeout(1800);
  return page;
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zuni-celular-'));
  const browser = await chromium.launch();
  const falhas = [];
  console.log(`Leitor no celular (${VW}×${VH}) — patch real do servidor, Chromium sem rede`);
  for (const o of [...ILEGIVEIS, ...ATUAIS]) {
    const linha = [];
    try {
      const original = fs.readFileSync(o.arquivo, 'utf8');
      const r = aplicarPatchLeitor(original, { livroId: o.slug, semImpressao: o.grupo === 'ilegível hoje' ? true : undefined });
      if (!r.ok) throw new Error('patch não aplicado: ' + r.motivo);
      const antesTmp = path.join(tmp, o.slug + '.antes.html'), depoisTmp = path.join(tmp, o.slug + '.depois.html');
      fs.writeFileSync(antesTmp, original); fs.writeFileSync(depoisTmp, r.html);

      // ANTES (sem patch)
      const e0 = []; let p = await abrir(browser, antesTmp, e0);
      const bo = await p.$('#openBtn'); if (bo) { await bo.click().catch(() => {}); await p.waitForTimeout(1500); }
      const antes = await lerAteTexto(p, 1100); await p.close();

      // DEPOIS (com patch): capa, botões, leitura
      const e1 = []; p = await abrir(browser, depoisTmp, e1);
      const botoes = await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.id || '') + ':' + b.textContent.trim()));
      const temPdf = botoes.some((b) => /^btnPdf:.*Baixar PDF/.test(b));
      const temImprimir = botoes.some((b) => /imprimir|btnPrint|btnDownloadPdf/i.test(b));
      await p.screenshot({ path: path.join(SAIDA, `${o.slug}-1-capa.png`) });
      const abre = await p.$('#openBtn'); if (abre) { await abre.click().catch(() => {}); await p.waitForTimeout(1800); }
      const depois = await lerAteTexto(p, 500);
      await p.screenshot({ path: path.join(SAIDA, `${o.slug}-2-leitura.png`) });
      // clique no botão Baixar PDF (na capa, antes de abrir o livro, ou na barra): navega para .../pdf
      let navegou = null;
      if (temPdf) {
        const p2 = await abrir(browser, depoisTmp, []);
        let pediu = false;
        p2.on('request', (rq) => { if (/\/pdf(\?|$)/.test(rq.url())) pediu = true; });
        await p2.evaluate(() => { const b = document.getElementById('btnPdf'); if (b) b.click(); });
        await p2.waitForTimeout(800);
        navegou = pediu; await p2.close();
      }
      await p.close();

      const checagens = [
        ...(o.grupo === 'ilegível hoje' ? [['página única (#reader.zs-single)', depois.single]] : []),
        [`texto ≥ ${MIN_PX}px (antes ${antes.px}px → depois ${depois.px}px)`, depois.px !== null && depois.px >= MIN_PX],
        ['sem rolagem horizontal', depois.sw <= VW],
        ['sem erro de JS', e1.length === 0],
      ];
      if (o.grupo === 'ilegível hoje') {
        checagens.push(['botão Baixar PDF na capa', temPdf], ['sem botão de imprimir/baixar .html', !temImprimir], ['clique em Baixar PDF navega para /pdf', navegou === true]);
      }
      for (const [nome, ok] of checagens) { linha.push(`    ${ok ? 'ok  ' : 'FALHOU'} ${nome}`); if (!ok) falhas.push(`${o.slug}: ${nome}`); }
      console.log(`${o.slug}  [${o.grupo}]`);
      console.log(linha.join('\n'));
    } catch (e) {
      falhas.push(`${o.slug}: ${e.message}`);
      console.log(`${o.slug}  [${o.grupo}]\n    FALHOU ${e.message}`);
    }
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(falhas.length ? `\n${falhas.length} falha(s):\n - ${falhas.join('\n - ')}` : '\nTodas as checagens passaram.');
  console.log('Capturas em ' + path.relative(RAIZ, SAIDA));
  process.exit(falhas.length ? 1 : 0);
})();
