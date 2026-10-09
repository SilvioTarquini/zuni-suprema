// lib/recuperacaoSessao.js
//
// Recuperação SEGURA do acesso à Síntese (e à sessão) pelo comprador legítimo, depois que o token de sessão (6 h) expirou,
// em outro dia ou em outro aparelho — sem ampliar a duração do token e sem que o sessionId seja uma credencial.
//
// Como funciona (código de uso único, por e-mail, sem links):
//   1. O comprador informa o e-mail da compra. A resposta é SEMPRE a mesma ("se houver uma compra, enviamos um código"),
//      exista ou não — não revela quem comprou.
//   2. Se houver uma sessão paga (e não estornada) com esse e-mail, enviamos um código de 6 dígitos SOMENTE ao e-mail gravado
//      na sessão (nunca a um endereço informado na requisição). O código vale 10 min, 5 tentativas, uso único; só o HMAC dele
//      fica na memória do servidor.
//   3. O comprador digita o código; o servidor devolve um token de sessão NOVO (6 h, mesmo escopo de sempre) no CORPO da
//      resposta. O token nunca vai em URL, e-mail ou log; o e-mail só carrega o código (curto, de uso único).
//
// Limites (contam mesmo quando o e-mail não existe, para não virar oráculo): cooldown e teto por e-mail, teto por IP,
// tentativas por código e teto de confirmações por IP. Estado em memória (zera no deploy: o comprador só pede outro código).

const crypto = require('crypto');

const TTL_CODIGO_MS = 10 * 60 * 1000;
const MAX_TENTATIVAS = 5;
const COOLDOWN_EMAIL_MS = 60 * 1000;
const MAX_SOLICITACOES_EMAIL_HORA = 3;
const MAX_SOLICITACOES_IP_HORA = 10;
const MAX_CONFIRMACOES_IP_HORA = 30;
const HORA_MS = 60 * 60 * 1000;
const MAX_ENTRADAS = 20000;

const normalizarEmail = (e) => String(e == null ? '' : e).trim().toLowerCase();

