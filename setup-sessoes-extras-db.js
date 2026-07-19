/**
 * Setup automático do banco para Sessões Extras
 * Executa o SQL de criação de tabelas via Supabase
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_KEY não estão configurados');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function setupTables() {
  console.log('🔧 Setup de Banco para Sessões Extras\n');

  try {
    // Tentar verificar se tabelas existem
    console.log('🔍 Verificando se tabelas existem...\n');

    const { error: errorCreditos } = await supabase
      .from('creditos_sessao')
      .select('*')
      .limit(1);

    const { error: errorResumos } = await supabase
      .from('resumos_sessoes')
      .select('*')
      .limit(1);

    if (!errorCreditos && !errorResumos) {
      console.log('✅ Ambas as tabelas já existem!');
      console.log('   • creditos_sessao ✅');
      console.log('   • resumos_sessoes ✅');
      console.log('\n🚀 Banco pronto para testar Sessões Extras!\n');
      return;
    }

    if (!errorCreditos && errorResumos?.code === 'PGRST116') {
      console.log('✅ Tabela creditos_sessao existe');
      console.log('⚠️  Tabela resumos_sessoes NÃO existe');
    }

    if (errorCreditos?.code === 'PGRST116' && !errorResumos) {
      console.log('⚠️  Tabela creditos_sessao NÃO existe');
      console.log('✅ Tabela resumos_sessoes existe');
    }

    if (errorCreditos?.code === 'PGRST116' && errorResumos?.code === 'PGRST116') {
      console.log('⚠️  Nenhuma tabela existe\n');
    }

    console.log('\n📍 Para criar as tabelas manualmente:');
    console.log('1️⃣  Acesse: https://app.supabase.com');
    console.log('2️⃣  Vá para: SQL Editor → New Query');
    console.log('3️⃣  Execute o SQL em: SESSOES_EXTRAS_SETUP.md');
    console.log('4️⃣  Volte aqui e execute: node testar-sessoes-extras.js\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

setupTables();
