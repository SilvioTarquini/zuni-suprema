// Teste local (sem rede externa, sem servidor, sem Supabase) da Rodada 2 — pontos de texto/configuração:
//   R2.5 página de acesso expirado sem promessa de renovação, com o mesmo WhatsApp do checkout;
//   R2.6 prazo de leitura vindo de LIVRO_ACESSO_DIAS (nunca fixo no HTML): página da obra renderizada no servidor,
//        endpoint de configuração e as duas páginas estáticas (checkout e loja) que o consomem;
//   paginador: só os dois livros auditados recebem a correção.
// Uso: node scripts/testar-rodada2-correcoes.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

const raiz = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
let passaram = 0;
const falhas = [];
async function teste(nome, fn) {
  try { await fn(); passaram++; console.log('  ok   ' + nome); } catch (e) { falhas.push(nome + ' — ' + e.message.split('\n')[0]); console.log('  FAIL ' + nome + ' — ' + e.message.split('\n')[0]); }
}
// executa um trecho com LIVRO_ACESSO_DIAS definido (a constante é lida na carga do módulo)
function comEnv(valor, codigo) {
  const env = { ...process.env, SUPABASE_URL: '', SUPABASE_KEY: '' };
  if (valor === undefined) delete env.LIVRO_ACESSO_DIAS; else env.LIVRO_ACESSO_DIAS = valor;
  return execFileSync(process.execPath, ['-e', codigo], { cwd: raiz, env, encoding: 'utf8' }).trim();
}
const PRAZO = "const {textoPrazoLeitura}=require('./src/lib/prazoAcesso');process.stdout.write(textoPrazoLeitura())";
const PAGINA = "const {renderizarExperimenteObra}=require('./src/lib/experimenteObra');const r=renderizarExperimenteObra({livroId:'vender-bem-vender-sempre'});const m=r.html.match(/<p class=\"prazo-leitura\">([^<]*)<\\/p>/);process.stdout.write(r.status+'|'+(m?m[1]:'SEM'))";

