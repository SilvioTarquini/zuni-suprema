const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function verificarChunks() {
  try {
    // Query 1: Contar chunks do livro de degustação
    const { data: countData, error: countError } = await supabase
      .from('documentos')
      .select('id', { count: 'exact', head: true })
      .eq('livro_id', 'os-bastidores-da-mente-1-degustacao');

    if (countError) {
      console.error('Erro ao contar chunks:', countError);
      process.exit(1);
    }

    console.log('═════════════════════════════════════════');
    console.log('VERIFICAÇÃO DE CHUNKS DO MÓDULO D');
    console.log('═════════════════════════════════════════\n');
    console.log(`Livro ID utilizado: os-bastidores-da-mente-1-degustacao`);
    console.log(`Total de chunks indexados: ${countData ? countData.length : 'erro'}\n`);

    // Query 2: Listar os chunks com detalhes
    const { data: chunks, error: chunkError } = await supabase
      .from('documentos')
      .select('id, titulo, categoria, livro_id')
      .eq('livro_id', 'os-bastidores-da-mente-1-degustacao')
      .order('id');

    if (chunkError) {
      console.error('Erro ao listar chunks:', chunkError);
      process.exit(1);
    }

    console.log('Chunks detalhados:');
    console.log('─────────────────────────────────────────');
    chunks.forEach((chunk, i) => {
      console.log(`${i + 1}. [${chunk.categoria}] ${chunk.titulo}`);
    });

    console.log('\n═════════════════════════════════════════');
    console.log(`✅ Total confirmado: ${chunks.length} chunks`);
    console.log('═════════════════════════════════════════');

    process.exit(0);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

verificarChunks();
