// lib/sessionToken.js
//
// Token de autorização por sessionId (chat e download da síntese/dossiê).
// Mesmo padrão HMAC de src/lib/brinde.js (gerarTokenHMAC/validarTokenHMAC):
// fail-closed se o secret não estiver configurado, comparação timing-safe.
// Sem estado novo no banco — a assinatura já prova tudo.
//
// Payload assinado: `${sessionId}.${escopo}.${expiraEm}`. O escopo entra na
// assinatura (não só o sessionId), então um token 'chat' jamais valida como
// 'dl' e vice-versa — cada rota exige o escopo certo.
//
// Token trafegado ao cliente: `${expiraEm}.${hmacHex}` (expiraEm em epoch ms,
// visível; a proteção vem inteira do HMAC, não de esconder a expiração).

const crypto = require('crypto');

const ESCOPOS_VALIDOS = new Set(['chat', 'dl']);

const VALIDADE_CHAT_MS = 6 * 60 * 60 * 1000; // 6 horas
const VALIDADE_DOWNLOAD_MS = 10 * 60 * 1000; // 10 minutos

// Confirma na inicialização do processo que a variável foi lida — sem nunca
// imprimir valor nem tamanho. Roda uma vez, no primeiro require() do módulo
// (ou seja, no boot do servidor).
if (process.env.SESSION_TOKEN_SECRET) {
  console.log('[SESSAO] SESSION_TOKEN_SECRET lida na inicialização.');
} else {
  console.error('[SESSAO][CRÍTICO] SESSION_TOKEN_SECRET não configurada — emissão e validação de token de sessão falharão fechadas.');
}

/**
 * Gera um token de sessão escopado.
 *
 * @param {string} sessionId
 * @param {'chat'|'dl'} escopo
 * @param {number} validadeMs - tempo de validade a partir de AGORA (emissão), em ms
 * @returns {string} `${expiraEm}.${hmacHex}`
 */
function gerarTokenSessao(sessionId, escopo, validadeMs) {
  const secret = process.env.SESSION_TOKEN_SECRET;

  if (!secret) {
    throw new Error('[SESSAO] SESSION_TOKEN_SECRET não configurada — não é possível gerar token de sessão');
  }
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('[SESSAO] sessionId inválido para geração de token');
  }
  if (!ESCOPOS_VALIDOS.has(escopo)) {
    throw new Error(`[SESSAO] escopo inválido para geração de token: ${escopo}`);
  }
  if (!Number.isFinite(validadeMs) || validadeMs <= 0) {
    throw new Error('[SESSAO] validadeMs inválido para geração de token');
  }

  const expiraEm = Date.now() + validadeMs;

  try {
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(`${sessionId}.${escopo}.${expiraEm}`)
      .digest('hex');

    return `${expiraEm}.${hmac}`;
  } catch (err) {
    throw new Error(`[SESSAO] Erro ao gerar token de sessão: ${err.message}`);
  }
}

/**
 * Valida um token de sessão para um sessionId e escopo específicos.
 *
 * FAIL-CLOSED: sem secret configurada, sempre retorna false.
 * TIMING-SAFE: usa crypto.timingSafeEqual() para comparar a assinatura.
 *
 * @param {string} sessionId
 * @param {'chat'|'dl'} escopo
 * @param {string} tokenCompleto - `${expiraEm}.${hmacHex}`
 * @returns {boolean}
 */
function validarTokenSessao(sessionId, escopo, tokenCompleto) {
  const secret = process.env.SESSION_TOKEN_SECRET;

  if (!secret) {
    console.error('[SESSAO][CRÍTICO] SESSION_TOKEN_SECRET não configurada — validação de token falhou com rejeição automática');
    return false;
  }
  if (!sessionId || typeof sessionId !== 'string') return false;
  if (!ESCOPOS_VALIDOS.has(escopo)) return false;
  if (!tokenCompleto || typeof tokenCompleto !== 'string') return false;

  const partes = tokenCompleto.split('.');
  if (partes.length !== 2) return false;

  const [expiraEmStr, hmacRecebido] = partes;
  if (!/^\d+$/.test(expiraEmStr)) return false;

  const expiraEm = Number(expiraEmStr);
  if (!Number.isFinite(expiraEm)) return false;
  if (Date.now() > expiraEm) return false; // expirado

  try {
    const hmacEsperado = crypto
      .createHmac('sha256', secret)
      .update(`${sessionId}.${escopo}.${expiraEm}`)
      .digest('hex');

    if (hmacRecebido.length !== hmacEsperado.length) {
      return false;
    }

    const recebidoBuffer = Buffer.from(hmacRecebido, 'hex');
    const esperadoBuffer = Buffer.from(hmacEsperado, 'hex');

    if (recebidoBuffer.length !== esperadoBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(recebidoBuffer, esperadoBuffer);
  } catch (err) {
    console.error('[SESSAO] Erro ao validar token de sessão:', err.message);
    return false; // Fail-closed em caso de erro
  }
}

module.exports = {
  gerarTokenSessao,
  validarTokenSessao,
  VALIDADE_CHAT_MS,
  VALIDADE_DOWNLOAD_MS
};
