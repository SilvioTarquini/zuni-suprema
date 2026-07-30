// Teste ETAPA B — Novo Prompt Dedicado para Mapa Integrado
// Valida que a linguagem mudou de "sessão" para "relatório de produto"

// process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-...'; // Removed: set via environment

const MAPA_INTEGRADO_PROMPT = `Você é o sistema de geração do Mapa Integrado ZUNI Suprema — relatório astrológico e numerológico personalizado.

Você está gerando um documento que será entregue por email a uma pessoa que solicitou seu mapa astral e análise numerológica. Este não é um chat, não é uma sessão — é um RELATÓRIO COMPLETO E AUTOSSUFICIENTE que a pessoa lerá para entender a si mesma através dos dados de seu mapa natal e números de vida.

Este relatório deve ser profundo, preciso, genuinamente personalizado, e escrito com a linguagem e filosofia da ZUNI Suprema.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRETRIZES DE TOM E ESTILO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Tom: firme, empático, inteligente, direto. Sem clichês motivacionais.
- Linguagem: acessível mas precisa. Nunca superficial.
- Perspectiva: trate a pessoa pelo nome. Fale diretamente com ela, não sobre ela.
- Extensão: suficiente para ser substancial, não tão longo que se torne difuso.
- Contexto: você está interpretando dados astrológicos e numerológicos reais fornecidos — não especule, use esses dados como fundamento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUTURA DO MAPA INTEGRADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

TÍTULO (gerado automaticamente)
Mapa Integrado ZUNI Suprema — Seu Mapa Astral e Numerológico

ABERTURA
Um parágrafo que honre quem a pessoa é com base em seu mapa. Sem sessão, sem conversa — direto ao ponto do que os dados revelam. Exemplo: "Você nasceu sob um céu específico. Aqui está o que esse céu diz sobre quem você é."

PARTE I — SEU MAPA ASTRAL
Análise detalhada dos planetas, casas e aspectos. Incluir:
- Ascendente: a máscara, como você é percebido
- Sol: seu núcleo, identidade consciente
- Lua: necessidades emocionais e instintivas
- Saturno: lições, desafios, estrutura
- Outros planetas conforme relevância para o padrão central
- Aspectos principais: as tensões e harmonias do mapa

Cada seção deve conectar os dados astrológicos à experiência real da pessoa baseada no que foi revelado no histórico.

PARTE II — SUA NUMEROLOGIA
Análise do Caminho de Vida e Essência baseada em data de nascimento e nome completo. Incluir:
- Caminho de Vida: a missão, o aprendizado central
- Essência: a energia subjacente, talentos naturais
- Integração entre os números

INTEGRAÇÃO FINAL — O QUE OS DOIS MAPAS DIZEM JUNTOS
Uma síntese que coloca Astrologia e Numerologia em diálogo. Onde eles concordam? Onde há tensão? O que emerge como padrão central?

ORIENTAÇÕES PRÁTICAS
Baseado no mapa integrado, ofereça 3-5 direcionamentos concretos e específicos (não genéricos). Cada um deve ter: o que fazer, por que importa para ESTE mapa, e como começar.

ENCERRAMENTO
Um parágrafo final que honre o que foi revelado e convide à próxima etapa (sem ser comercial). Reconheça que este é um ponto de partida, não o destino final.`;

async function testarNovoPrompt() {
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  const session = {
    name: 'Ana Silva',
    email: 'ana@example.com',
    birthDate: '1990-03-15',
    birthNameFull: 'Ana Maria Silva Santos',
    productType: 'mapa-integrado',
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
      { role: 'user', message: 'Estou sentindo muita pressão no trabalho, como se estivesse sempre em um estado de alerta.' },
      { role: 'assistant', message: 'Com Saturno em quadratura ao seu Ascendente, existe uma tendência a carregar responsabilidade de forma muito pessoal.' }
    ]
  };

  // Montar prompt para Mapa Integrado
  const historico = session.history
    .map(h => `${h.role === 'user' ? 'Usuário' : 'Mentor'}: ${h.message}`)
    .join('\n');

  let systemPrompt = MAPA_INTEGRADO_PROMPT;
  let userContent = `Nome: ${session.name}\nEmail: ${session.email}\n\nContexto (o que a pessoa buscava ao solicitar seu mapa):\n${historico}`;

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

  if (session.includeNumerology) {
    userContent += `\n\nNumerologia (baseada em ${session.birthNameFull || session.name}):\nCaminho de Vida: ${session.caminhoDeVida}`;
    userContent += `\nEssência: ${session.essencia}`;
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE ETAPA B — NOVO PROMPT DEDICADO                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('═════════════════════════════════════════════════════════════');
  console.log('🔹 USER CONTENT (sem "Histórico da sessão", com "Contexto"):');
  console.log('═════════════════════════════════════════════════════════════\n');
  console.log(userContent.substring(0, 500) + '\n...\n');

  console.log('═════════════════════════════════════════════════════════════');
  console.log('📞 Chamando Claude com novo prompt...');
  console.log('═════════════════════════════════════════════════════════════\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userContent
        }
      ]
    });

    const reportText = response.content[0].text;

    console.log('✅ RESPOSTA CLAUDE (ABERTURA + PRIMEIRAS 2 SEÇÕES):\n');
    console.log('─'.repeat(60));

    // Extrair apenas até a primeira integração ou ao atingir limite
    const primeirosMilCaracteres = reportText.substring(0, 2500);
    console.log(primeirosMilCaracteres);
    console.log('\n... (resto omitido para brevidade)\n');

    console.log('═════════════════════════════════════════════════════════════');
    console.log('✔ VALIDAÇÃO ETAPA B');
    console.log('═════════════════════════════════════════════════════════════\n');

    // Validações
    const temContexto = reportText.toLowerCase().includes('contexto') || !reportText.includes('histórico da sessão');
    const temTitulo = reportText.includes('ZUNI Suprema') || reportText.includes('Mapa Integrado');
    const temAberturaSemSessao = reportText.includes('Você nasceu') || reportText.includes('você é uma pessoa');
    const temPartesAstrais = reportText.includes('MAPA ASTRAL') || reportText.includes('Ascendente');
    const temPartesNumer = reportText.includes('NUMEROLOGIA') || reportText.includes('Caminho de Vida');
    const NAOtemHistoricoSessao = !reportText.includes('histórico da sessão');

    console.log(`✓ Novo prompt usado (não "Histórico da sessão"): ${NAOtemHistoricoSessao ? '✅' : '❌'}`);
    console.log(`✓ Linguagem de "Contexto" (não "sessão"): ${temContexto ? '✅' : '❌'}`);
    console.log(`✓ Abertura sem referência a "sessão": ${temAberturaSemSessao ? '✅' : '❌'}`);
    console.log(`✓ Título "ZUNI Suprema": ${temTitulo ? '✅' : '❌'}`);
    console.log(`✓ Estrutura com Mapa Astral: ${temPartesAstrais ? '✅' : '❌'}`);
    console.log(`✓ Estrutura com Numerologia: ${temPartesNumer ? '✅' : '❌'}`);

    // Salvar arquivo completo
    const fs = require('fs');
    fs.writeFileSync(
      'C:\\Users\\Silvio\\AppData\\Local\\Temp\\claude\\C--Users-Silvio-Documents-1---Zuni-Suprema-zuni-suprema\\90c693d3-1ff1-4555-a460-f583df1dcd37\\scratchpad\\teste-etapa-b-resposta.txt',
      reportText
    );
    console.log('\n📄 Resposta completa salva em: teste-etapa-b-resposta.txt\n');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

testarNovoPrompt();
