// TESTE ISOLADO: renderMarkdownToPDF() com strings de teste puras

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  TESTE ISOLADO: renderMarkdownToPDF()                      ║');
console.log('║  Verificar se há fragmentação de texto                      ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// ===== FUNÇÃO renderMarkdownToPDF (EXATA DO SERVIDOR) =====
function renderMarkdownToPDF(doc, texto, opcoes = {}) {
  const fontSize = opcoes.fontSize || 11;
  const lineGap = opcoes.lineGap || 5;
  const maxWidth = opcoes.maxWidth || 500;

  const linhas = texto.split('\n');

  linhas.forEach((linha) => {
    if (linha.trim() === '---') {
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      return;
    }

    if (linha.startsWith('# ')) {
      doc.moveDown(1);
      const titulo = linha.replace(/^# /, '').trim();
      doc.fontSize(16).font('Helvetica-Bold').text(titulo, { width: maxWidth });
      doc.fontSize(fontSize).font('Helvetica');
      doc.moveDown(0.5);
      return;
    }

    if (linha.startsWith('## ')) {
      doc.moveDown(0.5);
      const titulo = linha.replace(/^## /, '').trim();
      doc.fontSize(13).font('Helvetica-Bold').text(titulo, { width: maxWidth });
      doc.fontSize(fontSize).font('Helvetica');
      doc.moveDown(0.3);
      return;
    }

    if (linha.startsWith('### ')) {
      doc.moveDown(0.5);
      const titulo = linha.replace(/^### /, '').trim();
      doc.fontSize(12).font('Helvetica-Bold').text(titulo, { width: maxWidth });
      doc.fontSize(fontSize).font('Helvetica');
      doc.moveDown(0.3);
      return;
    }

    if (linha.trim() === '') {
      doc.moveDown(0.3);
      return;
    }

    // Parser Markdown: **negrito** e *itálico*
    const negritoRegex = /\*\*([^*]|\*(?!\*))+?\*\*/g;
    const italicoRegex = /\*([^*])+?\*/g;

    const partes = [];
    let ultimoIndice = 0;

    const matches = [];
    let match;
    while ((match = negritoRegex.exec(linha)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        tipo: 'negrito',
        conteudo: match[1]
      });
    }

    const italicoMatches = [];
    while ((match = italicoRegex.exec(linha)) !== null) {
      const eNegrito = matches.some(m =>
        match.index >= m.index && match.index + match[0].length <= m.index + m.length
      );
      if (!eNegrito) {
        italicoMatches.push({
          index: match.index,
          length: match[0].length,
          tipo: 'italico',
          conteudo: match[1]
        });
      }
    }

    const todosMatches = [...matches, ...italicoMatches].sort((a, b) => a.index - b.index);

    ultimoIndice = 0;
    todosMatches.forEach((m) => {
      if (m.index > ultimoIndice) {
        partes.push({ texto: linha.substring(ultimoIndice, m.index), tipo: 'normal' });
      }
      partes.push({ texto: m.conteudo, tipo: m.tipo });
      ultimoIndice = m.index + m.length;
    });

    if (ultimoIndice < linha.length) {
      partes.push({ texto: linha.substring(ultimoIndice), tipo: 'normal' });
    }

    if (partes.length === 0) {
      doc.fontSize(fontSize).font('Helvetica').text(linha, { width: maxWidth, lineGap });
    } else {
      doc.fontSize(fontSize);
      let x = doc.x;
      let y = doc.y;

      partes.forEach((parte) => {
        if (parte.tipo === 'negrito') {
          doc.font('Helvetica-Bold');
        } else if (parte.tipo === 'italico') {
          doc.font('Helvetica-Oblique');
        } else {
          doc.font('Helvetica');
        }
        doc.text(parte.texto, x, y, { continued: true, width: maxWidth, lineGap });
      });
      doc.moveDown();
    }
  });
}

// ===== TESTE 1: String simples, sem caracteres especiais =====
console.log('═════════════════════════════════════════════════════════════');
console.log('TESTE 1: String Simples (Sem Caracteres Especiais)');
console.log('═════════════════════════════════════════════════════════════\n');

const textoSimples = `Este é um parágrafo de teste simples, sem símbolos especiais, apenas para verificar se o parser preserva o texto integralmente.
Este é um segundo parágrafo, também sem nenhuma formatação especial.
O objetivo é confirmar que renderMarkdownToPDF preserva cada caractere.`;

console.log('ENTRADA:\n' + textoSimples + '\n');

const pdfPath1 = 'C:\\Users\\Silvio\\Documents\\Teste-RenderMarkdown-1-Simples.pdf';
const doc1 = new PDFDocument({ margin: 50, size: 'A4' });
const stream1 = fs.createWriteStream(pdfPath1);

doc1.pipe(stream1);
doc1.fontSize(14).font('Helvetica-Bold').text('TESTE 1: Texto Simples', { align: 'center' });
doc1.moveDown(1);
renderMarkdownToPDF(doc1, textoSimples, { fontSize: 11, lineGap: 4, maxWidth: 500 });
doc1.end();

stream1.on('finish', () => {
  const stats = fs.statSync(pdfPath1);
  console.log('✅ PDF gerado: ' + pdfPath1);
  console.log('   Tamanho: ' + (stats.size / 1024).toFixed(2) + ' KB\n');
});

// ===== TESTE 2: String com Markdown, pontuação e padrões reais =====
setTimeout(() => {
  console.log('═════════════════════════════════════════════════════════════');
  console.log('TESTE 2: Com Markdown, Negrito, Itálico e Pontuação Complexa');
  console.log('═════════════════════════════════════════════════════════════\n');

  const textoComMarkdown = `# Análise de Características

Carlos possui uma **natureza** forte, um traço dominante que o define.
Ele é reconhecido por sua *capacidade* de liderança — algo raro e valioso.

A *razão* de tudo isto está em sua essência profunda, uma combinação única.
Seus padrões comportamentais refletem isso: trabalho estruturado, resultados claros, ação decisiva.

Há **múltiplos** aspectos a considerar: trabalho, relacionamento, *crescimento pessoal*.
Cada um desses domínios revela uma faceta diferente de quem ele é — e de quem pode ser.

## Padrões Emergentes

O que emerge da análise é claro: há uma *coerência* interna que poucos possuem.
A **intensidade** de seu compromisso com objetivos, aliada à paciência necessária para realizá-los — isto é, de fato, uma combinação poderosa.`;

  console.log('ENTRADA:\n' + textoComMarkdown + '\n');

  const pdfPath2 = 'C:\\Users\\Silvio\\Documents\\Teste-RenderMarkdown-2-Markdown.pdf';
  const doc2 = new PDFDocument({ margin: 50, size: 'A4' });
  const stream2 = fs.createWriteStream(pdfPath2);

  doc2.pipe(stream2);
  doc2.fontSize(14).font('Helvetica-Bold').text('TESTE 2: Com Markdown e Pontuação', { align: 'center' });
  doc2.moveDown(1);
  renderMarkdownToPDF(doc2, textoComMarkdown, { fontSize: 11, lineGap: 4, maxWidth: 500 });
  doc2.end();

  stream2.on('finish', () => {
    const stats = fs.statSync(pdfPath2);
    console.log('✅ PDF gerado: ' + pdfPath2);
    console.log('   Tamanho: ' + (stats.size / 1024).toFixed(2) + ' KB\n');
  });

  setTimeout(() => {
    console.log('═════════════════════════════════════════════════════════════');
    console.log('RESULTADOS ESPERADOS:');
    console.log('═════════════════════════════════════════════════════════════\n');
    console.log('✓ TESTE 1: Texto deve sair EXATAMENTE como entrou.');
    console.log('✓ TESTE 2: **negrito** deve aparecer em negrito visual.');
    console.log('✓ TESTE 2: *itálico* deve aparecer em itálico visual.');
    console.log('✓ Nenhum caractere deve ser perdido ou fragmentado.\n');

    console.log('🔍 Se houver fragmentação em qualquer PDF, renderMarkdownToPDF() é o culpado.\n');
    console.log('Abrir os PDFs acima para inspeção visual.\n');
  }, 2000);
}, 1000);
