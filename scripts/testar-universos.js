// Fase de estrutura (parte D) — página única e parametrizada dos universos. Sem rede externa.
//
// Compara, no Chromium, a página NOVA (/loja/<slug>/, modelo único) com a página ANTIGA de cada universo (HTML do commit
// anterior, `git show main:…`), alimentadas pelo MESMO /api/livros: título e metatags, variáveis de cor, texto visível, cartões
// (título, preço, chamada, capa), seções e o detalhe de CADA obra (texto, avisos, links de compra/experimente).
// Também: endereços atuais (200, redirecionamento sem barra, 404 de universo inexistente), /api/universos, e o campo
// `universo` do catálogo como texto OU lista (obra de teste só em memória — nada é cadastrado).
// Uso: node scripts/testar-universos.js [--ref=<commit com as páginas antigas>]   (padrão: HEAD~0 não serve; usa --ref=main)

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const express = require('express');
const { chromium } = require('playwright');
const { listarLivrosPublicos } = require('../src/lib/catalogoLivros');
const { comCapas } = require('../src/lib/capasLoja');
const { universosDaObra, obraDoUniverso, obterUniverso } = require('../src/lib/universos');

const RAIZ = path.join(__dirname, '..');
const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : null; };
// As páginas ANTIGAS dos universos (HTML estático) foram removidas do repositório; sem --ref, o teste usa o commit imediatamente
// anterior ao que removeu public/loja/universo-feminino/index.html (assim não depende de "main" apontar para o código antigo).
const REF = arg('ref') || (() => {
  const del = execFileSync('git', ['log', '--diff-filter=D', '-1', '--format=%H', '--', 'public/loja/universo-feminino/index.html'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim();
  return del ? del + '^' : 'main';
})();
const SAIDA = path.join(RAIZ, 'relatorios', 'capturas_estrutura');
const UNIVERSOS = [
  { slug: 'universo-feminino', antigo: 'public/loja/universo-feminino/index.html' },
  // extras: obras acrescentadas DEPOIS da página antiga (lote-piloto) — a paridade vale para as obras originais; as extras têm checagem própria.
  { slug: 'empreender-e-crescer', antigo: 'public/loja/empreender-e-crescer/index.html', extras: ['Fazenda Lucrativa'], secaoNova: 'Do campo à fazenda' }
];

let total = 0; const falhas = [];
function ok(nome, cond, detalhe) { total++; if (cond) console.log(`  ok   ${nome}`); else { falhas.push(nome); console.log(`  FALHOU ${nome}${detalhe ? ': ' + detalhe : ''}`); } }
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const OBRA_TESTE = {
  livroId: 'obra-teste-universos-lista', titulo: 'Obra de Teste (só em memória)', preco: 10, categoria: 'principal', departamento: 'Executive',
  universo: ['empreender-e-crescer', 'universo-feminino'], resumo: 'Obra fictícia para provar o campo universo como lista.', descricaoCurta: 'Obra fictícia.',
  capa: '/loja/capas/ela-tem-classe.jpg', ativoNaLoja: true
};

function get(porta, url) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: porta, path: url }, (res) => {
      let corpo = ''; res.on('data', (d) => corpo += d); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, corpo }));
    }).on('error', reject);
  });
}