(async () => {
  await teste('R2.5 expirado: sem promessa de renovação, com WhatsApp do checkout e botão "Voltar à loja"', () => {
    const h = ler('public/livros/_acesso-expirado.html');
    assert.ok(h.includes('O período de leitura deste livro no site terminou. O seu PDF continua disponível para baixar e guardar. Se precisar de ajuda, fale com a gente pelo'));
    assert.ok(!/renova/i.test(h), 'ainda fala em renovação');
    const wa = (ler('public/checkout-livro.html').match(/https:\/\/wa\.me\/(\d+)/) || [])[1];
    assert.ok(wa && h.includes('https://wa.me/' + wa), 'WhatsApp diferente do checkout');
    assert.ok(h.includes('href="/loja">Voltar à loja</a>'));
  });
  await teste('R2.6 prazo: texto vem de LIVRO_ACESSO_DIAS (90 → "por 90 dias"; 30; 1 → "1 dia"; ausente → 7)', () => {
    assert.strictEqual(comEnv('90', PRAZO), 'Você recebe o livro em PDF para guardar e pode ler no site por 90 dias.');
    assert.strictEqual(comEnv('30', PRAZO), 'Você recebe o livro em PDF para guardar e pode ler no site por 30 dias.');
    assert.strictEqual(comEnv('1', PRAZO), 'Você recebe o livro em PDF para guardar e pode ler no site por 1 dia.');
    assert.strictEqual(comEnv(undefined, PRAZO), 'Você recebe o livro em PDF para guardar e pode ler no site por 7 dias.');
  });
  await teste('R2.6 prazo: valor inválido não vira promessa (nada é exibido)', () => {
    assert.strictEqual(comEnv('abc', PRAZO), '');
    assert.strictEqual(comEnv('0', PRAZO), '');
    assert.strictEqual(comEnv('-5', PRAZO), '');
  });
  await teste('R2.6 página da obra (/experimente/<id>/): prazo renderizado no servidor, perto do botão de compra', () => {
    assert.strictEqual(comEnv('90', PAGINA), '200|Você recebe o livro em PDF para guardar e pode ler no site por 90 dias.');
    assert.strictEqual(comEnv('30', PAGINA), '200|Você recebe o livro em PDF para guardar e pode ler no site por 30 dias.');
    const t = ler('templates/experimente-obra.html');
    assert.ok(t.indexOf('{{PRAZO_BLOCK}}') > t.indexOf('btn-primario" href="{{CHECKOUT_URL}}"'), 'prazo não está depois do botão de compra');
  });
  await teste('R2.6 nenhuma página tem o número de dias escrito no HTML', () => {
    for (const rel of ['public/checkout-livro.html', 'public/loja/index.html', 'templates/experimente-obra.html']) {
      const h = ler(rel);
      assert.ok(!/Leitura no site por\s*\d/i.test(h) && !/por\s+\d+\s+dias/i.test(h.replace(/primeiros 30 dias/g, '')), rel + ' tem prazo fixo');
    }
  });
  await teste('R2.6 endpoint de configuração existe no servidor e só devolve prazo (sem dados de cliente)', () => {
    const srv = ler('src/server.js');
    const i = srv.indexOf("app.get('/api/config/prazo-acesso'");
    assert.ok(i > 0, 'rota ausente');
    const trecho = srv.slice(i, i + 760);
    assert.ok(/res\.json\(\{ dias: diasParaExibir\(\), texto: textoPrazoLeitura\(livro\) \}\)/.test(trecho), trecho);
    // o único parâmetro lido é ?livro=<id> (validado); nada de e-mail, token, corpo da requisição ou banco
    const rota = trecho.slice(0, trecho.indexOf('res.json(') + 80);
    assert.ok(/req\.query\.livro/.test(rota) && !/req\.body|email|token|supabase/i.test(rota), rota);
  });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  let respostaPrazo = { status: 200, json: { dias: 90, texto: 'Você recebe o livro em PDF para guardar e pode ler no site por 90 dias.' } };
  await page.route('**/*', async (rt) => {
    const u = new URL(rt.request().url());
    if (u.hostname === 'teste.local') {
      if (u.pathname === '/api/config/prazo-acesso') return rt.fulfill({ status: respostaPrazo.status, contentType: 'application/json', body: JSON.stringify(respostaPrazo.json) });
      if (u.pathname === '/checkout-livro.html') return rt.fulfill({ path: path.join(raiz, 'public/checkout-livro.html'), contentType: 'text/html' });
      if (u.pathname === '/loja/') return rt.fulfill({ path: path.join(raiz, 'public/loja/index.html'), contentType: 'text/html' });
      return rt.fulfill({ status: 404, body: '' });
    }
    return rt.abort();
  });

  await teste('R2.6 checkout-livro.html: mostra o prazo vindo do servidor, logo abaixo do aviso digital', async () => {
    respostaPrazo = { status: 200, json: { dias: 90, texto: 'Você recebe o livro em PDF para guardar e pode ler no site por 90 dias.' } };
    await page.goto('http://teste.local/checkout-livro.html?livro=vender-bem-vender-sempre');
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const p = document.getElementById('prazo-leitura');
      const av = document.querySelector('.aviso-digital');
      return { visivel: !p.hidden, texto: p.textContent, apos: av.nextElementSibling === p };
    });
    assert.ok(r.visivel && r.apos, JSON.stringify(r));
    assert.strictEqual(r.texto, 'Você recebe o livro em PDF para guardar e pode ler no site por 90 dias.');
  });
  await teste('R2.6 checkout-livro.html: se o servidor não responder, nada é exibido', async () => {
    respostaPrazo = { status: 500, json: {} };
    await page.goto('http://teste.local/checkout-livro.html?livro=vender-bem-vender-sempre');
    await page.waitForTimeout(800);
    assert.ok(await page.evaluate(() => document.getElementById('prazo-leitura').hidden));
  });
  await teste('R2.6 loja: o trecho "prazo determinado" ganha o número; sem resposta, fica o texto genérico', async () => {
    respostaPrazo = { status: 200, json: { dias: 90, texto: 'Você recebe o livro em PDF para guardar e pode ler no site por 90 dias.' } };
    await page.goto('http://teste.local/loja/');
    await page.waitForTimeout(800);
    const com = await page.evaluate(() => document.getElementById('prazo-loja').textContent);
    assert.ok(com.endsWith('Você recebe o livro em PDF para guardar e pode ler no site por 90 dias.'), com);
    assert.ok(!com.includes('prazo determinado'));
    respostaPrazo = { status: 500, json: {} };
    await page.goto('http://teste.local/loja/');
    await page.waitForTimeout(800);
    assert.ok((await page.evaluate(() => document.getElementById('prazo-loja').textContent)).includes('prazo determinado'));
  });
  await browser.close();

  await teste('paginador: patch só nos dois livros auditados; os demais do mesmo motor ficam como estavam', () => {
    const { aplicarPatchLeitor } = require('../src/lib/leitorMobile');
    const lerLivro = (id) => fs.readFileSync(path.join(raiz, 'private', 'livros', id, 'index.html'), 'utf8');
    for (const id of ['vender-bem-vender-sempre', 'toda-reuniao-tem-duas-pautas']) {
      const r = aplicarPatchLeitor(lerLivro(id), { livroId: id });
      assert.ok(r.ok && r.html.includes('zsAjustar'), id + ' sem correção do paginador');
    }
    const outro = aplicarPatchLeitor(lerLivro('a-arte-da-presenca-masculina'), { livroId: 'a-arte-da-presenca-masculina' });
    assert.ok(outro.ok && !outro.html.includes('zsAjustar'));
  });

  console.log('\nTotal: ' + (passaram + falhas.length) + ' | Passaram: ' + passaram + ' | Falharam: ' + falhas.length);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — Rodada 2 (R2.5, R2.6, paginador) verificada.');
})().catch((e) => { console.error(e); process.exit(2); });
