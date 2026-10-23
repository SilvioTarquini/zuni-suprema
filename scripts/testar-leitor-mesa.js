// Teste local (sem rede externa, sem servidor, sem banco) do patch de celular de "Toda Mesa Tem Dois Lados"
// (src/lib/leitorMobileMotorE.js), sobre o HTML exatamente como o servidor o entrega (lerLivroComPatch).
//   - o servidor reconhece o leitor (sem [LEITOR_PATCH_FALHOU]);
//   - celular: modo de rolagem contínua com texto >= 12 px, botões sem sobreposição, sumário e A−/A+ funcionando; sem botão de imprimir/PDF;
//   - o texto exibido no celular é o mesmo do livro (toda palavra do modo rolagem existe nas páginas do próprio leitor);
//   - computador: leitor original, sem o modo de rolagem; cruzar o limite de largura liga e desliga o modo.
// Uso: node scripts/testar-leitor-mesa.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const { lerLivroComPatch, aplicarPatchLeitor } = require('../src/lib/leitorMobile');

const ARQUIVO = path.join(__dirname, '..', 'private', 'livros', 'toda-mesa-tem-dois-lados', 'index.html');
let passaram = 0;
const falhas = [];
async function teste(nome, fn) {
  try { await fn(); passaram++; console.log('  ok   ' + nome); } catch (e) { falhas.push(nome + ' — ' + e.message.split('\n')[0]); console.log('  FAIL ' + nome + ' — ' + e.message.split('\n')[0]); }
}

async function abrir(browser, arquivo, vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.route('**/*', (rt) => (/^(file|data|blob):/.test(rt.request().url()) ? rt.continue() : rt.abort()));
  await page.goto(pathToFileURL(arquivo).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6500);
  return { ctx, page, erros };
}

