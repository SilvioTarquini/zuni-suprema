const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDistribution() {
  const { data, error } = await supabase
    .from('documentos')
    .select('tema')
    .not('tema', 'is', null);

  if (error) {
    console.log('Erro:', error.message);
    return;
  }

  // Contar por tema
  const counts = {};
  data.forEach(row => {
    counts[row.tema] = (counts[row.tema] || 0) + 1;
  });

  // Ordenar por total descendente
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  console.log('=== DISTRIBUIÇÃO DE CHUNKS POR TEMA ===\n');
  console.log('tema | total_chunks');
  console.log('-----|-------------');
  sorted.forEach(([tema, total]) => {
    console.log(`${tema.padEnd(40)} | ${total}`);
  });

  console.log(`\nTotal de temas: ${sorted.length}`);
  console.log(`Total de chunks: ${data.length}`);
}

checkDistribution();
