// lib/leitorSemImpressao.js
//
// Nos 4 leitores à venda (Da Terra ao Resultado, Vender Bem, Toda Mesa, Toda Reunião) o recurso de impressão sai por
// completo: botão "PDF/Imprimir", botão "Imprimir", "Baixar em PDF" e as chamadas a window.print(). No lugar entra UM
// botão, "Baixar PDF", que abre a rota GET /livros/<id>/pdf?token=… (mesmo token da URL do leitor). O botão "Baixar"
// (.html) de Vender Bem e Toda Reunião também sai: o download do livro passa a ser só o PDF. Quem quiser imprimir
// imprime o PDF. O resto do leitor e o texto dos livros não mudam.
//
// Aplicado na hora de servir, junto do patch de celular (ver leitorMobile.js). Toda âncora é obrigatória e ocorre
// exatamente uma vez; senão lança, e o patch inteiro é abandonado (livro original + [LEITOR_PATCH_FALHOU]).

const { jsFlutuantes } = require('./flutuantes');

const LIVROS_SEM_IMPRESSAO = new Set([
  'da-terra-ao-resultado',
  // Lote-piloto (cópias de _staging já sem impressão; o servidor só acrescenta o "Baixar PDF"):
  'fazenda-lucrativa',
  'a-bussola-do-adolescente',
  'situacoes-da-vida-real',
  'heranca-de-papel',
  'vender-bem-vender-sempre',
  'toda-mesa-tem-dois-lados',
  'toda-reuniao-tem-duas-pautas',
  // Lote 2 (cópias de _staging já sem impressão; o servidor só acrescenta o "Baixar PDF"):
  'a-casa-da-neblina',
  'a-segunda-margem',
  'a-tradutora',
  'almas-silenciadas',
  'falsa-moralidade',
  'guerra-de-compadre',
  'mascara-para-o-controle',
  'ninguem-avisou-que-ele-morreu',
  'o-baile-dos-herdeiros-posticos',
  'o-disfarce-da-alma',
  'o-falecido-esta-a-mesa',
  'o-lugar-a-mesa',
  'o-ultimo-baile-do-moinho',
  'onze-dias-de-sorte',
  'toda-familia-tem-duas-historias',
  'toda-briga-tem-dois-comecos',
  'entre-o-encanto-e-a-escolha',
  'senti-percebi-escolhi',
  'ninguem-reage-do-nada'
]);

function ehLivroSemImpressao(livroId) {
  return LIVROS_SEM_IMPRESSAO.has(livroId);
}

// Expressão JS (no navegador) que monta a URL da rota do PDF a partir da URL do leitor: /livros/<id>[?token=…]
// vira /livros/<id>/pdf?token=…
const JS_URL_PDF = "location.pathname.replace(/\\/$/, '') + '/pdf' + location.search";
const JS_IR_PARA_PDF = `location.href = ${JS_URL_PDF};`;

// Troca exatamente uma ocorrência (texto fixo ou regex sem flag g); `novo` pode ser texto ou função (grupos da regex).
function tirarUma(texto, alvo, novo = '') {
  const n = typeof alvo === 'string' ? texto.split(alvo).length - 1 : (texto.match(new RegExp(alvo.source, 'g')) || []).length;
  if (n !== 1) throw new Error(`sem-impressao: âncora ocorre ${n}x: ${String(alvo).slice(0, 60)}`);
  return texto.replace(alvo, typeof novo === 'function' ? novo : () => novo);
}

// Leitor estático do Da Terra (HTML inteiro, sem bundle).
function tirarImpressaoDaTerra(html) {
  let t = tirarUma(html, '<button id="printBtn">PDF/Imprimir</button>', '<button id="pdfBtn">Baixar PDF</button>');
  t = tirarUma(t, "document.getElementById('printBtn').onclick=()=>window.print();", `document.getElementById('pdfBtn').onclick=()=>{ ${JS_IR_PARA_PDF} };`);
  return t;
}

// Template do bundle (Vender Bem, Toda Reunião e Toda Mesa).
// Os três livros à venda cujos leitores têm âncoras exatas conhecidas usam o caminho estrito (comportamento de sempre,
// coberto por scripts/testar-sem-impressao.js). Qualquer outro leitor do mesmo motor usa o caminho tolerante abaixo.
const LIVROS_COM_CAMINHO_ESTRITO = new Set(['toda-mesa-tem-dois-lados', 'vender-bem-vender-sempre', 'toda-reuniao-tem-duas-pautas']);

