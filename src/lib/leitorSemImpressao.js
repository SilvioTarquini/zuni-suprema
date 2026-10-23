// lib/leitorSemImpressao.js
//
// Tira dos 4 leitores à venda (Da Terra ao Resultado, Vender Bem, Toda Mesa, Toda Reunião) o botão que abre a impressão
// do navegador ("PDF/Imprimir", "Imprimir", "Baixar em PDF"). A entrega passa a ser leitura no site; o PDF de verdade
// vem depois, por rota própria. Nada mais do leitor muda: o botão "Baixar" (.html) de Vender e Reunião fica como está.
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

// Troca exatamente uma ocorrência (texto fixo ou regex sem flag g).
function tirarUma(texto, alvo, novo = '') {
  const n = typeof alvo === 'string' ? texto.split(alvo).length - 1 : (texto.match(new RegExp(alvo.source, 'g')) || []).length;
  if (n !== 1) throw new Error(`sem-impressao: âncora ocorre ${n}x: ${String(alvo).slice(0, 60)}`);
  return texto.replace(alvo, () => novo);
}

// Leitor estático do Da Terra (HTML inteiro, sem bundle).
function tirarImpressaoDaTerra(html) {
  let t = tirarUma(html, '<button id="printBtn">PDF/Imprimir</button>');
  t = tirarUma(t, "document.getElementById('printBtn').onclick=()=>window.print();");
  return t;
}

// Template do bundle (Vender Bem, Toda Reunião e Toda Mesa).
function tirarImpressaoTemplate(livroId, template) {
  if (livroId === 'toda-mesa-tem-dois-lados') {
    return tirarUma(template, /<button sc-camel-on-click="\{\{ doPrintClick \}\}"[^>]*>Baixar em PDF<\/button>/);
  }
  // Vender Bem e Toda Reunião: botão "Imprimir" da capa e o seu ouvinte de clique.
  let t = tirarUma(template, /\n {6}<button class="cover-ghost" id="btnPrint"[\s\S]*?<\/button>/);
  t = tirarUma(t, "    this.$('btnPrint').addEventListener('click', ()=>this.doPrint());\n");
  return t;
}

module.exports = { ehLivroSemImpressao, tirarImpressaoDaTerra, tirarImpressaoTemplate };
