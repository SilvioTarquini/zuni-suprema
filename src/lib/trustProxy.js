// lib/trustProxy.js
//
// A aplicação roda atrás do proxy de borda da Railway (1 salto: "railway-hikari"; a documentação da Railway lista X-Real-IP, X-Forwarded-Proto
// e X-Forwarded-Host, e o código já assumia a "entrada da direita" de X-Forwarded-For como a anexada pelo proxy — ver lib/ipCliente.js).
// Sem `trust proxy`, req.ip é o IP do PROXY: todos os leitores caíam no mesmo balde dos limitadores do express-rate-limit (30 pedidos por
// 15 min para o site inteiro) e o express-rate-limit registrava ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
//
// Com `trust proxy = N`, o Express toma como IP do cliente a entrada de X-Forwarded-For N posições a partir da DIREITA — a que o proxy
// confiável anexou; entradas forjadas pelo cliente ficam à esquerda e são ignoradas.
//
// N vem de TRUST_PROXY_HOPS (opcional); padrão 1. Se N for maior que o número real de proxies, o cliente poderia forjar o IP; se for
// menor, vários clientes dividem um balde (mais restritivo, nunca contorna o limite). Por isso o padrão é o do desenho conhecido.

const SALTOS_PADRAO = 1;

function saltosDeProxy(env = process.env) {
  const bruto = env.TRUST_PROXY_HOPS;
  if (bruto === undefined || !/^\d+$/.test(String(bruto).trim())) return SALTOS_PADRAO;
  return parseInt(String(bruto).trim(), 10);
}

// Configura o app e devolve o número de saltos usado (0 = sem confiança em proxy).
function configurarTrustProxy(app, env = process.env) {
  const n = saltosDeProxy(env);
  app.set('trust proxy', n === 0 ? false : n);
  return n;
}

// Diagnóstico de UMA linha por processo, para confirmar em produção que o número de saltos está certo: só contagens, nenhum IP.
//   [TRUST_PROXY] saltos=1 entradas_xff=1 req_ip_e_a_ultima_entrada=true
// Esperado com 1 salto da Railway: entradas_xff=1 (a borda anexa só o IP do cliente). Se vier 2 ou mais, há mais proxies: ajustar
// TRUST_PROXY_HOPS.
function diagnosticoUmaVez(saltos, log = console.log) {
  let feito = false;
  return function (req, res, next) {
    if (!feito) {
      const h = req.headers['x-forwarded-for'];
      if (typeof h === 'string' && h.trim()) {
        feito = true;
        const partes = h.split(',').map((p) => p.trim()).filter(Boolean);
        log(`[TRUST_PROXY] saltos=${saltos} entradas_xff=${partes.length} req_ip_e_a_ultima_entrada=${partes[partes.length - 1] === req.ip}`);
      }
    }
    next();
  };
}

module.exports = { saltosDeProxy, configurarTrustProxy, diagnosticoUmaVez, SALTOS_PADRAO };
