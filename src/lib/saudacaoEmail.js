// lib/saudacaoEmail.js
//
// Saudação do e-mail de entrega: "Olá, Silvio!" quando há nome, "Olá!" quando não há.
// O nome entra em HTML de e-mail, então o primeiro nome é escapado aqui.

function escaparHtml(valor) {
  return String(valor).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function primeiroNome(nome) {
  if (typeof nome !== 'string') return '';
  return nome.trim().split(/\s+/)[0] || '';
}

function saudacaoEmail(nome) {
  const primeiro = primeiroNome(nome);
  return primeiro ? `Olá, ${escaparHtml(primeiro)}!` : 'Olá!';
}

module.exports = { saudacaoEmail, primeiroNome };
