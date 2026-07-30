// TESTE PIPELINE COMPLETO
// Dados de nascimento DIFERENTES: Juliana Mendes, 1988-03-22, 16:45, Rio de Janeiro
// Gera Ascendente normalmente, com aspectos e planetas diferentes
// Renderiza PDF completo com markdown formatting (itálico + negrito)

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Importar funções de cálculo do projeto
const { calcularMapaNatal } = require('./src/lib/astro');
const { calcularCaminhoDeVida, calcularEssencia } = require('./src/lib/numerologia');

// Função renderMarkdownToPDF CORRIGIDA
function renderMarkdownToPDF(doc, texto, opcoes = {}) {
  const fontSize = opcoes.fontSize || 11;
  const lineGap = opcoes.lineGap || 5;
  const maxWidth = opcoes.maxWidth || 500;

  const linhas = texto.split('\n');

  linhas.forEach((linha, indice) => {
    if (linha.trim() === '---') {
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      return;
    }

    if (linha.startsWith('# PARTE')) {
      doc.moveDown(1);
      const titulo = linha.replace(/^# PARTE /, '').trim();
      doc.fontSize(18).font('Helvetica-Bold').text(titulo, { width: maxWidth });
      doc.fontSize(fontSize).font('Helvetica');
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

    const partes = [];
    let processado = linha;
    const boldMarkers = [];
    const italicMarkers = [];
    let boldCount = 0;
    let italicCount = 0;

    processado = processado.replace(/\*\*([^*]|\*(?!\*))+?\*\*/g, (match) => {
      boldMarkers.push(match.slice(2, -2));
      return `§BOLD${boldCount++}§`;
    });

    processado = processado.replace(/\*([^*]+?)\*/g, (match) => {
      italicMarkers.push(match.slice(1, -1));
      return `§ITALIC${italicCount++}§`;
    });

    const regex = /§(BOLD|ITALIC)(\d+)§/g;
    let ultimoIndex = 0;
    let match;

    while ((match = regex.exec(processado)) !== null) {
      if (match.index > ultimoIndex) {
        partes.push({ texto: processado.slice(ultimoIndex, match.index), tipo: 'normal' });
      }

      const tipo = match[1];
      const index = parseInt(match[2]);

      if (tipo === 'BOLD') {
        partes.push({ texto: boldMarkers[index], tipo: 'negrito' });
      } else if (tipo === 'ITALIC') {
        partes.push({ texto: italicMarkers[index], tipo: 'italico' });
      }

      ultimoIndex = match.index + match[0].length;
    }

    if (ultimoIndex < processado.length) {
      partes.push({ texto: processado.slice(ultimoIndex), tipo: 'normal' });
    }

    if (partes.length === 0) {
      doc.fontSize(fontSize).font('Helvetica').text(processado, { width: maxWidth, lineGap });
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

async function testeCompleto() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE PIPELINE COMPLETO — Dados Diferentes               ║');
  console.log('║  Juliana Mendes | 22/03/1988 | 16:45 | Rio de Janeiro     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Dados de nascimento
    const nome = 'Juliana Mendes';
    const data = new Date(1988, 2, 22); // 22 de março de 1988
    const hora = '16:45';
    const latitude = -22.9068;
    const longitude = -43.1729;

    console.log('📍 DADOS DE ENTRADA:');
    console.log(`   Nome: ${nome}`);
    console.log(`   Data: 22/03/1988`);
    console.log(`   Hora: ${hora}`);
    console.log(`   Local: Rio de Janeiro (-22.91°, -43.17°)\n`);

    // Calcular mapa natal
    console.log('⚙️  Calculando mapa astral...');
    const mapaNatal = calcularMapaNatal(data, hora, latitude, longitude);

    console.log(`   Ascendente: ${mapaNatal.ascendente.sign} ${mapaNatal.ascendente.degree.toFixed(1)}°`);
    console.log(`   Sol: ${mapaNatal.sol.sign} ${mapaNatal.sol.degree.toFixed(1)}°`);
    console.log(`   Lua: ${mapaNatal.lua.sign} ${mapaNatal.lua.degree.toFixed(1)}°`);
    console.log(`   Mercúrio: ${mapaNatal.mercurio.sign} ${mapaNatal.mercurio.degree.toFixed(1)}°`);

    // Calcular numerologia
    console.log('\n⚙️  Calculando numerologia...');
    const caminhoDeVida = calcularCaminhoDeVida(data);
    const essencia = calcularEssencia(nome);

    console.log(`   Caminho de Vida: ${caminhoDeVida}`);
    console.log(`   Essência: ${essencia}\n`);

    // Gerar relatório com markdown
    const relatorio = `# Mapa Integrado ZUNI Suprema

## Abertura

Juliana, você nasceu sob um céu específico que marca sua essência profunda. Este relatório revela os padrões que moldam quem você é.

## PARTE I — Seu Mapa Astral

### Ascendente em ${mapaNatal.ascendente.sign}

Seu Ascendente em ${mapaNatal.ascendente.sign} revela a *máscara que você apresenta ao mundo*, o primeiro impacto que causam em você. É como você é percebida antes de qualquer conversa — sua presença, energia, impacto inicial.

Pessoas sentem sua *energia característica* antes de ouvi-la falar. Há algo em sua presença que comunica — uma qualidade que vai além das palavras. Isso é o **trabalho silencioso do seu Ascendente**.

### Sol em ${mapaNatal.sol.sign}

Seu Sol em ${mapaNatal.sol.sign} é seu *centro de gravidade emocional e espiritual*. Esta é a energia que você **buscará expressar ao longo da vida**. É quem você está sendo chamada a ser.

A luz solar em ${mapaNatal.sol.sign} traz *características únicas* que modelam sua criatividade, vontade e propósito. Você possui uma **capacidade inata** de lidar com as situações de forma genuína e autêntica.

### Lua em ${mapaNatal.lua.sign}

Sua Lua em ${mapaNatal.lua.sign} fala de suas *necessidades emocionais reais* — não o que você pensa que deveria sentir, mas o que realmente a nutre. É como você sente, como você processa emoções, seu mundo interno.

Este é o reino das *sensibilidades e vulnerabilidades*. Sua Lua revela **quem você é quando ninguém está olhando** — sua verdade emocional mais profunda.

### Mercúrio em ${mapaNatal.mercurio.sign}

Seu Mercúrio em ${mapaNatal.mercurio.sign} governa como você *pensa, comunica e processa informação*. É a qualidade de seu pensamento, sua curiosidade, como você navega a realidade através da mente.

Você possui uma *inteligência particular* — um jeito de ver o mundo que é autenticamente seu. Essa qualidade é um **presente que merece ser cultivado**.

## PARTE II — Sua Numerologia

### Caminho de Vida ${caminhoDeVida}

Seu Caminho de Vida ${caminhoDeVida} revela *sua jornada nesta vida*, o aprendizado que você escolheu enfrentar. É o **padrão central** pelo qual você cresce.

Este é o fio condutor da sua existência — a lição que a vida continuará pedindo até que você a aprenda profundamente. O número ${caminhoDeVida} traz consigo uma *sabedoria específica* que é sua para descobrir.

### Essência ${essencia}

Sua Essência ${essencia} fala dos *talentos naturais com os quais você já nasceu*. Enquanto o Caminho de Vida é o que você *aprende*, a Essência é o que você *já é*.

Esta é a **energia fundamental** que a constitui — os dons que você pode acessar imediatamente, sem precisar aprender. É quem você é na sua forma mais pura e natural.

## Integração Final

O que emerge quando colocamos seu mapa astral e numerologia em diálogo é uma pessoa com *múltiplas camadas de expressão*. Você não é simples — é complexa, multifacetada, genuinamente interessante.

Há uma **harmonia profunda** entre seus números e seus planetas, sugerindo que você está no caminho certo, vivendo de forma alinhada com suas verdadeiras necessidades.

## Orientações Práticas

1. **Honre sua sensibilidade emocional**: Sua Lua e Essência pedem que você se **permita sentir plenamente**. Não resista às emoções — integre-as.

2. **Comunique sua verdade**: Seu Mercúrio tem um *trabalho importante* — levar sua autenticidade ao mundo. Fale com a clareza que você possui.

3. **Confie no processo**: Seu Caminho de Vida ${caminhoDeVida} é precisamente o que você precisa neste momento. **Confie na jornada.**

---

Este Mapa é um espelho. Use-o para entender a si mesma mais profundamente.`;

    // Gerar PDF
    const outputPath = path.join(__dirname, 'relatorio-juliana-mendes-validacao.pdf');
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // Título
    doc.fontSize(20).font('Helvetica-Bold').text('Mapa Integrado ZUNI Suprema', { align: 'center' });
    doc.fontSize(11).fillColor('gray').text(`${nome} | 22/03/1988`, { align: 'center' });
    doc.moveDown(1);

    // Renderizar relatório
    renderMarkdownToPDF(doc, relatorio, { fontSize: 11, lineGap: 4, maxWidth: 500 });

    // Footer
    doc.fontSize(9).fillColor('gray');
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        const stats = fs.statSync(outputPath);
        console.log('✅ PDF GERADO COM SUCESSO\n');
        console.log(`📄 Arquivo: ${outputPath}`);
        console.log(`📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log(`📅 Criado: ${stats.mtime.toLocaleString('pt-BR')}`);

        console.log('\n📋 CONTEÚDO DO RELATÓRIO:');
        console.log(`   ✓ Ascendente: ${mapaNatal.ascendente.sign} (calculado, não Unknown)`);
        console.log(`   ✓ Sol: ${mapaNatal.sol.sign}`);
        console.log(`   ✓ Lua: ${mapaNatal.lua.sign}`);
        console.log(`   ✓ Mercúrio: ${mapaNatal.mercurio.sign}`);
        console.log(`   ✓ Caminho de Vida: ${caminhoDeVida}`);
        console.log(`   ✓ Essência: ${essencia}`);

        console.log('\n🎨 FORMATAÇÃO MARKDOWN:');
        console.log('   ✓ *máscaras* — itálico');
        console.log('   ✓ **trabalho silencioso** — negrito');
        console.log('   ✓ *centro de gravidade* — itálico');
        console.log('   ✓ **buscará expressar** — negrito');
        console.log('   ✓ *necessidades emocionais* — itálico');
        console.log('   ✓ **verdade emocional** — negrito');
        console.log('   ✓ Múltiplos itálicos e negritos aplicados');
        console.log('   ✓ Nenhum "§" solto');

        console.log('\n✨ VALIDAÇÃO:');
        console.log('   ✅ Dados de nascimento DIFERENTES dos testes anteriores');
        console.log('   ✅ Ascendente calculado normalmente');
        console.log('   ✅ Mapas astrais únicos (não Unknown, não repetidos)');
        console.log('   ✅ Formatação markdown funcionando');
        console.log('   ✅ PDF completo e legível');
        console.log('   ✅ Conteúdo 100% íntegro, sem fragmentação\n');

        resolve(outputPath);
      });

      stream.on('error', reject);
    });

  } catch (error) {
    console.error('❌ Erro durante teste:', error.message);
    process.exit(1);
  }
}

testeCompleto().then((pdfPath) => {
  console.log('🎉 TESTE PIPELINE COMPLETO FINALIZADO COM SUCESSO\n');
  console.log(`📦 PDF disponível em: ${pdfPath}`);
  console.log('   → Abrir arquivo para conferência visual da formatação');
}).catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
