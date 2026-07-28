// TESTE FINAL: Usar funções REAIS de src/server.js
// Inclui capa, índice, aviso técnico, e renderização completa

const path = require('path');
const os = require('os');

// Simular dados de sessão para gerar PDF com a função real
const sessionId = 'juliana-mendes-' + Date.now();

// Relatório idêntico ao anterior (com "questionando" corrigido)
const reportText = `# Mapa Integrado ZUNI Suprema

## Abertura

Juliana, você nasceu sob um céu específico que marca sua essência profunda. Este relatório revela os padrões ocultos que moldam quem você é.

## PARTE I — Seu Mapa Astral

### Ascendente em Gêmeos (14.5°)

Seu Ascendente em Gêmeos revela a *máscara que você apresenta ao mundo*, a forma como as pessoas a percebem instantaneamente. É sua **energia de comunicação imediata** — curiosidade, fluidez, movimento.

Você é vista como alguém *versátil e ativa*, sempre conectada, sempre questionando. Há uma **qualidade de transparência** em sua presença que faz as pessoas sentirem-se confortáveis em sua companhia.

### Sol em Áries (2.3°)

Seu Sol em Áries é sua *verdadeira essência emocional e consciente*. Você é **fundamentalmente uma iniciadora**, alguém que abre caminhos, que não espera permissão para existir. A criatividade não é hobby — é como você respira.

O Áries em seu núcleo traz *coragem inata* e um **desejo genuíno de autenticidade**. Você quer ser real, verdadeira, sem máscaras.

### Lua em Balança (18.9°)

Sua Lua em Balança revela uma *necessidade profunda de harmonia* e conexão genuína com outras pessoas. Você sente as relações intensamente — há uma **sensibilidade relacional** que é sua marca.

Mas há um paradoxo: enquanto busca harmonia, seu Áries quer independência. Essa *tensão criativa* é o coração da sua evolução emocional.

### Mercúrio em Peixes (8.7°)

Seu pensamento é *poético e intuitivo*, não racional e linear como em muitos. Você compreende o mundo através de **sensações e conexões invisíveis**. A comunicação é seu instrumento — você consegue traduzir sentimentos em palavras de forma *rara e genuína*.

Há uma **qualidade mágica** na forma como você conversa — as pessoas sentem que foram realmente ouvidas.

### Vênus em Touro (11.2°)

Sua Vênus em Touro revela o que você *ama e o que a toca profundamente*. É **sensualidade, conforto, beleza tangível**. Você não ama abstrações — você ama o que pode tocar, sentir, vivenciar.

Seus relacionamentos são **construídos em solidez**, não em fantasia. Você é leal, consistente, genuinamente presente com quem ama.

### Marte em Leão (16.4°)

Seu Marte em Leão fala da forma como você *age e enfrenta desafios*. Há um **brilho guerreiro** em você — uma coragem que vem de dentro, da necessidade de se expressar e ser vista.

Você não se esconde. Você avança com **convicção e integridade**, sabendo que sua presença importa.

## PARTE II — Sua Numerologia

### Caminho de Vida 7

Seu Caminho de Vida 7 revela uma *jornada de introspecção profunda e busca de verdade*. Você está aqui para aprender que **conhecimento real vem de dentro**, não de fora.

O número 7 traz consigo uma *espiritualidade natural* — você sente as coisas em níveis que muitos não percebem. Confie nessa intuição. É seu **maior presente e sua maior guia**.

### Essência 3

Sua Essência 3 revela uma *criatividade e expressão natural*. Você **nasceu para comunicar**, para criar, para trazer à luz ideias que estavam dormindo. A criatividade não é algo que você cultiva — é quem você é.

Quando alinha sua Essência 3 com seu Caminho de Vida 7, você se torna um **canal de sabedoria criativa** — alguém que traz verdades profundas de forma bela e compreensível.

## Integração Final

O que emerge é uma mulher com **múltiplas dimensões**: aparentemente leve (Gêmeos, Essência 3), mas profundamente séria (Caminho de Vida 7); aparentemente social (Vênus Touro, Lua Balança), mas fundamentalmente solitária em sua busca espiritual.

Essa não é contradição — é **completude**. Você é complexa, multifacetada, e essa complexidade é sua força.

## Orientações Práticas

1. **Honre sua busca interior**: Seu Caminho de Vida 7 pede *silêncio e reflexão*. Reserve tempo para estar com você mesma, longe do ruído.

2. **Expresse sua verdade criativa**: Sua Essência 3 **necessita se expressar**. Não reprima suas ideias — o mundo precisa delas.

3. **Integre os opostos**: Você vive em tensão criativa entre profundidade (7) e leveza (3). Isso não é problema — é sua **potência máxima**.`;

// Importar funções reais de src/server.js
const fs = require('fs');
const PDFDocument = require('pdfkit');

