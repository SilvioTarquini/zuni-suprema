// Extrair texto do PDF isolado para validação
const fs = require('fs');
const path = require('path');

async function validarPdfIsolado() {
  const pdfPath = path.join(__dirname, 'teste-isolado-v3.pdf');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  VALIDAÇÃO: Extração de Texto do PDF Isolado             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Ler arquivo PDF
    const dataBuffer = fs.readFileSync(pdfPath);

    // Parsear com pdf-parse
    const pdfParse = require('pdf-parse');
    const data = await pdfParse.default(dataBuffer);

    console.log(`📄 PDF: ${path.basename(pdfPath)}`);
    console.log(`📊 Páginas: ${data.numpages}`);
    console.log(`📝 Caracteres: ${data.text.length}\n`);

    console.log('📋 TEXTO EXTRAÍDO:\n');
    console.log('═'.repeat(70));
    console.log(data.text);
    console.log('═'.repeat(70));

    console.log('\n✅ VALIDAÇÃO DE ESTRUTURA:\n');

    // Validar fragmentação
    const linhas = data.text.split('\n').filter(l => l.trim());
    console.log(`Total de linhas não-vazias: ${linhas.length}`);

    // Procurar por padrões de fragmentação
    const linhasUmasPalavra = linhas.filter(l => l.trim().split(' ').length === 1);
    console.log(`Linhas com UMA PALAVRA: ${linhasUmasPalavra.length}`);
    if (linhasUmasPalavra.length > 0) {
      console.log('  ⚠️  Possível fragmentação:');
      linhasUmasPalavra.slice(0, 5).forEach(l => console.log(`     "${l}"`));
    } else {
      console.log('  ✅ Nenhuma linha isolada com uma palavra');
    }

    // Procurar por frase teste
    const temFraseTeste = data.text.includes('Este é um parágrafo');
    console.log(`\nFrase teste presente: ${temFraseTeste ? '✅ SIM' : '❌ NÃO'}`);

    // Procurar por títulos
    const temTitulo = data.text.includes('Teste de Formatação');
    console.log(`Título presente: ${temTitulo ? '✅ SIM' : '❌ NÃO'}`);

    // Extrair primeira frase para análise
    const primeiraFrase = data.text.split('\n').find(l => l.includes('Este é um parágrafo'));
    if (primeiraFrase) {
      console.log(`\nPrimeira frase:\n  "${primeiraFrase}"`);
      console.log(`\nComprimento: ${primeiraFrase.length} caracteres`);
      console.log(`Contém "negrito": ${primeiraFrase.includes('negrito') ? '✅' : '❌'}`);
    }

    console.log('\n✨ ANÁLISE:');
    if (linhasUmasPalavra.length === 0 && temFraseTeste && primeiraFrase) {
      console.log('   ✅ SUCESSO — Sem fragmentação detectada no texto extraído');
      console.log('   ✅ Frase teste íntegra');
      console.log('   ✅ Conteúdo esperado presente\n');
      return true;
    } else {
      console.log('   ⚠️  Possível problema — revisar acima\n');
      return false;
    }

  } catch (err) {
    console.error('❌ Erro ao parsear PDF:', err.message);
    console.log('\n💡 Se erro for "Invalid PDF structure", o PDF pode estar corrompido.');
    console.log('   Verifique se foi gerado corretamente.\n');
    return false;
  }
}

validarPdfIsolado()
  .then(ok => {
    if (ok) {
      console.log('🎉 VALIDAÇÃO PASSOU — Próximo: confirmar visualmente e depois pipeline');
    } else {
      console.log('⚠️  VALIDAÇÃO COM POSSÍVEL PROBLEMA — Revisar acima');
    }
  })
  .catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
