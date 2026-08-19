require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function main() {
  console.log('=== VERIFICANDO ESTRUTURA DAS TABELAS ===\n');

  console.log('1. Estrutura de pedidos_livros_pendentes:');
  const { data: pedidosData, error: pedidosError } = await supabase
    .from('pedidos_livros_pendentes')
    .select('*')
    .limit(1);

  if (pedidosError) {
    console.error('❌ Erro:', pedidosError.message);
  } else if (pedidosData && pedidosData[0]) {
    console.log('✅ Colunas:', Object.keys(pedidosData[0]).join(', '));
    console.log('   audiolivro_incluido presente?', 'audiolivro_incluido' in pedidosData[0] ? '✅ SIM' : '❌ NÃO');
  } else {
    console.log('⚠️  Tabela vazia (verificar schema via Supabase console)');
  }

  console.log('\n2. Estrutura de acessos_livros:');
  const { data: acessosData, error: acessosError } = await supabase
    .from('acessos_livros')
    .select('*')
    .limit(1);

  if (acessosError) {
    console.error('❌ Erro:', acessosError.message);
  } else if (acessosData && acessosData[0]) {
    console.log('✅ Colunas:', Object.keys(acessosData[0]).join(', '));
  } else {
    console.log('⚠️  Tabela vazia');
  }
}

main().catch(console.error);
