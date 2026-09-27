// lib/pedidosCheckoutStripe.js
//
// Tabela genérica de pedido pendente para o checkout via Stripe (Fase 2+ da
// migração MercadoPago → Stripe). Uma linha carrega o payload necessário
// para o fulfillment de qualquer produto (ex.: livroId, email,
// audiolivroIncluido para 'livro') entre a criação da Checkout Session e a
// confirmação via webhook — identificada só pelo id opaco (pedidoId).
//
// Diferente do padrão antigo por produto (pedidos_livros_pendentes etc.,
// que existem por causa do limite de 64 caracteres do external_reference
// do MercadoPago), o metadata do Stripe não tem essa restrição — ainda
// assim mantemos uma tabela (em vez de só metadata) para dar um lugar
// único e auditável onde o webhook grava o resultado do fulfillment
// (ver marcarPedidoPendenteProcessado), consumido pelo polling do front.

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

function assertSupabase() {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados para usar o Supabase.');
  }
  return supabase;
}

/**
 * Registra um pedido pendente e devolve o pedidoId (uuid opaco) a ser usado
 * como client_reference_id / metadata.pedidoId na Checkout Session Stripe.
 *
 * @param {Object} params
 * @param {string} params.fulfillmentType - ex: 'livro', 'sessoes-extras'
 * @param {Object} params.payload - dados necessários ao fulfillment (produto-específico)
 * @param {number} [params.valorPago] - valor final cobrado (após cupom)
 * @returns {Promise<string>} pedidoId
 */
async function criarPedidoPendenteStripe({ fulfillmentType, payload, valorPago }) {
  const supabaseClient = assertSupabase();
  const pedidoId = crypto.randomUUID();

  const { error } = await supabaseClient.from('checkout_pedidos_pendentes').insert({
    id: pedidoId,
    fulfillment_type: fulfillmentType,
    payload: payload || {},
    valor_pago: valorPago ?? null
  });

  if (error) {
    throw new Error(`Falha ao registrar pedido pendente (${fulfillmentType}): ${error.message}`);
  }

  return pedidoId;
}

/**
 * Busca um pedido pendente pelo pedidoId.
 *
 * @param {string} pedidoId
 * @returns {Promise<{id: string, fulfillmentType: string, payload: Object, valorPago: number|null, stripeSessionId: string|null, resultado: Object|null, processadoEm: string|null}|null>}
 */
async function buscarPedidoPendenteStripe(pedidoId) {
  const supabaseClient = assertSupabase();

  const { data, error } = await supabaseClient
    .from('checkout_pedidos_pendentes')
    .select('*')
    .eq('id', pedidoId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    fulfillmentType: data.fulfillment_type,
    payload: data.payload || {},
    valorPago: data.valor_pago,
    stripeSessionId: data.stripe_session_id,
    resultado: data.resultado,
    processadoEm: data.processado_em
  };
}

/**
 * Grava o stripe_session_id na criação da Checkout Session (antes do
 * pagamento) — permite localizar o pedido pelo id da Checkout Session
 * caso o webhook precise, sem depender só do metadata.
 *
 * @param {string} pedidoId
 * @param {string} stripeSessionId
 */
async function vincularStripeSessionId(pedidoId, stripeSessionId) {
  const supabaseClient = assertSupabase();
  const { error } = await supabaseClient
    .from('checkout_pedidos_pendentes')
    .update({ stripe_session_id: stripeSessionId })
    .eq('id', pedidoId);

  if (error) {
    throw new Error(`Falha ao vincular stripe_session_id ao pedido ${pedidoId}: ${error.message}`);
  }
}

/**
 * Marca um pedido como processado, gravando o resultado do fulfillment.
 * ATÔMICO por processado_em IS NULL: se duas reentregas do webhook
 * chegarem quase juntas, só a primeira marca (a segunda recebe data vazio
 * e deve tratar como "já processado por outra chamada").
 *
 * Chame isto SÓ DEPOIS que o fulfillment (ex.: criarAcesso) já tiver sido
 * concluído com sucesso — nunca antes, senão uma falha no meio do
 * fulfillment faria o pedido ser considerado resolvido sem o cliente ter
 * de fato recebido o produto.
 *
 * @param {string} pedidoId
 * @param {Object} resultado - o que o fulfillment gerou (ex: { token, tokenAudiolivro })
 * @returns {Promise<boolean>} true se esta chamada foi quem marcou (false = já estava marcado)
 */
async function marcarPedidoPendenteProcessado(pedidoId, resultado) {
  const supabaseClient = assertSupabase();

  const { data, error } = await supabaseClient
    .from('checkout_pedidos_pendentes')
    .update({ processado_em: new Date().toISOString(), resultado })
    .eq('id', pedidoId)
    .is('processado_em', null)
    .select();

  if (error) {
    throw new Error(`Falha ao marcar pedido ${pedidoId} como processado: ${error.message}`);
  }

  return Boolean(data && data.length > 0);
}

module.exports = {
  criarPedidoPendenteStripe,
  buscarPedidoPendenteStripe,
  vincularStripeSessionId,
  marcarPedidoPendenteProcessado
};
