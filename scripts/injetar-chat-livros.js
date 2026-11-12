// scripts/injetar-chat-livros.js
//
// Injeta o widget de chat (templates/chat-livro-widget.html) em cada
// private/livros/<livro_id>/index.html, substituindo o placeholder
// __ZUNI_LIVRO_ID__ pelo nome real da pasta (que é o próprio livro_id
// usado em acessos_livros / documentos / uso_chat_livro).
//
// Idempotente: remove qualquer injeção anterior (delimitada por
// <!-- ZUNI-CHAT-WIDGET-START --> ... <!-- ZUNI-CHAT-WIDGET-END -->)
// antes de inserir a versão atual, então pode ser rodado quantas vezes
// for preciso — inclusive depois de editar o arquivo-fonte do widget.
//
// Uso: node scripts/injetar-chat-livros.js

const fs = require('fs');
const path = require('path');
const { modeloWidgetPronto } = require('../src/lib/widgetLivroVivo');

const LIVROS_DIR = path.join(__dirname, '..', 'private', 'livros');
const WIDGET_SOURCE_PATH = path.join(__dirname, '..', 'templates', 'chat-livro-widget.html');
const MARCADOR_INICIO = '<!-- ZUNI-CHAT-WIDGET-START -->';
const MARCADOR_FIM = '<!-- ZUNI-CHAT-WIDGET-END -->';

// LISTA EXPLÍCITA de obras que recebem o widget do Livro-Vivo. Nenhuma outra pasta é lida nem alterada.
// Para ligar outra obra: indexar (src/indexarLivro.js), ligar chatDisponivel no catálogo e só então
// acrescentar o livro_id aqui, por ordem do autor. O livro_id é o nome da pasta e a chave do catálogo.
const OBRAS_COM_LIVRO_VIVO = [
  // Universo Feminino (ainda sem indexação em 04/11/2026 — não rodar o script antes de indexar)
  'ela-tem-classe',
  'codigo-feminino',
  'a-inteligencia-do-corpo-feminino',
  'inesquecivel-charme-feminino',
  'a-mulher-que-permanece-inteira',
  // Já com chatDisponivel: true
  'os-bastidores-da-mente-1-a-origem-de-todo-bem-e-de-todo-mal',
  'os-bastidores-da-mente-2-o-antidoto',
  'os-bastidores-da-mente-3-a-bussola-humana',
  'os-bastidores-da-mente-4-a-travessia',
  'os-bastidores-da-mente-5-a-escada',
  'os-bastidores-da-mente-6-o-designio',
  'tempo-para-viver'
];

function removerInjecaoAnterior(html) {
  const inicio = html.indexOf(MARCADOR_INICIO);
  const fim = html.indexOf(MARCADOR_FIM);

  if (inicio === -1 || fim === -1 || fim < inicio) {
    return html;
  }

  const antes = html.slice(0, inicio).replace(/\s+$/, '');
  const depois = html.slice(fim + MARCADOR_FIM.length).replace(/^\s+/, '');

  return `${antes}\n${depois}`;
}

function injetarWidget(html, blocoWidget) {
  const semInjecaoAnterior = removerInjecaoAnterior(html).replace(/\s+$/, '');
  const fechamentoBody = /<\/body>/i;

  if (!fechamentoBody.test(semInjecaoAnterior)) {
    throw new Error('Arquivo não tem tag </body> — não sei onde injetar o widget.');
  }

  return semInjecaoAnterior.replace(fechamentoBody, `${blocoWidget}\n</body>`);
}

function injetarChatLivros() {
  if (!fs.existsSync(WIDGET_SOURCE_PATH)) {
    throw new Error(`Arquivo-fonte do widget não encontrado: ${WIDGET_SOURCE_PATH}`);
  }

  const widgetFonte = modeloWidgetPronto(); // modelo com o código de templates/flutuantes.js no lugar do marcador

  const pastas = OBRAS_COM_LIVRO_VIVO.map(livroId => ({ name: livroId }));

  if (!pastas.length) {
    console.log('Lista de obras vazia.');
    return [];
  }

  const processados = [];

  for (const pasta of pastas) {
    const livroId = pasta.name;
    const indexPath = path.join(LIVROS_DIR, livroId, 'index.html');

    if (!fs.existsSync(indexPath)) {
      console.warn(`Ignorado (obra da lista sem index.html): ${livroId}`);
      continue;
    }

    const blocoWidget = widgetFonte.split('__ZUNI_LIVRO_ID__').join(livroId);
    const htmlOriginal = fs.readFileSync(indexPath, 'utf8');
    const htmlAtualizado = injetarWidget(htmlOriginal, blocoWidget);

    fs.writeFileSync(indexPath, htmlAtualizado);
    console.log(`Widget injetado: ${livroId}`);
    processados.push(livroId);
  }

  return processados;
}

if (require.main === module) {
  try {
    const processados = injetarChatLivros();
    console.log(`\nConcluído — ${processados.length} livro(s) atualizado(s).`);
  } catch (erro) {
    console.error('Erro ao injetar widget:', erro.message);
    process.exit(1);
  }
}

module.exports = { OBRAS_COM_LIVRO_VIVO, injetarChatLivros, removerInjecaoAnterior, injetarWidget };
