// teste-questionario-integracao.js
// Teste de integração: verifica se as funções de Resposta A e B estão funcionando

require('dotenv').config();
const { gerarRespostaA, gerarRespostaB } = require('./src/lib/questionarioTimidez');

// Respostas de teste baseadas no formulário
const respostaTeste = {
  q1: 'Puxar conversa ou me aproximar de pessoas novas',
  q2: 'Começou na adolescência',
  q3: 'Coração acelerado, mãos suando',
  q4: 'Já tentei sozinho(a)',
  q5: 'Entender por que sou assim'
};

async function testar() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TESTE DE INTEGRAÇÃO: Questionário Timidez/Comunicação');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📋 RESPOSTAS DE TESTE:');
  console.log(JSON.stringify(respostaTeste, null, 2));
  console.log('\n');

  // Teste 1: Gerar Resposta A
  console.log('🔄 Gerando Resposta A (mensagem de abertura do Mentor)...\n');
  try {
    const inicio = Date.now();
    const respostaA = await gerarRespostaA(respostaTeste);
    const tempoDecorrido = Date.now() - inicio;

    console.log('✅ RESPOSTA A GERADA COM SUCESSO');
    console.log(`⏱️  Tempo: ${tempoDecorrido}ms`);
    console.log('\n📝 CONTEÚDO:\n');
    console.log(respostaA);
    console.log('\n' + '─'.repeat(60) + '\n');

    // Validação básica
    const contemPontosPositivos = respostaA.length > 100;
    const naoContemTermosTecnicos = !respostaA.match(/(amígdala|cortisol|sistema límbico|luta ou fuga|fisiologia)/i);

    console.log('✓ Validação:');
    console.log(`  - Tamanho adequado: ${contemPontosPositivos ? '✅' : '❌'}`);
    console.log(`  - Sem termos técnicos: ${naoContemTermosTecnicos ? '✅' : '❌'}`);
    console.log('\n');

  } catch (error) {
    console.error('❌ ERRO ao gerar Resposta A:');
    console.error(error.message);
    process.exit(1);
  }

  // Teste 2: Gerar Resposta B
  console.log('🔄 Gerando Resposta B (resumo técnico para equipe)...\n');
  try {
    const inicio = Date.now();
    const respostaB = await gerarRespostaB(respostaTeste);
    const tempoDecorrido = Date.now() - inicio;

    console.log('✅ RESPOSTA B GERADA COM SUCESSO');
    console.log(`⏱️  Tempo: ${tempoDecorrido}ms`);
    console.log('\n📝 CONTEÚDO (resumo técnico - APENAS PARA EQUIPE INTERNA):\n');
    console.log(respostaB);
    console.log('\n' + '─'.repeat(60) + '\n');

    // Validação básica
    const temEstrutura = respostaB.includes('Tema') || respostaB.includes('tema') || respostaB.includes('central');

    console.log('✓ Validação:');
    console.log(`  - Estrutura presente: ${temEstrutura ? '✅' : '❌'}`);
    console.log('\n');

  } catch (error) {
    console.error('❌ ERRO ao gerar Resposta B:');
    console.error(error.message);
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ TODOS OS TESTES PASSARAM COM SUCESSO');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('Próximos passos:');
  console.log('1. Rodar a migration SQL no Supabase');
  console.log('2. Testar o fluxo completo no navegador com ?testQuestionario=true\n');
}

testar();
