// Teste manual (não automatizado em CI) da Fase 2 do checkout Stripe —
// produto Livros (botão Cartão). Roda contra o servidor local já de pé em
// http://localhost:8091, com o relay `stripe listen` ativo. Cartão de
// teste 4242 4242 4242 4242.
//
// Uso: node testar-checkout-livro-stripe.js <livroId> [--email=x@y.com]

const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8091';
const livroId = process.argv[2];
if (!livroId) {
  console.error('Uso: node testar-checkout-livro-stripe.js <livroId>');
  process.exit(1);
}
const emailArg = process.argv.find(a => a.startsWith('--email='));
const email = emailArg ? emailArg.split('=')[1] : 'teste.zuni.livros@example.com';
const comAudiolivro = process.argv.includes('--audiolivro');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 480, height: 900 } });

  const url = `${BASE_URL}/checkout-livro.html?livro=${encodeURIComponent(livroId)}`;
  console.log(`[TESTE-LIVRO] Abrindo ${url}`);
  await page.goto(url);
  await page.waitForTimeout(1000);

  const titulo = await page.textContent('#titulo-livro');
  console.log(`[TESTE-LIVRO] Título carregado: "${titulo}"`);

  await page.fill('#name', 'Teste Zuni Livros');
  await page.fill('#email', email);
  console.log(`[TESTE-LIVRO] Formulário preenchido (email=${email}).`);

  if (comAudiolivro) {
    await page.check('#audiolivro-checkbox');
    console.log('[TESTE-LIVRO] Audiolivro marcado.');
  }

  await page.click('#btn-cartao-metodo');
  await page.click('#btn-continuar');

  console.log('[TESTE-LIVRO] Aguardando iframe do Stripe Embedded Checkout montar...');
  await page.waitForSelector('#stripe-checkout-container iframe', { timeout: 20000 });
  await page.waitForTimeout(3000);

  async function acharFrameComCampo(seletor, timeoutMs) {
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
      for (const frame of page.frames()) {
        if (frame === page.mainFrame()) continue; // é o iframe do Stripe, nunca a própria página
        try {
          const el = await frame.$(seletor);
          if (el) return frame;
        } catch (e) {}
      }
      await page.waitForTimeout(300);
    }
    return null;
  }

  console.log('[TESTE-LIVRO] Procurando campos do cartão dentro dos iframes do Stripe...');

  const frameEmail = await acharFrameComCampo('input[name="email"], input[id*="email" i]', 15000);
  if (frameEmail) {
    try {
      await frameEmail.fill('input[name="email"], input[id*="email" i]', email);
    } catch (e) {}
  }

  const frameCardNumber = await acharFrameComCampo('input[name="number"], input[placeholder*="1234" i], input[autocomplete="cc-number"]', 20000);
  if (!frameCardNumber) throw new Error('Não encontrei o campo de número do cartão em nenhum iframe.');
  await frameCardNumber.fill('input[name="number"], input[placeholder*="1234" i], input[autocomplete="cc-number"]', '4242424242424242');

  const frameExpiry = await acharFrameComCampo('input[name="expiry"], input[placeholder*="MM" i], input[autocomplete="cc-exp"]', 5000);
  if (frameExpiry) await frameExpiry.fill('input[name="expiry"], input[placeholder*="MM" i], input[autocomplete="cc-exp"]', '12/34');

  const frameCvc = await acharFrameComCampo('input[name="cvc"], input[placeholder*="CVC" i], input[autocomplete="cc-csc"]', 5000);
  if (frameCvc) await frameCvc.fill('input[name="cvc"], input[placeholder*="CVC" i], input[autocomplete="cc-csc"]', '123');

  const frameNome = await acharFrameComCampo('input[name="billingName"], input[autocomplete="cc-name"]', 3000);
  if (frameNome) await frameNome.fill('input[name="billingName"], input[autocomplete="cc-name"]', 'Teste Zuni Livros');

  const frameCep = await acharFrameComCampo('input[name="billingPostalCode"], input[autocomplete="postal-code"]', 3000);
  if (frameCep) await frameCep.fill('input[name="billingPostalCode"], input[autocomplete="postal-code"]', '18000-000');

  console.log('[TESTE-LIVRO] Campos preenchidos. Procurando botão de pagar...');
  const frameBotaoPagar = await acharFrameComCampo('button[type="submit"]', 5000);
  if (!frameBotaoPagar) throw new Error('Não encontrei o botão de submit do Stripe.');

  await page.screenshot({ path: 'debug-antes-pagar.png', fullPage: true });
  await frameBotaoPagar.click('button[type="submit"]');
  console.log('[TESTE-LIVRO] Botão de pagar clicado. Aguardando redirect de retorno (return_url)...');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'debug-depois-pagar.png', fullPage: true });
  console.log('[TESTE-LIVRO] URL logo após clicar pagar:', page.url());

  await page.waitForURL('**/checkout-livro.html?**status=retorno**', { timeout: 30000 }).catch(async (e) => {
    console.log('[TESTE-LIVRO] Timeout esperando URL de retorno. URL atual:', page.url());
    await page.screenshot({ path: 'debug-timeout-retorno.png', fullPage: true });
    throw e;
  });

  console.log('[TESTE-LIVRO] URL de retorno:', page.url());
  console.log('[TESTE-LIVRO] Aguardando webhook confirmar pagamento e liberar acesso...');

  await page.waitForURL(`**/livros/${encodeURIComponent(livroId)}?token=**`, { timeout: 90000 }).catch(async (e) => {
    console.log('[TESTE-LIVRO] Timeout esperando redirect final pro livro. URL atual:', page.url());
    throw e;
  });

  console.log('[TESTE-LIVRO] URL final (acesso liberado):', page.url());

  await browser.close();
})().catch(async (e) => {
  console.error('[TESTE-LIVRO] ERRO:', e);
  process.exit(1);
});