// Tudo o que um leitor vê e usa em uma página de universo.
async function coletar(page) {
  await page.waitForSelector('.obra', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(400);
  const base = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const cores = ['--fundo', '--carta', '--tinta', '--suave', '--borda', '--acento', '--acento-escuro'].map((v) => css.getPropertyValue(v).trim());
    const estilos = ['h1', '.sobretitulo', '.btn-primario', '.secao-cabeca h2', 'footer', 'body'].map((s) => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); return [c.color, c.backgroundColor, c.fontSize]; });
    const meta = (sel) => { const e = document.querySelector(sel); return e ? e.getAttribute('content') : null; };
    return {
      titulo: document.title, desc: meta('meta[name=description]'), ogTitulo: meta('meta[property="og:title"]'), ogDesc: meta('meta[property="og:description"]'), tema: meta('meta[name=theme-color]'),
      cores, estilos,
      texto: document.body.innerText.replace(/\s+/g, ' ').trim(),
      secoes: [...document.querySelectorAll('.secao')].map((s) => [s.querySelector('h2').textContent, s.querySelector('.secao-cabeca p').textContent, [...s.querySelectorAll('.obra h3')].map((h) => h.textContent)]),
      cards: [...document.querySelectorAll('.obra')].map((c) => ({ t: c.querySelector('h3').textContent, p: c.querySelector('.preco').textContent, ch: c.querySelector('.chamada, .chamada.cortada').textContent, img: c.querySelector('img').getAttribute('src'), f: [...c.querySelectorAll('.formatos li')].map((l) => l.textContent) })),
      direciona: [...document.querySelectorAll('.direciona a')].map((a) => a.getAttribute('href')),
      diagnostico: !!document.querySelector('.diagnostico')
    };
  });
  const detalhes = [];
  const n = base.cards.length;
  for (let i = 0; i < n; i++) {
    await page.evaluate((k) => document.querySelectorAll('.obra .btn-primario')[k].click(), i);
    await page.waitForTimeout(150);
    detalhes.push(await page.evaluate(() => {
      const d = document.getElementById('detalhe');
      const vis = (id) => { const e = document.getElementById(id); return e ? { oculto: e.hidden, texto: e.hidden ? '' : e.textContent.trim(), href: e.getAttribute('href'), src: e.getAttribute('src') } : null; };
      const r = { aberto: d.open, texto: d.innerText.replace(/\s+/g, ' ').trim() };
      for (const id of ['det-titulo', 'det-chamada', 'det-sobre', 'det-nota-saude', 'det-nota-audio', 'det-comprar', 'det-experimentar', 'det-capa']) r[id] = vis(id);
      return r;
    }));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  return { ...base, detalhes };
}

