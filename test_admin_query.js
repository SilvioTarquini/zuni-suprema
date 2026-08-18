const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('=== TEST: Admin Empresa Query ===');
console.log('URL:', supabaseUrl ? '✓ carregada' : '✗ FALTANDO');
console.log('KEY:', supabaseKey ? '✓ carregada' : '✗ FALTANDO');

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    // Primeiro: contar total de documentos
    const { count: totalCount } = await supabase
      .from('documentos')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Total de documentos no banco: ${totalCount}`);

    // Segundo: contar por tema (sem filtro específico, só verificar distribuição)
    const { data: allData } = await supabase
      .from('documentos')
      .select('tema')
      .limit(1000);

    const temaCount = {};
    (allData || []).forEach(row => {
      temaCount[row.tema] = (temaCount[row.tema] || 0) + 1;
    });

    console.log('\n📋 Distribuição de temas (primeiros 1000):');
    Object.entries(temaCount).sort((a, b) => b[1] - a[1]).forEach(([tema, count]) => {
      console.log(`  ${tema}: ${count}`);
    });

    // Terceiro: query específica para administracao_empresarial_inteligente
    console.log('\n🔍 Buscando "administracao_empresarial_inteligente"...');
    const { data, error } = await supabase
      .from('documentos')
      .select('titulo, corpo')
      .eq('tema', 'administracao_empresarial_inteligente')
      .limit(8);

    if (error) {
      console.error('❌ ERRO:', error.message);
    } else if (!data || data.length === 0) {
      console.log('⚠️ NENHUM CHUNK ENCONTRADO para este tema');
    } else {
      console.log(`✅ ${data.length} chunks encontrados:\n`);
      data.forEach((doc, idx) => {
        const preview = (doc.corpo || '').substring(0, 300).replace(/\n/g, ' ');
        console.log(`[${idx + 1}] ${doc.titulo}`);
        console.log(`    ${preview}...\n`);
      });
    }

  } catch (err) {
    console.error('❌ ERRO CRÍTICO:', err.message);
  }
})();
