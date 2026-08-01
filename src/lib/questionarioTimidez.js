// lib/questionarioTimidez.js
// Geração de Resposta A (abertura do Mentor com base nas respostas)
// e Resposta B (resumo técnico para equipe — sob demanda)

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Gera a Resposta A — mensagem de abertura do Mentor ZUNI com base nas
 * respostas do formulário. Essa mensagem aparecerá como a primeira fala
 * do Mentor no chat, como se ele já tivesse entendido a situação.
 *
 * @param {Object} respostas - objeto com as respostas do questionário
 * @param {string} tema - tema/slug do questionário (ex: 'timidez_comunicacao', 'bullying')
 * @param {string} titulo - título do questionário (ex: 'Timidez e Comunicação')
 * @returns {Promise<string>} - a mensagem de abertura do Mentor
 */
async function gerarRespostaA(respostas, tema = null, titulo = null) {
  const tituloDoTema = titulo || 'este tema';
  const promptSistema = `Com base nas respostas do formulário abaixo sobre "${tituloDoTema}", gere a mensagem de abertura do Mentor ZUNI para esta pessoa. Não mencione que houve um formulário. Fale como se já tivesse entendido a situação dela. Use tom acolhedor, direto, sem termos técnicos ou fisiológicos. Termine convidando a pessoa a continuar a partir daí.

Respostas fornecidas (em JSON):
${JSON.stringify(respostas, null, 2)}

Gere uma mensagem natural, como se fosse a saudação genuína do Mentor ao iniciar a conversa.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: promptSistema,
    messages: [
      {
        role: 'user',
        content: 'Gere a mensagem de abertura do Mentor ZUNI com base nas respostas acima.',
      },
    ],
  });

  if (!message.content || message.content.length === 0) {
    console.error('[questionarioTimidez] Erro: message.content vazio', message);
    return '';
  }

  // Procura pelo primeiro bloco de texto (pode haver bloco de thinking antes)
  const textBlock = message.content.find(block => block.type === 'text');
  const respostaA = textBlock ? textBlock.text : '';
  return respostaA;
}

/**
 * Gera a Resposta B — resumo técnico estruturado para a equipe de
 * acompanhamento profissional. NUNCA deve ser exposto ao cliente.
 * Chamada sob demanda (quando cliente pedir encaminhamento humano).
 *
 * @param {Object} respostas - objeto com as respostas do questionário
 * @param {string} tema - tema/slug do questionário (ex: 'timidez_comunicacao', 'bullying')
 * @param {string} titulo - título do questionário (ex: 'Timidez e Comunicação')
 * @returns {Promise<string>} - o resumo técnico estruturado
 */
async function gerarRespostaB(respostas, tema = null, titulo = null) {
  const tituloDoTema = titulo || 'este tema';
  const promptSistema = `Gere um resumo técnico estruturado das respostas abaixo sobre "${tituloDoTema}", para uso interno da equipe de acompanhamento humano. NÃO gere diagnóstico nem parecer clínico definitivo — gere pontos de observação e hipóteses a investigar, com base apenas nos dados fornecidos.

Formato esperado (adapte conforme necessário):
- Tema central e intensidade percebida
- Duração e padrão temporal relatado
- Sintomas/manifestações relatadas
- Tentativas anteriores e resultado
- Expectativa da pessoa em relação à ajuda
- Padrões ou sinais que merecem atenção na primeira conversa
- Perguntas sugeridas para aprofundar na primeira sessão

Respostas fornecidas (em JSON):
${JSON.stringify(respostas, null, 2)}

Evite qualquer linguagem de diagnóstico. O objetivo é acelerar a escuta qualificada do profissional, não substituí-la.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: promptSistema,
    messages: [
      {
        role: 'user',
        content: 'Gere o resumo técnico estruturado com base nas respostas acima.',
      },
    ],
  });

  if (!message.content || message.content.length === 0) {
    console.error('[questionarioTimidez] Erro: message.content vazio', message);
    return '';
  }

  // Procura pelo primeiro bloco de texto (pode haver bloco de thinking antes)
  const textBlock = message.content.find(block => block.type === 'text');
  const respostaB = textBlock ? textBlock.text : '';
  return respostaB;
}

module.exports = { gerarRespostaA, gerarRespostaB };
