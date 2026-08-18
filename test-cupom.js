// Script de teste isolado para validarCupomSemMarcar
require('dotenv').config();

const { validarCupomSemMarcar } = require('./src/lib/cupons');

async function testar() {
  console.log('[TEST] Iniciando teste de validarCupomSemMarcar...');
  console.log('[TEST] SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ definida' : '✗ não definida');
  console.log('[TEST] SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✓ definida' : '✗ não definida');

  try {
    console.log('\n[TEST] Chamando validarCupomSemMarcar("TEST100")...');
    const resultado = await validarCupomSemMarcar('TEST100');
    console.log('[TEST] Resultado:', resultado);
  } catch (err) {
    console.error('[TEST] ERRO CAPTURADO:');
    console.error('[TEST] Mensagem:', err.message);
    console.error('[TEST] Stack:', err.stack);
    console.error('[TEST] Tipo:', err.constructor.name);
    console.error('[TEST] Objeto completo:', JSON.stringify(err, null, 2));
  }

  process.exit(0);
}

testar();
