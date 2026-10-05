// Teste local (sem rede, sem Stripe, sem Supabase, sem e-mail, sem Pinterest real) do gate de privacidade P0:
// a return_url do Stripe Embedded Checkout de livros NÃO pode conter o e-mail do comprador (nem outro dado pessoal).
// Ela passa por logs de acesso, pelo objeto da sessão na Stripe e por uma página com tag de anúncio (Pinterest).
// Uso: node scripts/testar-privacidade-retorno-p0.js
//
// A rota POST /api/checkout/livro/stripe-session é extraída do código real de src/server.js e executada com
// dependências falsas (pedido, Stripe e cupons em memória): nenhuma sessão, pedido ou e-mail reais.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

const raiz = path.join(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const { buscarLivro } = require(path.join(raiz, 'src/lib/catalogoLivros'));
const { calcularPrecoBaseLivro } = require(path.join(raiz, 'src/lib/precoLivro'));
const { calcularDesconto } = require(path.join(raiz, 'src/lib/cupons'));
const { normalizarOrigem } = require(path.join(raiz, 'src/lib/origemCompra'));

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); ok++; console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); }
}

const srv = ler('src/server.js');
const CUPONS = { PCT30: { tipo: 'sessao', percentual: 30, teto_reais: null, codigo: 'PCT30' }, CEM: { tipo: 'sessao', percentual: 100, teto_reais: null, codigo: 'CEM' } };
const buscarCupom = async (c) => (typeof c === 'string' ? CUPONS[c.trim().toUpperCase()] || null : null);
const mFn = srv.match(/async function calcularPrecoFinalLivro[\s\S]*?\n}\n/);
const calcularPrecoFinalLivro = new Function('validarCupom', 'calcularDesconto', 'calcularPrecoBaseLivro', `${mFn[0]}; return calcularPrecoFinalLivro;`)(buscarCupom, calcularDesconto, calcularPrecoBaseLivro);
const ini = srv.indexOf("app.post('/api/checkout/livro/stripe-session'");
const fim = srv.indexOf("app.get('/api/checkout/livro/stripe-status");
assert.ok(ini > 0 && fim > ini, 'rota stripe-session não encontrada');
const blocoRota = srv.slice(ini, fim);
const corpoRota = blocoRota.replace(/console\.(log|error)\([^;]*\);/g, '');
const FRONTEND = 'https://app.exemplo.test';

async function criarSessao(body) {
  const reg = { pedidos: [], sessoes: [], fulfill: [] };
  let handler;
  const stripeClient = { checkout: { sessions: { create: async (a) => { reg.sessoes.push(a); return { id: 'cs_fake', client_secret: 'secret_fake' }; } } } };
  new Function('app', 'buscarLivro', 'stripeClient', 'calcularPrecoFinalLivro', 'criarPedidoPendenteStripe', 'buscarPedidoPendenteStripe', 'fulfillLivro', 'vincularStripeSessionId', 'normalizarOrigem', 'process', corpoRota)(
    { post: (r, h) => { if (r === '/api/checkout/livro/stripe-session') handler = h; } }, buscarLivro, stripeClient, calcularPrecoFinalLivro,
    async (p) => { reg.pedidos.push(p); return 'ped-fake-0001'; }, async () => ({ id: 'ped-fake-0001', payload: reg.pedidos[0].payload }),
    async (p) => { reg.fulfill.push(p); return { token: 'tk', tokenAudiolivro: null }; }, async () => {}, normalizarOrigem, { env: { FRONTEND_URL: FRONTEND } }
  );
  let status = 200, resposta; const res = { status(c) { status = c; return res; }, json(b) { resposta = b; return res; } };
  await handler({ body }, res);
  return { status, resposta, ...reg };
}
const base = { livroId: 'ela-tem-classe', name: 'Maria da Silva Sauro', email: 'maria.silva@example.invalid' };
const retornoDe = (r) => r.sessoes[0].return_url;

