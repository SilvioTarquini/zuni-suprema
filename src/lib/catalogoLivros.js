// lib/catalogoLivros.js
//
// Catálogo dos livros vendidos avulsos na loja (public/loja/index.html).
// Cada chave precisa bater com o :livroId usado no link do card
// ("/checkout-livro.html?livro=<livroId>") e com a pasta correspondente
// em private/livros/<livroId>/index.html.
//
// O preço fica só aqui — o checkout nunca aceita preço vindo do cliente,
// exatamente para impedir que alguém manipule o valor pago.

const CATALOGO = {
  // 'os-bastidores-vol-5': { titulo: 'Os Bastidores Vol. 5', preco: 29.90 },
};

function buscarLivro(livroId) {
  return CATALOGO[livroId] || null;
}

module.exports = { CATALOGO, buscarLivro };
