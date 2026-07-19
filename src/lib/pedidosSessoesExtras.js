// lib/pedidosSessoesExtras.js
//
// Guarda temporariamente os dados de um pedido de sessões extras (nome, email, cpf)
// entre a criação do pedido no MercadoPago e a confirmação via webhook.
//
// Usa o mesmo padrão de pedidosLivros.js, mas com prefixo "se" para sessões extras.

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
 * Registra um pedido de sessões extras pendente e devolve a referência curta a ser
 * usada como external_reference no MercadoPago.
 *
 * @param {Object} params
 * @param {string} [params.nome]
 * @param {string} params.email
 * @param {string} [params.cpf]
 * @returns {Promise<string>} referência (ex: "se3f9a1c2b...")
 */
async function criarPedidoPendente({ nome, email, cpf }) {
  const supabaseClient = assertSupabase();
  const referencia = `se${crypto.randomBytes(16).toString('hex')}`;

  const { error } = await supabaseClient.from('pedidos_sessoes_extras_pendentes').insert({
    referencia,
    nome: nome || null,
    email,
    cpf: cpf || null,
  });

  if (error) {
    throw new Error(`Falha ao registrar pedido de sessões extras: ${error.message}`);
  }

  return referencia;
}

/**
 * Busca os dados de um pedido de sessões extras pendente pela referência.
 *
 * @param {string} referencia
 * @returns {Promise<{nome: string|null, email: string, cpf: string|null}|null>}
 */
async function buscarPedidoPendente(referencia) {
  const supabaseClient = assertSupabase();

  const { data, error } = await supabaseClient
    .from('pedidos_sessoes_extras_pendentes')
    .select('*')
    .eq('referencia', referencia)
    .maybeSingle();

  if (error || !data) return null;

  return { nome: data.nome, email: data.email, cpf: data.cpf };
}

/**
 * Deleta um pedido pendente após confirmação (webhook).
 * Evita duplicatas se o webhook for chamado várias vezes.
 *
 * @param {string} referencia
 */
async function deletarPedidoPendente(referencia) {
  const supabaseClient = assertSupabase();

  const { error } = await supabaseClient
    .from('pedidos_sessoes_extras_pendentes')
    .delete()
    .eq('referencia', referencia);

  if (error) {
    console.error(`Erro ao deletar pedido pendente: ${error.message}`);
  }
}

module.exports = { criarPedidoPendente, buscarPedidoPendente, deletarPedidoPendente };
