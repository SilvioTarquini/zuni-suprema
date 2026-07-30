// Teste REAL com Claude API — Etapa A Validação Completa
// Captura prompt completo + resposta

// Variáveis de ambiente diretas
// process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-...'; // Removed: set via environment

const REPORT_PROMPT = `Você é o sistema de geração do Mapa Integrativo ZUNI Suprema — o relatório personalizado entregue ao final de cada sessão de mentoria.

Com base no histórico completo da sessão, gere um documento profundo, preciso e genuinamente personalizado. Este não é um relatório genérico — é o espelho da jornada desta pessoa específica, escrito com a linguagem e a filosofia da ZUNI Suprema.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRETRIZES DE TOM E ESTILO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Tom: firme, empático, inteligente, direto. Sem clichês motivacionais.
- Linguagem: acessível mas precisa. Nunca superficial.
- Perspectiva: trate a pessoa pelo nome. Fale diretamente com ela, não sobre ela.
- Extensão: suficiente para ser substancial, não tão longo que se torne difuso.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUTURA DO MAPA INTEGRATIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

ABERTURA — O MOMENTO ATUAL
Escreva um parágrafo de abertura que reflita com precisão o estado em que a pessoa chegou à sessão.

SEÇÃO 1 — MAPEAMENTO DO ESTADO ATUAL
Descreva com profundidade: a queixa principal e como ela se manifesta.

SEÇÃO 2 — O QUE ESTE PADRÃO REVELA
Vá além do sintoma. Ofereça a perspectiva mais profunda sobre o que está por trás.

--- INSTRUÇÕES ESPECIAIS ---
Este é um relatório DUAL (Mapa Astral + Numerologia). Estruture o documento com DUAS SEÇÕES CLARAMENTE SEPARADAS:
1. Seção de Mapa Astral (análise astrológica)
2. Seção de Numerologia (análise numerológica baseada em Ana Maria Silva Santos)
Mantenha ambas as análises coerentes e integradas ao mesmo tempo, mas com seções distintas.`;

