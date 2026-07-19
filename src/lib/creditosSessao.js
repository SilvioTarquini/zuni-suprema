/**
 * Gerenciamento de Créditos de Sessão
 *
 * Controla pacotes de "Sessões Extras" (3 sessões por R$74,90)
 * Cada pacote tem memória de jornada ativada entre suas sessões
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

const PREÇO_PACOTE = 74.90;
const SESSOES_POR_PACOTE = 3;
const DIAS_VALIDADE = 30;

function assertSupabase() {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados.');
  }
  return supabase;
}

/**
 * Cria um novo pacote de créditos de sessão após pagamento confirmado
 * Chamado pelo webhook do MercadoPago quando pagamento de "Sessões Extras" é aprovado
 *
 * @param {Object} params
 * @param {string} params.email - Email do cliente
 * @param {string} params.paymentId - ID do pagamento no MercadoPago
 * @param {number} [params.sessoes] - Quantas sessões (padrão: 3)
 * @returns {Promise<{pacoteId: string, email: string, creditos: number, expiraEm: Date}>}
 */
async function criarPacoteSessoes({ email, paymentId, sessoes = SESSOES_POR_PACOTE }) {
  const supabaseClient = assertSupabase();

  const pacoteId = uuidv4();
  const expiraEm = new Date(Date.now() + DIAS_VALIDADE * 24 * 60 * 60 * 1000);

  const { error } = await supabaseClient.from('creditos_sessao').insert({
    pacote_id: pacoteId,
    email,
    payment_id: paymentId,
    creditos_iniciais: sessoes,
    creditos_restantes: sessoes,
    data_pagamento: new Date().toISOString(),
    expira_em: expiraEm.toISOString(),
    ativo: true
  });

  if (error) {
    throw new Error(`Falha ao criar pacote de sessões: ${error.message}`);
  }

  console.log(`[CREDITOS] Pacote criado: ${email} — ${sessoes} sessões (expira ${expiraEm.toLocaleDateString('pt-BR')})`);

  return {
    pacoteId,
    email,
    creditos: sessoes,
    expiraEm
  };
}

/**
 * Busca pacote ativo com créditos disponíveis para um email
 * Retorna o pacote mais recente com créditos > 0
 *
 * @param {string} email
 * @returns {Promise<Object|null>} - Pacote com créditos ou null
 */
async function buscarPacoteAtivo(email) {
  if (!email) return null;

  const supabaseClient = assertSupabase();

  const { data, error } = await supabaseClient
    .from('creditos_sessao')
    .select('*')
    .eq('email', email)
    .eq('ativo', true)
    .gt('creditos_restantes', 0)
    .order('data_pagamento', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = nenhuma linha encontrada (esperado quando não há pacote ativo)
    console.error('[CREDITOS] Erro ao buscar pacote:', error.message);
    return null;
  }

  if (!data) return null;

  // Verificar se não expirou
  if (new Date(data.expira_em).getTime() < Date.now()) {
    return null;
  }

  return data;
}

/**
 * Consome um crédito de sessão
 * Chamado ao iniciar uma sessão com crédito disponível
 *
 * @param {string} pacoteId
 * @param {string} sessionId - ID da sessão do Mentor
 * @returns {Promise<Object>} - Pacote atualizado
 */
async function consumirCredito(pacoteId, sessionId) {
  const supabaseClient = assertSupabase();

  // Decrementar crédito
  const { data, error } = await supabaseClient
    .from('creditos_sessao')
    .update({
      creditos_restantes: supabaseClient.rpc('creditos_sessao - 1'),
      ultima_sessao_id: sessionId,
      data_ultima_sessao: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    })
    .eq('pacote_id', pacoteId)
    .select()
    .single();

  if (error) {
    throw new Error(`Falha ao consumir crédito: ${error.message}`);
  }

  console.log(`[CREDITOS] Crédito consumido: ${pacoteId} — Restantes: ${data.creditos_restantes}`);

  return data;
}

/**
 * Versão alternativa mais simples de consumirCredito (sem RPC)
 */
async function consumirCreditoSimples(pacoteId, sessionId) {
  const supabaseClient = assertSupabase();

  // Primeiro, buscar o pacote atual
  const { data: pacote, error: erroFetch } = await supabaseClient
    .from('creditos_sessao')
    .select('*')
    .eq('pacote_id', pacoteId)
    .single();

  if (erroFetch) {
    throw new Error(`Pacote não encontrado: ${erroFetch.message}`);
  }

  // Decrementar manualmente
  const novosCreditosRestantes = Math.max(0, pacote.creditos_restantes - 1);

  const { error: erroUpdate } = await supabaseClient
    .from('creditos_sessao')
    .update({
      creditos_restantes: novosCreditosRestantes,
      ultima_sessao_id: sessionId,
      data_ultima_sessao: new Date().toISOString(),
      atualizado_em: new Date().toISOString()
    })
    .eq('pacote_id', pacoteId);

  if (erroUpdate) {
    throw new Error(`Falha ao consumir crédito: ${erroUpdate.message}`);
  }

  console.log(`[CREDITOS] Crédito consumido: ${pacoteId} — Restantes: ${novosCreditosRestantes}`);

  return { ...pacote, creditos_restantes: novosCreditosRestantes };
}

/**
 * Busca todos os resumos de sessões do mesmo pacote
 * Para injeção de memória de jornada
 *
 * @param {string} pacoteId
 * @param {number} limite - Últimos N resumos (padrão: 5)
 * @returns {Promise<Array>} - Lista de resumos
 */
async function buscarResumosDoPacko(pacoteId, limite = 5) {
  const supabaseClient = assertSupabase();

  // Buscar o pacote para saber o email
  const { data: pacote, error: erroFetch } = await supabaseClient
    .from('creditos_sessao')
    .select('*')
    .eq('pacote_id', pacoteId)
    .single();

  if (erroFetch) {
    console.error('[CREDITOS] Erro ao buscar pacote:', erroFetch.message);
    return [];
  }

  // Buscar resumos salvos DEPOIS do pagamento desse pacote (sessões desse pacote)
  const { data: resumos, error: erroResumos } = await supabaseClient
    .from('resumos_sessoes')
    .select('*')
    .eq('email', pacote.email)
    .gte('data_sessao', pacote.data_pagamento)
    .lte('data_sessao', pacote.expira_em)
    .eq('ativo', true)
    .order('data_sessao', { ascending: false })
    .limit(limite);

  if (erroResumos) {
    console.error('[CREDITOS] Erro ao buscar resumos:', erroResumos.message);
    return [];
  }

  return resumos || [];
}

/**
 * Status do pacote (info pública para exibir ao cliente)
 *
 * @param {string} pacoteId
 * @returns {Promise<Object|null>}
 */
async function statusPacote(pacoteId) {
  const supabaseClient = assertSupabase();

  const { data, error } = await supabaseClient
    .from('creditos_sessao')
    .select('*')
    .eq('pacote_id', pacoteId)
    .single();

  if (error || !data) return null;

  return {
    pacoteId: data.pacote_id,
    creditosRestantes: data.creditos_restantes,
    creditosIniciais: data.creditos_iniciais,
    expiraEm: new Date(data.expira_em),
    expirado: new Date(data.expira_em).getTime() < Date.now(),
    ativo: data.ativo && data.creditos_restantes > 0
  };
}

module.exports = {
  criarPacoteSessoes,
  buscarPacoteAtivo,
  consumirCredito: consumirCreditoSimples,
  buscarResumosDoPacko,
  statusPacote,
  PREÇO_PACOTE,
  SESSOES_POR_PACOTE,
  DIAS_VALIDADE
};
