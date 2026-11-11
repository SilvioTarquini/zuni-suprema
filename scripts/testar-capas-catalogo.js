// Fase de estrutura (parte C) — capas vindas do catálogo, sem a lista fixa "novasObras" em public/loja/index.html.
//
// 1. Para as obras atuais, a URL resolvida pelo servidor (lib/capasLoja.js) é IGUAL à que a lista fixa antiga produzia
//    (a regra antiga está reproduzida aqui só para a comparação) e o arquivo existe.
// 2. Uma obra nova só precisa do arquivo na pasta: sem mexer em lista nenhuma, a capa aparece (teste com arquivo temporário).
// 3. Chromium: a vitrine real (/loja/), alimentada pelo /api/livros montado com o código real, mostra todas as capas
//    (naturalWidth > 0), nenhuma imagem quebrada. Captura em relatorios/capturas_estrutura/.
// Uso: node scripts/testar-capas-catalogo.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { chromium } = require('playwright');
const { listarLivrosPublicos } = require('../src/lib/catalogoLivros');
const { comCapas, resolverCapa, limparCache, PASTA_CAPAS } = require('../src/lib/capasLoja');

const RAIZ = path.join(__dirname, '..');
let total = 0; const falhas = [];
function teste(nome, fn) { total++; try { fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }

// Regra ANTIGA de public/loja/index.html (removida), só para comparar.
const FEMININO = ['codigo-feminino', 'ela-tem-classe', 'inesquecivel-charme-feminino', 'a-inteligencia-do-corpo-feminino', 'a-mulher-que-permanece-inteira'];
const MASCULINO = ['a-arte-da-presenca-masculina', 'a-presenca-em-acao-apendice', 'a-arte-invisivel-elegancia-masculina', 'guia-integral-saude-beleza-masculina'];
const NOVAS = ['fazenda-lucrativa', 'a-bussola-do-adolescente', 'situacoes-da-vida-real', 'heranca-de-papel', 'protocolo-90s-executive-black', 'executive-black-standalone', 'vender-bem-vender-sempre', 'toda-mesa-tem-dois-lados', 'toda-reuniao-tem-duas-pautas', 'da-terra-ao-resultado', 'a-arquitetura-da-decisao-humana', 'a-arte-e-a-ciencia-de-viver', 'a-inteligencia-da-vida', 'a-jornada-interior', 'excelencia-humana', 'o-retorno-da-clareza', 'a-neurobiologia-integrativa-da-depressao', 'a-visao-integrativa-da-obesidade', 'medicina-natural-integrativa', 'mentes-esgotadas', 'o-elo-invisivel', 'rejuvenesca', 'transforma-te-protocolos-90s', 'alem-do-que-voce-ve', 'alem-do-que-voce-sente', 'o-caminho-da-consciencia', 'inteligencia-artificial-volume-1', 'empresas-inteligentes-volume-2', 'consequencias-edicao-essencial', 'tempo-para-viver', 'a-casa-da-neblina', 'a-segunda-margem', 'a-tradutora', 'almas-silenciadas', 'falsa-moralidade', 'guerra-de-compadre', 'mascara-para-o-controle', 'ninguem-avisou-que-ele-morreu', 'o-baile-dos-herdeiros-posticos', 'o-disfarce-da-alma', 'o-falecido-esta-a-mesa', 'o-lugar-a-mesa', 'o-ultimo-baile-do-moinho', 'onze-dias-de-sorte', 'toda-familia-tem-duas-historias', 'toda-briga-tem-dois-comecos', 'entre-o-encanto-e-a-escolha', 'senti-percebi-escolhi', 'ninguem-reage-do-nada'];
const urlAntiga = (id) => `/loja/capas/${id}.${FEMININO.includes(id) || MASCULINO.includes(id) || NOVAS.includes(id) ? 'jpg' : 'png'}`;

(async () => {
  console.log('C. Capas lidas do catálogo');
  limparCache();
  const obras = comCapas(listarLivrosPublicos());
  teste(`catálogo público: ${obras.length} obras, todas com capa`, () => { assert.ok(obras.length >= 42); assert.deepStrictEqual(obras.filter((o) => !o.capa).map((o) => o.livroId), []); });
  teste('a URL é igual à da lista fixa antiga em TODAS as obras atuais', () => {
    const difs = obras.filter((o) => o.capa !== urlAntiga(o.livroId)).map((o) => `${o.livroId}: novo=${o.capa} antigo=${urlAntiga(o.livroId)}`);
    assert.deepStrictEqual(difs, []);
  });
  teste('o arquivo de cada capa existe em public/loja/capas', () => {
    const faltam = obras.filter((o) => !fs.existsSync(path.join(RAIZ, 'public', decodeURIComponent(o.capa)))).map((o) => o.livroId);
    assert.deepStrictEqual(faltam, []);
  });
  teste('campo `capa` do catálogo, se existir, vence a pasta (só dentro de /loja/capas/)', () => {
    assert.strictEqual(resolverCapa('x', { capa: '/loja/capas/especial.jpg' }), '/loja/capas/especial.jpg');
    assert.strictEqual(resolverCapa('ela-tem-classe', { capa: 'https://outro.site/x.jpg' }), '/loja/capas/ela-tem-classe.jpg');
  });
  teste('obra NOVA: basta o arquivo na pasta (sem lista fixa); .jpg vence .png; sem arquivo = null', () => {
    const id = 'obra-teste-capa-temporaria';
    const jpg = path.join(PASTA_CAPAS, id + '.jpg'), png = path.join(PASTA_CAPAS, id + '.png');
    try {
      limparCache(); assert.strictEqual(resolverCapa(id, {}), null);
      fs.writeFileSync(png, 'x'); limparCache(); assert.strictEqual(resolverCapa(id, {}), `/loja/capas/${id}.png`);
      fs.writeFileSync(jpg, 'x'); limparCache(); assert.strictEqual(resolverCapa(id, {}), `/loja/capas/${id}.jpg`);
    } finally { for (const f of [jpg, png]) { try { fs.unlinkSync(f); } catch (_) {} } limparCache(); }
  });
  teste('public/loja/index.html não tem mais a lista fixa', () => {
    const h = fs.readFileSync(path.join(RAIZ, 'public', 'loja', 'index.html'), 'utf8');
    assert.ok(!/novasObras|universosFeminino|universoMasculino/.test(h));
    assert.ok(h.includes('livro.capa'));
  });

  // Vitrine real no Chromium
  const app = express();
  app.get('/api/livros', (req, res) => res.json(comCapas(listarLivrosPublicos())));
  app.use(express.static(path.join(RAIZ, 'public'))); // /loja/, /js/, imagens: como o servidor real
  const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const porta = servidor.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message.slice(0, 100)));
  await page.goto(`http://127.0.0.1:${porta}/loja/`);
  await page.waitForSelector('.livro .capa img', { state: 'attached', timeout: 15000 });
  await page.evaluate(() => document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; }));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.livro .capa img')];
    return { total: imgs.length, quebradas: imgs.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src')) };
  });
  fs.mkdirSync(path.join(RAIZ, 'relatorios', 'capturas_estrutura'), { recursive: true });
  await page.screenshot({ path: path.join(RAIZ, 'relatorios', 'capturas_estrutura', 'loja-vitrine-capas.png'), fullPage: true });
  await browser.close(); servidor.close();
  teste(`vitrine /loja/ no Chromium: ${r.total} capas carregadas, 0 quebradas`, () => { assert.ok(r.total >= 42, 'cards: ' + r.total); assert.deepStrictEqual(r.quebradas, []); });
  teste('vitrine sem erro de JavaScript', () => assert.deepStrictEqual(erros, []));

  console.log(`\n${total - falhas.length}/${total} ok` + (falhas.length ? `\nFalhas: ${falhas.join('; ')}` : ''));
  process.exit(falhas.length ? 1 : 0);
})();
