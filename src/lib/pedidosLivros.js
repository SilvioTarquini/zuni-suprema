// lib/pedidosLivros.js
//
// Guarda temporariamente os dados de um pedido de livro (nome, email, cpf)
// entre a criação do pedido no MercadoPago e a confirmação via webhook.
//
// Necessário porque o external_reference da API de orders do MercadoPago
// só aceita [A-Za-z0-9_-], com no máximo 64 caracteres — curto demais para
// carregar e-mail e CPF diretamente. Em vez disso, geramos uma referência
// curta e opaca (prefixo "lv" + hex aleatório) e guardamos os dados reais
// aqui, indexados por ela.

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
 * Registra um pedido de livro pendente e devolve a referência curta a ser
 * usada como external_reference no MercadoPago.
 *
 * @param {Object} params
 * @param {string} params.livroId
 * @param {string} [params.nome]
 * @param {string} params.email
 * @param {string} [params.cpf]
 * @returns {Promise<string>} referência (ex: "lv3f9a1c2b...")
 */
async function criarPedidoPendente({ livroId, nome, email, cpf }) {
  const supabaseClient = assertSupabase();
  const referencia = `lv${crypto.randomBytes(16).toString('hex')}`;

  const { error } = await supabaseClient.from('pedidos_livros_pendentes').insert({
    referencia,
    livro_id: livroId,
    nome: nome || null,
    email,
    cpf: cpf || null,
  });

  if (error) {
    throw new Error(`Falha ao registrar pedido de livro: ${error.message}`);
  }

  return referencia;
}

/**
 * Busca os dados de um pedido de livro pendente pela referência.
 *
 * @param {string} referencia
 * @returns {Promise<{livroId: string, nome: string|null, email: string, cpf: string|null}|null>}
 */
async function buscarPedidoPendente(referencia) {
  const supabaseClient = assertSupabase();

  const { data, error } = await supabaseClient
    .from('pedidos_livros_pendentes')
    .select('*')
    .eq('referencia', referencia)
    .maybeSingle();

  if (error || !data) return null;

  return { livroId: data.livro_id, nome: data.nome, email: data.email, cpf: data.cpf };
}

module.exports = { criarPedidoPendente, buscarPedidoPendente };
