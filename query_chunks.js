const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function queryChunks() {
  console.log('=== CASO 1: administracao_empresarial_inteligente ===\n');
  
  const { data, error } = await supabase
    .from('documentos')
    .select('titulo, corpo')
    .eq('tema', 'administracao_empresarial_inteligente')
    .limit(3);

  if (error) {
    console.log('Erro:', error.message);
  } else if (data && data.length > 0) {
    console.log(`Encontrados ${data.length} chunks com tema 'administracao_empresarial_inteligente':\n`);
    data.forEach((chunk, idx) => {
      console.log(`[${idx + 1}] Título: ${chunk.titulo}`);
      console.log(`    Preview: ${chunk.corpo.substring(0, 300)}...\n`);
    });
  } else {
    console.log('Nenhum chunk encontrado com tema "administracao_empresarial_inteligente"\n');
  }

  console.log('\n=== CASO 2: sentimentos_adolescencia ===\n');
  
  const { data: data2, error: error2 } = await supabase
    .from('documentos')
    .select('titulo, corpo')
    .eq('tema', 'sentimentos_adolescencia')
    .limit(3);

  if (error2) {
    console.log('Erro:', error2.message);
  } else if (data2 && data2.length > 0) {
    console.log(`Encontrados ${data2.length} chunks com tema 'sentimentos_adolescencia':\n`);
    data2.forEach((chunk, idx) => {
      console.log(`[${idx + 1}] Título: ${chunk.titulo}`);
      console.log(`    Preview: ${chunk.corpo.substring(0, 300)}...\n`);
    });
  } else {
    console.log('Nenhum chunk encontrado com tema "sentimentos_adolescencia"\n');
  }

  console.log('\n=== CASO 3: educar_filhos ===\n');
  
  const { data: data3, error: error3 } = await supabase
    .from('documentos')
    .select('titulo, corpo')
    .eq('tema', 'educar_filhos')
    .limit(3);

  if (error3) {
    console.log('Erro:', error3.message);
  } else if (data3 && data3.length > 0) {
    console.log(`Encontrados ${data3.length} chunks com tema 'educar_filhos':\n`);
    data3.forEach((chunk, idx) => {
      console.log(`[${idx + 1}] Título: ${chunk.titulo}`);
      console.log(`    Preview: ${chunk.corpo.substring(0, 300)}...\n`);
    });
  } else {
    console.log('Nenhum chunk encontrado com tema "educar_filhos"\n');
  }
}

queryChunks();
