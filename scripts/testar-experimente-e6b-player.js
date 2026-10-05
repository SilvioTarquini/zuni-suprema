// Teste de COMPORTAMENTO do player da amostra do audiobook (E6B + botão Parar) em Chromium real (Playwright),
// sem servidor, sem rede e sem Pinterest: a página renderizada pelo código de produção é servida por rotas
// interceptadas em um domínio falso, e o MP3 curto vem do disco. Nenhuma requisição sai da máquina.
// Uso: node scripts/testar-experimente-e6b-player.js   (pula com aviso se o Playwright/Chromium não estiver disponível)
const assert = require('assert');
const fs = require('fs');
const path = require('path');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

const raiz = path.join(__dirname, '..');
const { renderizarExperimenteObra } = require(path.join(raiz, 'src/lib/experimenteObra'));
const MP3 = fs.readFileSync(path.join(raiz, 'public/audio/amostras/ela-tem-classe.mp3'));
const HTML = renderizarExperimenteObra({ livroId: 'ela-tem-classe', origem: 'universo-feminino' }).html;

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); ok++; console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); }
}

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(raiz, 'node_modules/playwright'))); } catch (e) { console.log('PULADO: Playwright indisponível.'); return; }
  let browser;
  try { browser = await chromium.launch(); } catch (e) { console.log('PULADO: Chromium indisponível (' + String(e.message).split('\n')[0] + ').'); return; }

  console.log('E6B — comportamento do player (Ouvir / Pausar / Continuar / Parar / Recomeçar)\n');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const externos = [], naoGet = [], erros = [], requisicoes = [];
  await ctx.route('**/*', (route) => {
    const req = route.request(); const u = new URL(req.url());
    requisicoes.push(req.method() + ' ' + u.host + u.pathname);
    if (req.method() !== 'GET') naoGet.push(req.method());
    if (u.host !== 'zuni.test') { externos.push(u.host); return route.abort(); }
    if (u.pathname === '/experimente/ela-tem-classe/') return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML });
    if (u.pathname === '/audio/amostras/ela-tem-classe.mp3') {
      const r = req.headers()['range'];
      if (r) { const m = /bytes=(\d+)-(\d*)/.exec(r); const ini = +m[1], fim = m[2] ? +m[2] : MP3.length - 1; return route.fulfill({ status: 206, headers: { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${ini}-${fim}/${MP3.length}` }, body: MP3.slice(ini, fim + 1) }); }
      return route.fulfill({ status: 200, headers: { 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes' }, body: MP3 });
    }
    if (u.pathname === '/loja/capas/ela-tem-classe.jpg') return route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(path.join(raiz, 'public/loja/capas/ela-tem-classe.jpg')) });
    return route.fulfill({ status: 404, body: '' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) erros.push(m.text()); });
  await page.goto('http://zuni.test/experimente/ela-tem-classe/', { waitUntil: 'load' });

  const est = () => page.evaluate(() => {
    const a = document.getElementById('audio-player'); const vis = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.offsetParent !== null; };
    return { paused: a.paused, t: +a.currentTime.toFixed(2), rotulo: document.getElementById('audio-rotulo').textContent, parar: vis('audio-parar'), recomecar: vis('audio-recomecar'), progresso: vis('audio-progresso-caixa'), barra: document.getElementById('audio-barra').style.width, tempo: document.getElementById('audio-tempo').textContent, status: document.getElementById('audio-status').textContent };
  });

  await teste('H. estado inicial: sem autoplay, só "Ouvir amostra"; Parar, Recomeçar e progresso ocultos', async () => {
    await page.waitForTimeout(500);
    const s = await est();
    assert.deepStrictEqual([s.paused, s.t, s.rotulo, s.parar, s.recomecar, s.progresso], [true, 0, 'Ouvir amostra', false, false, false]);
    assert.ok(!requisicoes.some((r) => /\.mp3/.test(r)), 'preload="none": o MP3 só é pedido depois do clique');
  });
  await teste('toca ao clicar: Pausar + Parar + Recomeçar aparecem, tempo avança', async () => {
    await page.click('#audio-tocar'); await page.waitForTimeout(1800);
    const s = await est();
    assert.strictEqual(s.paused, false); assert.ok(s.t > 0.5, 'tempo avançou: ' + s.t);
    assert.deepStrictEqual([s.rotulo, s.parar, s.recomecar, s.progresso], ['Pausar', true, true, true]);
    assert.ok(/^0:0\d de 1:0[45]$/.test(s.tempo), s.tempo);
  });
  await teste('G. Pausar → "Continuar" (Parar e Recomeçar permanecem); Continuar retoma de onde parou', async () => {
    await page.click('#audio-tocar'); await page.waitForTimeout(300);
    const p = await est();
    assert.deepStrictEqual([p.paused, p.rotulo, p.parar, p.recomecar], [true, 'Continuar', true, true]);
    assert.ok(p.t > 0.5);
    await page.click('#audio-tocar'); await page.waitForTimeout(700);
    const c = await est();
    assert.strictEqual(c.paused, false); assert.ok(c.t >= p.t, 'retomou sem voltar ao início');
    assert.strictEqual(c.rotulo, 'Pausar');
  });
  await teste('D. Parar DURANTE a reprodução: pausa, tempo 0, progresso 0, estado inicial, botão "Ouvir amostra"', async () => {
    const antes = await est(); assert.strictEqual(antes.paused, false);
    await page.click('#audio-parar'); await page.waitForTimeout(500);
    const s = await est();
    // O texto do tempo fica dentro da caixa de progresso, que está oculta: o que a pessoa vê é só o estado inicial.
    assert.deepStrictEqual([s.paused, s.t, s.rotulo, s.parar, s.recomecar, s.progresso, s.barra], [true, 0, 'Ouvir amostra', false, false, false, '0%']);
    assert.ok(s.tempo === '' || s.tempo.startsWith('0:00'), 'tempo: ' + s.tempo);
    await page.waitForTimeout(800);
    assert.strictEqual((await est()).t, 0, 'o áudio não continua tocando');
    assert.strictEqual(await page.evaluate(() => document.activeElement && document.activeElement.id), 'audio-tocar', 'foco volta ao botão principal');
  });
  await teste('E. Parar com o áudio PAUSADO: tempo 0 e estado inicial', async () => {
    await page.click('#audio-tocar'); await page.waitForTimeout(1200);
    await page.click('#audio-tocar'); await page.waitForTimeout(300);
    const p = await est(); assert.deepStrictEqual([p.paused, p.rotulo], [true, 'Continuar']); assert.ok(p.t > 0.3);
    await page.click('#audio-parar'); await page.waitForTimeout(400);
    const s = await est();
    assert.deepStrictEqual([s.paused, s.t, s.rotulo, s.parar, s.recomecar, s.progresso, s.barra], [true, 0, 'Ouvir amostra', false, false, false, '0%']);
  });
  await teste('F. Recomeçar volta ao início e continua tocando', async () => {
    await page.click('#audio-tocar'); await page.waitForTimeout(1600);
    const antes = await est(); assert.ok(antes.t > 1);
    await page.click('#audio-recomecar'); await page.waitForTimeout(400);
    const s = await est();
    assert.strictEqual(s.paused, false); assert.ok(s.t < antes.t && s.t < 1.2, 'voltou ao início: ' + s.t);
    assert.strictEqual(s.rotulo, 'Pausar');
  });
  await teste('fim natural: o estado volta ao inicial (Ouvir amostra, 0:00, sem Parar/Recomeçar) e o áudio não recomeça sozinho', async () => {
    await page.evaluate(() => { const a = document.getElementById('audio-player'); a.currentTime = Math.max(0, a.duration - 0.6); });
    await page.waitForTimeout(1800);
    const s = await est();
    assert.deepStrictEqual([s.paused, s.t, s.rotulo, s.parar, s.recomecar, s.progresso, s.barra], [true, 0, 'Ouvir amostra', false, false, false, '0%']);
    assert.strictEqual(s.status, 'Fim da amostra.');
  });
  await teste('replay depois do fim e depois de Parar: "Ouvir amostra" toca de novo', async () => {
    await page.click('#audio-tocar'); await page.waitForTimeout(1000);
    const s = await est(); assert.strictEqual(s.paused, false); assert.strictEqual(s.rotulo, 'Pausar');
    await page.click('#audio-parar'); await page.waitForTimeout(300);
  });
  await teste('touch targets ≥ 44 px (incl. Parar) e Parar acessível por teclado', async () => {
    await page.click('#audio-tocar'); await page.waitForTimeout(800);
    const caixas = await page.$$eval('#audio-tocar, #audio-parar, #audio-recomecar', (n) => n.map((e) => { const r = e.getBoundingClientRect(); return [e.id, Math.round(r.width), Math.round(r.height)]; }));
    caixas.forEach(([id, w, h]) => assert.ok(w >= 44 && h >= 44, id + ' ' + w + 'x' + h));
    assert.strictEqual(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'sem overflow horizontal');
    await page.focus('#audio-parar'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const s = await est(); assert.deepStrictEqual([s.paused, s.t, s.rotulo], [true, 0, 'Ouvir amostra']);
  });
  await teste('saída da página: pagehide pausa o áudio (sem telemetria, sem storage)', async () => {
    await page.click('#audio-tocar'); await page.waitForTimeout(800);
    assert.strictEqual((await est()).paused, false);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await page.waitForTimeout(300);
    assert.strictEqual((await est()).paused, true);
    const usoStorage = await page.evaluate(() => localStorage.length + sessionStorage.length);
    assert.strictEqual(usoStorage, 0, 'o player não grava storage');
  });
  await teste('J/I/K. nenhum POST causado pelo player, nenhum erro de console, nenhum host externo exceto a tag do Pinterest bloqueada; a única mídia é a amostra', async () => {
    assert.deepStrictEqual(naoGet, []);
    assert.deepStrictEqual(erros, []);
    assert.ok(externos.every((h) => /pinimg\.com|pinterest\.com/.test(h)), 'externos: ' + externos.join(','));
    const midias = requisicoes.filter((r) => /\.(mp3|wav|ogg|m4a|mp4)\b/i.test(r));
    assert.ok(midias.length >= 1 && midias.every((r) => r === 'GET zuni.test/audio/amostras/ela-tem-classe.mp3'), midias.join(' | '));
  });

  // Sem JavaScript: o player nativo continua sendo o fallback e Parar nem aparece.
  const ctxSemJs = await browser.newContext({ javaScriptEnabled: false });
  await ctxSemJs.route('**/*', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML }));
  const p2 = await ctxSemJs.newPage(); await p2.goto('http://zuni.test/experimente/ela-tem-classe/');
  await teste('sem JavaScript: player nativo visível com controles; Parar/Recomeçar/UI ocultos', async () => {
    assert.strictEqual(await p2.locator('#audio-player').isVisible(), true);
    assert.strictEqual(await p2.locator('#audio-parar').isVisible(), false);
    assert.strictEqual(await p2.locator('#audio-ui').isVisible(), false);
  });
  await browser.close();

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${total - ok}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — player: Parar encerra a audição e volta ao início; sem autoplay, sem POST, sem erro.');
})();
