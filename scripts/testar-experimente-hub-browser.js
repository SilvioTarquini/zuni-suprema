// Teste de interface local do hub e da Loja, sem backend real, rede, IA ou pagamento.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const raiz = path.join(__dirname, '..');
const publico = path.join(raiz, 'public');
const catalogo = {
  'ela-tem-classe': {
    titulo: 'Ela Tem Classe',
    resumo: 'Uma degustação editorial com amostra de áudio oficial.',
    descricao: 'Descrição de teste.',
    preco: 34.90,
    departamento: 'Universo Feminino',
    amostraDisponivel: true,
    audiobookDisponivel: true,
    precoAudiobook: 19.90
  },
  'codigo-feminino': {
    titulo: 'Código Feminino',
    resumo: 'Obra sem degustação aprovada.',
    descricao: 'Descrição de teste.',
    preco: 44.90,
    departamento: 'Universo Feminino',
    amostraDisponivel: false,
    audiobookDisponivel: true,
    precoAudiobook: 24.90
  }
};

function responderArquivo(res, arquivo) {
  if (!fs.existsSync(arquivo) || !fs.statSync(arquivo).isFile()) { res.writeHead(404); res.end(); return; }
  const extensao = path.extname(arquivo).toLowerCase();
  const tipo = extensao === '.html' ? 'text/html; charset=utf-8' : extensao === '.js' ? 'application/javascript; charset=utf-8' : extensao === '.css' ? 'text/css; charset=utf-8' : extensao === '.jpg' || extensao === '.jpeg' ? 'image/jpeg' : extensao === '.png' ? 'image/png' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': tipo });
  fs.createReadStream(arquivo).pipe(res);
}

function criarServidor() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://teste.local');
    if (url.pathname === '/api/livros') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(catalogo));
      return;
    }
    const mapa = { '/experimente': 'experimente-hub.html', '/experimente/': 'experimente-hub.html', '/loja/': 'loja/index.html' };
    const relativo = mapa[url.pathname] || url.pathname.replace(/^\/+/, '');
    const arquivo = path.resolve(publico, relativo);
    if (!arquivo.startsWith(publico + path.sep)) { res.writeHead(403); res.end(); return; }
    responderArquivo(res, arquivo);
  });
}

(async () => {
  const servidor = criarServidor();
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const porta = servidor.address().port;
  const browser = await chromium.launch({ headless: true });
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexto.newPage();

  try {
    await page.goto(`http://127.0.0.1:${porta}/experimente?origem=universo-feminino&cupom=OUT26`, { waitUntil: 'networkidle' });
    await page.locator('#amostras .obra').waitFor();
    assert.strictEqual(await page.locator('#amostras .obra').count(), 1, 'somente a obra com amostra aprovada aparece');
    assert.ok((await page.locator('#amostras .btn-principal').getAttribute('href')).includes('/experimente/ela-tem-classe/?origem=universo-feminino&cupom=OUT26'));
    assert.ok((await page.locator('#link-legado').getAttribute('href')).includes('/experimente.html?origem=universo-feminino&cupom=OUT26#modulo-livro'));
    assert.ok((await page.locator('.obra').boundingBox()).width <= 358, 'card se ajusta ao viewport móvel');

    await page.goto(`http://127.0.0.1:${porta}/loja/?cupom=OUT26`, { waitUntil: 'networkidle' });
    await page.locator('#grade-livros .livro').first().waitFor();
    assert.strictEqual(await page.locator('.badge-experimente').count(), 1, 'Loja sinaliza somente a obra com amostra');
    await page.getByRole('button', { name: 'Ela Tem Classe' }).click();
    await page.locator('#painel-experimentar').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#painel-experimentar').getAttribute('href')).includes('/experimente/ela-tem-classe/?cupom=OUT26'));
    console.log('OK — hub e Loja responsivos; disponibilidade e cupom preservados sem checkout.');
  } finally {
    await browser.close();
    await new Promise((resolve) => servidor.close(resolve));
  }
})().catch((erro) => { console.error(erro); process.exitCode = 1; });
