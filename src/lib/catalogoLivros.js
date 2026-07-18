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
  'os-bastidores-da-mente-1-a-origem-de-todo-bem-e-de-todo-mal': {
    titulo: 'Os Bastidores da Mente — Volume I: A Origem de Todo Bem e de Todo Mal',
    preco: 57.90,
    categoria: 'principal'
  },
  'os-bastidores-da-mente-2-o-antidoto': {
    titulo: 'Os Bastidores da Mente — Volume II: O Antídoto',
    preco: 57.90,
    categoria: 'principal'
  },
  'os-bastidores-da-mente-3-a-bussola-humana': {
    titulo: 'Os Bastidores da Mente — Volume III: A Bússola Humana',
    preco: 57.90,
    categoria: 'principal'
  },
  'os-bastidores-da-mente-4-a-travessia': {
    titulo: 'Os Bastidores da Mente — Volume IV: A Travessia',
    preco: 57.90,
    categoria: 'principal'
  },
  'os-bastidores-da-mente-5-a-escada': {
    titulo: 'Os Bastidores da Mente — Volume V: A Escada e o Plano',
    preco: 57.90,
    categoria: 'principal'
  },
};

function buscarLivro(livroId) {
  return CATALOGO[livroId] || null;
}

module.exports = { CATALOGO, buscarLivro };
