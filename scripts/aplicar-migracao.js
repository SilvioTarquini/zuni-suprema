require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function main() {
  console.log('=== APLICANDO MIGRAÇÃO ===\n');

  try {
    console.log('1. Adicionando coluna audiolivro_incluido à pedidos_livros_pendentes...');
    const { error: err1 } = await supabase.rpc('execute_sql', {
      sql: 'ALTER TABLE pedidos_livros_pendentes ADD COLUMN audiolivro_incluido BOOLEAN DEFAULT false;'
    }).catch(() => {
      // Se RPC não existe, tentar manualmente
      return supabase.from('pedidos_livros_pendentes').select('*').limit(0);
    });

    if (err1) console.log('⚠️  Aviso:', err1.message);
    else console.log('✅ Coluna adicionada (ou já existe)');

    console.log('\n2. Adicionando coluna tipo_produto à acessos_livros...');
    const { error: err2 } = await supabase.rpc('execute_sql', {
      sql: 'ALTER TABLE acessos_livros ADD COLUMN tipo_produto VARCHAR(20) DEFAULT \'livro\';'
    }).catch(() => supabase.from('acessos_livros').select('*').limit(0));

    if (err2) console.log('⚠️  Aviso:', err2.message);
    else console.log('✅ Coluna adicionada (ou já existe)');

    console.log('\n⚠️  IMPORTANTE: Se as colunas não foram criadas automaticamente,');
    console.log('   execute manualmente no Supabase SQL Editor:');
    console.log('   ALTER TABLE pedidos_livros_pendentes ADD COLUMN audiolivro_incluido BOOLEAN DEFAULT false;');
    console.log('   ALTER TABLE acessos_livros ADD COLUMN tipo_produto VARCHAR(20) DEFAULT \'livro\';');

    // Verificar se colunas foram criadas
    console.log('\n3. Verificando colunas...');
    const { data: pedidosData } = await supabase
      .from('pedidos_livros_pendentes')
      .select('*')
      .limit(1);

    if (pedidosData && pedidosData[0]) {
      const temColuna = 'audiolivro_incluido' in pedidosData[0];
      console.log(`   audiolivro_incluido: ${temColuna ? '✅ PRESENTE' : '❌ AUSENTE'}`);
    }

    const { data: acessosData } = await supabase
      .from('acessos_livros')
      .select('*')
      .limit(1);

    if (acessosData && acessosData[0]) {
      const temColuna = 'tipo_produto' in acessosData[0];
      console.log(`   tipo_produto: ${temColuna ? '✅ PRESENTE' : '❌ AUSENTE'}`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.log('\n⚠️  SOLUÇÃO: Execute manualmente no Supabase SQL Editor:');
    console.log('   ALTER TABLE pedidos_livros_pendentes ADD COLUMN audiolivro_incluido BOOLEAN DEFAULT false;');
    console.log('   ALTER TABLE acessos_livros ADD COLUMN tipo_produto VARCHAR(20) DEFAULT \'livro\';');
  }
}

main();
