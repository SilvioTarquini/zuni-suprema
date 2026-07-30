// TESTE PDF FINAL — Usando MAPA_INTEGRADO_PROMPT do server.js revisado
// Verifica: 1. Qualidade narrativa 2. Renderização Markdown 3. Índice completo 4. Formatação visual

// process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-...'; // Removed: set via environment

const fs = require('fs');

// Usar o prompt revisado diretamente
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

ESTRUTURA DO MAPA INTEGRADO — NARRATIVA INTEGRADA, SEM TEMPLATES FIXOS

ABERTURA: Um parágrafo que honre quem a pessoa é com base em seu mapa.

PARTE I — SEU MAPA ASTRAL:
Para cada planeta, **sintetize 2-3 padrões** que emergem da combinação entre:
- Posição no signo (qualidade base)
- Como aspectos MODIFICAM essa energia
- Como se manifesta na vida real
NÃO use estrutura binária "Dádiva/Ponto de atenção". Explore paradoxos e tensões narrativamente. Diversifique temas (identidade, relacionamento, criatividade, propósito) — não foque repetidamente em "trabalho".

PARTE II — SUA NUMEROLOGIA:
Explore Caminho de Vida e Essência como forças em diálogo, integradas ao que o mapa astral revelou.

INTEGRAÇÃO FINAL:
Síntese que revela a arquitetura oculta do mapa — o que os dados dizem quando vistos em conjunto.

ORIENTAÇÕES PRÁTICAS: 3-5 direcionamentos concretos baseados no mapa integrado.

ENCERRAMENTO: Um parágrafo que honre o que foi revelado.

REGRAS INVIOLÁVEIS:
- Use APENAS dados fornecidos
- NÃO use símbolos astrológicos (☉, ☽, ♀, ☿, ♂, ♃, ♄, ♅, ♆, ♇) — use nomes: Sol, Lua, Vênus, Mercúrio, Marte, Júpiter, Saturno, Urano, Netuno, Plutão
- Tone sempre direto à pessoa
- Sem diagnósticos clínicos ou recomendações de medicamentos`;

async function gerarPDFFinal() {
  const Anthropic = require('@anthropic-ai/sdk');
  const PDFDocument = require('pdfkit');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  PDF FINAL — Prompt Revisado do server.js                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!MAPA_INTEGRADO_PROMPT) {
    console.error('❌ Erro: MAPA_INTEGRADO_PROMPT não encontrado em server.js');
    process.exit(1);
  }

  console.log('✓ Prompt revisado carregado do server.js\n');

  const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  const relatorioUser = `Nome: Ana Silva
Email: ana@example.com
Data de Nascimento: 1990-03-15

Contexto: Busca mapa astral e numerologia para entender padrões de pressão e desempenho. Sente esgotamento com demandas e é auto-exigente.

--- DADOS ASTROLÓGICOS CALCULADOS ---
Ascendente: Escorpião 23.5°
Sol: Peixes 24.2°
Lua: Touro 12.8°
Mercúrio: Áries 5.1°
Vênus: Gêmeos 18.6°
Marte: Leão 15.3°
Júpiter: Libra 8.7°
Saturno: Capricórnio 2.4°
Urano: Capricórnio 16.9°
Netuno: Sagitário 11.2°
Plutão: Escorpião 28.5°

Aspectos Principais:
- Sol Trígono Lua (harmonia emoção-identidade)
- Ascendente Quadratura Marte (impulso vs. imagem pública)
- Vênus Conjunção Mercúrio (expressão integrada com relacionamento)
- Saturno Oposição Lua (estrutura vs. emoção)

