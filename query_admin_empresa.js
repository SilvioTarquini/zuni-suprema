const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('[DEBUG] Iniciando query...');
console.log('[DEBUG] SUPABASE_URL presente?', !!supabaseUrl);
console.log('[DEBUG] SUPABASE_KEY presente?', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_KEY não encontrados em .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('[DEBUG] Cliente Supabase criado');

async function queryAdminEmpresa() {
  try {
    console.log('[DEBUG] Executando query na tabela documentos...');

    const { data, error } = await supabase
      .from('documentos')
      .select('titulo, corpo')
      .eq('tema', 'administracao_empresarial_inteligente')
      .order('titulo')
      .limit(8);

    console.log('[DEBUG] Query concluída');

    if (error) {
      console.error('❌ Erro na query:', error.message);
      console.error('[DEBUG] Error details:', error);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('⚠️ Nenhum chunk encontrado para tema "administracao_empresarial_inteligente"');
      process.exit(0);
    }

    console.log(`\n📊 ${data.length} chunks encontrados para "administracao_empresarial_inteligente":\n`);

    data.forEach((doc, idx) => {
      const preview = doc.corpo.substring(0, 500).replace(/\n/g, ' ');
      console.log(`\n[${idx + 1}] TÍTULO: ${doc.titulo}`);
      console.log(`PREVIEW: ${preview}...\n`);
    });

  } catch (err) {
    console.error('❌ Erro ao conectar:', err.message);
    console.error('[DEBUG] Stack:', err.stack);
    process.exit(1);
  }
}

queryAdminEmpresa();
