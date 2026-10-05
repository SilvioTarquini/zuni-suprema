// lib/origemCompra.js
//
// Origem comercial de uma compra (de qual vitrine/entrada a pessoa veio), só como
// contexto de análise. Whitelist fechada: qualquer outro valor vira null, para que
// uma query/body arbitrária nunca seja gravada, refletida na página ou usada como
// dado. A origem NUNCA influencia preço, cupom, produto, acesso ou fulfillment.
//
// Espelhada no cliente (public/js/checkout-livro-cliente.js, lerOrigem) só para não
// enviar lixo; o servidor revalida sempre — esta é a validação que vale.

const ORIGENS_PERMITIDAS = ['universo-feminino'];

function normalizarOrigem(valor) {
  return typeof valor === 'string' && ORIGENS_PERMITIDAS.includes(valor) ? valor : null;
}

module.exports = { ORIGENS_PERMITIDAS, normalizarOrigem };
