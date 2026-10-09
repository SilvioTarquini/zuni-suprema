// lib/orcamentoDemoPersistente.js
//
// Orçamento diário PERSISTENTE da demo do ZUNI Direciona (POST /api/experimente-chat).
//
// Por que existe: o orçamento atual (lib/protecaoMentorDemo.js) vive na memória do processo — zera a cada deploy/reinício
// e não é compartilhado entre instâncias. Com tráfego pago isso permite estourar o teto diário simplesmente com um deploy
// no meio do dia, e o teto global (300 trocas/dia) pode ser consumido por poucos IPs sem aviso.
//
// Desenho:
//   • Contadores no Postgres (tabela orcamento_demo, função consumir_orcamento_demo — migrations/008_orcamento_demo.sql),
//     decididos de forma ATÔMICA numa única chamada (IP e global na mesma transação: não gasta o orçamento do IP se o global
//     estiver esgotado, e vice-versa).
//   • A chave do IP é um HASH (sha256 + sal), nunca o IP. Nada de texto do visitante é gravado.
//   • FALHA SEGURA: se o banco falhar, usa o orçamento em memória (mesmos limites) — o custo continua limitado. Nunca "libera tudo".
//   • Limites configuráveis por ambiente (DEMO_LIMITE_DIA_IP, DEMO_LIMITE_DIA_GLOBAL); aviso de 80% do teto global, 1x por janela.
//   • NÃO muda a oferta (continuam 5 trocas por visitante) — só onde e como o teto é contado.
//
// Desligado por padrão: só ativa com DEMO_LIMITES_PERSISTENTES=1 (e Supabase configurado).

const crypto = require('crypto');

const JANELA_SEG_PADRAO = 24 * 60 * 60;
const CHAVE_GLOBAL = 'global';

function inteiroPositivo(valor, padrao) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : padrao;
}

function hashDoIp(ip, sal) {
  return 'ip:' + crypto.createHash('sha256').update(String(sal || '') + '|' + String(ip || 'desconhecido')).digest('hex').slice(0, 32);
}

/**
 * @param {Object} o
 * @param {(nome:string, args:Object)=>Promise<{data:any,error:any}>} o.rpc  ex.: (n, a) => supabase.rpc(n, a)
 * @param {{consumir:(ip:string)=>{permitido:boolean,horasAteReset:number,motivo?:string}}} o.fallback  orçamento em memória
 */
function criarOrcamentoDemoPersistente({ rpc, fallback, sal = '', limiteDiaPorIp = 20, limiteDiaGlobal = 300, janelaSeg = JANELA_SEG_PADRAO, aoEvento = () => {}, agora = () => Date.now() } = {}) {
  if (typeof rpc !== 'function') throw new Error('rpc obrigatório');
  if (!fallback || typeof fallback.consumir !== 'function') throw new Error('fallback em memória obrigatório');
  const limIp = inteiroPositivo(limiteDiaPorIp, 20);
  const limGlobal = inteiroPositivo(limiteDiaGlobal, 300);
  let avisou80Ate = 0;

  async function consumir(ip) {
    const chaveIp = hashDoIp(ip, sal);
    let resp;
    try {
      resp = await rpc('consumir_orcamento_demo', { p_chave_ip: chaveIp, p_limite_ip: limIp, p_limite_global: limGlobal, p_janela_seg: janelaSeg });
    } catch (e) { resp = { data: null, error: e }; }
    const d = resp && Array.isArray(resp.data) ? resp.data[0] : (resp && resp.data);
    if (!resp || resp.error || !d || typeof d.permitido !== 'boolean') {
      try { aoEvento('fallback'); } catch (_) { /* observador nunca interfere */ }
      return { ...fallback.consumir(ip), fonte: 'memoria' };
    }
    const horasAteReset = Math.max(1, Math.ceil(Number(d.segundos_ate_reset || janelaSeg) / 3600));
    if (d.permitido && Number(d.contagem_global) >= Math.ceil(limGlobal * 0.8) && agora() >= avisou80Ate) {
      avisou80Ate = agora() + janelaSeg * 1000;
      try { aoEvento('global_80'); } catch (_) { /* idem */ }
    }
    return { permitido: d.permitido, motivo: d.permitido ? null : (d.motivo || 'ip'), horasAteReset, fonte: 'banco' };
  }

  return { consumir, limites: Object.freeze({ porIp: limIp, global: limGlobal, janelaSeg }) };
}

module.exports = { criarOrcamentoDemoPersistente, hashDoIp, CHAVE_GLOBAL };
