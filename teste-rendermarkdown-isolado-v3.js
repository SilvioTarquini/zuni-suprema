// TESTE ISOLADO — renderMarkdownToPDF V2
// Objetivo: validar que negrito/itálico funcionam em texto corrido,
// sem fragmentação, sem sobreposição, sem cortes entre páginas.

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Importar função V2
const { renderMarkdownToPDF } = require('./src/renderMarkdownToPDF-v2');

async function testeIsolado() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE ISOLADO — renderMarkdownToPDF V2                 ║');
  console.log('║  Validação de negrito + itálico em texto corrido       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Texto de teste: 2-3 parágrafos com negrito e itálico misturados
  const textoTeste = `# Teste de Formatação

Este é um parágrafo **simples com negrito** no meio da frase. Aqui temos também *itálico inserido* naturalmente no texto, sem quebras. E agora **negrito novamente**, seguido de *itálico*, tudo na mesma frase sem fragmentação visível.

O segundo parágrafo valida um cenário mais complexo: *você vê itálico*, depois **negrito**, depois *volta a itálico*, e **termina em negrito**. Isso simula o padrão de ênfase encontrado no Mapa Integrado com descrições de planetas.

Um terceiro parágrafo ainda mais longo para garantir que o fluxo natural de quebra de linha (quando atinge a margem) funcione corretamente. Aqui temos **múltiplos trechos em negrito espalhados** ao longo do parágrafo, com *itálico intercalado*, para validar que o PDFKit não força quebras indesejadas entre segmentos de formatação diferente.

## Validação de Títulos

Títulos devem aparecer em negrito (Helvetica-Bold), e o parágrafo logo após o título é **um teste final** com itálico *integrado na mensagem*.

---

Este documento deve ter EXATAMENTE 3 páginas.
Página 1: Título principal + 2 parágrafos iniciais.
Página 2: Terceiro parágrafo + Seção de validação.
Página 3: Parágrafo final com divisa.`;

  return new Promise((resolve, reject) => {
    const outputPath = path.join(__dirname, 'teste-isolado-v3.pdf');
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // Renderizar com a função V2
    renderMarkdownToPDF(doc, textoTeste, {
      fontSize: 11,
      lineGap: 4,
      maxWidth: 500
    });

    // Footer
    doc.fontSize(9).fillColor('gray');
    doc.text('Teste isolado — renderMarkdownToPDF V2', { align: 'center' });
    doc.text(`Gerado: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

    doc.end();

    stream.on('finish', () => {
      const stats = fs.statSync(outputPath);

      console.log('✅ PDF TESTE GERADO\n');
      console.log(`📄 Arquivo: ${outputPath}`);
      console.log(`📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB\n`);

      console.log('📋 O QUE VALIDAR AO ABRIR:\n');
      console.log('   1️⃣  TEXTO CORRIDO');
      console.log('      ✓ Negrito e itálico aparecem sem quebras de linha');
      console.log('      ✓ Frase "Este é um parágrafo **simples com negrito** no meio"');
      console.log('        deve estar em UMA ÚNICA LINHA, não fragmentada\n');

      console.log('   2️⃣  SEM SOBREPOSIÇÃO');
      console.log('      ✓ Nenhuma palavra aparece sobre outra');
      console.log('      ✓ Todas as palavras são legíveis\n');

      console.log('   3️⃣  SEM CORTE ENTRE PÁGINAS');
      console.log('      ✓ Se uma frase quebra em 2 páginas, deve estar completa');
      console.log('      ✓ Negrito/itálico mantido após quebra\n');

      console.log('   4️⃣  FLUXO NATURAL');
      console.log('      ✓ Quebras de linha apenas na margem (500px)');
      console.log('      ✓ NÃO há quebras forçadas a cada troca de formatação');
      console.log('      ✓ Parece um documento profissional\n');

      console.log('✨ PRÓXIMOS PASSOS:');
      console.log('   1. Abra o PDF acima');
      console.log('   2. Tire PRINT SCREEN de 2-3 páginas');
      console.log('   3. Valide contra critérios acima');
      console.log('   4. Se OK → avançar para teste pipeline completo\n');

      resolve(outputPath);
    });

    stream.on('error', reject);
  });
}

testeIsolado()
  .then((pdfPath) => {
    console.log('🎉 TESTE ISOLADO PRONTO PARA VALIDAÇÃO VISUAL\n');
  })
  .catch((err) => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });
