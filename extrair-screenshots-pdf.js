// Extrair screenshots de 3+ páginas do PDF para validação visual
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function extrairScreenshots() {
  const pdfPath = path.join(__dirname, 'relatorio-juliana-mapa-expandido.pdf');
  const outputDir = path.join(__dirname, 'screenshots-validacao');

  // Criar diretório de saída
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  EXTRAÇÃO DE SCREENSHOTS DO PDF                      ║');
  console.log('║  Para validação visual da formatação                 ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // Tentar usar ghostscript (gs) para conversão PDF -> PNG
  try {
    console.log('🔄 Tentando usar Ghostscript para conversão PDF -> PNG...');

    // Converter páginas 1-4 para PNG
    const gsCommand = `gs -dQUIET -dSAFER -dBATCH -dNOPAUSE -dNOPROMPT -r150 -sDEVICE=png16m -dFirstPage=1 -dLastPage=4 -sOutputFile="${outputDir}\\page-%d.png" "${pdfPath}"`;

    try {
      execSync(gsCommand, { stdio: 'pipe' });
      console.log('✅ Ghostscript disponível — imagens extraídas!');

      const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.png'));
      files.forEach(file => {
        const fullPath = path.join(outputDir, file);
        const stats = fs.statSync(fullPath);
        console.log(`   📸 ${file} — ${(stats.size / 1024).toFixed(0)} KB`);
      });

      console.log(`\n✨ Screenshots salvos em: ${outputDir}`);
      return outputDir;
    } catch (gsError) {
      console.log('⚠️  Ghostscript não disponível\n');
      throw gsError;
    }
  } catch (error) {
    console.log('⚠️  Conversão automática não disponível');
    console.log('\n💡 ALTERNATIVA: Abra o PDF manualmente e capture screenshots:\n');
    console.log(`📄 Arquivo: ${pdfPath}`);
    console.log('\n   Páginas para capturar:');
    console.log('   1. Página 1-2: Capa + Índice (validar formatação visual)');
    console.log('   2. Página 3-5: Conteúdo planetário (validar fluxo contínuo de texto)');
    console.log('   3. Página 6-8: Mais conteúdo + numerologia (validar sem quebras indesejadas)');

    return null;
  }
}

extrairScreenshots().then((dir) => {
  if (dir) {
    console.log('\n🎉 SCREENSHOTS EXTRAÍDAS COM SUCESSO');
  } else {
    console.log('\n📋 Instruções de captura manual fornecidas acima');
  }
}).catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
