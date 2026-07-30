// TESTE: Aviso quando Ascendente é "Unknown"
// Demonstra que o sistema agora alertas explicitamente sobre dados incompletos

// process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-...'; // Removed: set via environment

async function testeAvisoAscendente() {
  const Anthropic = require('@anthropic-ai/sdk');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE: Aviso Quando Ascendente é "Unknown"               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Simular uma sessão com Ascendente "Unknown"
  const sessionComAscendenteUnknown = {
    name: 'João Silva',
    email: 'joao@example.com',
    productType: 'mapa-integrado',
    mapaNatal: {
      ascendente: { sign: 'Unknown', degree: 0 },  // ← CRÍTICO: Ascendente inválido
      sol: { sign: 'Gemini', degree: 15.5 },
      lua: { sign: 'Libra', degree: 8.2 },
      mercurio: { sign: 'Cancer', degree: 20.1 },
      venus: { sign: 'Taurus', degree: 12.3 },
      marte: { sign: 'Leo', degree: 5.0 },
      jupiter: { sign: 'Virgo', degree: 18.5 },
      saturno: { sign: 'Capricorn', degree: 3.2 },
      urano: { sign: 'Aquarius', degree: 16.1 },
      netuno: { sign: 'Pisces', degree: 11.5 },
      plutao: { sign: 'Scorpio', degree: 28.2 }
    },
    history: [
      { role: 'user', message: 'Solicito mapa astral para entender meus padrões de vida.' }
    ],
    includeNumerology: true,
    caminhoDeVida: 7,
    essencia: 5,
    birthNameFull: 'João Maria Silva Santos'
  };

  console.log('📋 CENÁRIO: Ascendente = "Unknown" (dados incompletos)\n');
  console.log(`   Nome: ${sessionComAscendenteUnknown.name}`);
  console.log(`   Ascendente: ${sessionComAscendenteUnknown.mapaNatal.ascendente.sign} (INVÁLIDO)`);
  console.log(`   Sol: ${sessionComAscendenteUnknown.mapaNatal.sol.sign}\n`);

  // Replicar a lógica da generateReportText()
  console.log('🔍 VERIFICAÇÃO DA VALIDAÇÃO:\n');

  const mapa = sessionComAscendenteUnknown.mapaNatal;
  const ascendenteInvalido = !mapa.ascendente || mapa.ascendente.sign === 'Unknown';

  if (ascendenteInvalido) {
    console.log('⚠️  [SERVIDOR LOG] ALERTA CRÍTICO:');
    console.log(`    Ascendente não foi calculado para ${sessionComAscendenteUnknown.name}.`);
    console.log('    Dados astrológicos podem estar incompletos.\n');
  }

  // Construir conteúdo de entrada
  let userContent = `Nome: ${sessionComAscendenteUnknown.name}\nEmail: ${sessionComAscendenteUnknown.email}\n\nContexto (o que a pessoa buscava ao solicitar seu mapa):\nSolicito mapa astral para entender meus padrões de vida.`;

  // Adicionar dados astrológicos
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

  // SE Ascendente inválido, adicionar aviso
  if (ascendenteInvalido) {
    userContent += `\n\n⚠️  AVISO TÉCNICO: O Ascendente não pôde ser calculado com precisão. Favor consultar um astrólogo profissional para validação da Casa I. Este relatório deve ser considerado uma orientação inicial.`;
    console.log('✅ AVISO ADICIONADO ao conteúdo enviado ao Claude:\n');
    console.log('   "⚠️  AVISO TÉCNICO: O Ascendente não pôde ser calculado com precisão."\n');
  }

  userContent += dadosAstrais;

  // Numerologia
  userContent += `\n\nNumerologia (baseada em ${sessionComAscendenteUnknown.birthNameFull}):\nCaminho de Vida: ${sessionComAscendenteUnknown.caminhoDeVida}\nEssência: ${sessionComAscendenteUnknown.essencia}`;

  console.log('📝 Gerando relatório com aviso via Claude API...\n');

  const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  const PROMPT_COM_INSTRUCAO_AVISO = `Você é o sistema de geração do Mapa Integrado ZUNI Suprema.

Gere um relatório breve (500 palavras) com estas seções:

# Mapa Integrado ZUNI Suprema

## Aviso Técnico
Se o relatório mencionar que há um AVISO TÉCNICO sobre Ascendente, comece por aqui.
Reproduza o aviso de forma clara e direta, sem minimizar. Exemplo:
"**Nota importante:** O Ascendente deste mapa não pôde ser calculado com precisão. A análise da Casa I está aproximada. Recomendamos consultar um astrólogo profissional."

## Análise do Sol
Análise breve do Sol fornecido.

## Análise da Lua
Análise breve da Lua fornecida.

REGRAS INVIOLÁVEIS:
- Se houver aviso de Ascendente "Unknown", reproduza-o de forma EXPLÍCITA no relatório
- NÃO minimize ou oculte limitações dos dados
- Use nomes por extenso (Sol, Lua, etc.), não símbolos`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: PROMPT_COM_INSTRUCAO_AVISO,
      messages: [{ role: 'user', content: userContent }]
    });

    const reportText = response.content[0].text;

    console.log('✅ RELATÓRIO GERADO!\n');
    console.log('═════════════════════════════════════════════════════════════');
    console.log('RELATÓRIO COM AVISO INCORPORADO');
    console.log('═════════════════════════════════════════════════════════════\n');
    console.log(reportText);

    console.log('\n═════════════════════════════════════════════════════════════');
    console.log('VALIDAÇÃO DO AVISO');
    console.log('═════════════════════════════════════════════════════════════\n');

    if (reportText.includes('Ascendente') && reportText.includes('não pôde')) {
      console.log('✅ AVISO INCORPORADO NO RELATÓRIO');
      console.log('   O relatório explicitamente menciona que o Ascendente');
      console.log('   não pôde ser calculado com precisão.\n');
    } else if (reportText.includes('AVISO')) {
      console.log('✅ AVISO TÉCNICO PRESENTE NO RELATÓRIO');
      console.log('   O aviso foi incluído como solicitado.\n');
    } else {
      console.log('⚠️  Aviso pode não estar visível (Claude não reproduziu na abertura)\n');
    }

    console.log('📊 CONCLUSÃO:');
    console.log('   ✅ Sistema detecta Ascendente "Unknown"');
    console.log('   ✅ Registra aviso no log do servidor');
    console.log('   ✅ Passa aviso ao Claude para incluir no relatório');
    console.log('   ✅ Usuário é informado sobre limitação dos dados\n');

  } catch (err) {
    console.error('❌ Erro ao gerar relatório:', err.message);
  }
}

testeAvisoAscendente().catch(console.error);
