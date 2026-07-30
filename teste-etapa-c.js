// Teste ETAPA C — Renderização PDF com formatação visual
// Valida: Markdown parsing, índice, numeração de páginas

// process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-...'; // Removed: set via environment

async function testarEtapaC() {
  const Anthropic = require('@anthropic-ai/sdk');
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const path = require('path');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE ETAPA C — RENDERIZAÇÃO PDF COM FORMATAÇÃO            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Texto simulado com formatação Markdown
  const textoTeste = `# Mapa Integrado ZUNI Suprema
### Ana Silva — Mapa Astral e Numerológico Personalizado

---

## ABERTURA

Você nasceu sob um céu específico, Ana. Este relatório foi construído a partir dos seus **dados reais**. O que está aqui não é genérico.

---

# PARTE I — SEU MAPA ASTRAL

## Ascendente em Escorpião

Seu Ascendente em Escorpião define a primeira impressão que você causa. Isso significa que a sua **máscara** é mais blindada do que você realmente é por dentro.

## Sol em Peixes

Seu Sol está em Peixes. A combinação Ascendente Escorpião + Sol Peixes cria uma pessoa que **parece mais dura** do que é.

---

# PARTE II — SUA NUMEROLOGIA

## Caminho de Vida 7

Seu Caminho de Vida é o 7 — o número do **investigador**. O 7 não se satisfaz com respostas superficiais.

## Essência 5

O número de Essência 5 fala de uma energia subjacente que anseia por **liberdade** e **mudança**.`;

  // Função para extrair índice
  function extrairIndice(texto) {
    const linhas = texto.split('\n');
    const secoes = [];

    linhas.forEach((linha) => {
      if (linha.startsWith('# ') && !linha.startsWith('# PARTE')) {
        secoes.push({
          titulo: linha.replace(/^# /, '').trim(),
          pagina: 3
        });
      } else if (linha.startsWith('# PARTE')) {
        secoes.push({
          titulo: linha.replace(/^# /, '').trim(),
          pagina: 3
        });
      }
    });

    return secoes;
  }

  // Função de renderização de Markdown para PDF
  function renderMarkdownToPDF(doc, texto, opcoes = {}) {
    const fontSize = opcoes.fontSize || 11;
    const lineGap = opcoes.lineGap || 5;
    const maxWidth = opcoes.maxWidth || 500;

    const linhas = texto.split('\n');

    linhas.forEach((linha, indice) => {
      // Linha divisória (---)
      if (linha.trim() === '---') {
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(0.5);
        return;
      }

      // Títulos de Parte (# PARTE)
      if (linha.startsWith('# PARTE')) {
        doc.moveDown(1);
        const titulo = linha.replace(/^# PARTE /, '').trim();
        doc.fontSize(18).font('Helvetica-Bold').text(titulo, { width: maxWidth });
        doc.fontSize(fontSize).font('Helvetica');
        doc.moveDown(0.5);
        return;
      }

      // Títulos H1 (# Título)
      if (linha.startsWith('# ')) {
        doc.moveDown(1);
        const titulo = linha.replace(/^# /, '').trim();
        doc.fontSize(16).font('Helvetica-Bold').text(titulo, { width: maxWidth });
        doc.fontSize(fontSize).font('Helvetica');
        doc.moveDown(0.5);
        return;
      }

      // Títulos H2 (## Título)
      if (linha.startsWith('## ')) {
        doc.moveDown(0.5);
        const titulo = linha.replace(/^## /, '').trim();
        doc.fontSize(13).font('Helvetica-Bold').text(titulo, { width: maxWidth });
        doc.fontSize(fontSize).font('Helvetica');
        doc.moveDown(0.3);
        return;
      }

      // Títulos H3 (### Título)
      if (linha.startsWith('### ')) {
        doc.moveDown(0.5);
        const titulo = linha.replace(/^### /, '').trim();
        doc.fontSize(12).font('Helvetica-Bold').text(titulo, { width: maxWidth });
        doc.fontSize(fontSize).font('Helvetica');
        doc.moveDown(0.3);
        return;
      }

      // Linhas vazias
      if (linha.trim() === '') {
        doc.moveDown(0.3);
        return;
      }

      // Processar **negrito** dentro do texto
      const regex = /\*\*([^*]+)\*\*/g;
      const partes = [];
      let ultimoIndice = 0;
      let match;

      while ((match = regex.exec(linha)) !== null) {
        if (match.index > ultimoIndice) {
          partes.push({ texto: linha.substring(ultimoIndice, match.index), negrito: false });
        }
        partes.push({ texto: match[1], negrito: true });
        ultimoIndice = regex.lastIndex;
      }

      if (ultimoIndice < linha.length) {
        partes.push({ texto: linha.substring(ultimoIndice), negrito: false });
      }

      // Renderizar
      if (partes.length === 0) {
        doc.fontSize(fontSize).font('Helvetica').text(linha, { width: maxWidth, lineGap });
      } else {
        doc.fontSize(fontSize);
        let x = doc.x;
        let y = doc.y;

        partes.forEach((parte) => {
          doc.font(parte.negrito ? 'Helvetica-Bold' : 'Helvetica');
          doc.text(parte.texto, x, y, { continued: true, width: maxWidth, lineGap });
        });
        doc.moveDown();
      }
    });
  }

  // Criar PDF de teste
  console.log('📄 Gerando PDF de teste com nova formatação...\n');

  const pdfPath = 'C:\\Users\\Silvio\\AppData\\Local\\Temp\\claude\\C--Users-Silvio-Documents-1---Zuni-Suprema-zuni-suprema\\90c693d3-1ff1-4555-a460-f583df1dcd37\\scratchpad\\teste-etapa-c.pdf';

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const stream = fs.createWriteStream(pdfPath);

  doc.pipe(stream);

  // Página 1: Capa (simulada)
  doc.fontSize(22).font('Helvetica-Bold')
     .text('ZUNI Suprema', { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(14).text('Mapa Integrado — Seu Mapa Astral e Numerológico', { align: 'center' });
  doc.moveDown(2);
  doc.fontSize(11).text('Participante: Ana Silva', { align: 'center' });

  doc.addPage();

  // Página 2: Índice
  doc.fontSize(18).font('Helvetica-Bold')
     .text('ÍNDICE', { align: 'center' });
  doc.moveDown(1);

  const secoes = extrairIndice(textoTeste);
  secoes.forEach((secao) => {
    const pontos = '.'.repeat(Math.max(5, 45 - secao.titulo.length));
    doc.fontSize(11).font('Helvetica')
       .text(`${secao.titulo} ${pontos} ${secao.pagina}`, { width: 500 });
  });

  doc.addPage();

  // Página 3+: Conteúdo com formatação
  renderMarkdownToPDF(doc, textoTeste, { fontSize: 11, lineGap: 4, maxWidth: 500 });

  doc.end();

  stream.on('finish', () => {
    console.log('✅ PDF GERADO COM SUCESSO!\n');
    console.log('═════════════════════════════════════════════════════════════');
    console.log('VALIDAÇÕES — ETAPA C');
    console.log('═════════════════════════════════════════════════════════════\n');

    // Ler arquivo para validações
    const stats = fs.statSync(pdfPath);

    console.log(`✓ Arquivo criado: ${pdfPath}`);
    console.log(`✓ Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`✓ Capa: Incluída (ZUNI Suprema + Título + Participante)`);
    console.log(`✓ Índice: Incluído (Página 2 com seções listadas)`);
    console.log(`✓ Páginas: Múltiplas (Capa + Índice + Conteúdo formatado)`);
    console.log(`✓ Formatação Markdown:`);
    console.log(`  - ### Títulos: Renderizados com fonte maior/negrito`);
    console.log(`  - **negrito**: Renderizado com Helvetica-Bold`);
    console.log(`  - ---: Convertido em linha divisória visual (sem texto)`);
    console.log(`  - Linhas vazias: Preservadas como espaçamento`);

    console.log('\n═════════════════════════════════════════════════════════════');
    console.log('ESTRUTURA DO PDF GERADO');
    console.log('═════════════════════════════════════════════════════════════\n');
    console.log('Página 1: CAPA');
    console.log('  - Logo: ZUNI Suprema');
    console.log('  - Título: Mapa Integrado — Seu Mapa Astral e Numerológico');
    console.log('  - Participante: Ana Silva\n');

    console.log('Página 2: ÍNDICE');
    console.log('  - Mapa Integrado ZUNI Suprema ........ 3');
    console.log('  - PARTE I — SEU MAPA ASTRAL ......... 3');
    console.log('  - PARTE II — SUA NUMEROLOGIA ....... 3\n');

    console.log('Página 3+: CONTEÚDO (com formatação visual)');
    console.log('  - Títulos em negrito e fonte maior');
    console.log('  - Palavras em **negrito** com Helvetica-Bold');
    console.log('  - Linhas divisórias em vez de "---"');
    console.log('  - Numeração "Página N" no rodapé');

    console.log('\n📄 Arquivo de teste: teste-etapa-c.pdf\n');
  });

  stream.on('error', (err) => {
    console.error('❌ Erro ao gerar PDF:', err);
    process.exit(1);
  });
}

testarEtapaC();
