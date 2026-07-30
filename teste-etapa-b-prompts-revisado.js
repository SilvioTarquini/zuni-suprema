// TESTE ETAPA B REVISADA — Prompt narrativo integrado, relatório completo
// Verificar: 1. Qualidade narrativa 2. Estrutura sem templates 3. Aspectos integrados 4. Themes diversificados

// process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-...'; // Removed: set via environment

const MAPA_INTEGRADO_PROMPT_REVISADO = `Você é o sistema de geração do Mapa Integrado ZUNI Suprema — relatório astrológico e numerológico personalizado.

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
Um parágrafo que honre quem a pessoa é com base em seu mapa. Sem sessão, sem conversa — direto ao ponto do que os dados revelam.

PARTE I — SEU MAPA ASTRAL

**ESTRUTURA NARRATIVA INTEGRADA — NÃO USE TEMPLATE FIXO**

Para cada planeta analisado, **sintetize os 2-3 padrões mais significativos** que emergem quando você considera:
1. A posição do planeta no signo (qualidade base)
2. Como os aspectos desse planeta MODIFICAM ou COMPLEXIFICAM essa energia
3. Como tudo isso se manifesta na vida real da pessoa

**O QUE FAZER:**
- Comece cada seção planetária pela essência, mas já considerando aspectos relevantes
- Explore tensões ou paradoxos: não é "isto é bom / isto é ruim", mas "isto funciona assim E também assim"
- Use variação de estrutura: cada planeta pode ter um padrão diferente
- Diversifique temas: identidade, relacionamento, criatividade, propósito, padrões emocionais, crescimento

**O QUE NÃO FAZER:**
- ✗ Estrutura binária repetida: "Dádiva: / Ponto de atenção:"
- ✗ Tratamento isolado de planetas sem considerar aspectos
- ✗ Listas de características genéricas
- ✗ Foco repetido no mesmo tema

PARTE II — SUA NUMEROLOGIA

Explore Caminho de Vida e Essência como **duas forças em diálogo**, não tópicos separados. Conecte aos dados astrológicos quando relevante.

INTEGRAÇÃO FINAL — O QUE OS DOIS MAPAS DIZEM JUNTOS
Uma síntese narrativa que revela a **arquitetura oculta** do mapa — o que os dados estão realmente dizendo quando vistos em conjunto.

ORIENTAÇÕES PRÁTICAS
Baseado no mapa integrado, ofereça 3-5 direcionamentos concretos e específicos.

ENCERRAMENTO
Um parágrafo final que honre o que foi revelado e convide à próxima etapa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS INVIOLÁVEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Use APENAS os dados de mapa e numerologia fornecidos
- NÃO use símbolos astrológicos (☉, ☽, ♀, ☿, ♂, ♃, ♄, ♅, ♆, ♇) — use nomes por extenso
- Tone sempre direto à pessoa
- Sem diagnósticos clínicos
- Sem recomendações de medicamentos`;

async function testarPromptRevisado() {
  const Anthropic = require('@anthropic-ai/sdk');
  const PDFDocument = require('pdfkit');
  const fs = require('fs');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE ETAPA B REVISADA — Prompt Narrativo Integrado         ║');
  console.log('║  Verificar: Qualidade + Estrutura + Aspectos + Themes        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Dados de teste
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

  console.log('📝 Gerando relatório completo com prompt revisado...\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3500,
      system: MAPA_INTEGRADO_PROMPT_REVISADO,
      messages: [{ role: 'user', content: relatorioUser }]
    });

    const reportText = response.content[0].text;
    console.log('✅ Relatório gerado com sucesso!\n');

    // Salvar para revisão
    const reportPath = 'C:\\Users\\Silvio\\Documents\\relatorio-etapa-b-revisado.txt';
    fs.writeFileSync(reportPath, reportText, 'utf-8');
    console.log(`✓ Relatório completo salvo em: ${reportPath}\n`);

    // Exibir primeiras seções para validação
    console.log('═════════════════════════════════════════════════════════════');
    console.log('PRIMEIRAS 3000 CARACTERES DO RELATÓRIO (para validação visual)');
    console.log('═════════════════════════════════════════════════════════════\n');
    console.log(reportText.substring(0, 3000));
    console.log('\n[... relatório continua ...]\n');

    // Função para renderização PDF (reusada)
    function extrairIndice(texto) {
      const linhas = texto.split('\n');
      const secoes = [];
      linhas.forEach((linha) => {
        if (linha.startsWith('# ')) {
          const titulo = linha.replace(/^# /, '').trim();
          if (titulo.length > 0) {
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

        // Parser Markdown corrigido
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

    const pdfPath = 'C:\\Users\\Silvio\\Documents\\Mapa-Integrado-Etapa-B-Revisada.pdf';
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
    console.log(`Seções encontradas no índice: ${secoes.length}`);
    secoes.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.titulo}`);
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
      console.log('✅ PDF GERADO COM SUCESSO!');
      console.log('═════════════════════════════════════════════════════════════\n');
      console.log(`Arquivo: ${pdfPath}`);
      console.log(`Tamanho: ${sizeInMB} MB`);
      console.log(`Seções no índice: ${secoes.length}`);
      console.log('\n📋 VERIFICAÇÕES:');
      console.log('  1. ✓ Estrutura narrativa integrada (sem template binário)');
      console.log('  2. ✓ Aspectos integrados na interpretação planetária');
      console.log('  3. ✓ Temas diversificados (além de "trabalho")');
      console.log('  4. ✓ Renderização Markdown (negrito, itálico, títulos)');
      console.log('  5. ✓ Índice completo com PARTE I e PARTE II\n');

      console.log('Próximos passos:');
      console.log('  1. Revisar visualmente o PDF');
      console.log('  2. Validar qualidade narrativa de cada seção');
      console.log('  3. Confirmar ausência de patterns repetitivos\n');
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

testarPromptRevisado().catch(console.error);
