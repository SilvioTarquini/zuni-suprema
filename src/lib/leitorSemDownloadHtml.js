// lib/leitorSemDownloadHtml.js
//
// Obras "antigas" (as que não passaram pelos lotes de novembro/2026): o leitor traz um botão "Baixar" que entrega o LIVRO INTEIRO como
// arquivo .html — ou a página serializada (documentElement.outerHTML) ou a própria URL do leitor com download — um arquivo que abre
// em qualquer lugar, sem token, sem prazo e sem reembolso que o revogue. Isso é vazamento. Aqui o botão e o ouvinte saem na hora de
// servir (a obra no disco não muda). O botão "Imprimir" NÃO é tocado: aquele é outro assunto (ver LIVROS_SEM_IMPRESSAO).
//
// Variantes de leitor encontradas (scripts/auditar-obras-antigas.js):
//   V1  bundle com <button id="btnDownload" title="Baixar o livro (.html)"> e this.$('btnDownload').addEventListener(...download())
//   V2  bundle React-like com <button sc-camel-on-click="{{ onDownload }}"> (A Inteligência da Vida, Neurobiologia, Obesidade)
//   V3  bundle com <button class="cc-btn" data-cact="down"> e o ramo else if(a==='down'){…} (A Arquitetura da Decisão Humana)
//   V4  estático (Os Bastidores da Mente 1–6) com <a id="link-baixar" href="#" download> e link-baixar.href = window.location.href
// Cada passo é independente: a falta de uma âncora só deixa de fazer aquele passo (nunca derruba a entrega do livro). O teste
// scripts/testar-sem-download-html.js garante, obra por obra, que nada sobrou.
//
// Rede de segurança (só nas obras da lista): bloqueia a criação de arquivo text/html para download, caso alguma variante escape.

const LIVROS_SEM_DOWNLOAD_HTML = new Set([
  // Os Bastidores da Mente (estáticos)
  'os-bastidores-da-mente-1-a-origem-de-todo-bem-e-de-todo-mal', 'os-bastidores-da-mente-2-o-antidoto', 'os-bastidores-da-mente-3-a-bussola-humana',
  'os-bastidores-da-mente-4-a-travessia', 'os-bastidores-da-mente-5-a-escada', 'os-bastidores-da-mente-6-o-designio',
  // Bundle
  'arquitetura-excelencia-humana-ii', 'ela-tem-classe', 'codigo-feminino', 'a-inteligencia-do-corpo-feminino', 'a-mulher-que-permanece-inteira',
  'a-arte-da-presenca-masculina', 'a-presenca-em-acao-apendice', 'a-arte-invisivel-elegancia-masculina', 'guia-integral-saude-beleza-masculina',
  'protocolo-90s-executive-black', 'executive-black-standalone', 'a-arquitetura-da-decisao-humana', 'a-arte-e-a-ciencia-de-viver', 'a-inteligencia-da-vida',
  'a-jornada-interior', 'excelencia-humana', 'o-retorno-da-clareza', 'a-neurobiologia-integrativa-da-depressao', 'a-visao-integrativa-da-obesidade',
  'medicina-natural-integrativa', 'mentes-esgotadas', 'o-elo-invisivel', 'transforma-te-protocolos-90s', 'consequencias-edicao-essencial',
  'alem-do-que-voce-ve', 'alem-do-que-voce-sente', 'o-caminho-da-consciencia', 'inteligencia-artificial-volume-1', 'empresas-inteligentes-volume-2',
  'tempo-para-viver'
]);

function ehLivroSemDownloadHtml(livroId) { return LIVROS_SEM_DOWNLOAD_HTML.has(livroId); }

const GUARDA = '<script id="zs-sem-download-html">(function(){try{var cu=URL.createObjectURL;URL.createObjectURL=function(o){if(o&&/html/i.test(String(o.type||\'\'))){return\'about:blank\';}return cu.apply(URL,arguments);};'
  + 'var ck=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.hasAttribute(\'download\')&&this.href===\'about:blank\'){return;}return ck.apply(this,arguments);};}catch(e){}})();</script>';

