// lib/limpezaSessoes.js
//
// Rotina de retenção de dados das sessões do Mentor.
//
// Quando uma sessão encerra (message_count >= 15, mesmo limite do chat) ou
// fica 10 dias sem atividade, o conteúdo pessoal dela deixa de ter uso e é
// zerado: o histórico da conversa (`history`) e os dados de nascimento
// (`birth_date`, `birth_time`, `birth_location`, `birth_name_full`).
//
// IMPORTANTE: isto é UPDATE, não DELETE. A linha continua em `sessions` —
// os metadados operacionais (paid, product_type, created_at, message_count,
// updated_at) ficam intactos. Só o conteúdo sai.

const { createClient } = require('@supabase/supabase-js');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

// message_count a partir do qual a sessão é considerada encerrada — casa com
// LIMITE_INTERACOES em src/server.js (bloqueio rígido de 15 trocas).
const LIMITE_ENCERRAMENTO = 15;
// dias sem `updated_at` mudar para a sessão ser considerada abandonada.
const DIAS_INATIVIDADE = 10;

/**
 * Zera `history` e os dados de nascimento das sessões que se qualificam:
 *   history não-vazio E (message_count >= 15 OU updated_at < agora - 10 dias)
 *
 * Não lança — em erro, loga e devolve 0, para não derrubar o boot nem o
 * intervalo que a chama.
 *
 * @returns {Promise<number>} quantidade de linhas afetadas
 */
async function limparSessoesExpiradas() {
  if (!supabase) {
    console.warn('[LIMPEZA-SESSOES] Supabase não configurado — limpeza ignorada.');
    return 0;
  }

  // updated_at é gravado como new Date().toISOString() (UTC) em upsertSession;
  // o corte também em UTC, sem milissegundos para não confundir o parser de
  // filtros do PostgREST.
  const corte = new Date(Date.now() - DIAS_INATIVIDADE * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');

  try {
    const { data, error } = await supabase
      .from('sessions')
      .update({
        history: [],
        birth_date: null,
        birth_time: null,
        birth_location: null,
        birth_name_full: null,
      })
      // history não-vazio: nem nulo, nem array vazio (upsertSession sempre
      // grava um array em history).
      .not('history', 'is', null)
      .neq('history', '[]')
      .or(`message_count.gte.${LIMITE_ENCERRAMENTO},updated_at.lt.${corte}`)
      .select('session_id');

    if (error) {
      console.error(`[LIMPEZA-SESSOES] Falha ao limpar sessões: ${error.message}`);
      return 0;
    }

    const afetadas = Array.isArray(data) ? data.length : 0;
    console.log(`[LIMPEZA-SESSOES] ${afetadas} sessao(oes) tiveram history e dados de nascimento zerados.`);
    return afetadas;
  } catch (err) {
    console.error(`[LIMPEZA-SESSOES] Erro inesperado: ${err.message}`);
    return 0;
  }
}

module.exports = { limparSessoesExpiradas, LIMITE_ENCERRAMENTO, DIAS_INATIVIDADE };
