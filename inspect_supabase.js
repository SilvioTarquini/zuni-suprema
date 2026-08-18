const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  try {
    console.log('=== CREDITOS_SESSAO ===');
    const { data: creditos, error: creditosErr } = await supabase
      .from('creditos_sessao')
      .select('*');
    
    if (creditosErr) {
      console.log('Erro:', creditosErr.message);
    } else {
      console.log(`Total de registros: ${creditos.length}`);
      creditos.forEach((row, idx) => {
        console.log(`\n[${idx + 1}] Pacote ID: ${row.pacote_id}`);
        console.log(`    Email: ${row.email}`);
        console.log(`    Créditos: ${row.creditos_restantes}/${row.creditos_iniciais}`);
        console.log(`    Válido até: ${row.expira_em}`);
        console.log(`    Questionário respondido: ${row.questionario_respondido}`);
        console.log(`    Criado: ${row.created_at}`);
      });
    }

    console.log('\n=== RESPOSTAS_QUESTIONARIO ===');
    const { data: respostas, error: respostasErr } = await supabase
      .from('respostas_questionario')
      .select('*');
    
    if (respostasErr) {
      console.log('Erro:', respostasErr.message);
    } else {
      console.log(`Total de registros: ${respostas.length}`);
      respostas.forEach((row, idx) => {
        console.log(`\n[${idx + 1}] Session ID: ${row.session_id}`);
        console.log(`    Tema: ${row.tema}`);
        console.log(`    Pacote ID: ${row.pacote_id || '(nenhum)'}`);
        console.log(`    Respondido em: ${row.respondido_em}`);
      });
    }

  } catch (err) {
    console.error('Erro:', err.message);
  }
}

inspect();
