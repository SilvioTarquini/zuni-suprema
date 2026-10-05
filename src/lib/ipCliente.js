// lib/ipCliente.js
//
// IP do cliente para limites de uso, sem depender de `trust proxy` (a aplicação roda atrás do proxy
// da Railway e não o configura). Regra: um cliente só consegue ACRESCENTAR entradas à esquerda de
// X-Forwarded-For; a entrada da direita é a que o proxy confiável anexou. Por isso usamos a última,
// nunca a primeira (a primeira é livremente forjável: trocar o valor trocaria a "identidade").
//
// Sem X-Forwarded-For (dev local / acesso direto), cai no endereço do socket.
// Se houver mais de um proxy na frente, a entrada da direita pode ser a de um proxy compartilhado:
// o efeito é agrupar visitantes num mesmo balde (mais restritivo), nunca contornar o limite.

function extrairIpConfiavel(req) {
  const cabecalho = req && req.headers ? req.headers['x-forwarded-for'] : null;
  const valor = Array.isArray(cabecalho) ? cabecalho.join(',') : cabecalho;
  if (typeof valor === 'string') {
    const partes = valor.split(',').map((p) => p.trim()).filter(Boolean);
    if (partes.length) return partes[partes.length - 1];
  }
  return (req && req.socket && req.socket.remoteAddress) || '0.0.0.0';
}

module.exports = { extrairIpConfiavel };
