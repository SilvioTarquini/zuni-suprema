// Teste local (sem rede, sem Supabase, sem Stripe, sem pedido) da F3C: origem comercial no checkout de
// livros (whitelist, persistência no payload/metadata, zero efeito em preço/cupom/áudio) e a conexão
// Loja → Universo Feminino → checkout (links e Pinterest, verificados no código das páginas).
// Uso: node scripts/testar-f3c-origem-e-vitrine.js
//
// Código real exercitado: a rota POST /api/checkout/livro/stripe-session e calcularPrecoFinalLivro,
// extraídos de src/server.js; normalizarOrigem; calcularDesconto; public/js/checkout-livro-cliente.js.
// Só o banco (pedido pendente), o Stripe e os cupons são fixtures em memória.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

const raiz = path.join(__dirname, '..');
const { CATALOGO, buscarLivro } = require(path.join(raiz, 'src/lib/catalogoLivros'));
const { calcularPrecoBaseLivro } = require(path.join(raiz, 'src/lib/precoLivro'));
const { calcularDesconto } = require(path.join(raiz, 'src/lib/cupons'));
const { normalizarOrigem, ORIGENS_PERMITIDAS } = require(path.join(raiz, 'src/lib/origemCompra'));
const cliente = require(path.join(raiz, 'public/js/checkout-livro-cliente.js'));
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); ok++; console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); }
}

// ── Rota real de criação da sessão, com dependências falsas ──
const CUPONS = {
  PCT30: { tipo: 'sessao', percentual: 30, teto_reais: null, codigo: 'PCT30' },
  TETO15: { tipo: 'campanha', percentual: 30, teto_reais: 15, codigo: 'TETO15' },
  CEM: { tipo: 'sessao', percentual: 100, teto_reais: null, codigo: 'CEM' }
};
const buscarCupom = async (c) => (typeof c === 'string' ? CUPONS[c.trim().toUpperCase()] || null : null);
const srv = ler('src/server.js');
const mFn = srv.match(/async function calcularPrecoFinalLivro[\s\S]*?\n}\n/);
const calcularPrecoFinalLivro = new Function('validarCupom', 'calcularDesconto', 'calcularPrecoBaseLivro', `${mFn[0]}; return calcularPrecoFinalLivro;`)(buscarCupom, calcularDesconto, calcularPrecoBaseLivro);
const iniRota = srv.indexOf("app.post('/api/checkout/livro/stripe-session'");
const fimRota = srv.indexOf("app.get('/api/checkout/livro/stripe-status");
assert.ok(iniRota > 0 && fimRota > iniRota, 'rota stripe-session não encontrada');
const corpoRota = srv.slice(iniRota, fimRota).replace(/console\.(log|error)\([^;]*\);/g, '');

async function chamarRota(body) {
  const registro = { pedidos: [], sessoes: [], fulfill: [] };
  let handler;
  const app = { post: (r, h) => { if (r === '/api/checkout/livro/stripe-session') handler = h; } };
  const stripeClient = { checkout: { sessions: { create: async (args) => { registro.sessoes.push(args); return { id: 'cs_fake', client_secret: 'secret_fake' }; } } } };
  new Function('app', 'buscarLivro', 'stripeClient', 'calcularPrecoFinalLivro', 'criarPedidoPendenteStripe', 'buscarPedidoPendenteStripe', 'fulfillLivro', 'vincularStripeSessionId', 'normalizarOrigem', 'process', corpoRota)(
    app, buscarLivro, stripeClient, calcularPrecoFinalLivro,
    async (p) => { registro.pedidos.push(p); return 'ped-fake'; },
    async () => ({ id: 'ped-fake', payload: registro.pedidos[0].payload }),
    async (pedido) => { registro.fulfill.push(pedido); return { token: 't', tokenAudiolivro: null }; },
    async () => {}, normalizarOrigem, { env: { FRONTEND_URL: 'http://localhost' } }
  );
  let status = 200, resposta;
  const res = { status(c) { status = c; return res; }, json(b) { resposta = b; return res; } };
  await handler({ body }, res);
  return { status, resposta, ...registro };
}
const base = { livroId: 'ela-tem-classe', name: 'Teste', email: 'smoke@example.invalid' };

