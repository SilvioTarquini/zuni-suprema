const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function verificarIndex() {
  console.log('🔍 Verificando indexação dos novos temas no Supabase...\n');

  try {
    const { data, error } = await supabase
      .from('documentos')
      .select('tema')
      .in('tema', ['elegancia_charme_feminino', 'elegancia_presenca_masculina']);

    if (error) {
      console.error('❌ Erro na query:', error.message);
      process.exit(1);
    }

    const contagem = {};
    data.forEach(row => {
      if (!contagem[row.tema]) {
        contagem[row.tema] = 0;
      }
      contagem[row.tema]++;
    });

    console.log('════════════════════════════════════════════════════════');
    console.log('RESULTADO DA QUERY:');
    console.log('SELECT tema, COUNT(*) FROM documentos');
    console.log('WHERE tema IN (\'elegancia_charme_feminino\',\'elegancia_presenca_masculina\')');
    console.log('GROUP BY tema;');
    console.log('════════════════════════════════════════════════════════\n');

    let totalChunks = 0;
    Object.entries(contagem).forEach(([tema, count]) => {
      console.log(`${tema} | ${count}`);
      totalChunks += count;
    });

    console.log('\n════════════════════════════════════════════════════════');
    console.log(`✅ Total de chunks indexados: ${totalChunks}`);
    console.log('════════════════════════════════════════════════════════\n');

    if (contagem['elegancia_charme_feminino'] === 174 && contagem['elegancia_presenca_masculina'] === 58) {
      console.log('✅ PERFEITO! Indexação 100% completa e confirmada!');
      process.exit(0);
    } else {
      console.log('⚠️  AVISO: Contagem não bate exatamente com o esperado.');
      console.log(`   Esperado: elegancia_charme_feminino=174, elegancia_presenca_masculina=58`);
      console.log(`   Encontrado: elegancia_charme_feminino=${contagem['elegancia_charme_feminino'] || 0}, elegancia_presenca_masculina=${contagem['elegancia_presenca_masculina'] || 0}`);
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Erro fatal:', err.message);
    process.exit(1);
  }
}

verificarIndex();
