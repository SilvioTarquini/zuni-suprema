// scripts/formatar-livro-docx.js
//
// Converte o manuscrito .docx de um livro para o HTML de leitura em
// private/livros/<livro_id>/index.html, substituindo só o conteúdo do
// <article class="conteudo-livro">...</article> — preserva a barra de
// ações, o <style> e o widget de chat já injetado (se houver), já que
// eles ficam fora do article.
//
// Convenção esperada no .docx (a mesma usada pela série "Os Bastidores
// da Mente"): título do livro + "SUMÁRIO" com a lista de capítulos no
// início (descartado — é regenerado a partir do conteúdo real), seguido
// do conteúdo de verdade, onde:
//   - "PARTE <romano> — <título>"   em negrito, maiúsculo → divisor de parte
//   - "CAPÍTULO <nº> — <título>"    em negrito, maiúsculo → título de capítulo
//   - "EPÍLOGO — <título>"          em negrito, maiúsculo → título de epílogo
//   - qualquer outro parágrafo 100% em negrito → subtítulo dentro do capítulo
//   - parágrafo normal → corpo do texto
//
// O início do conteúdo real é localizado pelo primeiro "CAPÍTULO 1 —" em
// negrito (a entrada do SUMÁRIO usa "Capítulo 1 —", sem negrito e sem
// maiúsculas, então não é confundida com o título real).
//
// Uso: node scripts/formatar-livro-docx.js <caminho.docx> <livro_id> "<Título>" ["<Subtítulo>"] ["<Autor>"]

const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const LIVROS_DIR = path.join(__dirname, '..', 'private', 'livros');
const TEMPLATE_PATH = path.join(LIVROS_DIR, '_template', 'index.html');

function textoPuro(p) {
  return p.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
}

function ehNegritoTotal(p) {
  return /^<p><strong>.*<\/strong><\/p>$/.test(p.replace(/\s+/g, ' '));
}

function encontrarInicioReal(paragrafos) {
  for (let i = 0; i < paragrafos.length; i++) {
    const t = textoPuro(paragrafos[i]);
    if (ehNegritoTotal(paragrafos[i]) && /^CAPÍTULO 1\s*—/i.test(t)) {
      const anterior = i > 0 ? textoPuro(paragrafos[i - 1]) : '';
      return /^PARTE [IVX]+\s*—/i.test(anterior) ? i - 1 : i;
    }
  }
  return -1;
}

function classificarParagrafo(p) {
  const t = textoPuro(p);
  if (!t) return null;

  if (ehNegritoTotal(p)) {
    if (/^PARTE [IVX]+\s*—/i.test(t)) return { tag: 'h2', classe: 'parte-livro', texto: t };
    if (/^CAPÍTULO \d+\s*—/i.test(t)) return { tag: 'h2', classe: null, texto: t };
    if (/^EPÍLOGO/i.test(t)) return { tag: 'h2', classe: null, texto: t };
    return { tag: 'h3', classe: null, texto: t };
  }

  return { tag: 'p', html: p.replace(/^<p>/, '').replace(/<\/p>$/, '') };
}

async function formatarLivro(docxPath, livroId, titulo, subtitulo, autor) {
  const resultado = await mammoth.convertToHtml({ path: docxPath });
  const semImagens = resultado.value.replace(/<img[^>]*>/g, '');
  const paragrafos = semImagens.match(/<p>.*?<\/p>/gs) || [];

  const inicioReal = encontrarInicioReal(paragrafos);
  if (inicioReal === -1) {
    throw new Error('Não encontrei "CAPÍTULO 1 —" em negrito no documento — verifique a formatação de origem.');
  }

  const blocos = [`<h1>${titulo}</h1>`];
  if (subtitulo) blocos.push(`<p class="subtitulo-livro"><em>${subtitulo}</em></p>`);
  if (autor) blocos.push(`<p class="autor-livro">${autor}</p>`);

  for (let i = inicioReal; i < paragrafos.length; i++) {
    const item = classificarParagrafo(paragrafos[i]);
    if (!item) continue;

    if (item.tag === 'p') {
      blocos.push(`<p>${item.html}</p>`);
    } else {
      const classeAttr = item.classe ? ` class="${item.classe}"` : '';
      blocos.push(`<${item.tag}${classeAttr}>${item.texto}</${item.tag}>`);
    }
  }

  const conteudoHtml = blocos.join('\n');

  const destDir = path.join(LIVROS_DIR, livroId);
  const destPath = path.join(destDir, 'index.html');
  fs.mkdirSync(destDir, { recursive: true });

  const base = fs.existsSync(destPath)
    ? fs.readFileSync(destPath, 'utf8')
    : fs.readFileSync(TEMPLATE_PATH, 'utf8');

  const artigoRegex = /<article class="conteudo-livro">[\s\S]*?<\/article>/;
  if (!artigoRegex.test(base)) {
    throw new Error('Não encontrei <article class="conteudo-livro"> no arquivo de destino.');
  }

  const atualizado = base
    .replace(artigoRegex, `<article class="conteudo-livro">\n${conteudoHtml}\n</article>`)
    .replace(/<title>.*?<\/title>/, `<title>${titulo} — ZUNI Suprema</title>`);

  fs.writeFileSync(destPath, atualizado);
  console.log(`OK — ${blocos.length} blocos escritos em ${destPath}`);
  return { destPath, totalBlocos: blocos.length };
}

if (require.main === module) {
  const [, , docxPath, livroId, titulo, subtitulo, autor] = process.argv;

  if (!docxPath || !livroId || !titulo) {
    console.error('Uso: node scripts/formatar-livro-docx.js <caminho.docx> <livro_id> "<Título>" ["<Subtítulo>"] ["<Autor>"]');
    process.exit(1);
  }

  formatarLivro(docxPath, livroId, titulo, subtitulo, autor).catch(err => {
    console.error('Erro:', err.message);
    process.exit(1);
  });
}

module.exports = { formatarLivro };
