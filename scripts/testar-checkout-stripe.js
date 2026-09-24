// Teste manual (não automatizado em CI) da Fase 1 do checkout Stripe da
// Sessão ZUNI (ZUNI Direciona). Roda contra o servidor local já de pé em
// http://localhost:8091. Usa o cartão de teste 4242 4242 4242 4242.
//
// Uso: node testar-checkout-stripe.js [--cupom=CODIGO]

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8091';
const cupomArg = process.argv.find(a => a.startsWith('--cupom='));
const cupom = cupomArg ? cupomArg.split('=')[1] : null;
const screenshotPath = process.argv.includes('--screenshot-name')
  ? process.argv[process.argv.indexOf('--screenshot-name') + 1]
  : 'checkout-embedded.png';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });

  const pintrkEvents = [];
  await page.exposeFunction('__capturarPintrk', (args) => {
    pintrkEvents.push(args);
  });
  await page.addInitScript(() => {
    const originalPintrk = window.pintrk;
    // Intercepta pintrk assim que a página cria a função (o script da Pinterest
    // sobrescreve window.pintrk logo depois — por isso o polling abaixo).
    Object.defineProperty(window, 'pintrk', {
      configurable: true,
      get() { return this.__pintrkReal; },
      set(fn) {
        this.__pintrkReal = function (...args) {
          try { window.__capturarPintrk(JSON.stringify(args)); } catch (e) {}
          return fn.apply(this, args);
        };
      }
    });
  });

  let url = `${BASE_URL}/checkout.html?tema=adolescentes`;
  if (cupom) url += `&cupom=${encodeURIComponent(cupom)}`;

  console.log(`[TESTE] Abrindo ${url}`);
  await page.goto(url);

  await page.waitForTimeout(1500); // deixa aplicarTemaDaURL/carregarCupomDaUrl rodarem

  const titulo = await page.textContent('#tema-titulo');
  const precoTexto = await page.textContent('.price');
  console.log(`[TESTE] Título aplicado (tema=adolescentes): "${titulo}"`);
  console.log(`[TESTE] Preço exibido no card: "${precoTexto.trim()}"`);

  console.log('[TESTE] Clicando no botão "Começar minha orientação"...');
  await page.click('#btn');

  console.log('[TESTE] Aguardando iframe do Stripe Embedded Checkout montar...');
  const stripeFrame = await page.waitForSelector('#stripe-checkout-container iframe', { timeout: 20000 });
  await page.waitForTimeout(3000); // Embedded Checkout carrega o form dentro do iframe

  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[TESTE] Screenshot salvo em ${screenshotPath}`);

  // O Embedded Checkout usa iframes aninhados (host controller ->
  // payment-details). Localiza o frame que realmente tem o campo de
  // número do cartão.
  async function acharFrameComCampo(seletor, timeoutMs) {
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      for (const frame of page.frames()) {
        try {
          const el = await frame.$(seletor);
          if (el) return frame;
        } catch (e) {}
      }
      await page.waitForTimeout(300);
    }
    return null;
  }

  console.log('[TESTE] Procurando campo de e-mail/cartão dentro dos iframes do Stripe...');

  const frameEmail = await acharFrameComCampo('input[name="email"], input[id*="email" i]', 15000);
  if (frameEmail) {
    try {
      await frameEmail.fill('input[name="email"], input[id*="email" i]', 'teste.zuni@example.com');
      console.log('[TESTE] E-mail preenchido.');
    } catch (e) { console.log('[TESTE] Não consegui preencher e-mail (pode já vir preenchido/oculto):', e.message); }
  }

  const frameCardNumber = await acharFrameComCampo('input[name="number"], input[placeholder*="1234" i], input[autocomplete="cc-number"]', 20000);
  if (!frameCardNumber) {
    throw new Error('Não encontrei o campo de número do cartão em nenhum iframe.');
  }
  await frameCardNumber.fill('input[name="number"], input[placeholder*="1234" i], input[autocomplete="cc-number"]', '4242424242424242');
  console.log('[TESTE] Número do cartão preenchido.');

  const frameExpiry = await acharFrameComCampo('input[name="expiry"], input[placeholder*="MM" i], input[autocomplete="cc-exp"]', 5000);
  if (frameExpiry) {
    await frameExpiry.fill('input[name="expiry"], input[placeholder*="MM" i], input[autocomplete="cc-exp"]', '12/34');
    console.log('[TESTE] Validade preenchida.');
  }

  const frameCvc = await acharFrameComCampo('input[name="cvc"], input[placeholder*="CVC" i], input[autocomplete="cc-csc"]', 5000);
  if (frameCvc) {
    await frameCvc.fill('input[name="cvc"], input[placeholder*="CVC" i], input[autocomplete="cc-csc"]', '123');
    console.log('[TESTE] CVC preenchido.');
  }

  // Nome no cartão / CEP, se pedidos
  const frameNome = await acharFrameComCampo('input[name="billingName"], input[autocomplete="cc-name"]', 3000);
  if (frameNome) {
    await frameNome.fill('input[name="billingName"], input[autocomplete="cc-name"]', 'Teste Zuni');
  }
  const frameCep = await acharFrameComCampo('input[name="billingPostalCode"], input[autocomplete="postal-code"]', 3000);
  if (frameCep) {
    await frameCep.fill('input[name="billingPostalCode"], input[autocomplete="postal-code"]', '18000-000');
  }

  await page.screenshot({ path: screenshotPath.replace('.png', '-preenchido.png'), fullPage: true });

  console.log('[TESTE] Procurando botão de pagar...');
  const frameBotaoPagar = await acharFrameComCampo('button[type="submit"]', 5000);
  if (!frameBotaoPagar) throw new Error('Não encontrei o botão de submit do Stripe.');

  await frameBotaoPagar.click('button[type="submit"]');
  console.log('[TESTE] Botão de pagar clicado. Aguardando redirect para checkout.html (return_url)...');

  await page.waitForURL('**/checkout.html?**status=retorno**', { timeout: 30000 }).catch(async (e) => {
    console.log('[TESTE] Timeout esperando URL de retorno. URL atual:', page.url());
    await page.screenshot({ path: screenshotPath.replace('.png', '-timeout.png'), fullPage: true });
    throw e;
  });

  console.log('[TESTE] URL de retorno:', page.url());
  console.log('[TESTE] Aguardando webhook confirmar pagamento (pode levar ~30s no relay local do Stripe CLI)...');

  await page.waitForURL('**/questionario-selecao.html**', { timeout: 90000 }).catch(async (e) => {
    console.log('[TESTE] Timeout esperando redirect final pro questionário. URL atual:', page.url());
    await page.screenshot({ path: screenshotPath.replace('.png', '-pos-retorno.png'), fullPage: true });
    throw e;
  });

  console.log('[TESTE] URL final (pós-confirmação):', page.url());

  await page.waitForTimeout(500);
  console.log('[TESTE] Eventos pintrk capturados:', JSON.stringify(pintrkEvents, null, 2));

  await browser.close();
})().catch(async (e) => {
  console.error('[TESTE] ERRO:', e);
  process.exit(1);
});
