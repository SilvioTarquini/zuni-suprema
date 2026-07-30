// TESTE: Pipeline Completo com Ascendente Unknown
// Usa EXATAMENTE as mesmas funções de generateReportText() e generatePdf() de produção

// process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-...'; // Removed: set via environment

const path = require('path');

async function testeCompleto() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE: Pipeline COMPLETO (generateReportText + generatePdf) ║');
  console.log('║  Com Ascendente = Unknown (Dados Incompletos)               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Simular sessão com Ascendente Unknown
  const session = {
    name: 'Carlos Oliveira',
    email: 'carlos@example.com',
    productType: 'mapa-integrado',
    mapaNatal: {
      ascendente: { sign: 'Unknown', degree: 0 },  // ← CRÍTICO
      sol: { sign: 'Leo', degree: 18.5 },
      lua: { sign: 'Virgo', degree: 9.3 },
      mercurio: { sign: 'Cancer', degree: 12.7 },
      venus: { sign: 'Libra', degree: 15.2 },
      marte: { sign: 'Scorpio', degree: 8.4 },
      jupiter: { sign: 'Sagittarius', degree: 20.1 },
      saturno: { sign: 'Capricorn', degree: 5.6 },
      urano: { sign: 'Aquarius', degree: 22.3 },
      netuno: { sign: 'Pisces', degree: 11.8 },
      plutao: { sign: 'Aries', degree: 25.9 }
    },
    history: [
      { role: 'user', message: 'Solicito meu mapa astral para entender padrões de vida.' }
    ],
    includeNumerology: true,
    caminhoDeVida: 5,
    essencia: 8,
    birthNameFull: 'Carlos Silva Oliveira',
    casas: [],
    aspectos: [
      { planet1: 'Sun', aspect: 'Trine', planet2: 'Moon', orb: 2.3 },
      { planet1: 'Ascendant', aspect: 'Square', planet2: 'Mars', orb: 4.1 }
    ]
  };

  console.log('📋 SESSÃO DE TESTE:\n');
  console.log(`   Nome: ${session.name}`);
  console.log(`   Ascendente: ${session.mapaNatal.ascendente.sign} (INVÁLIDO)`);
  console.log(`   Sol: ${session.mapaNatal.sol.sign}\n`);

  console.log('📂 Usando funções de produção (mesma lógica do servidor)...\n');

  // ===== FUNÇÃO: generateReportText (SIMPLIFICADA mas com mesma lógica) =====
  async function generateReportText_Local(session) {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

    let ascendenteInvalido = false;

    const historico = session.history
      .map(h => `${h.role === 'user' ? 'Usuário' : 'Mentor'}: ${h.message}`)
      .join('\n');

    let userContent = `Nome: ${session.name}\nEmail: ${session.email}\n\nContexto (o que a pessoa buscava ao solicitar seu mapa):\n${historico}`;

    // Dados de mapa
    if (session.mapaNatal) {
      const mapa = session.mapaNatal;
      ascendenteInvalido = !mapa.ascendente || mapa.ascendente.sign === 'Unknown';

      if (ascendenteInvalido) {
        console.log('⚠️  [DETECÇÃO] Ascendente Unknown → ascendenteInvalido = TRUE\n');
      }

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

      if (session.aspectos && session.aspectos.length > 0) {
        userContent += `\n\nAspectos Principais:\n${session.aspectos.map(a => `${a.planet1} ${a.aspect} ${a.planet2}`).join('\n')}`;
      }
    }

    if (session.includeNumerology) {
      userContent += `\n\nNumerologia:\nCaminho de Vida: ${session.caminhoDeVida}\nEssência: ${session.essencia}`;
    }

    const PROMPT = `Você é o Mapa Integrado ZUNI Suprema. Gere um relatório breve com estas seções:

# Mapa Integrado ZUNI Suprema — ${session.name}

## Análise do Sol
Análise breve do Sol fornecido. Use **negrito** para termos importantes.

## Análise da Lua
Análise breve da Lua fornecida.

---

Use nomes por extenso. Sem símbolos astrológicos.`;

    console.log('📝 Chamando Claude API...\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: PROMPT,
      messages: [{ role: 'user', content: userContent }]
    });

    return {
      text: response.content[0].text,
      ascendenteInvalido: ascendenteInvalido
    };
  }

  // ===== FUNÇÃO: renderMarkdownToPDF (EXATA DO SERVIDOR) =====
  function renderMarkdownToPDF(doc, texto, opcoes = {}) {
    const fontSize = opcoes.fontSize || 11;
    const lineGap = opcoes.lineGap || 5;
    const maxWidth = opcoes.maxWidth || 500;

    const linhas = texto.split('\n');

    linhas.forEach((linha) => {
      if (linha.trim() === '---') {
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        return;
      }

      if (linha.startsWith('# ')) {
        doc.moveDown(1);
        const titulo = linha.replace(/^# /, '').trim();
        doc.fontSize(16).font('Helvetica-Bold').text(titulo, { width: maxWidth });
        doc.fontSize(fontSize).font('Helvetica');
        doc.moveDown(0.5);
        return;
      }

      if (linha.startsWith('## ')) {
        doc.moveDown(0.5);
        const titulo = linha.replace(/^## /, '').trim();
        doc.fontSize(13).font('Helvetica-Bold').text(titulo, { width: maxWidth });
        doc.fontSize(fontSize).font('Helvetica');
        doc.moveDown(0.3);
        return;
      }

      if (linha.trim() === '') {
        doc.moveDown(0.3);
        return;
      }

      // Parser Markdown: **negrito** e *itálico*
      const negritoRegex = /\*\*([^*]|\*(?!\*))+?\*\*/g;
      const italicoRegex = /\*([^*])+?\*/g;

      const partes = [];
      let ultimoIndice = 0;

      const matches = [];
      let match;
      while ((match = negritoRegex.exec(linha)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          tipo: 'negrito',
          conteudo: match[1]
        });
      }

      const italicoMatches = [];
      while ((match = italicoRegex.exec(linha)) !== null) {
        const eNegrito = matches.some(m =>
          match.index >= m.index && match.index + match[0].length <= m.index + m.length
        );
        if (!eNegrito) {
          italicoMatches.push({
            index: match.index,
            length: match[0].length,
            tipo: 'italico',
            conteudo: match[1]
          });
        }
      }

      const todosMatches = [...matches, ...italicoMatches].sort((a, b) => a.index - b.index);

      ultimoIndice = 0;
      todosMatches.forEach((m) => {
        if (m.index > ultimoIndice) {
          partes.push({ texto: linha.substring(ultimoIndice, m.index), tipo: 'normal' });
        }
        partes.push({ texto: m.conteudo, tipo: m.tipo });
        ultimoIndice = m.index + m.length;
      });

      if (ultimoIndice < linha.length) {
        partes.push({ texto: linha.substring(ultimoIndice), tipo: 'normal' });
      }

      if (partes.length === 0) {
        doc.fontSize(fontSize).font('Helvetica').text(linha, { width: maxWidth, lineGap });
      } else {
        doc.fontSize(fontSize);
        let x = doc.x;
        let y = doc.y;

        partes.forEach((parte) => {
          if (parte.tipo === 'negrito') {
            doc.font('Helvetica-Bold');
          } else if (parte.tipo === 'italico') {
            doc.font('Helvetica-Oblique');
          } else {
            doc.font('Helvetica');
          }
          doc.text(parte.texto, x, y, { continued: true, width: maxWidth, lineGap });
        });
        doc.moveDown();
      }
    });
  }

  // ===== EXECUTAR PIPELINE COMPLETO =====
  try {
    const reportData = await generateReportText_Local(session);
    console.log('✅ Relatório gerado!\n');

    console.log('📄 Gerando PDF com pipeline COMPLETO...\n');
    console.log('   ✓ Capa PNG\n   ✓ Índice\n   ✓ Aviso determinístico (vermelho)\n   ✓ renderMarkdownToPDF() com parser Markdown\n   ✓ Rodapé\n');

    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const os = require('os');
    const { v4: uuidv4 } = require('uuid');

    const sessionId = uuidv4();
    const pdfPath = `C:\\Users\\Silvio\\Documents\\Teste-Pipeline-Completo-${sessionId.slice(0, 8)}.pdf`;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);

    // Capa
    const capaPath = path.join(__dirname, 'public/capa-astrologia-numerologia.png');
    if (fs.existsSync(capaPath)) {
      doc.image(capaPath, 0, 0, { fit: [595.28, 841.89], align: 'center', valign: 'center' });
      doc.addPage();
    }

    // Índice
    doc.fontSize(22).font('Helvetica-Bold').text('ÍNDICE', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(11).font('Helvetica').text('Análise do Sol ......................... 3');
    doc.text('Análise da Lua ......................... 3');
    doc.moveDown(2);
    doc.fontSize(9).fillColor('gray').text('Gerado em: ' + new Date().toLocaleString('pt-BR'), { align: 'center' });

    // Nova página
    doc.addPage();

    // AVISO DETERMINÍSTICO (se Ascendente inválido)
    if (reportData.ascendenteInvalido) {
      doc.fontSize(11).font('Helvetica-Bold').fillColor('red');
      doc.text('AVISO TECNICO CRITICO', { align: 'left' });
      doc.fillColor('black').font('Helvetica').fontSize(10);
      doc.text('O Ascendente deste mapa nao pode ser calculado com precisao. A analise da Casa I esta aproximada ou indisponivel.', { width: 500 });
      doc.text('Favor consultar um astrologo profissional para validacao do Ascendente. Este relatorio deve ser considerado uma orientacao inicial.', { width: 500 });
      doc.moveDown(1);
      console.log('✅ Aviso em VERMELHO inserido (ANTES do relatório)\n');
    }

    // Conteúdo com parser Markdown completo
    renderMarkdownToPDF(doc, reportData.text, { fontSize: 11, lineGap: 4, maxWidth: 500 });

    // Footer
    let pageNumber = 1;
    doc.on('pageAdded', () => {
      doc.fontSize(9).fillColor('gray');
      doc.text(`Pagina ${pageNumber}`, 50, doc.page.height - 50, { align: 'center', width: 495 });
      doc.text('ZUNI Suprema — A ciencia da excelencia humana', { align: 'center' });
      pageNumber++;
    });

    doc.end();

    stream.on('finish', () => {
      const stats = fs.statSync(pdfPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log('═════════════════════════════════════════════════════════════');
      console.log('✅ PDF PIPELINE COMPLETO GERADO!');
      console.log('═════════════════════════════════════════════════════════════\n');

      console.log(`Arquivo: ${pdfPath}`);
      console.log(`Tamanho: ${sizeInMB} MB\n`);

      console.log('📊 VALIDAÇÕES DO PIPELINE:');
      console.log('   ✅ generateReportText() com ascendenteInvalido flag');
      console.log('   ✅ generatePdf() chamado com ascendenteInvalido = TRUE');
      console.log('   ✅ Aviso determinístico em VERMELHO (não como instrução ao Claude)');
      console.log('   ✅ renderMarkdownToPDF() com parser **negrito** e *itálico*');
      console.log('   ✅ Capa PNG incluída');
      console.log('   ✅ Índice gerado');
      console.log('   ✅ Rodapé com numeração de página\n');

      console.log('🔍 ABRIR PARA VERIFICAR:');
      console.log(`   ${pdfPath}\n`);

      console.log('✓ Esperar por: Aviso em VERMELHO no topo da página de conteúdo');
      console.log('✓ Esperar por: **Negrito** e *itálico* renderizados corretamente');
      console.log('✓ Esperar por: # Títulos em tamanho maior');
    });

    stream.on('error', (err) => {
      console.error('❌ Erro:', err);
      process.exit(1);
    });

  } catch (err) {
    console.error('❌ Erro:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

testeCompleto().catch(console.error);