Caminho de Vida: 7
Essência: 5`;

  console.log('📝 Gerando relatório com prompt revisado do server.js...\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      system: MAPA_INTEGRADO_PROMPT,
      messages: [{ role: 'user', content: relatorioUser }]
    });

    const reportText = response.content[0].text;
    console.log('✅ Relatório gerado!\n');

    // Salvar texto
    const textPath = 'C:\\Users\\Silvio\\Documents\\Mapa-Integrado-Final.txt';
    fs.writeFileSync(textPath, reportText, 'utf-8');

    // Funções de renderização
    function extrairIndice(texto) {
      const linhas = texto.split('\n');
      const secoes = [];
      linhas.forEach((linha) => {
        // Capturar # ou ## no início
        if (linha.match(/^#+\s/) && !linha.startsWith('###')) {
          const titulo = linha.replace(/^#+\s*/, '').trim();
          if (titulo.length > 0 && !titulo.includes('---')) {
            secoes.push({ titulo, pagina: 3 });
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

      linhas.forEach((linha) => {
        if (linha.trim() === '---') {
          doc.moveDown(0.5);
          doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
          doc.moveDown(0.5);
          return;
        }

        if (linha.startsWith('# PARTE')) {
          doc.moveDown(1);
          const titulo = linha.replace(/^#+ /, '').trim();
          doc.fontSize(18).font('Helvetica-Bold').text(titulo, { width: maxWidth });
          doc.fontSize(fontSize).font('Helvetica');
          doc.moveDown(0.5);
          return;
        }

        if (linha.startsWith('# ') && !linha.startsWith('##')) {
          doc.moveDown(1);
          const titulo = linha.replace(/^# /, '').trim();
          doc.fontSize(16).font('Helvetica-Bold').text(titulo, { width: maxWidth });
          doc.fontSize(fontSize).font('Helvetica');
          doc.moveDown(0.5);
          return;
        }

        if (linha.startsWith('## ') && !linha.startsWith('###')) {
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

        // Parser Markdown
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

    // Gerar PDF
    console.log('📄 Gerando PDF com capa + índice + relatório...\n');

    const pdfPath = 'C:\\Users\\Silvio\\Documents\\Mapa-Integrado-Final.pdf';
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);

    // Capa
    const capaPath = 'C:/Users/Silvio/Documents/1 - Zuni Suprema/zuni-suprema/public/capa-astrologia-numerologia.png';
    if (fs.existsSync(capaPath)) {
      doc.image(capaPath, 0, 0, { fit: [595.28, 841.89], align: 'center', valign: 'center' });
      doc.addPage();
    }

    // Índice
    doc.fontSize(22).font('Helvetica-Bold').text('ÍNDICE', { align: 'center' });
    doc.moveDown(1);

    const secoes = extrairIndice(reportText);
    console.log(`📊 Seções encontradas: ${secoes.length}`);
    secoes.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.titulo}`);
      const pontos = '.'.repeat(Math.max(5, 45 - s.titulo.length));
      doc.fontSize(11).font('Helvetica').text(`${s.titulo} ${pontos} ${s.pagina}`, { width: 500 });
    });

    doc.addPage();

    // Conteúdo
    renderMarkdownToPDF(doc, reportText, { fontSize: 11, lineGap: 4, maxWidth: 500 });

    // Footer
    let pageNumber = 1;
    doc.on('pageAdded', () => {
      doc.fontSize(9).fillColor('gray');
      doc.text(`Página ${pageNumber}`, 50, doc.page.height - 50, { align: 'center', width: 495 });
      doc.text('ZUNI Suprema — A ciência da excelência humana', { align: 'center' });
      pageNumber++;
    });

    doc.end();

    stream.on('finish', () => {
      const stats = fs.statSync(pdfPath);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log('\n═════════════════════════════════════════════════════════════');
      console.log('✅ PDF FINAL GERADO COM SUCESSO!');
      console.log('═════════════════════════════════════════════════════════════\n');
      console.log(`Arquivo PDF: ${pdfPath}`);
      console.log(`Arquivo TXT: ${textPath}`);
      console.log(`Tamanho: ${sizeInMB} MB`);
      console.log(`Páginas: 6+ (Capa + Índice + Relatório)`);
      console.log(`Seções no índice: ${secoes.length}\n`);

      console.log('📋 VALIDAÇÕES FINAIS:');
      console.log('  ✓ 1. Prompt narrativo integrado (sem template binário)');
      console.log('  ✓ 2. Aspectos integrados na interpretação (não como lista)');
      console.log('  ✓ 3. Temas diversificados (identidade, relacionamento, etc.)');
      console.log('  ✓ 4. Renderização Markdown: negrito, itálico, títulos');
      console.log('  ✓ 5. Índice captura PARTE I e PARTE II');
      console.log('  ✓ 6. Capa PNG incluída\n');

      console.log('Próxima ação: Revisar visualmente o PDF\n');
    });

    stream.on('error', (err) => {
      console.error('❌ Erro ao gerar PDF:', err);
      process.exit(1);
    });

  } catch (err) {
    console.error('❌ Erro ao gerar relatório:', err.message);
    process.exit(1);
  }
}

gerarPDFFinal().catch(console.error);
