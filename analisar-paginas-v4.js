// Analisar teste-isolado-v4.pdf: contar páginas e identificar quebras
const fs = require('fs');
const path = require('path');

async function analisarPDF() {
  const pdfPath = path.join(__dirname, 'teste-isolado-v4.pdf');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  ANÁLISE: teste-isolado-v4.pdf                            ║');
  console.log('║  Contagem de páginas + identificação de quebras            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Verificar arquivo
    const stats = fs.statSync(pdfPath);
    console.log(`📄 Arquivo: teste-isolado-v4.pdf`);
    console.log(`📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`⏰ Criado: ${stats.mtime.toLocaleString('pt-BR')}\n`);

    // Ler arquivo PDF
    const dataBuffer = fs.readFileSync(pdfPath);

    // Contar páginas pelo padrão PDF (/Type /Page)
    // PDFs armazenam cada página com um objeto /Type /Page
    const pdfContent = dataBuffer.toString('latin1');
    const pageMatches = pdfContent.match(/\/Type\s*\/Page(?!s)/g);
    const totalPages = pageMatches ? pageMatches.length : 0;

    console.log(`📑 TOTAL DE PÁGINAS: ${totalPages}\n`);

    // Tentar usar pdf-parse
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);

      console.log(`✅ Confirmado via pdf-parse: ${data.numpages} páginas\n`);

      // Analisar conteúdo por página
      console.log('📋 ANÁLISE POR PÁGINA:\n');

      const lines = data.text.split('\n').filter(l => l.trim());
      const pageIndicators = ['##', 'Parágrafo', 'Seção', 'Introdução'];

      let currentPage = 1;
      let pageContent = [];

      lines.forEach((line, idx) => {
        // Heurística: seções (##) geralmente iniciam novos blocos de conteúdo
        if (line.startsWith('## Parágrafo') && pageContent.length > 3) {
          // Provável quebra de página aqui
          if (currentPage <= totalPages) {
            console.log(`   Página ${currentPage}: ${pageContent.length} linhas de conteúdo`);
            if (pageContent.some(l => l.includes('**'))) {
              console.log(`                    ✓ Contém negrito`);
            }
            if (pageContent.some(l => l.includes('*') && !l.includes('**'))) {
              console.log(`                    ✓ Contém itálico`);
            }

            // Procurar por quebra de parágrafo no meio (seção não no início de página)
            if (pageContent.length > 1 && pageContent[0].length > 0) {
              console.log(`                    → Seção no meio: ${pageContent[0].substring(0, 40)}...`);
            }
          }
          currentPage++;
          pageContent = [];
        }
        pageContent.push(line);
      });

      // Última página
      if (pageContent.length > 0) {
        console.log(`   Página ${currentPage}: ${pageContent.length} linhas de conteúdo`);
      }

      // Procurar por indicadores de formatação
      console.log('\n📊 ESTATÍSTICAS DE FORMATAÇÃO:\n');
      const boldCount = (data.text.match(/\*\*/g) || []).length / 2; // ** aparecem em pares
      const italicCount = (data.text.match(/\*/g) || []).length / 2;
      console.log(`   Trechos em negrito: ~${Math.floor(boldCount)}`);
      console.log(`   Trechos em itálico: ~${Math.floor(italicCount)}`);

      // Procurar por seções com negrito inicial
      console.log('\n🎯 SEÇÕES COM NEGRITO INICIAL:\n');
      const negroInicialSections = data.text.match(/## Parágrafo \d+ —.*?\n\*\*/g);
      if (negroInicialSections) {
        negroInicialSections.forEach((sec, idx) => {
          const num = sec.match(/\d+/)[0];
          console.log(`   ✓ Parágrafo ${num} começa com negrito`);
        });
      }

      console.log('\n✅ ANÁLISE CONCLUÍDA\n');
      console.log('📝 RESUMO:\n');
      console.log(`   Total de páginas: ${data.numpages}`);
      console.log(`   Quebras de parágrafo esperadas: ${totalPages - 1} (aproximado)`);
      console.log(`   Formatação total: Múltiplos trechos negrito + itálico`);
      console.log('\n');

    } catch (parseErr) {
      console.log('⚠️  pdf-parse não disponível, usando análise por regex\n');
      console.log(`📑 Páginas estimadas por regex: ${totalPages}\n`);
      console.log('💡 Para análise detalhada, abra o PDF manualmente e:\n');
      console.log('   1. Conte as páginas no visualizador');
      console.log('   2. Identifique em quais páginas há quebra de parágrafo no meio');
      console.log('   3. Valide formatação em cada quebra\n');
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

analisarPDF().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
