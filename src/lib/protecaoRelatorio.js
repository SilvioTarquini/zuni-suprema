// lib/protecaoRelatorio.js
//
// Proteção das rotas /api/relatorio* (Síntese em PDF do ZUNI Direciona).
//
// Problema corrigido: antes, saber o sessionId de uma sessão paga bastia para gerar o PDF (IA a cada chamada),
// disparar e-mails e trocar o e-mail gravado na sessão. O sessionId é um IDENTIFICADOR, não uma credencial.
//
// Regras:
//   1. AUTORIZAÇÃO: token HMAC de escopo 'chat' no header X-Zuni-Sessao (lib/sessionToken.js), válido para ESTE sessionId
//      (o sessionId entra na assinatura). Nunca por query string nem body. Sem token válido => 401, sem consultar banco.
//   2. LIMITES por sessão e por operação (cooldown, teto por janela, uma geração por vez) + disjuntor GLOBAL de custo
//      (gerações simultâneas e teto diário). Em memória: zera a cada deploy (conservador; sem banco novo).
//   3. O e-mail do comprador nunca é alterado por estas rotas (ver server.js: o destino extra vale só para aquele envio).
//
// Tudo aqui é função pura/injetável para teste offline.

const ID_MAX_CHARS = 100;
const EMAIL_MAX_CHARS = 254;
const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

const LIMITES_PADRAO = Object.freeze({
  download: Object.freeze({ cooldownMs: 15 * 1000, max: 6, janelaMs: HORA_MS }),
  'enviar-email': Object.freeze({ cooldownMs: 60 * 1000, max: 3, janelaMs: DIA_MS }),
  relatorio: Object.freeze({ cooldownMs: 60 * 1000, max: 2, janelaMs: DIA_MS })
});
const GLOBAL_PADRAO = Object.freeze({ simultaneas: 3, maxPorDia: 300 });
const MAX_CHAVES_EM_MEMORIA = 20000;

function idValido(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= ID_MAX_CHARS && /^[A-Za-z0-9_-]+$/.test(id);
}

function emailValido(email) {
  return typeof email === 'string' && email.length <= EMAIL_MAX_CHARS && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email);
}

function criarLimitadorRelatorio({ limites = LIMITES_PADRAO, global = GLOBAL_PADRAO, agora = () => Date.now() } = {}) {
  const porChave = new Map(); // `${op}:${sessionId}` -> { marcas: number[], emAndamento: boolean, ultimo: number }
  const dia = { inicio: 0, count: 0 };
  let simultaneas = 0;

  function limpar(t) {
    if (porChave.size <= MAX_CHAVES_EM_MEMORIA) return;
    for (const [k, v] of porChave) if (!v.emAndamento && t - v.ultimo > DIA_MS) porChave.delete(k);
  }

  // Reserva a operação. Devolve { ok, liberar } ou { ok:false, motivo, retryAfterSeg }.
  function adquirir(operacao, sessionId) {
    const cfg = limites[operacao];
    if (!cfg) return { ok: false, motivo: 'operacao_desconhecida', retryAfterSeg: 60 };
    const t = agora();
    if (!dia.inicio || t - dia.inicio >= DIA_MS) { dia.inicio = t; dia.count = 0; }
    const chave = operacao + ':' + sessionId;
    let e = porChave.get(chave);
    if (!e) { e = { marcas: [], emAndamento: false, ultimo: t }; porChave.set(chave, e); limpar(t); }
    e.marcas = e.marcas.filter((m) => t - m < cfg.janelaMs);

    if (e.emAndamento) return { ok: false, motivo: 'em_andamento', retryAfterSeg: 10 };
    const ult = e.marcas.length ? e.marcas[e.marcas.length - 1] : 0;
    if (ult && t - ult < cfg.cooldownMs) return { ok: false, motivo: 'aguarde', retryAfterSeg: Math.ceil((cfg.cooldownMs - (t - ult)) / 1000) };
    if (e.marcas.length >= cfg.max) return { ok: false, motivo: 'limite_da_sessao', retryAfterSeg: Math.ceil((cfg.janelaMs - (t - e.marcas[0])) / 1000) };
    if (simultaneas >= global.simultaneas) return { ok: false, motivo: 'servico_ocupado', retryAfterSeg: 20 };
    if (dia.count >= global.maxPorDia) return { ok: false, motivo: 'limite_global_diario', retryAfterSeg: Math.ceil((DIA_MS - (t - dia.inicio)) / 1000) };

    e.emAndamento = true; e.ultimo = t; simultaneas += 1; dia.count += 1;
    let liberada = false;
    // `consumir:true` conta a tentativa na janela (padrão). Em falha da geração use liberar({ devolver:true }) para não punir o cliente.
    const liberar = ({ devolver = false } = {}) => {
      if (liberada) return; liberada = true;
      e.emAndamento = false; simultaneas = Math.max(0, simultaneas - 1);
      if (devolver) dia.count = Math.max(0, dia.count - 1); else e.marcas.push(agora());
    };
    return { ok: true, liberar };
  }

  return { adquirir, _estado: () => ({ chaves: porChave.size, simultaneas, globalDia: dia.count }) };
}

/**
 * Middleware Express: autoriza ANTES de qualquer acesso a banco/IA.
 * `validarToken(sessionId, escopo, token)` é lib/sessionToken.validarTokenSessao (injetado para teste).
 * `aoNegar(rota)` é o contador operacional (registrarAuthNegado) — nunca recebe sessionId nem token.
 */
function exigirAutorizacaoRelatorio({ validarToken, rota, aoNegar = () => {} }) {
  return function autorizacaoRelatorio(req, res, next) {
    const sessionId = (req.params && req.params.sessionId) || (req.body && req.body.sessionId);
    if (!idValido(sessionId)) return res.status(400).json({ error: 'sessionId inválido.' });
    const token = req.headers['x-zuni-sessao'];
    let autorizado = false;
    try { autorizado = Boolean(token) && validarToken(sessionId, 'chat', token) === true; } catch (_) { autorizado = false; }
    if (!autorizado) {
      try { aoNegar(rota); } catch (_) { /* contador nunca derruba a resposta */ }
      return res.status(401).json({ error: 'Não autorizado. Reabra sua sessão para continuar.' });
    }
    req.sessionIdAutorizado = sessionId;
    return next();
  };
}

function responderLimite(res, r) {
  res.set('Retry-After', String(Math.max(1, r.retryAfterSeg || 30)));
  const msg = {
    aguarde: 'Aguarde alguns instantes antes de tentar de novo.',
    em_andamento: 'Seu PDF já está sendo preparado. Aguarde alguns instantes.',
    limite_da_sessao: 'Você atingiu o limite de pedidos desta Síntese. Tente novamente mais tarde.',
    servico_ocupado: 'Estamos preparando muitas Sínteses agora. Tente novamente em instantes.',
    limite_global_diario: 'Estamos com alta demanda hoje. Tente novamente mais tarde.'
  }[r.motivo] || 'Tente novamente em instantes.';
  return res.status(429).json({ error: msg });
}

module.exports = { idValido, emailValido, criarLimitadorRelatorio, exigirAutorizacaoRelatorio, responderLimite, LIMITES_PADRAO, GLOBAL_PADRAO };
