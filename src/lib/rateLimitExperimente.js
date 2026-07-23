/**
 * Rate Limiter para Chat de Demonstração (/api/experimente-chat)
 * - Limite: 5 trocas por visitante
 * - Reset: A cada 24h
 * - Identificação: sessionId (cookie) + hash de IP
 * - Storage: Memória (com audit trail em Supabase)
 *
 * LGPD: IP é armazenado como hash SHA-256, não identificável
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

// Armazenamento em memória de sessões de demonstração
// { visitorHash: { messageCount: 2, lastResetTime: timestamp, tokenUsage: [...] } }
const experimenteSessions = new Map();

const LIMITE_TROCAS = 5;
const JANELA_RESET_MS = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Cria hash SHA-256 do IP (LGPD: não identificável)
 */
function hashearIP(ip) {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

/**
 * Extrai IP origem da requisição
 */
function extrairIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.socket.remoteAddress ||
         '0.0.0.0';
}

/**
 * Gera identificador único do visitante (sessionId + hashIP)
 */
function gerarVisitorHash(sessionId, req) {
  const ipHash = hashearIP(extrairIP(req));
  return `${sessionId}:${ipHash}`;
}

/**
 * Verifica se visitante atingiu limite de trocas
 * Retorna: { permitido: boolean, contador: number, ultimaTroca: boolean, horasAteReset: number }
 */
function verificarLimite(visitorHash) {
  const agora = Date.now();
  const sessao = experimenteSessions.get(visitorHash);

  if (!sessao) {
    // Primeira troca deste visitante
    experimenteSessions.set(visitorHash, {
      messageCount: 0,
      lastResetTime: agora,
      tokenUsage: []
    });
    return { permitido: true, contador: 0, ultimaTroca: false, horasAteReset: 24 };
  }

  // Verificar se precisa resetar (24h passadas?)
  const tempoDecorrido = agora - sessao.lastResetTime;
  if (tempoDecorrido >= JANELA_RESET_MS) {
    // Reset
    sessao.messageCount = 0;
    sessao.lastResetTime = agora;
    sessao.tokenUsage = [];
    console.log(`[RATE_LIMIT] Reset para ${visitorHash} após 24h`);
  }

  const contador = sessao.messageCount;
  const horasAteReset = Math.ceil((JANELA_RESET_MS - tempoDecorrido) / (60 * 60 * 1000));

  if (contador >= LIMITE_TROCAS) {
    return {
      permitido: false,
      contador,
      ultimaTroca: false,
      horasAteReset
    };
  }

  // Penúltima troca?
  const ultimaTroca = contador === LIMITE_TROCAS - 1;

  return { permitido: true, contador, ultimaTroca, horasAteReset };
}

/**
 * Incrementa contador e registra uso de tokens
 * tokens: { input: 1234, output: 456 }
 */
function registrarUso(visitorHash, tokens) {
  const sessao = experimenteSessions.get(visitorHash);
  if (!sessao) return;

  sessao.messageCount += 1;
  sessao.tokenUsage.push({
    timestamp: Date.now(),
    input: tokens.input || 0,
    output: tokens.output || 0,
    total: (tokens.input || 0) + (tokens.output || 0)
  });

  console.log(
    `[RATE_LIMIT] ${visitorHash} — Troca ${sessao.messageCount}/${LIMITE_TROCAS} ` +
    `(input: ${tokens.input}, output: ${tokens.output})`
  );
}

/**
 * Registra consumo de tokens no Supabase para auditoria
 * (Background, não falha a requisição)
 */
async function auditarConsumo(visitorHash, tokens, resposta) {
  if (!supabase) return;

  try {
    const [sessionId, ipHash] = visitorHash.split(':');
    const { error } = await supabase.from('experimente_chat_audit').insert([
      {
        session_id: sessionId,
        ip_hash: ipHash,
        input_tokens: tokens.input || 0,
        output_tokens: tokens.output || 0,
        total_tokens: (tokens.input || 0) + (tokens.output || 0),
        resposta_length: resposta?.length || 0,
        created_at: new Date().toISOString()
      }
    ]);

    if (error) {
      console.error('[AUDIT] Erro ao registrar consumo:', error.message);
    }
  } catch (err) {
    console.error('[AUDIT] Erro ao auditoria consumo:', err.message);
  }
}

/**
 * Retorna estatísticas de consumo do visitante
 */
function obterEstatisticas(visitorHash) {
  const sessao = experimenteSessions.get(visitorHash);
  if (!sessao) return null;

  const total = sessao.tokenUsage.reduce((acc, uso) => acc + uso.total, 0);
  const media = sessao.tokenUsage.length > 0 ? Math.round(total / sessao.tokenUsage.length) : 0;

  return {
    trocas: sessao.messageCount,
    totalTokens: total,
    mediaTokensPorTroca: media,
    detalhe: sessao.tokenUsage
  };
}

module.exports = {
  verificarLimite,
  registrarUso,
  auditarConsumo,
  obterEstatisticas,
  gerarVisitorHash,
  extrairIP,
  hashearIP,
  LIMITE_TROCAS,
  JANELA_RESET_MS
};
