// lib/prazoAcesso.js
//
// Prazo de leitura no site depois da compra, em dias. ÚNICA fonte do número: a variável de ambiente LIVRO_ACESSO_DIAS
// (padrão 7 quando ausente). É o mesmo valor que lib/acessoLivros.js usa para gravar data_expiracao, e é o que as
// páginas públicas mostram antes da compra — nunca um número fixo no HTML. O PDF para guardar não tem prazo (a rota
// /livros/:id/pdf só deixa de abrir com reembolso); o prazo vale para a leitura no site e para o Livro-Vivo.

const { resolverPdf } = require('./pdfLivro');

const DIAS_DE_ACESSO = parseInt(process.env.LIVRO_ACESSO_DIAS || '7', 10);

// Só exibe se for um inteiro positivo; qualquer outra coisa não vira promessa na página.
function diasParaExibir() {
  return Number.isInteger(DIAS_DE_ACESSO) && DIAS_DE_ACESSO > 0 ? DIAS_DE_ACESSO : null;
}

// livroId informado: só promete PDF se a obra tem PDF (lib/pdfLivro.js); as demais seguem com a frase só de leitura.
// Sem livroId (loja, que lista as obras com PDF): frase do PDF.
function textoPrazoLeitura(livroId) {
  const d = diasParaExibir();
  if (!d) return '';
  const dias = `${d} ${d === 1 ? 'dia' : 'dias'}`;
  if (livroId !== undefined && !resolverPdf(livroId)) return `Leitura no site por ${dias} a partir da compra.`;
  return `Você recebe o livro em PDF para guardar e pode ler no site por ${dias}.`;
}

// Frase do e-mail de entrega dos livros que têm PDF para guardar.
function textoEmailLeituraPdf() {
  const d = diasParaExibir();
  return d ? `Leia no site por ${d} ${d === 1 ? 'dia' : 'dias'} e baixe o PDF para guardar.` : 'Leia no site e baixe o PDF para guardar.';
}

module.exports = { DIAS_DE_ACESSO, diasParaExibir, textoPrazoLeitura, textoEmailLeituraPdf };
