const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  try {
    console.log('Verificando se tabelas existem...');
    
    // Tentar SELECT em creditos_sessao com limit 1
    const { data: creditosData, error: creditosError } = await supabase
      .from('creditos_sessao')
      .select('*')
      .limit(1);
    
    if (creditosError && creditosError.message.includes('relation')) {
      console.log('❌ Tabela creditos_sessao: NÃO EXISTE em produção');
      console.log('   Erro:', creditosError.message);
    } else if (creditosError) {
      console.log('⚠️  Tabela creditos_sessao: Pode existir, mas erro no acesso');
      console.log('   Erro:', creditosError.message);
    } else {
      console.log('✅ Tabela creditos_sessao: EXISTE e tem dados');
      console.log('   Registros encontrados:', creditosData.length);
    }

    // Tentar SELECT em respostas_questionario
    const { data: respostasData, error: respostasError } = await supabase
      .from('respostas_questionario')
      .select('*')
      .limit(1);
    
    if (respostasError && respostasError.message.includes('relation')) {
      console.log('❌ Tabela respostas_questionario: NÃO EXISTE em produção');
      console.log('   Erro:', respostasError.message);
    } else if (respostasError) {
      console.log('⚠️  Tabela respostas_questionario: Pode existir, mas erro no acesso');
      console.log('   Erro:', respostasError.message);
    } else {
      console.log('✅ Tabela respostas_questionario: EXISTE e tem dados');
      console.log('   Registros encontrados:', respostasData.length);
    }

  } catch (err) {
    console.error('Erro ao conectar:', err.message);
  }
}

checkTables();