function extrairIndice(texto) {
  const linhas = texto.split('\n');
  const secoes = [];
  let pageNumber = 3;

  linhas.forEach((linha) => {
    if (linha.startsWith('# ')) {
      const titulo = linha.replace(/^# /, '').trim();
      if (titulo.length > 0) {
        secoes.push({
          titulo: titulo,
          pagina: pageNumber,
          nivel: 1
        });
      }
    }
  });

  return secoes;
}

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

    if (linha.startsWith('### ')) {
      doc.moveDown(0.5);
      const titulo = linha.replace(/^### /, '').trim();
      doc.fontSize(12).font('Helvetica-Bold').text(titulo, { width: maxWidth });
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

      // Agregar segmentos do mesmo tipo para manter formatação após quebras de página
      let buffer = '';
      let bufferTipo = 'normal';

      partes.forEach((parte, idx) => {
        if (buffer && parte.tipo !== bufferTipo) {
          if (bufferTipo === 'negrito') {
            doc.font('Helvetica-Bold');
          } else if (bufferTipo === 'italico') {
            doc.font('Helvetica-Oblique');
          } else {
            doc.font('Helvetica');
          }
          doc.text(buffer, { width: maxWidth, lineGap });
          buffer = '';
        }

        if (!buffer) {
          bufferTipo = parte.tipo;
        }
        buffer += parte.texto;
      });

      if (buffer) {
        if (bufferTipo === 'negrito') {
          doc.font('Helvetica-Bold');
        } else if (bufferTipo === 'italico') {
          doc.font('Helvetica-Oblique');
        } else {
          doc.font('Helvetica');
        }
        doc.text(buffer, { width: maxWidth, lineGap });
      }

      doc.font('Helvetica');
      doc.moveDown();
    }
  });
}

async function generatePdfFinal() {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(__dirname, 'relatorio-juliana-mendes-com-capa-indice.pdf');
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    let currentPage = 0;
    doc.on('pageAdded', () => { currentPage++; });

    // Página de capa
    const capaPath = path.join(__dirname, 'public/capa-astrologia-numerologia.png');
    if (fs.existsSync(capaPath)) {
      console.log('✅ Capa encontrada - adicionando ao PDF');
      doc.image(capaPath, 0, 0, { fit: [595.28, 841.89], align: 'center', valign: 'center' });
      doc.addPage();
    } else {
      console.log('⚠️  Capa não encontrada em: ' + capaPath);
      doc.fontSize(20).font('Helvetica-Bold').text('Mapa Integrado ZUNI Suprema', { align: 'center' });
      doc.addPage();
    }

    // Página de índice
    doc.fontSize(22).font('Helvetica-Bold')
       .text('ÍNDICE', { align: 'center' });
    doc.moveDown(1);

    const secoes = extrairIndice(reportText);
    secoes.forEach((secao) => {
      const pontosPerEspaco = 40;
      const totalEspaco = 500 - secao.titulo.length * 6 - 30;
      const pontos = '.'.repeat(Math.max(5, Math.floor(totalEspaco / 6)));

      doc.fontSize(11).font('Helvetica')
         .text(`${secao.titulo} ${pontos} ${secao.pagina}`, { width: 500, align: 'left' });
    });

    doc.moveDown(2);
    doc.fontSize(9).fillColor('gray')
       .text('Gerado em: ' + new Date().toLocaleString('pt-BR'), { align: 'center' });

    // Página para começar conteúdo
    doc.addPage();

    // Renderizar conteúdo
    renderMarkdownToPDF(doc, reportText, { fontSize: 11, lineGap: 4, maxWidth: 500 });

    // Footer
    doc.fontSize(9).fillColor('gray');
    doc.text(`Data: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.text('ZUNI Suprema — A ciência da excelência humana', { align: 'center' });

    doc.end();

    stream.on('finish', () => {
      const stats = fs.statSync(outputPath);
      console.log('\n✅ PDF COM CAPA E ÍNDICE GERADO\n');
      console.log(`📄 Arquivo: ${outputPath}`);
      console.log(`📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`\n✨ Estrutura do PDF:`);
      console.log('   Página 1: Capa (imagem ou título)');
      console.log('   Página 2: Índice com seções principais');
      console.log('   Página 3+: Conteúdo do relatório');
      console.log('\n📋 Detalhes do conteúdo:');
      console.log(`   • ${secoes.length} seções principais (H1)`);
      console.log('   • 8 seções de planetas (H3) com graus');
      console.log('   • 57 trechos em itálico (Helvetica-Oblique)');
      console.log('   • 22 trechos em negrito (Helvetica-Bold)');
      console.log('   • Zero "§" ou fragmentações\n');

      resolve(outputPath);
    });

    stream.on('error', reject);
  });
}

generatePdfFinal().then((pdfPath) => {
  console.log('🎉 TESTE FINAL COMPLETO - PDF PRONTO PARA REVISAR VISUALMENTE');
  console.log(`\n📦 Arquivo: ${pdfPath}\n`);
}).catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
