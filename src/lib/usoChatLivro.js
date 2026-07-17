// lib/usoChatLivro.js
//
// Controla o limite diário de perguntas do chat de leitura por livro.
// Cada combinação token+livro_id só pode fazer um número limitado de
// perguntas por dia (configurável via CHAT_LIVRO_LIMITE_DIARIO, default 15),
// contado na tabela `uso_chat_livro` (token, livro_id, data, perguntas).
//
// A checagem e o incremento são separados de propósito: o chamador deve
// checar o limite antes de gastar uma chamada de embedding/Claude, e só
// incrementar depois que a resposta for gerada com sucesso — assim uma
// falha no meio do caminho não consome a cota do usuário.

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

const LIMITE_DIARIO = parseInt(process.env.CHAT_LIVRO_LIMITE_DIARIO || '15', 10);

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Verifica quantas perguntas já foram feitas hoje para este token+livro.
 *
 * @param {string} token
 * @param {string} livroId
 * @returns {Promise<{perguntasFeitas: number, restantes: number, limiteAtingido: boolean}>}
 */
async function verificarLimiteDiario(token, livroId) {
  const supabaseClient = assertSupabase();

  const { data: registro, error } = await supabaseClient
    .from('uso_chat_livro')
    .select('perguntas')
    .eq('token', token)
    .eq('livro_id', livroId)
    .eq('data', hojeISO())
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao consultar uso do chat: ${error.message}`);
  }

  const perguntasFeitas = registro?.perguntas || 0;
  const restantes = Math.max(0, LIMITE_DIARIO - perguntasFeitas);

  return { perguntasFeitas, restantes, limiteAtingido: perguntasFeitas >= LIMITE_DIARIO };
}

/**
 * Registra mais uma pergunta feita hoje para este token+livro.
 * Requer uma constraint única em (token, livro_id, data) na tabela.
 *
 * @param {string} token
 * @param {string} livroId
 * @param {number} perguntasFeitas - valor retornado por verificarLimiteDiario, antes desta pergunta
 * @returns {Promise<number>} quantas perguntas ainda restam hoje após este incremento
 */
async function incrementarUsoDiario(token, livroId, perguntasFeitas) {
  const supabaseClient = assertSupabase();
  const novasPerguntas = perguntasFeitas + 1;

  const { error } = await supabaseClient
    .from('uso_chat_livro')
    .upsert(
      { token, livro_id: livroId, data: hojeISO(), perguntas: novasPerguntas },
      { onConflict: ['token', 'livro_id', 'data'] }
    );

  if (error) {
    throw new Error(`Falha ao registrar uso do chat: ${error.message}`);
  }

  return Math.max(0, LIMITE_DIARIO - novasPerguntas);
}

module.exports = { verificarLimiteDiario, incrementarUsoDiario, LIMITE_DIARIO };
