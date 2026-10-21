// lib/prazoAcesso.js
//
// Prazo de leitura no site depois da compra, em dias. ÚNICA fonte do número: a variável de ambiente LIVRO_ACESSO_DIAS
// (padrão 7 quando ausente). É o mesmo valor que lib/acessoLivros.js usa para gravar data_expiracao, e é o que as
// páginas públicas mostram antes da compra — nunca um número fixo no HTML.

const DIAS_DE_ACESSO = parseInt(process.env.LIVRO_ACESSO_DIAS || '7', 10);

// Só exibe se for um inteiro positivo; qualquer outra coisa não vira promessa na página.
function diasParaExibir() {
  return Number.isInteger(DIAS_DE_ACESSO) && DIAS_DE_ACESSO > 0 ? DIAS_DE_ACESSO : null;
}

function textoPrazoLeitura() {
  const d = diasParaExibir();
  return d ? `Leitura no site por ${d} ${d === 1 ? 'dia' : 'dias'} a partir da compra.` : '';
}

module.exports = { DIAS_DE_ACESSO, diasParaExibir, textoPrazoLeitura };
