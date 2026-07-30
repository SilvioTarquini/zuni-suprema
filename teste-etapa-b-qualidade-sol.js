// TESTE ETAPA B (Qualidade do Conteúdo) — 3 Variações da Seção Sol
// Comparando prompt original vs prompt revisado

// process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-...'; // Removed: set via environment

async function testarQualidadeConteudo() {
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE ETAPA B — Qualidade do Conteúdo (Seção Sol)         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // ============================================================================
  // DADOS PARA TESTE (Ana Silva)
  // ============================================================================
  const userData = {
    nome: 'Ana Silva',
    dataNascimento: '1990-03-15',
    ascendente: 'Escorpião 23.5°',
    sol: 'Peixes 24.2°',
    lua: 'Touro 12.8°',
    mercurio: 'Áries 5.1°',
    venus: 'Gêmeos 18.6°',
    marte: 'Leão 15.3°',
    jupiter: 'Libra 8.7°',
    saturno: 'Capricórnio 2.4°',
    urano: 'Capricórnio 16.9°',
    netuno: 'Sagitário 11.2°',
    plutao: 'Escorpião 28.5°',
    aspectos: [
      'Sol Trígono Lua (harmonia emoção-identidade)',
      'Ascendente Quadratura Marte (impulso vs. imagem)',
      'Vênus Conjunção Mercúrio (expressão + relacionamento)',
      'Saturno Oposição Lua (estrutura vs. emoção)'
    ],
    caminhoDeVida: 7,
    essencia: 5,
    contexto: 'Busca entender padrões de pressão e desempenho no trabalho. Sente-se esgotada com demandas, mas também é auto-exigente.'
  };

  // ============================================================================
  // PROMPT ORIGINAL (Genérico, estruturado em molde rígido)
  // ============================================================================
  const PROMPT_ORIGINAL = `Você é um astrólogo profissional gerando um Mapa Integrado ZUNI Suprema.

Analise o Sol da pessoa com base nos dados fornecidos. Estruture assim:

## Sol em [Signo]
[Posição no signo e características]

Contexto de vida:
[Como isso se manifesta no contexto apresentado]

Dádiva:
[Potencial positivo]

Ponto de atenção:
[Desafio ou sombra]

Use dados reais, não especule. Inclua **negrito** para termos importantes.`;

  // ============================================================================
  // PROMPT REVISADO (Síntese de padrões, integração de aspectos, estrutura flexível)
  // ============================================================================
  const PROMPT_REVISADO = `Você é um astrólogo profissional gerando um Mapa Integrado ZUNI Suprema.

TAREFA: Analise o Sol desta pessoa com profundidade. NÃO produza um template fixo — sintetize os 2-3 padrões MAIS SIGNIFICATIVOS que emergem quando você considera:

1. A posição do Sol no signo (identidade nuclear, vontade consciente)
2. Como os aspectos do Sol (Trígono com Lua, etc.) MODIFICAM ou COMPLEXIFICAM essa energia base
3. A tensão/harmonia entre essa identidade e o contexto de vida real da pessoa

Estruture com flexibilidade:
- Comece pela essência do Sol, mas já considerando o primeiro aspecto relevante
- Explore um padrão em profundidade, depois o próximo
- Use variação: não precisa seguir "Dádiva / Ponto de atenção" — pode ser uma exploração orgânica
- Evite estrutura repetitiva ou mecânica

Temas a explorar (nem todos, escolha os mais relevantes):
- Identidade e propósito (não apenas "desempenho")
- Criatividade, expressão, autenticidade
- Relacionamentos (como se apresenta, se conecta)
- Integração de sombras ou dualidades
- Crescimento e aprendizado de vida

Lembre: este é um RELATÓRIO DE PRODUTO (R$147), não uma sessão. Soe genuinamente perspicaz, não mecânico.`;

  // ============================================================================
  // VARIAÇÃO CRIATIVA (Mais exploração narrativa, menos listas)
  // ============================================================================
  const PROMPT_CRIATIVO = `Você é um astrólogo profissional criando um Mapa Integrado ZUNI Suprema.

TAREFA: Analise o Sol de forma NARRATIVA e EXPLORATÓRIA. Comece com a essência, mas permita que os dados guiem você para descobertas:

Estrutura sugerida (não obrigatória):
- Parágrafo 1: A essência do Sol no signo + como ela se manifesta no corpo, fala, presença
- Parágrafo 2: Explore um aspecto ou tensão emergente (use os aspectos fornecidos para profundidade real)
- Parágrafo 3: O que essa combinação revela sobre como a pessoa se vê, como quer ser vista, e onde há conflito ou crescimento potencial

Proíbido:
- Estrutura "Dádiva / Ponto de atenção" ou similar (muito template)
- Focar em "carreira/trabalho" repetidamente
- Tratar cada planeta isoladamente sem síntese

Permitido:
- Conectar múltiplos elementos (Sol + aspectos + contexto) na mesma frase
- Deixar a exploração ser mais profunda e menos didática
- Variar o tom e a estrutura conforme o que emerge dos dados`;

  // Dados de entrada para Claude
  const userInput = `Nome: ${userData.nome}
Data: ${userData.dataNascimento}

Dados Astrológicos:
- Ascendente: ${userData.ascendente}
- Sol: ${userData.sol}
- Lua: ${userData.lua}
- Mercúrio: ${userData.mercurio}
- Vênus: ${userData.venus}
- Marte: ${userData.marte}
- Júpiter: ${userData.jupiter}
- Saturno: ${userData.saturno}
- Urano: ${userData.urano}
- Netuno: ${userData.netuno}
- Plutão: ${userData.plutao}

Aspectos principais (relevantes para entender combinações):
${userData.aspectos.map(a => `- ${a}`).join('\n')}

Números de vida:
- Caminho de Vida: ${userData.caminhoDeVida}
- Essência: ${userData.essencia}

Contexto de vida:
${userData.contexto}

Gere APENAS a análise do Sol (nenhuma outra seção). Use **negrito** para destacar termos importantes.`;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('VARIAÇÃO 1: PROMPT ORIGINAL (Estrutura Rígida)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const resp1 = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: PROMPT_ORIGINAL,
      messages: [{ role: 'user', content: userInput }]
    });
    const texto1 = resp1.content[0].text;
    console.log(texto1);
    console.log('\n✓ Tokens usados:', resp1.usage.input_tokens + resp1.usage.output_tokens);
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('VARIAÇÃO 2: PROMPT REVISADO (Síntese + Flexibilidade)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const resp2 = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: PROMPT_REVISADO,
      messages: [{ role: 'user', content: userInput }]
    });
    const texto2 = resp2.content[0].text;
    console.log(texto2);
    console.log('\n✓ Tokens usados:', resp2.usage.input_tokens + resp2.usage.output_tokens);
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('VARIAÇÃO 3: PROMPT CRIATIVO (Narrativa Exploratória)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const resp3 = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: PROMPT_CRIATIVO,
      messages: [{ role: 'user', content: userInput }]
    });
    const texto3 = resp3.content[0].text;
    console.log(texto3);
    console.log('\n✓ Tokens usados:', resp3.usage.input_tokens + resp3.usage.output_tokens);
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('ANÁLISE DE QUALIDADE');
  console.log('═════════════════════════════════════════════════════════════\n');
  console.log('Critérios para comparação:');
  console.log('  1. Estrutura: Flexível vs. Rígida/Template');
  console.log('  2. Síntese: Usa aspectos para profundidade real?');
  console.log('  3. Temas: Diversidade (propósito, relacionamento, etc.) ou foco em trabalho?');
  console.log('  4. Tom: Genuíno e perspicaz vs. Mecânico/Preenchimento');
  console.log('  5. Integração: Combina múltiplos elementos na mesma exploração?\n');
}

testarQualidadeConteudo().catch(console.error);