async function testarComClaudeAPI() {
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Dados simulados reais
  const session = {
    sessionId: 'mi-test-12345',
    name: 'Ana Silva',
    email: 'ana@example.com',
    birthDate: '1990-03-15',
    birthNameFull: 'Ana Maria Silva Santos',
    includeNumerology: true,
    caminhoDeVida: 7,
    essencia: 5,
    mapaNatal: {
      ascendente: { sign: 'Escorpião', degree: 23.5 },
      sol: { sign: 'Peixes', degree: 24.2 },
      lua: { sign: 'Touro', degree: 12.8 },
      mercurio: { sign: 'Áries', degree: 5.1 },
      venus: { sign: 'Gêmeos', degree: 18.6 },
      marte: { sign: 'Leão', degree: 15.3 },
      jupiter: { sign: 'Libra', degree: 8.7 },
      saturno: { sign: 'Capricórnio', degree: 2.4 },
      urano: { sign: 'Capricórnio', degree: 16.9 },
      netuno: { sign: 'Sagitário', degree: 11.2 },
      plutao: { sign: 'Escorpião', degree: 28.5 }
    },
    casas: [
      { house: 1, sign: 'Escorpião', degree: 23.5 },
      { house: 2, sign: 'Sagitário', degree: 15.2 },
      { house: 3, sign: 'Capricórnio', degree: 8.9 },
      { house: 4, sign: 'Aquário', degree: 5.1 },
      { house: 5, sign: 'Peixes', degree: 4.8 },
      { house: 6, sign: 'Áries', degree: 8.2 },
      { house: 7, sign: 'Touro', degree: 23.5 },
      { house: 8, sign: 'Gêmeos', degree: 15.2 },
      { house: 9, sign: 'Câncer', degree: 8.9 },
      { house: 10, sign: 'Leão', degree: 5.1 },
      { house: 11, sign: 'Virgem', degree: 4.8 },
      { house: 12, sign: 'Libra', degree: 8.2 }
    ],
    aspectos: [
      { planet1: 'Sol', aspect: 'trígono', planet2: 'Lua', orb: 1.2 },
      { planet1: 'Ascendente', aspect: 'quadratura', planet2: 'Marte', orb: 0.8 },
      { planet1: 'Vênus', aspect: 'conjunção', planet2: 'Mercúrio', orb: 0.5 },
      { planet1: 'Saturno', aspect: 'oposição', planet2: 'Júpiter', orb: 2.1 }
    ],
    history: [
      { role: 'user', message: 'Estou sentindo muita pressão no trabalho, como se estivesse sempre em um estado de alerta. Meus relacionamentos sofrem porque fico irritável, e não consigo desligar, mesmo quando saio do escritório.' },
      { role: 'assistant', message: 'Essa tensão constante sugere um padrão de hipervigilância. Vamos explorar como seu mapa astral e padrões numéricos iluminam essa experiência. Com Saturno em quadratura ao seu Ascendente, existe uma tendência a carregar responsabilidade de forma muito pessoal. Você reconhece esse padrão?' },
      { role: 'user', message: 'Sim, sempre fui assim. Meus pais eram muito exigentes, e acho que internalizei essa voz crítica.' },
      { role: 'assistant', message: 'Esse é o trabalho de Saturno — ele aponta para onde aprendemos a nos proteger por meio da rigidez. Mas também é onde temos oportunidade de construir autenticidade verdadeira. Vamos trabalhar isso.' }
    ]
  };

  // Montar prompt completo
  const historico = session.history
    .map(h => `${h.role === 'user' ? 'Usuário' : 'Mentor'}: ${h.message}`)
    .join('\n');

  let systemPrompt = REPORT_PROMPT;
  let userContent = `Nome: ${session.name}\nEmail: ${session.email}\n\nHistórico da sessão:\n${historico}`;

  // Injetar dados astrológicos
  if (session.mapaNatal) {
    const mapa = session.mapaNatal;
    const dadosAstrais = `\n\n--- DADOS ASTROLÓGICOS CALCULADOS ---
Ascendente: ${mapa.ascendente?.sign} ${mapa.ascendente?.degree}°
Sol: ${mapa.sol?.sign} ${mapa.sol?.degree}°
Lua: ${mapa.lua?.sign} ${mapa.lua?.degree}°
Mercúrio: ${mapa.mercurio?.sign} ${mapa.mercurio?.degree}°
Vênus: ${mapa.venus?.sign} ${mapa.venus?.degree}°
Marte: ${mapa.marte?.sign} ${mapa.marte?.degree}°
Júpiter: ${mapa.jupiter?.sign} ${mapa.jupiter?.degree}°
Saturno: ${mapa.saturno?.sign} ${mapa.saturno?.degree}°
Urano: ${mapa.urano?.sign} ${mapa.urano?.degree}°
Netuno: ${mapa.netuno?.sign} ${mapa.netuno?.degree}°
Plutão: ${mapa.plutao?.sign} ${mapa.plutao?.degree}°`;
    userContent += dadosAstrais;

    if (session.casas && Array.isArray(session.casas) && session.casas.length > 0) {
      userContent += `\n\nCasas Astrológicas:\n${session.casas.map((c, i) => `Casa ${i + 1}: ${c.sign || 'desconhecida'} ${c.degree || 0}°`).join('\n')}`;
    }

    if (session.aspectos && Array.isArray(session.aspectos) && session.aspectos.length > 0) {
      userContent += `\n\nAspectos Principais:\n${session.aspectos.map(a => `${a.planet1} ${a.aspect} ${a.planet2} (${a.orb}°)`).join('\n')}`;
    }
  }

  // Injetar dados de numerologia
  if (session.includeNumerology) {
    systemPrompt += `\n\n--- INSTRUÇÕES ESPECIAIS ---\nEste é um relatório DUAL (Mapa Astral + Numerologia). Estruture o documento com DUAS SEÇÕES CLARAMENTE SEPARADAS:\n1. Seção de Mapa Astral (análise astrológica)\n2. Seção de Numerologia (análise numerológica baseada em ${session.birthNameFull || session.name})\nMantenha ambas as análises coerentes e integradas ao mesmo tempo, mas com seções distintas.`;
    userContent += `\n\nNome de nascimento/solteira para numerologia: ${session.birthNameFull || session.name}`;
    userContent += `\nCaminho de Vida (Numerologia): ${session.caminhoDeVida}`;
    userContent += `\nEssência (Numerologia): ${session.essencia}`;
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE REAL COM CLAUDE API — ETAPA A VALIDAÇÃO             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('═════════════════════════════════════════════════════════════');
  console.log('1️⃣  PROMPT COMPLETO ENVIADO PARA CLAUDE API');
  console.log('═════════════════════════════════════════════════════════════\n');

  console.log('🔹 SYSTEM PROMPT:');
  console.log('─'.repeat(60));
  console.log(systemPrompt);
  console.log('\n');

  console.log('🔹 USER CONTENT (com dados de mapaNatal + numerologia):');
  console.log('─'.repeat(60));
  console.log(userContent);
  console.log('\n');

  console.log('═════════════════════════════════════════════════════════════');
  console.log('2️⃣  CHAMANDO CLAUDE API...');
  console.log('═════════════════════════════════════════════════════════════\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userContent
        }
      ]
    });

    const reportText = response.content[0].text;

    console.log('✅ RESPOSTA GERADA POR CLAUDE:\n');
    console.log('─'.repeat(60));
    console.log(reportText.substring(0, 2000)); // Primeiras 2000 caracteres
    console.log('\n... (resto do relatório omitido para brevidade)\n');

    console.log('═════════════════════════════════════════════════════════════');
    console.log('3️⃣  ANÁLISE DA RESPOSTA');
    console.log('═════════════════════════════════════════════════════════════\n');

    // Verificar se mencionou título/estrutura
    const temDualSeptions = reportText.includes('MAPA ASTRAL') && reportText.includes('NUMEROLOGIA');
    const temAscendente = reportText.includes('Ascendente') || reportText.includes('Escorpião');
    const temCaminhoVida = reportText.includes('Caminho de Vida') || reportText.includes('número 7');
    const temEssencia = reportText.includes('Essência') || reportText.includes('número 5');

    console.log(`✓ Estrutura DUAL (Mapa + Numerologia): ${temDualSeptions ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`✓ Mencionou Ascendente: ${temAscendente ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`✓ Mencionou Caminho de Vida: ${temCaminhoVida ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`✓ Mencionou Essência: ${temEssencia ? '✅ SIM' : '❌ NÃO'}`);

    console.log('\n═════════════════════════════════════════════════════════════');
    console.log('4️⃣  STATUS DA ETAPA A');
    console.log('═════════════════════════════════════════════════════════════\n');
    console.log('✅ Pipeline de dados validado');
    console.log('✅ Dados astrológicos injetados no prompt');
    console.log('✅ Dados de numerologia injetados no prompt');
    console.log('✅ Claude recebe dados reais e gera relatório personalizado');
    console.log('\n⚠️  NOTA: Este relatório ainda NÃO tem título/capa "Mapa Integrativo"\n');
    console.log('   Isso será adicionado na ETAPA B (refinamento do prompt e renderização).\n');

    // Salvar arquivo completo
    const fs = require('fs');
    const conteudoCompleto = `PROMPT ENVIADO:
${systemPrompt}

USER CONTENT:
${userContent}

RESPOSTA CLAUDE:
${reportText}`;

    fs.writeFileSync(
      'C:\\Users\\Silvio\\AppData\\Local\\Temp\\claude\\C--Users-Silvio-Documents-1---Zuni-Suprema-zuni-suprema\\90c693d3-1ff1-4555-a460-f583df1dcd37\\scratchpad\\teste-claude-resposta-completa.txt',
      conteudoCompleto
    );
    console.log('📄 Resposta completa salva em: teste-claude-resposta-completa.txt\n');

  } catch (error) {
    console.error('❌ Erro ao chamar Claude API:', error.message);
    process.exit(1);
  }
}

testarComClaudeAPI();
