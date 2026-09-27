// Script de teste: simular o endpoint completo
require('dotenv').config();

const { validarCupomSemMarcar, calcularDesconto } = require('./src/lib/cupons');
const { buscarLivro } = require('./src/lib/catalogoLivros');

// TEST100 (usado antes como cupom de teste padrão) foi encerrado em
// 27/09/2026 (expira_em setado para o passado) — passe um código válido
// por argumento: node test-cupom2.js CODIGO
const codigo = process.argv[2] || 'TEST100';

async function testar() {
  console.log('[TEST] === Teste 1: Sem livroId ===');
  try {
    const cupom = await validarCupomSemMarcar(codigo);
    console.log('[TEST] Cupom:', cupom);
    if (cupom) {
      console.log('[TEST] Resultado:', { valido: true, tipo: cupom.tipo, percentual: cupom.percentual, teto_reais: cupom.teto_reais });
    }
  } catch (err) {
    console.error('[TEST] ERRO:', err.message);
  }

  console.log('\n[TEST] === Teste 2: Com livroId (simulando chamada com livro) ===');
  try {
    const cupom = await validarCupomSemMarcar(codigo);
    console.log('[TEST] Cupom validado:', cupom);

    if (cupom) {
      // Simular com um livroId aleatório
      const livroId = 'livro-teste-123';
      console.log('[TEST] Buscando livro:', livroId);
      const livro = buscarLivro(livroId);
      console.log('[TEST] Livro encontrado:', livro);

      if (livro) {
        console.log('[TEST] Calculando desconto...');
        const desconto = calcularDesconto(livro, cupom);
        console.log('[TEST] Desconto calculado:', desconto);
      } else {
        console.log('[TEST] Livro NÃO encontrado');
      }
    }
  } catch (err) {
    console.error('[TEST] ERRO:', err.message);
    console.error('[TEST] Stack:', err.stack);
  }

  process.exit(0);
}

testar();
