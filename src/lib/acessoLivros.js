// lib/acessoLivros.js
//
// Controla a liberação de acesso aos livros (leitura, download, impressão)
// após confirmação de pagamento via MercadoPago.
//
// Depende de um cliente Supabase (service role, pois grava na tabela
// `acessos_livros` que não tem policy pública). Usa o mesmo par de
// variáveis de ambiente (SUPABASE_URL / SUPABASE_KEY) e o mesmo padrão
// de inicialização já usado em src/server.js e src/indexar.js.

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

const DIAS_DE_ACESSO = parseInt(process.env.LIVRO_ACESSO_DIAS || '7', 10);

/**
 * Gera um token de acesso único para um livro, vinculado ao comprador,
 * com prazo de expiração. Deve ser chamado a partir do webhook do
 * MercadoPago, assim que o pagamento for confirmado.
 *
 * @param {Object} params
 * @param {string} params.livroId - identificador do livro (ex: 'os-bastidores-vol-5')
 * @param {string} params.email - e-mail do comprador
 * @param {string} [params.cpf] - CPF do comprador (opcional)
 * @param {string} [params.paymentId] - ID do pagamento no MercadoPago
 * @returns {Promise<{token: string, expiraEm: Date}>}
 */
async function criarAcesso({ livroId, email, cpf, paymentId }) {
  const supabaseClient = assertSupabase();
  const token = crypto.randomBytes(24).toString('hex');
  const expiraEm = new Date(Date.now() + DIAS_DE_ACESSO * 24 * 60 * 60 * 1000);

  const { error } = await supabaseClient.from('acessos_livros').insert({
    livro_id: livroId,
    email,
    cpf: cpf || null,
    token,
    payment_id: paymentId || null,
    data_pagamento: new Date().toISOString(),
    data_expiracao: expiraEm.toISOString(),
  });

  if (error) {
    throw new Error(`Falha ao criar acesso ao livro: ${error.message}`);
  }

  return { token, expiraEm };
}

/**
 * Verifica se um token é válido para um determinado livro:
 * existe, está dentro do prazo. Retorna o registro se válido, ou null.
 *
 * @param {string} token
 * @param {string} livroId
 * @returns {Promise<Object|null>}
 */
async function verificarAcesso(token, livroId) {
  if (!token) return null;
  const supabaseClient = assertSupabase();

  const { data, error } = await supabaseClient
    .from('acessos_livros')
    .select('*')
    .eq('token', token)
    .eq('livro_id', livroId)
    .single();

  if (error || !data) return null;

  const expirado = new Date(data.data_expiracao).getTime() < Date.now();
  if (expirado) return null;

  // Marca o primeiro acesso (não bloqueia reuso dentro do prazo,
  // apenas registra para fins de auditoria/estatística)
  if (!data.usado_em) {
    await supabaseClient
      .from('acessos_livros')
      .update({ usado_em: new Date().toISOString() })
      .eq('token', token);
  }

  return data;
}

module.exports = { criarAcesso, verificarAcesso, DIAS_DE_ACESSO };