const ICONE_DOWNLOAD = '<svg sc-camel-view-box="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"></path></svg>';
const BOTAO_PDF = `<button class="cover-ghost" id="btnPdf" title="Baixar o livro em PDF">${ICONE_DOWNLOAD}Baixar PDF</button>`;
// Ouvinte delegado: não depende do nome do método que monta os botões nem de o botão existir quando o leitor liga os eventos.
const OUVINTE_PDF = `document.addEventListener('click', function(e){ var b = e.target && e.target.closest && e.target.closest('#btnPdf'); if(b){ ${JS_IR_PARA_PDF} } });`;

// Versão tolerante: cada passo é independente e a falta de uma âncora NÃO derruba o patch (só deixa de fazer aquele passo).
//  1. tira os botões de imprimir, o antigo "Baixar PDF" que na verdade imprimia, o "Baixar (.html)" e o "PDF" embutido;
//  2. tira os ouvintes desses botões e toda chamada window.print();
//  3. coloca UM botão "Baixar PDF" (no lugar do primeiro botão removido; se não houver, depois do botão de abrir o livro)
//     que navega para /livros/<id>/pdf?token=… . Se o leitor não tiver método bind() para receber o ouvinte, não põe botão.
function tirarImpressaoTemplateTolerante(template) {
  const reBotao = /\n?[ \t]*<button[^>]*id="(?:btnPrint|btnDownloadPdf)"[^>]*>[\s\S]*?<\/button>/;
  const reBotoesRemover = [
    /\n?[ \t]*<button[^>]*id="(?:btnPrint|btnDownloadPdf)"[^>]*>[\s\S]*?<\/button>/g,
    /\n?[ \t]*<button[^>]*id="btnDownload"[^>]*title="[^"]*(?:\.html|HTML|em PDF)[^"]*"[^>]*>[\s\S]*?<\/button>/g
  ];
  const temBind = /\bbind\s*\(\)\s*\{/.test(template);
  let t = template;
  let colocado = !temBind || /id="btnPdf"/.test(t);

  if (!colocado) {
    const m = t.match(/\n?[ \t]*<button[^>]*id="(?:btnPrint|btnDownloadPdf|btnDownload)"[^>]*>[\s\S]*?<\/button>/);
    if (m) { t = t.replace(m[0], () => '\n      ' + BOTAO_PDF); colocado = true; }
  }
  for (const re of reBotoesRemover) t = t.replace(re, '');
  if (!colocado) {
    const abrir = t.match(/<button[^>]*id="openBtn"[^>]*>[\s\S]*?<\/button>/);
    if (abrir) { t = t.replace(abrir[0], () => abrir[0] + '\n      ' + BOTAO_PDF); colocado = true; }
  }
  void reBotao;

  t = t.replace(/(?:this\.)?\$\('(?:btnPrint|btnDownloadPdf|btnDownload)'\)\.addEventListener\('click',\s*\(\)\s*=>\s*this\.(?:doPrint|download)\(\)\);?/g, '');
  t = t.replace(/window\.print\(\)/g, 'void 0');

  if (colocado && temBind && /id="btnPdf"/.test(t) && !t.includes(OUVINTE_PDF)) {
    t = t.replace(/\bbind\s*\(\)\s*\{/, (m) => m + ' ' + OUVINTE_PDF);
  }
  return t;
}

// Leitores SEM bundle (HTML inteiro com o livro em <script>/const): não têm template para editar. Duas coisas, ambas
// tolerantes (falta de âncora nunca derruba a entrega do livro):
//  1. se o leitor trouxer o botão "Baixar o livro (.html)" (A Bússola do Adolescente), ele vira "Baixar PDF" e passa a
//     navegar para a rota do PDF — o download do HTML do livro, sem token, deixa de existir;
//  2. em qualquer caso, um botão flutuante "Baixar PDF" (canto superior direito) leva à rota /livros/<id>/pdf?token=… .
const CSS_BOTAO_PDF = '<style id="zs-pdf-css">#zs-baixar-pdf{position:fixed;top:10px;right:10px;z-index:999990;display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 14px;border:1px solid rgba(201,178,107,.7);border-radius:999px;background:rgba(20,20,20,.72);color:#f3e6bd;font:600 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:.02em;cursor:pointer;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}#zs-baixar-pdf:hover{background:rgba(20,20,20,.88)}@media print{#zs-baixar-pdf{display:none}}body:has(#zuni-chat-widget.zuni-chat-aberto) #zs-baixar-pdf{display:none}</style>';
// A posição de partida (canto superior direito) pode coincidir com os controles do leitor (A−/A+, busca…): o código compartilhado de
// templates/flutuantes.js — o mesmo do botão do Livro-Vivo — o desloca para a posição livre mais próxima, a 16 px de qualquer
// controle, de preferência longe do texto, e o trata junto do Livro-Vivo (um não cobre o outro).
function botaoPdfFlutuante() {
  return CSS_BOTAO_PDF + '<button type="button" id="zs-baixar-pdf" title="Baixar o livro em PDF">&#8681; Baixar PDF</button><script id="zs-pdf-js">'
    + jsFlutuantes() + '\n(function(){ var b = document.getElementById("zs-baixar-pdf"); b.addEventListener("click",function(){ ' + JS_IR_PARA_PDF + ' });'
    + ' window.ZuniFlutuantes.registrar(b, { ordem: 0, ativo: function(){ return getComputedStyle(b).display !== "none"; }, evitarTexto: function(){ return true; } }); })();</script>';
}

function tirarImpressaoHtmlEstatico(html) {
  let t = html;
  // (1) "Baixar o livro (.html)" → "Baixar PDF" (só se TODAS as âncoras existirem; senão deixa como está e segue)
  const reBotoes = /title="Baixar o livro \(\.html\)">Baixar<\/button>/g;
  const reLigacao = /\[\s*'dlBtn'\s*,\s*'dlBtn2'\s*\]\.forEach\(\s*id\s*=>\s*document\.getElementById\(id\)\.onclick\s*=\s*baixar\s*\)/;
  if (reBotoes.test(t) && reLigacao.test(t)) {
    t = t.replace(reBotoes, 'title="Baixar o livro em PDF">Baixar PDF</button>');
    t = t.replace(reLigacao, () => "['dlBtn','dlBtn2'].forEach(id=>document.getElementById(id).onclick = ()=>{ " + JS_IR_PARA_PDF + " })");
  }
  // (2) botão flutuante, uma vez só, logo antes de </body>
  if (!t.includes('id="zs-baixar-pdf"')) {
    const i = t.lastIndexOf('</body>');
    const botao = botaoPdfFlutuante();
    t = i >= 0 ? t.slice(0, i) + botao + t.slice(i) : t + botao;
  }
  return t;
}

function tirarImpressaoTemplate(livroId, template) {
  if (!LIVROS_COM_CAMINHO_ESTRITO.has(livroId)) return tirarImpressaoTemplateTolerante(template);
  if (livroId === 'toda-mesa-tem-dois-lados') {
    // Leitor em React: onclick="texto" não funciona (erro React #231). Mantém o gancho original do componente
    // (doPrintClick → doPrint); só o rótulo muda, e doPrint() passa a navegar para a rota do PDF em vez de imprimir.
    const t = tirarUma(template,
      /(<button sc-camel-on-click="\{\{ doPrintClick \}\}"[^>]*>)Baixar em PDF(<\/button>)/,
      (_, abre, fecha) => `${abre}Baixar PDF${fecha}`);
    return tirarUma(t, '  doPrint() {\n    this.setState({ printMode: true });\n    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));\n  }', `  doPrint() {\n    ${JS_IR_PARA_PDF}\n  }`);
  }
  // Vender Bem e Toda Reunião (capa): "Baixar" (.html) sai, "Imprimir" vira "Baixar PDF" (com o ícone de download).
  const iconeDownload = '<svg sc-camel-view-box="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"></path></svg>';
  let t = tirarUma(template, /\n {6}<button class="cover-ghost" id="btnDownload"[\s\S]*?<\/button>/);
  t = tirarUma(t, /\n {6}<button class="cover-ghost" id="btnPrint"[\s\S]*?<\/button>/,
    `\n      <button class="cover-ghost" id="btnPdf" title="Baixar o livro em PDF">\n        ${iconeDownload}Baixar PDF\n      </button>`);
  t = tirarUma(t, "    this.$('btnDownload').addEventListener('click', ()=>this.download());\n");
  t = tirarUma(t, "    this.$('btnPrint').addEventListener('click', ()=>this.doPrint());\n",
    `    this.$('btnPdf').addEventListener('click', ()=>{ ${JS_IR_PARA_PDF} });\n`);
  return tirarUma(t, '  doPrint(){ this.buildPrint(); setTimeout(()=>window.print(), 60); }', '  doPrint(){}');
}

module.exports = { ehLivroSemImpressao, tirarImpressaoDaTerra, tirarImpressaoHtmlEstatico, tirarImpressaoTemplate, tirarImpressaoTemplateTolerante, JS_IR_PARA_PDF };
