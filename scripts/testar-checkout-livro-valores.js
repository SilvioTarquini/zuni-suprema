// checkout-livro.html — o valor mostrado na tela e o da sessão do Stripe nunca divergem.
//
// A sessão do Stripe é imutável (valor e audiolivro ficam fixados no servidor ao criá-la). Antes da correção, aplicar um cupom ou
// marcar o audiolivro DEPOIS de "Comprar agora" só mudava o texto da tela: o botão "Pagar" cobrava o valor antigo e não havia
// caminho para o acesso gratuito do cupom de 100%.
//
// Chromium com interceptação (sem rede externa, nada gravado em lugar nenhum): a página real (public/checkout-livro.html) é servida
// por um servidor local; as APIs (/api/livros/catalogo, /api/validar-cupom, /api/checkout/livro/stripe-session…) e o Stripe.js são
// SIMULADOS com a mesma regra do servidor (preço base do catálogo + audiolivro, desconto sobre o total, total 0 → cupom100).
// Cenários: cupom antes e depois do clique; áudio antes e depois do clique; cupom de 100% depois do Stripe montado → fluxo gratuito;
// mesmo cupom reaplicado (não derruba); mudança durante a criação da sessão (a sessão velha não é montada).
// Uso: node scripts/testar-checkout-livro-valores.js

const assert = require('assert');
const path = require('path');
const express = require('express');
const { chromium } = require('playwright');
const { buscarLivro, serializarLivroCatalogo } = require('../src/lib/catalogoLivros');

const LIVRO = 'codigo-feminino'; // tem audiolivro no catálogo
const livro = buscarLivro(LIVRO);
const BASE = livro.precoPromocional || livro.preco; const AUDIO = livro.precoAudiobook;
const reais = (n) => `R$ ${n.toFixed(2).replace('.', ',')}`;
const CUPONS = { CUPOM10: 10, CUPOM100: 100 };
const total = (audio, cupom) => { const b = Math.round((BASE + (audio ? AUDIO : 0)) * 100) / 100; return cupom ? Math.round(b * (100 - CUPONS[cupom])) / 100 : b; };

const FAKE_STRIPE = `window.__stripe = { montados: 0, destruidos: 0 };
window.Stripe = function () { return { createEmbeddedCheckoutPage: async function (o) { const cs = await o.fetchClientSecret(); return {
  mount: function (sel) { window.__stripe.montados++; document.querySelector(sel).innerHTML = '<div id="stripe-falso">[Stripe] ' + cs + ' <button>Pagar</button></div>'; },
  destroy: function () { window.__stripe.destruidos++; } }; } }; };`;