// Cabeçalho do checkout-livro.html que tira ?email= da URL antes da tag (defesa para links antigos)
const htmlCheckout = ler('public/checkout-livro.html');
const scriptLimpeza = htmlCheckout.match(/<script>\s*\/\/ Guarda o e-mail do retorno[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g, '');

(async () => {
  console.log('Privacidade P0 — return_url do checkout de livros sem e-mail\n');

  console.log('return_url do Stripe (código real da rota)');
  await teste('a return_url não contém e-mail nem qualquer dado do comprador; só livro, pedidoId e status', async () => {
    const r = await criarSessao(base);
    assert.strictEqual(r.status, 200);
    const u = retornoDe(r);
    assert.strictEqual(u, `${FRONTEND}/checkout-livro.html?livro=ela-tem-classe&pedidoId=ped-fake-0001&status=retorno`);
    const url = new URL(u);
    assert.deepStrictEqual([...url.searchParams.keys()], ['livro', 'pedidoId', 'status']);
    for (const proibido of ['@', '%40', 'email', 'e-mail', 'maria', 'silva', 'sauro', 'example.invalid', 'nome', 'name', 'token', 'em=', 'telefone', 'cpf']) assert.ok(!u.toLowerCase().includes(proibido), 'URL contém: ' + proibido);
  });
  await teste('e-mails de formatos difíceis (plus, acento, subdomínio) também não aparecem; a URL é idêntica para qualquer e-mail', async () => {
    const emails = ['a+b@c.d', 'jose.ação@exemplo.com.br', 'xavier@sub.dominio.example', 'UPPER@CASE.COM', "o'brien@ex.com"];
    const urls = new Set();
    for (const email of emails) {
      const u = retornoDe(await criarSessao({ ...base, email }));
      urls.add(u);
      const t = decodeURIComponent(u).toLowerCase();
      assert.ok(!t.includes('@') && !u.includes(encodeURIComponent(email)) && !t.includes(email.split('@')[0].toLowerCase()), email);
    }
    assert.strictEqual(urls.size, 1, 'a return_url não pode depender do e-mail');
  });
  await teste('pedidoId preservado: a return_url, o client_reference_id, a metadata e a resposta usam o mesmo identificador opaco', async () => {
    const r = await criarSessao(base);
    assert.strictEqual(r.resposta.pedidoId, 'ped-fake-0001');
    assert.strictEqual(r.sessoes[0].client_reference_id, 'ped-fake-0001');
    assert.strictEqual(r.sessoes[0].metadata.pedidoId, 'ped-fake-0001');
    assert.strictEqual(new URL(retornoDe(r)).searchParams.get('pedidoId'), 'ped-fake-0001');
  });
  await teste('origem preservada pelos caminhos internos (payload e metadata), não pela URL; origem inválida segue ignorada', async () => {
    const r = await criarSessao({ ...base, origem: 'universo-feminino' });
    assert.strictEqual(r.pedidos[0].payload.origem, 'universo-feminino');
    assert.strictEqual(r.sessoes[0].metadata.origem, 'universo-feminino');
    assert.ok(!retornoDe(r).includes('origem'));
    const ruim = await criarSessao({ ...base, origem: 'evil' });
    assert.ok(!('origem' in ruim.pedidos[0].payload) && !('origem' in ruim.sessoes[0].metadata));
    assert.strictEqual(r.pedidos[0].payload.email, base.email); // o e-mail continua indo para o pedido (entrega), só saiu da URL
  });
  await teste('áudio e cupom não são afetados: mesmos valores cobrados e mesma return_url', async () => {
    const casos = [[{}, 3490], [{ audiolivroIncluido: true }, 5480], [{ cupom: 'PCT30' }, 2443], [{ audiolivroIncluido: true, cupom: 'PCT30' }, 3836]];
    for (const [extra, centavos] of casos) {
      const r = await criarSessao({ ...base, ...extra });
      assert.strictEqual(r.sessoes[0].line_items[0].price_data.unit_amount, centavos, JSON.stringify(extra));
      assert.strictEqual(r.pedidos[0].valorPago, centavos / 100);
      assert.ok(!retornoDe(r).includes('@') && !retornoDe(r).includes('email'));
    }
    assert.strictEqual((await criarSessao({ ...base, cupom: 'NAOEXISTE' })).status, 400);
  });
  await teste('cupom 100%: continua sem Stripe e sem return_url (acesso direto)', async () => {
    const r = await criarSessao({ ...base, cupom: 'CEM' });
    assert.strictEqual(r.resposta.cupom100, true);
    assert.strictEqual(r.sessoes.length, 0);
    assert.strictEqual(r.fulfill.length, 1);
  });

  console.log('\nCódigo: nenhuma return_url do Stripe com e-mail');
  await teste('a rota do Stripe não tem "email=" na URL; a Direciona (chat-mentor) também não', async () => {
    assert.ok(!/return_url:[^\n]*email/i.test(blocoRota.replace(/\/\/.*$/gm, '')), 'return_url do livro com e-mail');
    for (const m of srv.matchAll(/return_url:\s*`([^`]*)`/g)) assert.ok(!/email/i.test(m[1]), 'return_url com e-mail: ' + m[1]);
    assert.ok(/pedidoId=\$\{pedidoId\}&status=retorno/.test(srv));
  });
  await teste('as únicas URLs de retorno com e-mail que restam são as do Mercado Pago legado, sem tela que as acione (PIX desligado)', async () => {
    const restantes = [...srv.matchAll(/(success|pending|failure):\s*`[^`]*email=[^`]*`/g)].length;
    assert.ok(restantes > 0 && restantes <= 6, 'legado MP: ' + restantes);
    assert.ok(htmlCheckout.includes("let metodoPagamento = 'CARTAO';") && !/selecionarMetodo\s*\(/.test(htmlCheckout.replace(/\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '')), 'a tela só aciona o cartão (Stripe)');
  });

  console.log('\nPágina de retorno: nada depende do e-mail na URL');
  await teste('o polling usa só o pedidoId; a confirmação, o redirecionamento e o Purchase não leem e-mail', async () => {
    const t = htmlCheckout;
    assert.ok(t.includes('/api/checkout/livro/stripe-status/${encodeURIComponent(pedidoIdRetorno)}'));
    assert.ok(/if \(data\.pago && data\.token\) \{\s*clearInterval\(pollingInterval\);\s*registrarCompraPinterest\(pedidoIdRetorno\);\s*irParaLivro\(`\/livros\/\$\{encodeURIComponent\(livroId\)\}\?token=\$\{encodeURIComponent\(data\.token\)\}`\);/.test(t));
    const usos = [...t.matchAll(/emailRetorno|__zuniEmailRetorno|params\.get\('email'\)/g)].length;
    assert.ok(usos >= 3);
    // o e-mail só entra no texto do aviso de timeout, e há um texto alternativo quando ele não existe
    assert.ok(t.includes("' Assim que a confirmação chegar, o acesso também será enviado por e-mail.'"));
    assert.ok(/const avisoEmail = emailRetorno\s*\?/.test(t));
  });
  await teste('defesa em profundidade: um link antigo com ?email= é limpo da URL ANTES da tag do Pinterest carregar', async () => {
    assert.ok(htmlCheckout.indexOf('__zuniEmailRetorno') < htmlCheckout.indexOf("pintrk('load'"), 'limpeza antes da tag');
    const rodar = (href) => {
      const chamadas = []; const ctx = vm.createContext({ URL, history: { replaceState: (a, b, novo) => chamadas.push(novo) } });
      ctx.window = { location: { href } }; vm.runInContext(scriptLimpeza, ctx);
      return { chamadas, guardado: ctx.window.__zuniEmailRetorno };
    };
    const antigo = rodar('https://app.exemplo.test/checkout-livro.html?livro=ela-tem-classe&pedidoId=p1&email=x%40y.z&status=retorno');
    assert.deepStrictEqual(antigo.chamadas, ['/checkout-livro.html?livro=ela-tem-classe&pedidoId=p1&status=retorno']);
    assert.strictEqual(antigo.guardado, 'x@y.z');
    const novo = rodar('https://app.exemplo.test/checkout-livro.html?livro=ela-tem-classe&pedidoId=p1&status=retorno');
    assert.deepStrictEqual(novo.chamadas, []); // nada a limpar; a URL já nasce limpa
  });

  console.log('\nPinterest preservado (semântica inalterada)');
  await teste('PageVisit, AddToCart e Purchase seguem como antes: nenhum arquivo de tracking foi tocado e a URL do evento não leva dado pessoal', async () => {
    const cli = ler('public/js/checkout-livro-cliente.js');
    assert.ok(cli.includes("pinTrack('addtocart', dados)") && cli.includes("pinTrack('checkout', dados)"));
    assert.ok(/const dados = \{ product_id: livroId, order_quantity: 1 \};/.test(cli) && /const dados = \{ product_id: livroId, order_id: pedidoId, order_quantity: 1 \};/.test(cli));
    assert.ok(!/email|nome|name|telefone|token/i.test(cli.match(/function criarPinterestLivro[\s\S]*?\n  }\n/)[0]));
    assert.ok(/await montarEmbeddedCheckout\(data\.clientSecret\);\s*registrarInicioCheckoutPinterest\(data\.pedidoId\);/.test(htmlCheckout));
    assert.deepStrictEqual([...htmlCheckout.matchAll(/pintrk\(\s*'(\w+)'/g)].map((m) => m[1]), ['load', 'page']);
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${total - ok}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — P0: a return_url do Stripe não tem e-mail; pedidoId, origem, áudio, cupom e Pinterest preservados.');
})();
