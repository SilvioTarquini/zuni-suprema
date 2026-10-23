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

const LIVROS_SEM_IMPRESSAO = new Set([
  'da-terra-ao-resultado',
  'vender-bem-vender-sempre',
  'toda-mesa-tem-dois-lados',
  'toda-reuniao-tem-duas-pautas'
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
function tirarImpressaoTemplate(livroId, template) {
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

module.exports = { ehLivroSemImpressao, tirarImpressaoDaTerra, tirarImpressaoTemplate, JS_IR_PARA_PDF };
