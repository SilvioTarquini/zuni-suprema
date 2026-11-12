// lib/flutuantes.js
//
// Código de navegador que posiciona os botões flutuantes (Livro-Vivo e "Baixar PDF") longe dos controles do leitor e do texto da
// página. Fonte única: templates/flutuantes.js (ver o cabeçalho dele para as regras). Este módulo só lê o arquivo e o entrega
// pronto para ser embutido em <script> — no widget do Livro-Vivo (lib/widgetLivroVivo.js, scripts/injetar-chat-livros.js) e no
// botão "Baixar PDF" (lib/leitorSemImpressao.js).

const fs = require('fs');
const path = require('path');

const ARQUIVO = path.join(__dirname, '..', '..', 'templates', 'flutuantes.js');
let emCache = null;

// Sem o comentário de abertura (explicação para quem edita o arquivo; o navegador não precisa dela).
function jsFlutuantes() {
  if (!emCache) emCache = fs.readFileSync(ARQUIVO, 'utf8').replace(/\r\n/g, '\n').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '').trim();
  if (emCache.includes('</script')) throw new Error('flutuantes.js não pode conter "</script"');
  return emCache;
}

module.exports = { jsFlutuantes };
