// teste-questionario-debug.js
// Teste com debug detalhado para verificar chamadas à Claude API

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const respostaTeste = {
  q1: 'Puxar conversa ou me aproximar de pessoas novas',
  q2: 'Começou na adolescência',
  q3: 'Coração acelerado, mãos suando',
  q4: 'Já tentei sozinho(a)',
  q5: 'Entender por que sou assim'
};

async function testar() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TESTE DE DEBUG: Verificando resposta da Claude API');
  console.log('═══════════════════════════════════════════════════════════\n');

  const promptSistema = `Com base nas respostas do formulário abaixo, gere a mensagem de abertura do Mentor ZUNI para esta pessoa. Não mencione que houve um formulário. Fale como se já tivesse entendido a situação dela. Use tom acolhedor, direto, sem termos técnicos ou fisiológicos. Termine convidando a pessoa a continuar a partir daí.

Respostas fornecidas (em JSON):
${JSON.stringify(respostaTeste, null, 2)}

Gere uma mensagem natural, como se fosse a saudação genuína do Mentor ao iniciar a conversa.`;

  console.log('📤 Enviando request para Claude API...\n');

  try {
    const message = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 500,
      system: promptSistema,
      messages: [
        {
          role: 'user',
          content: 'Gere a mensagem de abertura do Mentor ZUNI com base nas respostas acima.',
        },
      ],
    });

    console.log('📥 Response recebida da API\n');
    console.log('Status:', message.stop_reason);
    console.log('Modelo:', message.model);
    console.log('Tokens:', { input: message.usage.input_tokens, output: message.usage.output_tokens });
    console.log('\n');

    console.log('Content array:', message.content);
    console.log('Tipo do content[0]:', message.content[0]?.type);
    console.log('\n');

    if (message.content && message.content[0] && message.content[0].type === 'text') {
      console.log('✅ RESPOSTA A GERADA COM SUCESSO:\n');
      console.log(message.content[0].text);
      console.log('\n' + '═'.repeat(60) + '\n');
    } else {
      console.error('❌ Erro: content não tem estrutura esperada');
      console.error(JSON.stringify(message.content, null, 2));
    }

  } catch (error) {
    console.error('❌ ERRO ao chamar Claude API:');
    console.error(error.message);
    if (error.error) {
      console.error('Detalhes:', error.error);
    }
    process.exit(1);
  }
}

testar();
