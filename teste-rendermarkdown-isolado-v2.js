// TESTE ISOLADO V2: renderMarkdownToPDF() - APENAS TESTE 2

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  TESTE ISOLADO V2: renderMarkdownToPDF() — Teste 2 Apenas  ║');
console.log('║  Verificar se a correção com placeholders funciona         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// ===== FUNÇÃO renderMarkdownToPDF (VERSÃO CORRIGIDA COM PLACEHOLDERS) =====
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

    if (linha.trim() === '') {
      doc.moveDown(0.3);
      return;
    }

    // ===== NOVO PARSER COM PLACEHOLDERS =====
    const partes = [];
    let textoTemp = linha;
    const boldMarkers = [];
    const italicMarkers = [];
    let boldCount = 0;
    let italicCount = 0;

    // PASSO 1: Processar **negrito** PRIMEIRO
    textoTemp = textoTemp.replace(/\*\*([^*]|\*(?!\*))+?\*\*/g, (match) => {
      boldMarkers.push(match.slice(2, -2));
      return `§BOLD${boldCount++}§`;
    });

    // PASSO 2: Processar *itálico*
    textoTemp = textoTemp.replace(/\*([^*]+?)\*/g, (match) => {
      italicMarkers.push(match.slice(1, -1));
      return `§ITALIC${italicCount++}§`;
    });

    // PASSO 3: Reconstruir partes
    const textoPartes = textoTemp.split(/(?=§)/);

    textoPartes.forEach((parte) => {
      if (parte.startsWith('§BOLD')) {
        const match = parte.match(/^§BOLD(\d+)§/);
        if (match) {
          const index = parseInt(match[1]);
          partes.push({ texto: boldMarkers[index], tipo: 'negrito' });
          const resto = parte.slice(match[0].length);
          if (resto) partes.push({ texto: resto, tipo: 'normal' });
        }
      } else if (parte.startsWith('§ITALIC')) {
        const match = parte.match(/^§ITALIC(\d+)§/);
        if (match) {
          const index = parseInt(match[1]);
          partes.push({ texto: italicMarkers[index], tipo: 'italico' });
          const resto = parte.slice(match[0].length);
          if (resto) partes.push({ texto: resto, tipo: 'normal' });
        }
      } else if (parte) {
        partes.push({ texto: parte, tipo: 'normal' });
      }
    });

    // ===== RENDERIZAR PARTES =====
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

// ===== TESTE 2: MARKDOWN COMPLEXO =====
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

const pdfPath = 'C:\\Users\\Silvio\\Documents\\Teste-RenderMarkdown-V2-Teste2.pdf';
const doc = new PDFDocument({ margin: 50, size: 'A4' });
const stream = fs.createWriteStream(pdfPath);

doc.pipe(stream);
doc.fontSize(14).font('Helvetica-Bold').text('TESTE 2 V2: Com Markdown (CORRIGIDO)', { align: 'center' });
doc.moveDown(1);
renderMarkdownToPDF(doc, textoComMarkdown, { fontSize: 11, lineGap: 4, maxWidth: 500 });
doc.end();

stream.on('finish', () => {
  const stats = fs.statSync(pdfPath);
  console.log('✅ PDF gerado: ' + pdfPath);
  console.log('   Tamanho: ' + (stats.size / 1024).toFixed(2) + ' KB\n');

  console.log('═════════════════════════════════════════════════════════════');
  console.log('VALIDAÇÃO ESPERADA:');
  console.log('═════════════════════════════════════════════════════════════\n');
  console.log('✓ "característica forte" deve aparecer COMPLETO (não "a forte")');
  console.log('✓ "combinação única" deve aparecer COMPLETO (não "o de tudo isto")');
  console.log('✓ "razão" deve aparecer COMPLETO (não fragmentado)');
  console.log('✓ "coerência" deve aparecer COMPLETO');
  console.log('✓ "intensidade" deve aparecer COMPLETO\n');
  console.log('✓ **negrito** renderizado visualmente em negrito');
  console.log('✓ *itálico* renderizado visualmente em itálico\n');
  console.log('Se TUDO acima aparecer correto no PDF, a correção funcionou!\n');
});

stream.on('error', (err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
