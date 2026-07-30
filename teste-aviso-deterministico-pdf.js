// TESTE: Aviso Determinístico no PDF quando Ascendente é "Unknown"

// process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-...'; // Removed: set via environment

async function testeAvisoDeterministico() {
  const Anthropic = require('@anthropic-ai/sdk');
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE: Aviso Determinístico no PDF (Ascendente Unknown)   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Simular dados com Ascendente "Unknown"
  const sessionData = {
    name: 'Maria Santos',
    email: 'maria@example.com',
    mapaNatal: {
      ascendente: { sign: 'Unknown', degree: 0 },  // ← CRÍTICO: Unknown
      sol: { sign: 'Aries', degree: 10.5 },
      lua: { sign: 'Cancer', degree: 15.2 },
      mercurio: { sign: 'Taurus', degree: 8.3 },
      venus: { sign: 'Gemini', degree: 12.7 },
      marte: { sign: 'Leo', degree: 22.1 },
      jupiter: { sign: 'Virgo', degree: 6.4 },
      saturno: { sign: 'Libra', degree: 9.8 },
      urano: { sign: 'Scorpio', degree: 14.3 },
      netuno: { sign: 'Sagittarius', degree: 19.5 },
      plutao: { sign: 'Pisces', degree: 24.8 }
    },
    history: [
      { role: 'user', message: 'Solicito análise do meu mapa astral.' }
    ],
    includeNumerology: true,
    caminhoDeVida: 3,
    essencia: 7,
    birthNameFull: 'Maria Silva Santos',
    productType: 'mapa-integrado'
  };

  console.log('📋 DADOS DE TESTE:\n');
  console.log(`   Nome: ${sessionData.name}`);
  console.log(`   Ascendente: ${sessionData.mapaNatal.ascendente.sign} (INVÁLIDO ← Teste propositalmente)`);
  console.log(`   Sol: ${sessionData.mapaNatal.sol.sign}\n`);

  // Gerar relatório breve
  console.log('📝 Gerando relatório com Claude API...\n');

  const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userContent = `Nome: ${sessionData.name}
Email: ${sessionData.email}

Contexto: Solicito análise do meu mapa astral.

--- DADOS ASTROLÓGICOS CALCULADOS ---
Ascendente: ${sessionData.mapaNatal.ascendente.sign} ${sessionData.mapaNatal.ascendente.degree}°
Sol: ${sessionData.mapaNatal.sol.sign} ${sessionData.mapaNatal.sol.degree}°
Lua: ${sessionData.mapaNatal.lua.sign} ${sessionData.mapaNatal.lua.degree}°
Mercúrio: ${sessionData.mapaNatal.mercurio.sign} ${sessionData.mapaNatal.mercurio.degree}°
Vênus: ${sessionData.mapaNatal.venus.sign} ${sessionData.mapaNatal.venus.degree}°
Marte: ${sessionData.mapaNatal.marte.sign} ${sessionData.mapaNatal.marte.degree}°
Júpiter: ${sessionData.mapaNatal.jupiter.sign} ${sessionData.mapaNatal.jupiter.degree}°
Saturno: ${sessionData.mapaNatal.saturno.sign} ${sessionData.mapaNatal.saturno.degree}°
Urano: ${sessionData.mapaNatal.urano.sign} ${sessionData.mapaNatal.urano.degree}°
Netuno: ${sessionData.mapaNatal.netuno.sign} ${sessionData.mapaNatal.netuno.degree}°
Plutão: ${sessionData.mapaNatal.plutao.sign} ${sessionData.mapaNatal.plutao.degree}°

Numerologia:
Caminho de Vida: ${sessionData.caminhoDeVida}
Essência: ${sessionData.essencia}`;

  const PROMPT = `Você é o sistema de geração do Mapa Integrado ZUNI Suprema.

Gere um breve relatório com estas seções:

# Mapa Integrado ZUNI Suprema
## Análise do Sol
Análise breve do Sol fornecido.

## Análise da Lua
Análise breve da Lua fornecida.

Use nomes por extenso (Sol, Lua, etc.), não símbolos.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: PROMPT,
      messages: [{ role: 'user', content: userContent }]
    });

    const reportText = response.content[0].text;
    console.log('✅ Relatório gerado!\n');

    // ===== LÓGICA REAL DE VALIDAÇÃO =====
    console.log('🔍 VALIDAÇÃO DE ASCENDENTE:\n');

    const mapa = sessionData.mapaNatal;
    const ascendenteInvalido = !mapa.ascendente || mapa.ascendente.sign === 'Unknown';

    if (ascendenteInvalido) {
      console.log('⚠️  [ALERTA] Ascendente não foi calculado para Maria Santos');
      console.log('   Flag ascendenteInvalido = TRUE\n');
    }

    // ===== GERAR PDF COM AVISO DETERMINÍSTICO =====
    console.log('📄 Gerando PDF com aviso determinístico...\n');

    const sessionId = 'test-' + Date.now();
    const pdfPath = path.join(os.tmpdir(), `relatorio-${sessionId}.pdf`);
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);

    // Capa
    doc.fontSize(20).font('Helvetica-Bold').text('MAPA INTEGRADO ZUNI SUPREMA', { align: 'center' });
    doc.moveDown(2);

    // Índice
    doc.fontSize(16).font('Helvetica-Bold').text('ÍNDICE', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(11).font('Helvetica').text('Análise do Sol ........................ 3');
    doc.text('Análise da Lua ........................ 3');
    doc.moveDown(2);

    // Nova página
    doc.addPage();

    // ===== INSERÇÃO DETERMINÍSTICA DO AVISO =====
    if (ascendenteInvalido) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('red');
      doc.text('⚠️  AVISO TÉCNICO CRÍTICO', { align: 'left' });
      doc.fillColor('black').font('Helvetica').fontSize(10);
      doc.text('O Ascendente deste mapa não pôde ser calculado com precisão. A análise da Casa I está aproximada ou indisponível.', { width: 500 });
      doc.text('Favor consultar um astrólogo profissional para validação do Ascendente. Este relatório deve ser considerado uma orientação inicial.', { width: 500 });
      doc.moveDown(1);
      console.log('✅ Aviso em VERMELHO inserido no PDF (DETERMINÍSTICO)\n');
    }

    // Conteúdo
    doc.fontSize(11).font('Helvetica').fillColor('black');
    doc.text(reportText, { width: 500 });

    doc.end();

    stream.on('finish', () => {
      const stats = fs.statSync(pdfPath);
      const sizeInKB = (stats.size / 1024).toFixed(2);

      console.log('═════════════════════════════════════════════════════════════');
      console.log('✅ PDF GERADO COM SUCESSO!');
      console.log('═════════════════════════════════════════════════════════════\n');
      console.log(`Arquivo: ${pdfPath}`);
      console.log(`Tamanho: ${sizeInKB} KB\n`);

      console.log('📊 VALIDAÇÕES:');
      console.log('   ✅ Ascendente = "Unknown" detectado');
      console.log('   ✅ Flag ascendenteInvalido = TRUE');
      console.log('   ✅ Aviso em VERMELHO inserido no PDF');
      console.log('   ✅ Aviso é DETERMINÍSTICO (não depende do Claude)\n');

      console.log('🔍 Abrir o PDF para verificar o aviso em vermelho:');
      console.log(`   ${pdfPath}\n`);

      // Copiar para Documents para fácil acesso
      const destPath = 'C:\\Users\\Silvio\\Documents\\Teste-Aviso-Deterministico.pdf';
      fs.copyFileSync(pdfPath, destPath);
      console.log(`Cópia também em: ${destPath}\n`);
    });

    stream.on('error', (err) => {
      console.error('❌ Erro ao gerar PDF:', err);
      process.exit(1);
    });

  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

testeAvisoDeterministico().catch(console.error);
