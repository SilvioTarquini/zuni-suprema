// lib/corrigirLeitor.js
//
// Correção de um defeito do LEITOR (código do flipbook) dos livros do lote que usam o motor "bookData" (Herança de Papel e a
// Máscara para o Controle): a função safeHref(s) faz
//     new URL(String(s || ''), location.href)
// e aceita http:/https:/mailto:. Com href VAZIO (todo trecho de texto comum) a URL resolve para a PRÓPRIA PÁGINA, e quando o
// livro é servido por https o leitor embrulha cada trecho num <a href="página-atual"> — o texto inteiro fica sublinhado, como
// link. Aberto como arquivo local (file://) o protocolo é recusado e o defeito some, por isso não apareceu na preparação.
//
// Correção: href vazio nunca vira link. Aplicada na hora de servir (o arquivo do bucket e o manifesto não mudam), de forma
// tolerante: se o padrão não existir (outros leitores), não faz nada.

const PADRAO = /(safeHref\s*\(\s*(\w+)\s*\)\s*\{\s*try\s*\{)/g;

// Devolve { html, aplicado }.
function corrigirLinkVazio(html) {
  let aplicado = false;
  const novo = html.replace(PADRAO, (m, abertura, arg) => {
    aplicado = true;
    return `${abertura}if(!String(${arg}||'').trim())return '';`;
  });
  return { html: aplicado ? novo : html, aplicado };
}

module.exports = { corrigirLinkVazio };