function criarRecuperacaoSessao({
  buscarSessaoPagaPorEmail, // async (emailNormalizado) => { sessionId, email, productType } | null  (paga e não estornada)
  enviarCodigo,             // async ({ para, codigo }) => { sucesso:boolean }
  gerarToken,               // (sessionId) => token de sessão (escopo chat)
  emailValido,
  segredo,
  agora = () => Date.now(),
  gerarCodigo = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0')
} = {}) {
  if (![buscarSessaoPagaPorEmail, enviarCodigo, gerarToken, emailValido].every((f) => typeof f === 'function')) throw new Error('dependências obrigatórias ausentes');
  if (!segredo || String(segredo).length < 16) throw new Error('segredo obrigatório');

  const codigos = new Map(); // emailNorm -> { hash, sessionId, exp, tentativas }
  const porEmail = new Map(); // emailNorm -> number[] (marcas de solicitação)
  const porIpSol = new Map(); const porIpConf = new Map();

  const hmac = (emailNorm, sessionId, codigo) => crypto.createHmac('sha256', segredo).update(`${emailNorm}|${sessionId}|${codigo}`).digest();
  const marcar = (mapa, chave, janelaMs, max, t) => {
    const lista = (mapa.get(chave) || []).filter((m) => t - m < janelaMs);
    if (lista.length >= max) { mapa.set(chave, lista); return { ok: false, retryAfterSeg: Math.ceil((janelaMs - (t - lista[0])) / 1000) }; }
    lista.push(t); mapa.set(chave, lista); return { ok: true };
  };
  const limpar = (t) => {
    if (codigos.size + porEmail.size + porIpSol.size + porIpConf.size <= MAX_ENTRADAS) return;
    for (const [k, v] of codigos) if (v.exp < t) codigos.delete(k);
    for (const m of [porEmail, porIpSol, porIpConf]) for (const [k, l] of m) if (!l.some((x) => t - x < HORA_MS)) m.delete(k);
  };

  async function solicitar({ email, ipKey = 'desconhecido' } = {}) {
    const t = agora(); limpar(t);
    const emailNorm = normalizarEmail(email);
    if (!emailValido(emailNorm)) return { status: 'invalido' };
    const ult = (porEmail.get(emailNorm) || []).slice(-1)[0];
    if (ult && t - ult < COOLDOWN_EMAIL_MS) return { status: 'limite', retryAfterSeg: Math.ceil((COOLDOWN_EMAIL_MS - (t - ult)) / 1000) };
    const lim = marcar(porEmail, emailNorm, HORA_MS, MAX_SOLICITACOES_EMAIL_HORA, t); if (!lim.ok) return { status: 'limite', retryAfterSeg: lim.retryAfterSeg };
    const limIp = marcar(porIpSol, ipKey, HORA_MS, MAX_SOLICITACOES_IP_HORA, t); if (!limIp.ok) return { status: 'limite', retryAfterSeg: limIp.retryAfterSeg };

    let sessao = null;
    try { sessao = await buscarSessaoPagaPorEmail(emailNorm); } catch (_) { sessao = null; }
    if (!sessao || !sessao.sessionId || !sessao.email) return { status: 'ok' }; // mesma resposta: não revela se existe

    const codigo = gerarCodigo();
    codigos.set(emailNorm, { hash: hmac(emailNorm, sessao.sessionId, codigo), sessionId: sessao.sessionId, exp: t + TTL_CODIGO_MS, tentativas: 0 });
    let enviado = { sucesso: false };
    try { enviado = await enviarCodigo({ para: sessao.email, codigo }); } catch (_) { /* o chamador nunca vê a causa */ }
    if (!enviado || !enviado.sucesso) codigos.delete(emailNorm);
    return { status: 'ok' };
  }

  async function confirmar({ email, codigo, ipKey = 'desconhecido' } = {}) {
    const t = agora(); limpar(t);
    const limIp = marcar(porIpConf, ipKey, HORA_MS, MAX_CONFIRMACOES_IP_HORA, t); if (!limIp.ok) return { status: 'limite', retryAfterSeg: limIp.retryAfterSeg };
    const emailNorm = normalizarEmail(email);
    const cod = String(codigo == null ? '' : codigo).trim();
    if (!emailValido(emailNorm) || !/^\d{6}$/.test(cod)) return { status: 'invalido' };
    const entrada = codigos.get(emailNorm);
    if (!entrada || entrada.exp < t) { codigos.delete(emailNorm); return { status: 'invalido' }; }
    entrada.tentativas += 1;
    if (entrada.tentativas > MAX_TENTATIVAS) { codigos.delete(emailNorm); return { status: 'invalido' }; }
    const esperado = entrada.hash; const recebido = hmac(emailNorm, entrada.sessionId, cod);
    if (!crypto.timingSafeEqual(esperado, recebido)) { if (entrada.tentativas >= MAX_TENTATIVAS) codigos.delete(emailNorm); return { status: 'invalido' }; }
    codigos.delete(emailNorm); // uso único

    let sessao = null; // revalida: estorno/revogação depois do pedido do código cancela a recuperação
    try { sessao = await buscarSessaoPagaPorEmail(emailNorm); } catch (_) { sessao = null; }
    if (!sessao || sessao.sessionId !== entrada.sessionId) return { status: 'invalido' };
    return { status: 'ok', sessionId: sessao.sessionId, token: gerarToken(sessao.sessionId), productType: sessao.productType || null };
  }

  return { solicitar, confirmar, _estado: () => ({ codigos: codigos.size }) };
}

module.exports = { criarRecuperacaoSessao, normalizarEmail, TTL_CODIGO_MS, MAX_TENTATIVAS, COOLDOWN_EMAIL_MS, MAX_SOLICITACOES_EMAIL_HORA, MAX_SOLICITACOES_IP_HORA };