// Aplica os passos a um texto HTML (o template do bundle ou o HTML estático). Devolve { texto, passos: [nomes dos passos que mudaram algo] }.
function aplicarPassos(texto) {
  const passos = []; let t = texto;
  const passo = (nome, re, novo = '') => { const r = t.replace(re, novo); if (r !== t) { passos.push(nome); t = r; } };
  // V1: botão (só o de download .html) e o ouvinte que o liga (sem o ouvinte, this.$('btnDownload') seria null e o leitor quebraria)
  passo('V1-botao', /\n?[ \t]*<button\b[^>]*\bid="btnDownload"[^>]*\btitle="[^"]*(?:\.html|HTML)[^"]*"[^>]*>[\s\S]*?<\/button>/g);
  passo('V1-botao', /\n?[ \t]*<button\b[^>]*\btitle="[^"]*(?:\.html|HTML)[^"]*"[^>]*\bid="btnDownload"[^>]*>[\s\S]*?<\/button>/g);
  passo('V1-ouvinte', /(?:this\.)?\$\('btnDownload'\)\.addEventListener\('click',\s*\(\)\s*=>\s*this\.download\(\)\);?/g);
  // V2: <button sc-camel-on-click="{{ onDownload }}" …>…</button> (o conteúdo do botão não tem outro <button>)
  passo('V2-botao', /\n?[ \t]*<button\b[^>]*sc-camel-on-click="\{\{\s*onDownload\s*\}\}"[^>]*>[\s\S]*?<\/button>/g);
  // V3: botão do painel "Escolha como ler" e o ramo do ouvinte
  passo('V3-botao', /\s*'<button class="cc-btn" data-cact="down">[\s\S]*?<\/button>'\s*\+/g);
  passo('V3-ramo', /\s*else if\(a==='down'\)\{[^}]*\}/g);
  // V4: link "Baixar" dos Bastidores e a linha que apontava o link para a URL da própria página
  passo('V4-link', /\n?[ \t]*<a\b[^>]*\bid="link-baixar"[^>]*>[\s\S]*?<\/a>/g);
  passo('V4-href', /document\.getElementById\('link-baixar'\)\.href\s*=\s*window\.location\.href;?/g);
  return { texto: t, passos };
}

const MARCADOR_TEMPLATE = '<script type="__bundler/template">';

// Devolve { html, passos }. Para obra fora da lista devolve o mesmo html.
function removerDownloadHtml(livroId, html) {
  if (!ehLivroSemDownloadHtml(livroId)) return { html, passos: [] };
  try {
    const i = html.lastIndexOf(MARCADOR_TEMPLATE);
    if (i < 0) {
      const r = aplicarPassos(html);
      return { html: guardar(r.texto), passos: r.passos };
    }
    let j = i + MARCADOR_TEMPLATE.length; while (/\s/.test(html[j])) j++;
    const fim = html.indexOf('</script>', j);
    if (html[j] !== '"' || fim < 0) throw new Error('template do bundle truncado');
    const template = JSON.parse(html.slice(j, fim)); if (typeof template !== 'string') throw new Error('template do bundle não é texto');
    const r = aplicarPassos(template);
    const novo = JSON.stringify(guardar(r.texto)).replace(/<\//g, '<\\/');
    return { html: html.slice(0, j) + novo + html.slice(fim), passos: r.passos };
  } catch (err) {
    console.error(`[SEM_DOWNLOAD_HTML_FALHOU] livroId=${livroId} motivo=${err.message} — entregando o livro sem a remoção.`);
    return { html, passos: [] };
  }
}

// Rede de segurança logo depois de <head> (ou no começo, se não houver).
function guardar(texto) {
  if (texto.includes('id="zs-sem-download-html"')) return texto;
  const m = /<head[^>]*>/i.exec(texto);
  return m ? texto.slice(0, m.index + m[0].length) + GUARDA + texto.slice(m.index + m[0].length) : GUARDA + texto;
}

module.exports = { LIVROS_SEM_DOWNLOAD_HTML, ehLivroSemDownloadHtml, removerDownloadHtml, aplicarPassos };