(async () => {
  console.log('F3C — origem comercial, Loja → Universo Feminino → checkout\n');

  console.log('Whitelist (servidor e cliente)');
  await teste('D. origem permitida é reconhecida (servidor e cliente)', async () => {
    assert.deepStrictEqual(ORIGENS_PERMITIDAS, ['universo-feminino']);
    assert.strictEqual(normalizarOrigem('universo-feminino'), 'universo-feminino');
    assert.strictEqual(cliente.lerOrigem('?livro=x&origem=universo-feminino'), 'universo-feminino');
    assert.deepStrictEqual(cliente.ORIGENS_PERMITIDAS, ORIGENS_PERMITIDAS); // cliente espelha o servidor
  });
  await teste('E. origem arbitrária é rejeitada (servidor e cliente)', async () => {
    const lixo = ['evil', 'UNIVERSO-FEMININO', ' universo-feminino', 'universo-feminino ', 'universo-feminino\n', '<script>alert(1)</script>', '', 'universo-masculino', '../../etc', 'universo-feminino,x', 123, null, undefined, ['universo-feminino'], { a: 1 }, true];
    lixo.forEach((v) => assert.strictEqual(normalizarOrigem(v), null, JSON.stringify(v)));
    ['?origem=evil', '?origem=', '?origem=UNIVERSO-FEMININO', '?origem=%3Cscript%3E', '?origem=universo-feminino&origem=evil', '', '?livro=x'].forEach((q) => {
      const r = cliente.lerOrigem(q);
      assert.ok(r === null || r === 'universo-feminino');
      if (q !== '?origem=universo-feminino&origem=evil') assert.strictEqual(r, null, q); // 1º valor vale; só o literal permitido passa
    });
  });

  console.log('\nRota de criação da sessão (real) — persistência e efeito zero');
  await teste('N. com origem válida: payload e metadata do pedido levam a origem', async () => {
    const r = await chamarRota({ ...base, origem: 'universo-feminino' });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.pedidos[0].payload, { livroId: 'ela-tem-classe', email: base.email, audiolivroIncluido: false, origem: 'universo-feminino' });
    assert.deepStrictEqual(r.sessoes[0].metadata, { pedidoId: 'ped-fake', fulfillment_type: 'livro', origem: 'universo-feminino' });
  });
  await teste('O. sem origem: payload e metadata idênticos ao fluxo legado (sem a chave)', async () => {
    const r = await chamarRota({ ...base });
    assert.deepStrictEqual(r.pedidos[0].payload, { livroId: 'ela-tem-classe', email: base.email, audiolivroIncluido: false });
    assert.deepStrictEqual(r.sessoes[0].metadata, { pedidoId: 'ped-fake', fulfillment_type: 'livro' });
    assert.ok(!('origem' in r.pedidos[0].payload) && !('origem' in r.sessoes[0].metadata));
  });
  await teste('E2. origem arbitrária no body não é persistida em lugar nenhum', async () => {
    for (const lixo of ['evil', '<img src=x>', 'UNIVERSO-FEMININO', ['universo-feminino'], { x: 1 }, 42]) {
      const r = await chamarRota({ ...base, origem: lixo });
      assert.strictEqual(r.status, 200);
      assert.ok(!('origem' in r.pedidos[0].payload), JSON.stringify(lixo));
      assert.ok(!('origem' in r.sessoes[0].metadata), JSON.stringify(lixo));
      assert.ok(!JSON.stringify(r).includes('evil') && !JSON.stringify(r).includes('<img'));
    }
  });
  await teste('F/G/H. a origem não altera preço, cupom, produto nem áudio (matriz com e sem origem)', async () => {
    for (const livroId of ['ela-tem-classe', 'a-inteligencia-do-corpo-feminino', 'codigo-feminino', 'inesquecivel-charme-feminino', 'a-mulher-que-permanece-inteira', 'protocolo-90s-executive-black']) {
      for (const audio of [false, true]) {
        for (const cupom of [null, 'PCT30', 'TETO15']) {
          const corpo = { ...base, livroId, audiolivroIncluido: audio, cupom };
          const sem = await chamarRota(corpo);
          const com = await chamarRota({ ...corpo, origem: 'universo-feminino' });
          const rot = `${livroId} audio=${audio} cupom=${cupom}`;
          assert.strictEqual(com.sessoes[0].line_items[0].price_data.unit_amount, sem.sessoes[0].line_items[0].price_data.unit_amount, rot + ' preço');
          assert.strictEqual(com.sessoes[0].line_items[0].price_data.product_data.name, sem.sessoes[0].line_items[0].price_data.product_data.name, rot + ' produto');
          assert.strictEqual(com.pedidos[0].valorPago, sem.pedidos[0].valorPago, rot + ' valorPago');
          const { origem, ...resto } = com.pedidos[0].payload;
          assert.deepStrictEqual(resto, sem.pedidos[0].payload, rot + ' payload');
        }
      }
    }
  });
  await teste('cupom inválido continua recusado com origem (400, nada criado)', async () => {
    const r = await chamarRota({ ...base, cupom: 'NAOEXISTE', origem: 'universo-feminino' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.pedidos.length, 0);
    assert.strictEqual(r.sessoes.length, 0);
  });
  await teste('cupom 100% com origem: fulfillment recebe o mesmo pedido de sempre (origem só no payload)', async () => {
    const r = await chamarRota({ ...base, cupom: 'CEM', audiolivroIncluido: true, origem: 'universo-feminino' });
    assert.strictEqual(r.resposta.cupom100, true);
    assert.strictEqual(r.sessoes.length, 0);
    assert.strictEqual(r.fulfill.length, 1);
    const { livroId, email, audiolivroIncluido } = r.fulfill[0].payload;
    assert.deepStrictEqual({ livroId, email, audiolivroIncluido }, { livroId: 'ela-tem-classe', email: base.email, audiolivroIncluido: true });
  });
  await teste('fulfillLivro só lê livroId/email/audiolivroIncluido do payload (a origem não influencia o acesso)', async () => {
    const m = srv.match(/async function fulfillLivro\(pedido, paymentId\) \{[\s\S]*?\n}\n/);
    assert.ok(m, 'fulfillLivro não encontrada');
    assert.ok(/const \{ livroId, email, audiolivroIncluido \} = pedido\.payload;/.test(m[0]));
    assert.ok(!/origem/.test(m[0]));
    assert.ok(!/pedido\.payload\.origem|payload\.origem/.test(srv.replace(/\/\/.*$/gm, '')), 'nada no servidor lê payload.origem para decidir algo');
  });
  await teste('M. payload e metadata não carregam metadata privada de áudio', async () => {
    const r = await chamarRota({ ...base, audiolivroIncluido: true, origem: 'universo-feminino' });
    const txt = JSON.stringify([r.pedidos, r.sessoes]);
    for (const k of ['audiobookStorage', 'audiobookUrl', 'audiobookPartes', 'bucket', 'supabase.co', '.mp3', 'zuni-audiobooks']) assert.ok(!txt.includes(k), k);
  });

  console.log('\nCheckout (página): origem só como contexto');
  const htmlCheckout = ler('public/checkout-livro.html');
  await teste('checkout lê a origem pela whitelist e a envia só na criação da sessão Stripe', async () => {
    assert.ok(htmlCheckout.includes('ZuniCheckoutLivro.lerOrigem(window.location.search)'));
    assert.strictEqual((htmlCheckout.match(/origemCompra/g) || []).length, 3); // declaração + condição + valor
    assert.ok(/\.\.\.\(origemCompra \? \{ origem: origemCompra \} : \{\}\)/.test(htmlCheckout));
  });
  await teste('origem nunca é escrita no DOM nem vai ao Pinterest', async () => {
    assert.ok(!/(innerHTML|textContent|innerText|insertAdjacentHTML|document\.write)[^;\n]*origem/i.test(htmlCheckout));
    const pin = fs.readFileSync(path.join(raiz, 'public/js/checkout-livro-cliente.js'), 'utf8').match(/function criarPinterestLivro[\s\S]*?\n  }\n/)[0];
    assert.ok(!/origem/i.test(pin), 'eventos Pinterest não carregam origem');
  });
  await teste('I/J/K/L. AddToCart, Purchase, dedupe e fail-open do checkout seguem como na F2b', async () => {
    const eventos = [];
    const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
    const pin = cliente.criarPinterestLivro({ pintrk: (...a) => eventos.push(a), sessionStorage: mem(), localStorage: mem(), livroId: 'ela-tem-classe' });
    pin.inicioCheckout('p1', 54.8);
    assert.deepStrictEqual(eventos[0], ['track', 'addtocart', { product_id: 'ela-tem-classe', order_quantity: 1, value: 54.8, currency: 'BRL' }]);
    assert.strictEqual(eventos.filter((e) => e[1] === 'checkout').length, 0); // Purchase só depois do pago:true
    assert.strictEqual(pin.compra('p1'), true);
    assert.strictEqual(pin.compra('p1'), false);
    assert.strictEqual(eventos.filter((e) => e[1] === 'checkout').length, 1);
    const quebrado = cliente.criarPinterestLivro({ pintrk: () => { throw new Error('fora do ar'); }, sessionStorage: null, localStorage: null, livroId: 'x' });
    assert.doesNotThrow(() => { quebrado.inicioCheckout('p2', 10); quebrado.compra('p2'); });
  });
  await teste('checkout: a ordem de abertura do checkout (addtocart) e do pago (checkout) não foi alterada', async () => {
    assert.ok(/await montarEmbeddedCheckout\(data\.clientSecret\);\s*registrarInicioCheckoutPinterest\(data\.pedidoId\);/.test(htmlCheckout));
    assert.ok(/if \(data\.pago && data\.token\) \{\s*clearInterval\(pollingInterval\);\s*registrarCompraPinterest\(pedidoIdRetorno\);/.test(htmlCheckout));
  });

  console.log('\nLoja principal → Universo Feminino');
  const htmlLoja = ler('public/loja/index.html');
  await teste('A. Loja: porta presente, rota correta, sem duplicar obras nem nova grade', async () => {
    assert.ok(htmlLoja.includes('class="porta-universo"'));
    assert.ok(htmlLoja.includes('href="/loja/universo-feminino/"'));
    assert.ok(htmlLoja.includes('Uma seleção de obras para diferentes momentos da vida de uma mulher.'));
    assert.ok(htmlLoja.includes('Explorar o Universo Feminino'));
    const porta = htmlLoja.match(/<nav class="porta-universo"[\s\S]*?<\/nav>/)[0];
    assert.ok(!/<img|class="grade"|R\$/.test(porta), 'porta não repete obras nem preços');
    assert.ok(htmlLoja.includes('id="grade-livros"')); // catálogo atual preservado
    assert.ok(htmlLoja.indexOf('class="porta-universo"') < htmlLoja.indexOf('id="grade-livros"'));
  });
  await teste('Loja: nenhum preço, catálogo ou lógica de compra da Loja foi alterado', async () => {
    assert.ok(htmlLoja.includes("fetch('/api/livros')"));
    assert.ok(htmlLoja.includes('/checkout-livro.html?livro='));
    assert.strictEqual((htmlLoja.match(/pintrk\(/g) || []).length, 2); // load + page, como antes
  });

  console.log('\nVitrine Universo Feminino');
  const htmlUF = ler('public/loja/universo-feminino/index.html');
  await teste('B. Pinterest da vitrine: mesma tag, só load + page (PageVisit), sem eventos novos nem PII', async () => {
    const lojaTag = htmlLoja.match(/pintrk\('load', '(\d+)'\)/)[1];
    assert.strictEqual(htmlUF.match(/pintrk\('load', '(\d+)'\)/)[1], lojaTag);
    const chamadas = [...htmlUF.matchAll(/pintrk\(\s*'(\w+)'/g)].map((m) => m[1]);
    assert.deepStrictEqual(chamadas, ['load', 'page']);
    assert.ok(!/pintrk\(\s*'track'/.test(htmlUF));
    assert.ok(!/b(email|e-mail|cpf|nome|name|phone|telefone)b/i.test(htmlUF.match(/<!-- Pinterest Tag[\s\S]*?end Pinterest Tag -->/)[0]));
  });
  await teste('C. "Conhecer a obra" só abre o detalhe: nenhum evento Pinterest nem addtocart na vitrine', async () => {
    assert.ok(!/addtocart|'checkout'|pintrk\('track/.test(htmlUF));
    assert.ok(htmlUF.includes('dlg.showModal()'));
  });
  await teste('vitrine: links de compra com origem, Direciona com origem, Loja completa e API única', async () => {
    assert.ok(htmlUF.includes("const ORIGEM = 'universo-feminino';"));
    assert.ok(htmlUF.includes("origem: ORIGEM"));
    assert.ok(htmlUF.includes('href="/checkout?origem=universo-feminino"'));
    assert.ok(htmlUF.includes('href="/loja/"'));
    assert.ok(htmlUF.includes("fetch('/api/livros')"));
    assert.ok(!/\d{2},\d{2}|R\$ ?\d/.test(htmlUF), 'nenhum preço escrito');
  });
  await teste('Direciona: a página /checkout ignora ?origem= (só lê cupom, tema, sessionId, erro, status)', async () => {
    const chk = ler('public/checkout.html');
    const lidos = [...chk.matchAll(/\.get\('(\w+)'\)/g)].map((m) => m[1]);
    assert.ok(!lidos.includes('origem'), 'checkout.html não consome origem');
    assert.ok(!/location\.search/.test(chk.replace(/new URLSearchParams\(window\.location\.search\)/g, '')), 'nada repassa a query inteira');
  });

  console.log('\nInvariantes F2/F2b');
  await teste('cinco preços e áudios preservados', async () => {
    const e = { 'ela-tem-classe': [34.9, 19.9], 'a-inteligencia-do-corpo-feminino': [39.9, 24.9], 'codigo-feminino': [44.9, 24.9], 'a-mulher-que-permanece-inteira': [49.9, 24.9], 'inesquecivel-charme-feminino': [49.9, 24.9] };
    for (const [id, [p, a]] of Object.entries(e)) { assert.strictEqual(CATALOGO[id].preco, p); assert.strictEqual(CATALOGO[id].precoAudiobook, a); }
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${total - ok}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — F3C: origem por whitelist, sem efeito em preço/cupom/áudio; vitrine e Loja conectadas.');
})();
