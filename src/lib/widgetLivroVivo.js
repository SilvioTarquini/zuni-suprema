// lib/widgetLivroVivo.js
//
// Widget do chat de leitura (Livro-Vivo) para as obras servidas do BUCKET privado. As obras de private/livros/ recebem o widget
// gravado no próprio arquivo (scripts/injetar-chat-livros.js); as do bucket não podem ser alteradas (o hash do manifesto vale),
// então o widget entra na hora de servir, no mesmo ponto do pipeline em que entram o patch de celular e a retirada da
// impressão (lib/htmlLivroStorage.js, depois de exigirAcesso ter validado o token).
//
// Reaproveita templates/chat-livro-widget.html (a mesma fonte única das obras de private/livros/): mesma frase "Converse com o
// Livro-Vivo durante a sua leitura", sem contador visível. Só injeta quando a ficha do catálogo tem chatDisponivel === true e o
// HTML ainda não tem o widget (nunca duplica). Se faltar o modelo ou a tag </body>, NÃO derruba a leitura: entrega o livro sem o
// chat e registra [LIVRO_VIVO_WIDGET_FALHOU] (falha visível, não silenciosa).

const fs = require('fs');
const path = require('path');

const MODELO = path.join(__dirname, '..', '..', 'templates', 'chat-livro-widget.html');
const MARCA_WIDGET = 'id="zuni-chat-widget"';

let modeloEmCache = null;
function lerModelo() {
  if (!modeloEmCache) modeloEmCache = fs.readFileSync(MODELO, 'utf8').replace(/\r\n/g, '\n').trim();
  return modeloEmCache;
}

// Devolve { html, injetado, motivo }. `ficha` = entrada do catálogo (ou null).
function injetarWidgetNoServico(html, livroId, ficha) {
  if (!ficha || ficha.chatDisponivel !== true) return { html, injetado: false, motivo: 'chat não habilitado na ficha' };
  if (html.includes(MARCA_WIDGET)) return { html, injetado: false, motivo: 'já tem widget' };
  try {
    const i = html.lastIndexOf('</body>');
    if (i < 0) throw new Error('HTML sem </body>');
    const bloco = lerModelo().split('__ZUNI_LIVRO_ID__').join(livroId);
    return { html: `${html.slice(0, i)}${bloco}\n${html.slice(i)}`, injetado: true, motivo: 'ok' };
  } catch (err) {
    console.error(`[LIVRO_VIVO_WIDGET_FALHOU] livroId=${livroId} motivo=${err.message} — entregando o livro sem o chat.`);
    return { html, injetado: false, motivo: err.message };
  }
}

module.exports = { injetarWidgetNoServico, MARCA_WIDGET };