(async () => {
  const original = fs.readFileSync(ARQUIVO, 'utf8');
  const msgs = [];
  const orig = console.error;
  console.error = (...a) => { msgs.push(a.join(' ')); };
  const servido = await lerLivroComPatch('toda-mesa-tem-dois-lados', ARQUIVO);
  console.error = orig;
  const temp = path.join(os.tmpdir(), 'zuni-teste-leitor-mesa.html');
  fs.writeFileSync(temp, servido);
  // Só para conferir o texto contra as folhas de impressão do livro (o HTML servido não tem como montá-las).
  const comImpressao = await lerLivroComPatch('toda-mesa-tem-dois-lados', ARQUIVO, { semImpressao: false });
  const tempImp = path.join(os.tmpdir(), 'zuni-teste-leitor-mesa-com-impressao.html');
  fs.writeFileSync(tempImp, comImpressao);
  const browser = await chromium.launch();

  await teste('servidor reconhece o leitor: patch aplicado e sem [LEITOR_PATCH_FALHOU]', async () => {
    assert.ok(aplicarPatchLeitor(original).ok);
    assert.ok(!msgs.some((m) => m.includes('[LEITOR_PATCH_FALHOU]')), msgs.join(' '));
    assert.ok(servido.length > original.length);
  });

  const m = await abrir(browser, temp, { width: 390, height: 844 });
  await teste('celular: modo de rolagem montado e leitor original escondido', async () => {
    const r = await m.page.evaluate(() => ({ z: !!document.getElementById('zsScroll'), so: getComputedStyle(document.getElementById('screenOnly')).display }));
    assert.ok(r.z, 'overlay ausente');
    assert.strictEqual(r.so, 'none');
  });
  await teste('celular: texto de leitura com pelo menos 12 px na tela', async () => {
    const px = await m.page.evaluate(() => {
      const ps = [...document.querySelectorAll('#zsCol p, #zsScrollArea div')].filter((e) => e.children.length === 0 && e.textContent.length > 80);
      return Math.min(...ps.slice(0, 40).map((e) => parseFloat(getComputedStyle(e).fontSize) * (e.getBoundingClientRect().width / e.offsetWidth)));
    });
    assert.ok(px >= 12, 'menor texto = ' + px + ' px');
  });
  await teste('celular: botões da barra sem sobreposição e dentro da tela', async () => {
    const r = await m.page.evaluate(() => {
      const bs = [...document.querySelectorAll('#zsScroll > div:first-of-type button')].map((b) => b.getBoundingClientRect());
      let sobre = 0;
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const ix = Math.min(bs[i].right, bs[j].right) - Math.max(bs[i].left, bs[j].left);
        const iy = Math.min(bs[i].bottom, bs[j].bottom) - Math.max(bs[i].top, bs[j].top);
        if (ix > 1 && iy > 1) sobre++;
      }
      return { n: bs.length, sobre, fora: bs.filter((b) => b.left < -1 || b.right > innerWidth + 1).length };
    });
    assert.strictEqual(r.n, 4); // Sumário, A−, A+ e Baixar PDF
    assert.strictEqual(r.sobre, 0);
    assert.strictEqual(r.fora, 0);
  });
  await teste('celular: A+ e A− mudam o tamanho do texto', async () => {
    const tam = () => m.page.evaluate(() => parseFloat(getComputedStyle([...document.querySelectorAll('#zsCol div')].find((e) => e.children.length === 0 && e.textContent.length > 120)).fontSize));
    const a = await tam();
    await m.page.evaluate(() => [...document.querySelectorAll('#zsScroll button')].find((b) => b.textContent === 'A+').click());
    const b = await tam();
    await m.page.evaluate(() => [...document.querySelectorAll('#zsScroll button')].find((x) => x.textContent === 'A−').click());
    const c = await tam();
    assert.ok(b > a && Math.abs(c - a) < 0.01, [a, b, c].join(','));
  });
  await teste('celular: sumário lista os capítulos e leva à seção escolhida', async () => {
    await m.page.evaluate(() => [...document.querySelectorAll('#zsScroll button')].find((b) => b.textContent === 'Sumário').click());
    const itens = await m.page.evaluate(() => [...document.querySelectorAll('#zsScroll button')].filter((b) => /Capítulo \d+/.test(b.textContent)).map((b) => b.textContent));
    assert.ok(itens.length >= 5, 'capítulos no sumário: ' + itens.length);
    await m.page.evaluate(() => [...document.querySelectorAll('#zsScroll button')].find((b) => /Capítulo 2/.test(b.textContent)).click());
    await m.page.waitForTimeout(400);
    const t = await m.page.evaluate(() => {
      const sec = [...document.querySelectorAll('#zsCol section')].find((s) => /Capítulo 2/.test(s.textContent.slice(0, 40)));
      return Math.round(sec.getBoundingClientRect().top - document.getElementById('zsScrollArea').getBoundingClientRect().top);
    });
    assert.ok(Math.abs(t) <= 12, 'topo da seção em ' + t + 'px');
  });
  await teste('celular: só "Baixar PDF" (rota /pdf); sem botão de imprimir nem "Baixar em PDF" no HTML servido', async () => {
    const achados = await m.page.evaluate(() => [...document.querySelectorAll('#zsScroll button, #zsScroll a')]
      .filter((e) => /imprimir|pdf/i.test((e.textContent || '') + ' ' + (e.getAttribute('title') || '') + ' ' + (e.getAttribute('aria-label') || ''))).map((e) => e.textContent.trim()));
    assert.deepStrictEqual(achados, ['Baixar PDF']);
    assert.ok(!(await m.page.evaluate(() => !!document.querySelector('#printPages'))), '#printPages não deveria existir sem pedir impressão');
  });
  await teste('celular: todas as palavras do modo rolagem existem nas páginas do próprio livro', async () => {
    const mi = await abrir(browser, tempImp, { width: 390, height: 844 });
    await mi.page.evaluate(() => { window.print = () => {}; });
    await mi.page.evaluate(() => [...document.querySelectorAll('#zsScroll button')].find((b) => b.textContent === 'Baixar em PDF').click());
    await mi.page.waitForTimeout(1500);
    const r = await mi.page.evaluate(() => {
      const pp = document.getElementById('printPages');
      pp.style.display = 'block';
      // sem diferenciar caixa (os títulos de nota saem em maiúsculas nas páginas do livro) e sem o ornamento do fim
      const conta = (t) => { const mp = new Map(); for (const w of t.toLowerCase().split(/\s+/).filter((x) => x && x !== '✦')) mp.set(w, (mp.get(w) || 0) + 1); return mp; };
      const rol = conta(document.getElementById('zsCol').innerText);
      const liv = conta(pp.innerText);
      pp.style.display = '';
      let faltam = 0, total = 0;
      const ex = [];
      for (const [w, n] of rol) { total += n; const d = n - (liv.get(w) || 0); if (d > 0) { faltam += d; if (ex.length < 5) ex.push(w + 'x' + d); } }
      return { total, faltam, ex };
    });
    await mi.ctx.close();
    assert.ok(r.total > 5000, 'texto curto demais: ' + r.total);
    assert.strictEqual(r.faltam, 0, JSON.stringify(r));
  });
  await teste('celular: sem erro de JavaScript', async () => { assert.deepStrictEqual(m.erros, []); });
  await m.ctx.close();

  const d = await abrir(browser, temp, { width: 1366, height: 768 });
  await teste('computador: leitor original, sem o modo de rolagem', async () => {
    const r = await d.page.evaluate(() => ({ z: !!document.getElementById('zsScroll'), so: getComputedStyle(document.getElementById('screenOnly')).display }));
    assert.strictEqual(r.z, false);
    assert.notStrictEqual(r.so, 'none');
  });
  await teste('largura cruzando 820 px liga e desliga o modo de rolagem', async () => {
    await d.page.setViewportSize({ width: 390, height: 844 });
    await d.page.waitForTimeout(600);
    assert.ok(await d.page.evaluate(() => !!document.getElementById('zsScroll')), 'não ligou');
    await d.page.setViewportSize({ width: 1366, height: 768 });
    await d.page.waitForTimeout(600);
    assert.ok(await d.page.evaluate(() => !document.getElementById('zsScroll') && getComputedStyle(document.getElementById('screenOnly')).display !== 'none'), 'não desligou');
  });
  await teste('computador: sem erro de JavaScript', async () => { assert.deepStrictEqual(d.erros, []); });
  await d.ctx.close();

  await browser.close();
  for (const f of [temp, tempImp]) { try { fs.unlinkSync(f); } catch (e) { /* temporário */ } }
  console.log('\nTotal: ' + (passaram + falhas.length) + ' | Passaram: ' + passaram + ' | Falharam: ' + falhas.length);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — leitor da Mesa (rolagem no celular, computador inalterado).');
})().catch((e) => { console.error(e); process.exit(2); });
