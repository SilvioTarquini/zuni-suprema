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

const LIVROS_DIR = path.join(__dirname, '..', 'private', 'livros');
const WIDGET_SOURCE_PATH = path.join(__dirname, '..', 'templates', 'chat-livro-widget.html');
const MARCADOR_INICIO = '<!-- ZUNI-CHAT-WIDGET-START -->';
const MARCADOR_FIM = '<!-- ZUNI-CHAT-WIDGET-END -->';
const PASTAS_IGNORADAS = new Set(['_template']);

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

  const widgetFonte = fs.readFileSync(WIDGET_SOURCE_PATH, 'utf8').trim();

  const pastas = fs.readdirSync(LIVROS_DIR, { withFileTypes: true })
    .filter(entrada => entrada.isDirectory() && !PASTAS_IGNORADAS.has(entrada.name));

  if (!pastas.length) {
    console.log('Nenhuma pasta de livro encontrada em', LIVROS_DIR);
    return [];
  }

  const processados = [];

  for (const pasta of pastas) {
    const livroId = pasta.name;
    const indexPath = path.join(LIVROS_DIR, livroId, 'index.html');

    if (!fs.existsSync(indexPath)) {
      console.warn(`Ignorado (sem index.html): ${livroId}`);
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

module.exports = { injetarChatLivros, removerInjecaoAnterior, injetarWidget };