let totalTestes = 0; const falhas = [];
async function teste(nome, fn) { totalTestes++; try { await fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }

(async () => {
  const app = express();
  const sessoes = []; let atrasoSessaoMs = 0;
  app.get('/api/livros/catalogo/:id', (req, res) => res.json(serializarLivroCatalogo(LIVRO, livro)));
  app.get('/api/config/prazo-acesso', (req, res) => res.json({ dias: 90, texto: '' }));
  app.get('/api/stripe/public-key', (req, res) => res.json({ publicKey: 'pk_test_falsa' }));
  app.get('/api/validar-cupom', (req, res) => {
    const c = String(req.query.codigo || '').toUpperCase(); const audio = req.query.audiolivroIncluido === 'true';
    if (!CUPONS[c]) return res.status(404).json({ valido: false, error: 'Cupom inválido ou expirado.' });
    const orig = total(audio, null); const fin = total(audio, c);
    res.json({ valido: true, tipo: 'percentual', percentual: CUPONS[c], precoOriginal: orig, desconto: Math.round((orig - fin) * 100) / 100, precoFinal: fin });
  });
  app.post('/api/checkout/livro/stripe-session', express.json(), async (req, res) => {
    const { cupom, audiolivroIncluido } = req.body; const valor = total(Boolean(audiolivroIncluido), cupom ? String(cupom).toUpperCase() : null);
    sessoes.push({ cupom: cupom || null, audio: Boolean(audiolivroIncluido), valor });
    if (atrasoSessaoMs) await new Promise((r) => setTimeout(r, atrasoSessaoMs));
    if (valor === 0) return res.json({ pedidoId: 'p', cupom100: true, token: 'TOKEN-GRATIS' });
    res.json({ pedidoId: 'p', clientSecret: `sessao-de-${reais(valor)}${audiolivroIncluido ? '-com-audio' : ''}` });
  });
  app.get('/livros/:id', (req, res) => res.send(`<h1>livro aberto token=${req.query.token}</h1>`));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();

  async function abrir() {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
    const page = await ctx.newPage(); const erros = []; page.on('pageerror', (e) => erros.push(e.message));
    await page.route('**/*', (rt) => { const u = rt.request().url(); if (u.includes('js.stripe.com/v3')) return rt.fulfill({ contentType: 'application/javascript', body: FAKE_STRIPE }); return /^http:\/\/127\.0\.0\.1/.test(u) || /^(data|blob):/.test(u) ? rt.continue() : rt.abort(); });
    sessoes.length = 0; atrasoSessaoMs = 0;
    await page.goto(`${base}/checkout-livro.html?livro=${LIVRO}`, { waitUntil: 'networkidle' });
    await page.fill('#name', 'Teste'); await page.fill('#email', 'teste@example.invalid');
    const api = {
      page, erros,
      cupom: async (c) => { if (await page.isVisible('#cupom-toggle')) await page.click('#cupom-toggle'); await page.fill('#cupom-input', c); await page.click('#cupom-form button'); await page.waitForTimeout(700); },
      audio: async (marcar) => { await page.setChecked('#audiolivro-checkbox', marcar); await page.waitForTimeout(700); },
      comprar: async () => { await page.click('#btn-continuar'); await page.waitForTimeout(900); },
      estado: () => page.evaluate(() => ({
        preco: document.getElementById('preco-livro').textContent, botao: document.getElementById('btn-continuar').textContent,
        botaoVisivel: getComputedStyle(document.getElementById('btn-continuar')).display !== 'none', botaoHabilitado: !document.getElementById('btn-continuar').disabled,
        stripeVisivel: getComputedStyle(document.getElementById('stripe-checkout-container')).display !== 'none',
        stripeTexto: (document.getElementById('stripe-falso') || {}).textContent || null,
        aviso: (() => { const e = document.getElementById('aviso-valores'); return e ? !e.hidden : false; })(), montados: window.__stripe ? window.__stripe.montados : 0, destruidos: window.__stripe ? window.__stripe.destruidos : 0, url: location.pathname + location.search
      }))
    };
    return { api, fechar: () => ctx.close() };
  }

  console.log('Cupom');
  await teste('cupom ANTES do clique: a sessão nasce com o desconto e nada é derrubado', async () => {
    const { api, fechar } = await abrir(); await api.cupom('CUPOM10'); await api.comprar(); const e = await api.estado();
    assert.deepStrictEqual(sessoes, [{ cupom: 'CUPOM10', audio: false, valor: total(false, 'CUPOM10') }]);
    assert.ok(e.stripeVisivel && e.stripeTexto.includes(reais(total(false, 'CUPOM10'))) && e.destruidos === 0 && !e.aviso, JSON.stringify(e)); await fechar();
  });
  await teste('cupom DEPOIS do clique: a caixa antiga é destruída, o botão volta, aparece o aviso; o novo clique cria sessão com o desconto', async () => {
    const { api, fechar } = await abrir(); await api.comprar();
    let e = await api.estado(); assert.ok(e.stripeVisivel && e.stripeTexto.includes(reais(total(false, null))) && !e.botaoVisivel);
    await api.cupom('CUPOM10'); e = await api.estado();
    assert.ok(!e.stripeVisivel && e.stripeTexto === null && e.destruidos === 1, 'caixa antiga não foi destruída: ' + JSON.stringify(e));
    assert.ok(e.botaoVisivel && e.botaoHabilitado && e.botao === 'Comprar agora' && e.aviso && e.preco === reais(total(false, 'CUPOM10')), JSON.stringify(e));
    await api.comprar(); e = await api.estado();
    assert.strictEqual(sessoes.length, 2); assert.strictEqual(sessoes[1].cupom, 'CUPOM10');
    assert.ok(e.stripeVisivel && e.stripeTexto.includes(reais(total(false, 'CUPOM10'))) && !e.aviso, JSON.stringify(e)); await fechar();
  });
  await teste('o MESMO cupom reaplicado depois do clique não derruba a sessão (nada mudou)', async () => {
    const { api, fechar } = await abrir(); await api.cupom('CUPOM10'); await api.comprar(); await api.cupom('CUPOM10'); const e = await api.estado();
    assert.ok(e.stripeVisivel && e.destruidos === 0 && sessoes.length === 1 && !e.aviso, JSON.stringify(e)); await fechar();
  });
  console.log('Audiolivro');
  await teste('áudio ANTES do clique: a sessão nasce com o audiolivro e o total certo', async () => {
    const { api, fechar } = await abrir(); await api.audio(true); await api.comprar(); const e = await api.estado();
    assert.deepStrictEqual(sessoes, [{ cupom: null, audio: true, valor: total(true, null) }]);
    assert.ok(e.stripeVisivel && e.stripeTexto.includes(reais(total(true, null))) && e.destruidos === 0, JSON.stringify(e)); await fechar();
  });
  await teste('áudio DEPOIS do clique: a caixa sem áudio é destruída; o novo clique cria sessão com áudio', async () => {
    const { api, fechar } = await abrir(); await api.comprar(); await api.audio(true); let e = await api.estado();
    assert.ok(!e.stripeVisivel && e.destruidos === 1 && e.botaoVisivel && e.aviso && e.preco === reais(total(true, null)), JSON.stringify(e));
    await api.comprar(); e = await api.estado();
    assert.deepStrictEqual(sessoes[1], { cupom: null, audio: true, valor: total(true, null) });
    assert.ok(e.stripeVisivel && e.stripeTexto.includes(reais(total(true, null))), JSON.stringify(e)); await fechar();
  });
  await teste('desmarcar o áudio depois do clique também derruba a caixa (o valor mudou para menos)', async () => {
    const { api, fechar } = await abrir(); await api.audio(true); await api.comprar(); await api.audio(false); const e = await api.estado();
    assert.ok(!e.stripeVisivel && e.destruidos === 1 && e.aviso && e.preco === reais(total(false, null)), JSON.stringify(e)); await fechar();
  });
  console.log('Cupom de 100% (fluxo gratuito)');
  await teste('cupom de 100% ANTES do clique: botão "Receber meu acesso gratuito"; o clique vai direto ao livro, sem montar o Stripe', async () => {
    const { api, fechar } = await abrir(); await api.cupom('CUPOM100'); let e = await api.estado();
    assert.ok(e.botao === 'Receber meu acesso gratuito' && e.preco === 'R$ 0,00', JSON.stringify(e));
    await api.page.click('#btn-continuar'); await api.page.waitForURL(/\/livros\//, { timeout: 5000 });
    assert.ok(api.page.url().includes('/livros/' + LIVRO + '?token=TOKEN-GRATIS')); assert.deepStrictEqual(sessoes, [{ cupom: 'CUPOM100', audio: false, valor: 0 }]); await fechar();
  });
  await teste('cupom de 100% DEPOIS do Stripe montado: a caixa de R$ valor cheio some, o botão vira "Receber meu acesso gratuito" e leva ao fluxo gratuito', async () => {
    const { api, fechar } = await abrir(); await api.comprar();
    let e = await api.estado(); assert.ok(e.stripeVisivel && e.stripeTexto.includes(reais(total(false, null))));
    await api.cupom('CUPOM100'); e = await api.estado();
    assert.ok(!e.stripeVisivel && e.destruidos === 1 && e.botaoVisivel && e.botao === 'Receber meu acesso gratuito' && e.preco === 'R$ 0,00' && e.aviso, JSON.stringify(e));
    await api.page.click('#btn-continuar'); await api.page.waitForURL(/\/livros\//, { timeout: 5000 });
    assert.ok(api.page.url().includes('?token=TOKEN-GRATIS'));
    assert.deepStrictEqual(sessoes.map((s) => [s.cupom, s.valor]), [[null, total(false, null)], ['CUPOM100', 0]]); await fechar();
  });
  await teste('sem cupom o botão continua "Comprar agora"; cupom inválido não derruba a sessão', async () => {
    const { api, fechar } = await abrir(); let e = await api.estado(); assert.strictEqual(e.botao, 'Comprar agora');
    await api.comprar(); await api.cupom('NAOEXISTE'); e = await api.estado();
    assert.ok(e.stripeVisivel && e.destruidos === 0 && !e.aviso, JSON.stringify(e)); await fechar();
  });
  console.log('Corrida');
  await teste('cupom aplicado ENQUANTO a sessão é criada: a sessão velha não é montada, o botão volta e aparece o aviso', async () => {
    const { api, fechar } = await abrir(); atrasoSessaoMs = 1200;
    await api.page.click('#btn-continuar'); await api.page.waitForTimeout(150);
    await api.cupom('CUPOM10'); await api.page.waitForTimeout(1500); const e = await api.estado();
    assert.ok(e.montados === 0 && !e.stripeVisivel && e.botaoVisivel && e.botaoHabilitado && e.aviso && e.botao === 'Comprar agora', JSON.stringify(e));
    atrasoSessaoMs = 0; await api.comprar(); const f = await api.estado();
    assert.ok(f.stripeVisivel && f.stripeTexto.includes(reais(total(false, 'CUPOM10'))), JSON.stringify(f)); await fechar();
  });
  await teste('nenhum erro de JavaScript em nenhum cenário', async () => {
    const { api, fechar } = await abrir(); await api.comprar(); await api.cupom('CUPOM10'); await api.audio(true); await api.comprar();
    assert.deepStrictEqual(api.erros, []); await fechar();
  });

  await browser.close(); srv.close();
  console.log(`\n${totalTestes - falhas.length}/${totalTestes} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`);
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
