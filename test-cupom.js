// Script de teste isolado para validarCupomSemMarcar
require('dotenv').config();

const { validarCupomSemMarcar } = require('./src/lib/cupons');

// TEST100 (usado antes como cupom de teste padrão) foi encerrado em
// 27/09/2026 (expira_em setado para o passado) — passe um código válido
// por argumento: node test-cupom.js CODIGO
const codigo = process.argv[2] || 'TEST100';

async function testar() {
  console.log('[TEST] Iniciando teste de validarCupomSemMarcar...');
  console.log('[TEST] SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ definida' : '✗ não definida');
  console.log('[TEST] SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✓ definida' : '✗ não definida');

  try {
    console.log(`\n[TEST] Chamando validarCupomSemMarcar("${codigo}")...`);
    const resultado = await validarCupomSemMarcar(codigo);
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
