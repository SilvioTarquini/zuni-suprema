// lib/protecaoMentorDemo.js
//
// Proteção de custo do chat de demonstração do Mentor (POST /api/experimente-chat), que chama
// embedding + Claude a cada troca. O limite antigo (5 trocas por sessionId + IP) não era barreira:
// o sessionId é gerado pelo cliente, então um sessionId novo dava mais 5 trocas, sem teto algum.
//
// Camadas (todas independentes do sessionId):
//   1. tamanho máximo da mensagem;
//   2. rajada por IP (express-rate-limit, janela curta);
//   3. orçamento diário por IP;
//   4. orçamento diário GLOBAL — disjuntor de custo: no pior caso o gasto diário da demo é limitado.
// O limite funcional por sessão (5 trocas/24h, lib/rateLimitExperimente.js) continua valendo por cima.
//
// Armazenamento em memória (zera a cada deploy; é conservador de propósito, sem banco novo).
// IP: ver lib/ipCliente.js (usa a entrada da direita de X-Forwarded-For; não depende de `trust proxy`).

const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { extrairIpConfiavel } = require('./ipCliente');

const MENSAGEM_MAX_CHARS = 500;
const SESSION_ID_MAX_CHARS = 100;

const RAJADA_JANELA_MS = 15 * 60 * 1000;
const RAJADA_MAX = 10;

const DIA_MS = 24 * 60 * 60 * 1000;
const LIMITE_DIA_POR_IP = 20;
const LIMITE_DIA_GLOBAL = 300;

const MAX_IPS_EM_MEMORIA = 10000;

function criarOrcamentoDemo({ limiteDiaPorIp = LIMITE_DIA_POR_IP, limiteDiaGlobal = LIMITE_DIA_GLOBAL, janelaMs = DIA_MS } = {}) {
  const porIp = new Map(); // ip -> { count, inicio }
  const global = { count: 0, inicio: 0 };

  function limpar(agora) {
    if (porIp.size <= MAX_IPS_EM_MEMORIA) return;
    for (const [ip, e] of porIp) if (agora - e.inicio >= janelaMs) porIp.delete(ip);
  }

  // Consome 1 unidade de orçamento (ip + global) só se ambos permitirem.
  function consumir(ipKey, agora = Date.now()) {
    if (!global.inicio || agora - global.inicio >= janelaMs) { global.count = 0; global.inicio = agora; }
    let e = porIp.get(ipKey);
    if (!e || agora - e.inicio >= janelaMs) { e = { count: 0, inicio: agora }; porIp.set(ipKey, e); limpar(agora); }

    const horasAteReset = (ini) => Math.max(1, Math.ceil((janelaMs - (agora - ini)) / (60 * 60 * 1000)));
    if (e.count >= limiteDiaPorIp) return { permitido: false, motivo: 'ip', horasAteReset: horasAteReset(e.inicio) };
    if (global.count >= limiteDiaGlobal) return { permitido: false, motivo: 'global', horasAteReset: horasAteReset(global.inicio) };

    e.count += 1;
    global.count += 1;
    return { permitido: true, motivo: null, horasAteReset: horasAteReset(e.inicio) };
  }

  return { consumir, _estado: () => ({ ips: porIp.size, global: global.count }) };
}

function criarLimiterMentorDemo() {
  return rateLimit({
    windowMs: RAJADA_JANELA_MS,
    limit: RAJADA_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(extrairIpConfiavel(req)),
    // A chave não usa req.ip (que, sem trust proxy, seria o IP do proxy): as validações abaixo não se aplicam.
    validate: { trustProxy: false, xForwardedForHeader: false },
    handler: (req, res) => res.status(429).json({
      bloqueado: true,
      mensagem: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
    })
  });
}

const orcamentoDemo = criarOrcamentoDemo();

module.exports = {
  MENSAGEM_MAX_CHARS, SESSION_ID_MAX_CHARS, RAJADA_MAX, RAJADA_JANELA_MS, LIMITE_DIA_POR_IP, LIMITE_DIA_GLOBAL,
  criarOrcamentoDemo, criarLimiterMentorDemo, orcamentoDemo, extrairIpConfiavel
};
