const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  try {
    console.log('Verificando tabelas...');
    
    // Tentar SELECT em creditos_sessao
    const { data: creditosData, error: creditosError } = await supabase
      .from('creditos_sessao')
      .select('COUNT(*)', { count: 'exact' })
      .limit(1);
    
    if (creditosError) {
      console.log('❌ Tabela creditos_sessao: NÃO EXISTE ou erro de acesso');
      console.log('   Erro:', creditosError.message);
    } else {
      console.log('✅ Tabela creditos_sessao: EXISTE e acessível');
    }

    // Tentar SELECT em respostas_questionario
    const { data: respostasData, error: respostasError } = await supabase
      .from('respostas_questionario')
      .select('COUNT(*)', { count: 'exact' })
      .limit(1);
    
    if (respostasError) {
      console.log('❌ Tabela respostas_questionario: NÃO EXISTE ou erro de acesso');
      console.log('   Erro:', respostasError.message);
    } else {
      console.log('✅ Tabela respostas_questionario: EXISTE e acessível');
    }

  } catch (err) {
    console.error('Erro ao conectar:', err.message);
  }
}

checkTables();