(async () => {
  fs.mkdirSync(SAIDA, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zuni-universos-'));
  for (const u of UNIVERSOS) {
    const html = execFileSync('git', ['show', `${REF}:${u.antigo}`], { cwd: RAIZ, maxBuffer: 50e6 });
    fs.mkdirSync(path.join(tmp, u.slug), { recursive: true });
    fs.writeFileSync(path.join(tmp, u.slug, 'index.html'), html);
  }

  const catalogo = () => comCapas(listarLivrosPublicos());
  let comTeste = false;
  const app = express();
  app.get('/api/livros', (req, res) => res.json(comTeste ? [...catalogo(), OBRA_TESTE] : catalogo()));
  app.use('/', require('../src/routes/livros'));          // rotas reais (/loja/<slug>/, /api/universos…)
  app.use('/antigo', express.static(tmp));                // páginas antigas, só para comparar
  app.use(express.static(path.join(RAIZ, 'public')));     // /js, imagens
  const servidor = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const porta = servidor.address().port;

  console.log('D. Endereços atuais e API');
  for (const u of UNIVERSOS) {
    const r = await get(porta, `/loja/${u.slug}/`);
    ok(`/loja/${u.slug}/ → 200 text/html`, r.status === 200 && /text\/html/.test(r.headers['content-type']), `status ${r.status}`);
    ok(`/loja/${u.slug}/ vem pronta (título, h1 e metatags no HTML, sem JavaScript)`, r.corpo.includes(`<title>${obterUniverso(u.slug).nome} — ZUNI Suprema</title>`) && r.corpo.includes(obterUniverso(u.slug).h1.replace(/&/g, '&amp;')) && !/\{\{[A-Z0-9_]+\}\}/.test(r.corpo));
    const s = await get(porta, `/loja/${u.slug}?cupom=ABC`);
    ok(`/loja/${u.slug}?cupom=ABC → 301 para /loja/${u.slug}/?cupom=ABC`, s.status === 301 && s.headers.location === `/loja/${u.slug}/?cupom=ABC`, `${s.status} ${s.headers.location}`);
    const a = await get(porta, `/api/universos/${u.slug}`);
    ok(`/api/universos/${u.slug} → 200 JSON`, a.status === 200 && JSON.parse(a.corpo).slug === u.slug);
  }
  const nx = await get(porta, '/loja/nao-existe/');
  ok('/loja/nao-existe/ → 404', nx.status === 404, String(nx.status));
  const l = await get(porta, '/loja/');
  ok('/loja/ (vitrine geral) → 200', l.status === 200);
  const ap = await get(porta, '/api/universos/../../etc/passwd');
  ok('slug malformado em /api/universos → 404', ap.status === 404, String(ap.status));

  console.log('D. Campo universo: texto OU lista');
  ok('texto continua valendo', igual(universosDaObra({ universo: 'empreender-e-crescer' }), ['empreender-e-crescer']));
  ok('lista aceita', igual(universosDaObra({ universo: ['a', 'b'] }), ['a', 'b']));
  ok('ausente/vazio → []', igual(universosDaObra({}), []) && igual(universosDaObra({ universo: '  ' }), []) && igual(universosDaObra({ universo: [] }), []));
  ok('obraDoUniverso: pela lista e pelo departamento', obraDoUniverso({ universo: ['x', 'universo-feminino'] }, obterUniverso('universo-feminino')) && obraDoUniverso({ departamento: 'Universo Feminino' }, obterUniverso('universo-feminino')) && !obraDoUniverso({ departamento: 'Executive' }, obterUniverso('universo-feminino')));

  const browser = await chromium.launch();
  for (const u of UNIVERSOS) {
    console.log(`D. Paridade no Chromium — ${u.slug} (nova × antiga)`);
    const errN = [], errA = [];
    const pn = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pa = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    pn.on('pageerror', (e) => errN.push(e.message.slice(0, 90))); pa.on('pageerror', (e) => errA.push(e.message.slice(0, 90)));
    await pn.goto(`http://127.0.0.1:${porta}/loja/${u.slug}/`);
    // A página ANTIGA só entende `universo` em texto: obras com lista (ex.: Mesa e Reunião, também em Relações e Convivência)
    // chegam a ela com o primeiro universo da lista, como eram antes. A página NOVA recebe o catálogo como está.
    await pa.route('**/api/livros', async (rt) => { const r = await rt.fetch(); const j = await r.json(); (Array.isArray(j) ? j : []).forEach((o) => { if (Array.isArray(o.universo)) o.universo = o.universo[0]; }); await rt.fulfill({ response: r, json: j }); });
    await pa.goto(`http://127.0.0.1:${porta}/antigo/${u.slug}/`);
    const N = await coletar(pn), A = await coletar(pa);
    const extras = u.extras || [];
    const idxEx = N.cards.map((c, i) => (extras.includes(c.t) ? i : -1)).filter((i) => i >= 0);
    const idxExA = A.cards.map((c, i) => (extras.includes(c.t) ? i : -1)).filter((i) => i >= 0);
    const sem = (arr) => arr.filter((_, i) => !idxEx.includes(i));
    const semA = (arr) => arr.filter((_, i) => !idxExA.includes(i));
    const Ncards = sem(N.cards); const Acards = semA(A.cards);
    if (extras.length) {
      ok(`${N.cards.length} obras na nova = ${A.cards.length} na antiga (a antiga já listava a acrescentada em "Mais…"; comparo as originais, e ${extras.join(', ')} tem checagem própria)`, N.cards.length === A.cards.length && idxEx.length === extras.length && idxExA.length === extras.length);
      const sec = N.secoes.find((x) => x[2].includes(extras[0]));
      ok(`${extras[0]} está na seção própria "${u.secaoNova}", ao lado de Da Terra, e não em "Mais de…"`, !!sec && sec[0] === u.secaoNova && sec[2].includes('Da Terra ao Resultado') && !N.secoes.some((x) => /^Mais de/.test(x[0]) && x[2].includes(extras[0])), JSON.stringify(N.secoes));
    } else {
      ok(`${N.cards.length} obras na nova = ${A.cards.length} na antiga`, N.cards.length === A.cards.length && N.cards.length > 0);
    }
    ok('título e metatags (description, og, theme-color) iguais', igual([N.titulo, N.desc, N.ogTitulo, N.ogDesc, N.tema], [A.titulo, A.desc, A.ogTitulo, A.ogDesc, A.tema]));
    ok('cores (variáveis CSS) iguais', igual(N.cores, A.cores), JSON.stringify(N.cores) + ' × ' + JSON.stringify(A.cores));
    ok('estilos calculados (h1, botão, seções, rodapé, corpo) iguais', igual(N.estilos, A.estilos));
    let dif = '';
    if (N.texto !== A.texto) { let i = 0; while (N.texto[i] === A.texto[i]) i++; dif = `1ª diferença em ${i}: nova «${N.texto.slice(Math.max(0, i - 25), i + 50)}» × antiga «${A.texto.slice(Math.max(0, i - 25), i + 50)}»`; }
    if (!extras.length) {
      ok('texto visível da página inteiro igual', N.texto === A.texto, dif);
      ok('seções e ordem das obras iguais', igual(N.secoes, A.secoes));
    } else {
      ok('as obras originais seguem na mesma ordem (a seção nova é a única diferença de estrutura)', igual(Ncards.map((c) => c.t), Acards.map((c) => c.t)));
    }
    ok('cartões (título, preço, chamada, capa, formatos) iguais', igual(Ncards, Acards));
    ok('bloco ZUNI Direciona e bloco extra iguais', igual(N.direciona, A.direciona) && N.diagnostico === A.diagnostico);
    const dn = sem(N.detalhes), da = semA(A.detalhes);
    const difs = dn.map((d, i) => (igual(d, da[i]) ? null : Ncards[i].t + ' [' + Object.keys(d).filter((k) => !igual(d[k], da[i][k])).map((k) => `${k}: nova ${JSON.stringify(d[k]).replace(/ /g, '<NBSP>')} × antiga ${JSON.stringify(da[i][k]).replace(/ /g, '<NBSP>')}`).join('; ') + ']')).filter(Boolean);
    ok(`detalhe de cada obra igual (${dn.length} obras: texto, avisos, links de compra e experimente)`, difs.length === 0, 'diferem: ' + difs.join(', '));
    ok('nenhum erro de JavaScript (nova e antiga)', errN.length === 0 && errA.length === 0, errN.concat(errA).join(' | '));
    await pn.screenshot({ path: path.join(SAIDA, `universo-${u.slug}-desktop.png`), fullPage: true });
    const pm = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
    await pm.goto(`http://127.0.0.1:${porta}/loja/${u.slug}/`); await pm.waitForSelector('.obra', { state: 'attached' }); await pm.waitForTimeout(600);
    ok('390 px: sem rolagem horizontal', await pm.evaluate(() => document.documentElement.scrollWidth <= 390));
    await pm.screenshot({ path: path.join(SAIDA, `universo-${u.slug}-390px.png`), fullPage: true });
    await pn.close(); await pa.close(); await pm.close();
  }

  console.log('D. Obra de teste com universo em LISTA (só em memória, nada cadastrado)');
  comTeste = true;
  for (const u of UNIVERSOS) {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(`http://127.0.0.1:${porta}/loja/${u.slug}/`);
    const C = await coletar(p);
    ok(`${u.slug}: a obra de teste (universo: [a, b]) aparece, em "Mais …"`, C.secoes.some(([titulo, , obras]) => /^Mais /.test(titulo) && obras.includes(OBRA_TESTE.titulo)), JSON.stringify(C.secoes.map((s) => s[0])));
    await p.close();
  }
  comTeste = false;

  await browser.close(); servidor.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${total - falhas.length}/${total} ok` + (falhas.length ? `\nFalhas:\n - ${falhas.join('\n - ')}` : ''));
  process.exit(falhas.length ? 1 : 0);
})();
