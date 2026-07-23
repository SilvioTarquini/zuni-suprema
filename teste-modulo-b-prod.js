require('dotenv').config();
const astrologia = require('./src/lib/astrologia-b.js');

async function testar() {
  try {
    console.log('\n✅ TESTE MÓDULO B — ÁRIES EM PRODUÇÃO\n');
    console.log('='.repeat(80));

    const resultado = await astrologia.buscarInterpretacaoSigno('Áries');

    console.log(`\n📊 Tamanho: ${resultado.length} caracteres\n`);
    console.log(`📄 Conteúdo retornado:\n`);
    console.log(resultado);

    console.log(`\n${'='.repeat(80)}\n`);

    // Identificar qual bloco é
    if (resultado.includes('gesto de começar')) {
      console.log(`✅ NOVO BLOCO: "[ÁRIES — TEMPERAMENTO]" (expandido)`);
      console.log(`   Caracteres: ${resultado.length} (vs 490 do antigo)`);
      console.log(`   Status: ✅ PRODUÇÃO RETORNANDO NOVO CONTEÚDO`);
    } else if (resultado.includes('tradicionalmente associado')) {
      console.log(`❌ BLOCO ANTIGO: "[ARIES - TEMPERAMENTO E ENERGIA]"`);
    } else {
      console.log(`⚠️ CONTEÚDO NÃO IDENTIFICADO`);
    }

  } catch (err) {
    console.error(`❌ Erro: ${err.message}`);
    process.exit(1);
  }
  process.exit(0);
}

testar();
