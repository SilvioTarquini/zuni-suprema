// lib/keepaliveSupabase.js
//
// "Sinal de vida" para o Supabase: o plano gratuito pausa o projeto após um
// período sem atividade. Uma consulta leve e somente leitura, 1 min após o boot
// e depois a cada 6h, mantém o banco ativo.
//
// Nunca lança: falha vira uma linha de log. Para não poluir os logs, só a
// primeira falha de uma sequência é registrada (e a recuperação, uma vez).

const { createClient } = require('@supabase/supabase-js');

const SEIS_HORAS_MS = 6 * 60 * 60 * 1000;
const UM_MINUTO_MS = 60 * 1000;
// Tabela pequena e já usada pelo servidor; só lemos 1 linha de 1 coluna.
const TABELA = 'sessions';
const COLUNA = 'session_id';

/**
 * Ligado por padrão em produção (NODE_ENV=production ou Railway);
 * SUPABASE_KEEPALIVE=0 desliga, =1 liga em qualquer ambiente.
 */
function keepaliveAtivo(env = process.env) {
  const v = String(env.SUPABASE_KEEPALIVE || '').trim();
  if (v === '0') return false;
  if (v === '1') return true;
  return env.NODE_ENV === 'production' || Boolean(env.RAILWAY_ENVIRONMENT || env.RAILWAY_ENVIRONMENT_NAME);
}

/**
 * Uma consulta de 1 linha. Nunca rejeita.
 * @returns {Promise<{ok: boolean, ms: number, erro?: string}>}
 */
async function pingSupabase(client) {
  const inicio = Date.now();
  try {
    const { error } = await client.from(TABELA).select(COLUNA).limit(1);
    if (error) return { ok: false, ms: Date.now() - inicio, erro: error.message };
    return { ok: true, ms: Date.now() - inicio };
  } catch (err) {
    return { ok: false, ms: Date.now() - inicio, erro: err.message };
  }
}

/**
 * Agenda o sinal de vida. Devolve uma função `parar()` (usada nos testes).
 * Os timers são unref: não seguram o processo aberto.
 */
function iniciarKeepalive({
  client,
  env = process.env,
  intervaloMs = SEIS_HORAS_MS,
  atrasoInicialMs = UM_MINUTO_MS,
  log = console,
} = {}) {
  if (!keepaliveAtivo(env)) return () => {};
  if (!client) {
    log.warn('[KEEPALIVE] Supabase não configurado — sinal de vida desativado.');
    return () => {};
  }

  let falhando = false;
  const executar = async () => {
    const r = await pingSupabase(client);
    if (r.ok) {
      log.log(`[KEEPALIVE] Supabase ok (${r.ms}ms)${falhando ? ' — recuperado' : ''}`);
      falhando = false;
    } else if (!falhando) {
      log.warn(`[KEEPALIVE] Supabase falhou: ${r.erro}`);
      falhando = true;
    }
  };

  const inicial = setTimeout(executar, atrasoInicialMs);
  const periodico = setInterval(executar, intervaloMs);
  inicial.unref();
  periodico.unref();
  return () => { clearTimeout(inicial); clearInterval(periodico); };
}

function criarClientePadrao(env = process.env) {
  return env.SUPABASE_URL && env.SUPABASE_KEY ? createClient(env.SUPABASE_URL, env.SUPABASE_KEY) : null;
}

module.exports = { keepaliveAtivo, pingSupabase, iniciarKeepalive, criarClientePadrao, SEIS_HORAS_MS, UM_MINUTO_MS };
