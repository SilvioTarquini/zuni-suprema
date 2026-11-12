// lib/fraseCompleta.js
//
// Livro-Vivo — resposta que bateu no limite de tokens (stop_reason "max_tokens") termina no meio de uma palavra ("O cap").
// Aqui: se a resposta foi cortada, devolve só até a última FRASE COMPLETA; a pessoa nunca vê palavra cortada.
// Se a resposta terminou normalmente, devolve o texto intacto.

// Última posição (exclusiva) onde uma frase termina de verdade: ponto/!/?/… seguido (opcional) de aspas/fecha-parêntese/negrito,
// e depois espaço, quebra de linha ou fim do texto. Evita cortar em "Sr.", "p. ex.", "3.5", "a.C.".
function indiceUltimaFraseCompleta(texto) {
  const re = /[.!?…]+["”’')\]»*]*(?=\s|$)/g;
  let m; let fim = -1;
  while ((m = re.exec(texto)) !== null) {
    const antes = texto.slice(Math.max(0, m.index - 4), m.index);
    if (m[0] === '.' && /(?:^|\s)(?:sr|sra|dr|dra|prof|p|pg|cap|etc|ex|av|nº|no)$/i.test(antes)) continue; // abreviação
    fim = m.index + m[0].length;
  }
  return fim;
}

// `cortada` = stop_reason === 'max_tokens'. Devolve { texto, aparada }.
function encerrarEmFraseCompleta(texto, cortada) {
  const bruto = String(texto == null ? '' : texto);
  if (!cortada) return { texto: bruto, aparada: false };
  const limpo = bruto.trimEnd();
  const fim = indiceUltimaFraseCompleta(limpo);
  if (fim > 0) {
    let resultado = limpo.slice(0, fim).trimEnd();
    // negrito aberto e não fechado (número ímpar de **) por causa do corte: remove o marcador solto
    if ((resultado.match(/\*\*/g) || []).length % 2 === 1) resultado = resultado.replace(/\*\*(?![\s\S]*\*\*)/, '').trimEnd();
    return { texto: resultado, aparada: resultado.length < limpo.length };
  }
  // nenhuma frase completa (resposta curtíssima e cortada): tira ao menos a palavra pela metade e fecha com reticências
  const semUltima = limpo.replace(/\s+\S*$/, '').trimEnd();
  return { texto: semUltima ? `${semUltima}…` : limpo, aparada: true };
}

module.exports = { encerrarEmFraseCompleta, indiceUltimaFraseCompleta };
