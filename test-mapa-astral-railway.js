// Teste de mapa astral via lib/astro.js com chave do Railway

const astro = require('./src/lib/astro.js');

async function testar() {
  console.log('=== TESTE DE MAPA ASTRAL (Railway) ===\n');

  const dadosTeste = {
    nome: 'Ana Silva',
    dataNascimento: '1990-05-15',
    horaNascimento: '14:30',
    localNascimento: 'São Paulo, Brasil'
  };

  try {
    console.log('Dados:', JSON.stringify(dadosTeste, null, 2));
    console.log('\nCalculando mapa natal...\n');

    const resultado = await astro.calcularMapaNatal(dadosTeste);

    console.log('✅ SUCESSO!\n');
    console.log('Resultado completo:');
    console.log(JSON.stringify(resultado, null, 2));

  } catch (erro) {
    console.error('❌ ERRO:', erro.message);
    process.exit(1);
  }
}

testar();
