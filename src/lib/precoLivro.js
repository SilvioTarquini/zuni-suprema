// lib/precoLivro.js
//
// Base comercial de um livro antes do cupom: preço vigente (promocional, se
// houver, senão o preço normal) + audiolivro opcional. Função pura, sem
// dependência de banco — única fonte dessa regra para o checkout real
// (calcularPrecoFinalLivro, em server.js) e para a pré-visualização de cupom
// (/api/validar-cupom), para as duas nunca divergirem.
//
// O cupom (validarCupom/calcularDesconto, em lib/cupons.js) incide sobre este
// valor — o TOTAL livro + audiolivro.

function calcularPrecoBaseLivro(livro, audiolivroIncluido) {
  let precoBase = livro.precoPromocional || livro.preco;
  if (audiolivroIncluido && livro.audiobookDisponivel) {
    precoBase += livro.precoAudiobook;
  }
  return Math.round(precoBase * 100) / 100;
}

module.exports = { calcularPrecoBaseLivro };
