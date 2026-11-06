// lib/widgetLivroVivo.js
//
// Widget do chat de leitura (Livro-Vivo) injetado NA HORA DE SERVIR, depois de exigirAcesso ter validado o token:
//   - obras do BUCKET privado (arquivo e manifesto não podem mudar: o hash vale);
//   - obras "bundler" de private/livros/ (Ela Tem Classe e as demais do Universo Feminino, tempo-para-viver…).
//
// POR QUE NO TEMPLATE: nos livros "bundler" o HTML externo é só um carregador — ao iniciar, o leitor REESCREVE o documento inteiro
// (document.write do template) e apaga tudo o que estava fora dele. O widget que ficava gravado no HTML externo era apagado: a API
// do chat funcionava, mas o botão nunca aparecia. Aqui o widget entra DENTRO do template do bundle (a string JSON de
// <script type="__bundler/template">), que é o que sobrevive. Livros estáticos (sem bundle) recebem o widget antes de </body>.
//
// Reaproveita templates/chat-livro-widget.html (fonte única; mesma frase "Converse com o Livro-Vivo durante a sua leitura", sem
// contador visível). Só injeta quando a ficha do catálogo tem chatDisponivel === true e o HTML ainda não tem o widget (nunca
// duplica). Se faltar o modelo ou o ponto de injeção, NÃO derruba a leitura: entrega o livro sem o chat e registra
// [LIVRO_VIVO_WIDGET_FALHOU] (falha visível, não silenciosa).

const fs = require('fs');
const path = require('path');

const MODELO = path.join(__dirname, '..', '..', 'templates', 'chat-livro-widget.html');
const MARCA_WIDGET = 'id="zuni-chat-widget"';
const MARCADOR_TEMPLATE = '<script type="__bundler/template">';

let modeloEmCache = null;
function lerModelo() {
  if (!modeloEmCache) modeloEmCache = fs.readFileSync(MODELO, 'utf8').replace(/\r\n/g, '\n').trim();
  return modeloEmCache;
}

function ehBundler(html) { return html.lastIndexOf(MARCADOR_TEMPLATE) >= 0; }

// Coloca o bloco antes do último </body> de `texto` (ou no fim, se não houver).
function inserirAntesDoFimDoBody(texto, bloco) {
  const i = texto.lastIndexOf('</body>');
  return i < 0 ? `${texto}\n${bloco}\n` : `${texto.slice(0, i)}${bloco}\n${texto.slice(i)}`;
}

// Bundle: o template é uma string JSON entre aspas, até o primeiro "</script>" literal (dentro do JSON, "</" aparece escapado).
function injetarNoTemplate(html, bloco) {
  const iMarcador = html.lastIndexOf(MARCADOR_TEMPLATE);
  let iLinha = iMarcador + MARCADOR_TEMPLATE.length;
  while (/\s/.test(html[iLinha])) iLinha++;
  const iFim = html.indexOf('</script>', iLinha);
  if (html[iLinha] !== '"' || iFim < 0) throw new Error('template do bundle truncado');
  const template = JSON.parse(html.slice(iLinha, iFim));
  if (typeof template !== 'string') throw new Error('template do bundle não é texto');
  if (template.includes(MARCA_WIDGET)) return { html, jaTinha: true };
  const novo = JSON.stringify(inserirAntesDoFimDoBody(template, bloco)).replace(/<\//g, '<\\/');
  return { html: html.slice(0, iLinha) + novo + html.slice(iFim), jaTinha: false };
}

// Devolve { html, injetado, motivo }. `ficha` = entrada do catálogo (ou null).
function injetarWidgetNoServico(html, livroId, ficha) {
  if (!ficha || ficha.chatDisponivel !== true) return { html, injetado: false, motivo: 'chat não habilitado na ficha' };
  try {
    const bloco = lerModelo().split('__ZUNI_LIVRO_ID__').join(livroId);
    if (ehBundler(html)) {
      // o widget gravado no HTML externo (se houver) é apagado pelo leitor; o que vale é o do template
      const r = injetarNoTemplate(html, bloco);
      return r.jaTinha ? { html, injetado: false, motivo: 'já tem widget' } : { html: r.html, injetado: true, motivo: 'ok (template do bundle)' };
    }
    if (html.includes(MARCA_WIDGET)) return { html, injetado: false, motivo: 'já tem widget' };
    if (html.lastIndexOf('</body>') < 0) throw new Error('HTML sem </body>');
    return { html: inserirAntesDoFimDoBody(html, bloco), injetado: true, motivo: 'ok' };
  } catch (err) {
    console.error(`[LIVRO_VIVO_WIDGET_FALHOU] livroId=${livroId} motivo=${err.message} — entregando o livro sem o chat.`);
    return { html, injetado: false, motivo: err.message };
  }
}

module.exports = { injetarWidgetNoServico, ehBundler, MARCA_WIDGET };
