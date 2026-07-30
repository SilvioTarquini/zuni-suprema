// TESTE PIPELINE FINAL — renderMarkdownToPDF V2 com Juliana Mendes (11 planetas)
// Simula: checkout → dados astrológicos → geração de conteúdo → renderização PDF
// NÃO envia e-mail, apenas gera arquivo PDF final

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Importar função V2
const { renderMarkdownToPDF } = require('./src/renderMarkdownToPDF-v2');

// Dados reais de Juliana Mendes (dos testes anteriores)
const JulianaMendes = {
  nome: 'Juliana Mendes',
  dataNascimento: '22/03/1988',
  horaNascimento: '16:45',
  localNascimento: 'Rio de Janeiro',
  astrologia: {
    ascendente: { signo: 'Gêmeos', grau: 14.5 },
    sol: { signo: 'Áries', grau: 2.3 },
    lua: { signo: 'Balança', grau: 18.9 },
    mercurio: { signo: 'Peixes', grau: 8.7 },
    venus: { signo: 'Touro', grau: 11.2 },
    marte: { signo: 'Leão', grau: 16.4 },
    jupiter: { signo: 'Sagitário', grau: 20.1 },
    saturno: { signo: 'Capricórnio', grau: 5.6 },
    urano: { signo: 'Aquário', grau: 22.3 },
    netuno: { signo: 'Peixes', grau: 11.8 },
    plutao: { signo: 'Áries', grau: 25.9 }
  },
  numerologia: {
    caminhoDeVida: 7,
    essencia: 3
  }
};

// Relatório expandido com 11 planetas (gerado sinteticamente)
const relatorioJuliana = `# Mapa Integrado ZUNI Suprema

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

### Júpiter em Sagitário (20.1°)

Seu Júpiter em Sagitário é a *chama da expansão e da fé*. Você possui uma **crença natural na vida**, uma otimismo que não é ingenuidade — é conhecimento de que há sempre mais a descobrir.

Há em você um *apetite insaciável por verdade*, por significado. Você quer entender o mundo em profundidade, não apenas conhecê-lo superficialmente. O desafio é não dispersar essa energia em mil direções diferentes.

### Saturno em Capricórnio (5.6°)

Seu Saturno em Capricórnio traz *estrutura profunda e responsabilidade*. Você compreende, em nível visceral, que **construir é trabalho**. Não há atalho para o real.

Há uma *sabedoria que vem da experiência difícil*, lições que aprendeu porque as viveu. Saturno aqui pode parecer limitante, mas é na verdade seu **maior ativo** — a capacidade de transformar visão em realidade concreta.

### Urano em Aquário (22.3°)

Seu Urano em Aquário revela uma *necessidade de liberdade genuína e inovação*. Você não segue o molde apenas porque é o esperado — há uma **rebeldia inteligente** em você, questionadora.

Urano aqui busca *ruptura criativa*, novas formas de ser e pensar. Você é alguém que desafia o status quo não por rebeldia vazia, mas porque vê possibilidades que outros ainda não enxergam.

### Netuno em Peixes (11.8°)

Seu Netuno em Peixes aprofunda sua *natureza espiritual e intuitiva*. Há em você uma **capacidade quase mágica de se conectar com o invisível** — intuição, arte, o reino do espírito.

O desafio é não perder-se nessa dissolução. Netuno em Peixes pede clareza: discernimento entre o que é verdade espiritual e o que é ilusão, entre compaixão genuína e enmeshment emocional.

### Plutão em Áries (25.9°)

Seu Plutão em Áries fala de *transformação profunda através da ação e coragem*. Há um **poder de renascimento** em você — a capacidade de morrer para quem era e emergir como uma versão mais autêntica de si mesma.

Plutão aqui traz *intensidade e verdade*. Você não se contenta com meias-medidas. Quando se compromete com algo, é com toda sua alma.

## PARTE II — Sua Numerologia

### Caminho de Vida 7

Seu Caminho de Vida 7 revela uma *jornada de introspecção profunda e busca de verdade*. Você está aqui para aprender que **conhecimento real vem de dentro**, não de fora.

O número 7 traz consigo uma *espiritualidade natural* — você sente as coisas em níveis que muitos não percebem. Confie nessa intuição. É seu **maior presente e sua maior guia**.

### Essência 3

Sua Essência 3 revela uma *criatividade e expressão natural*. Você **nasceu para comunicar**, para criar, para trazer à luz ideias que estavam dormindo. A criatividade não é algo que você cultiva — é quem você é.

Quando alinha sua Essência 3 com seu Caminho de Vida 7, você se torna um **canal de sabedoria criativa** — alguém que traz verdades profundas de forma bela e compreensível.

## Integração Final

O que emerge é uma mulher com **múltiplas dimensões e poder genuíno**:
- Aparentemente leve (Gêmeos, Essência 3), mas profundamente séria (Caminho de Vida 7)
- Aparentemente social (Vênus Touro, Lua Balança), mas fundamentalmente solitária em sua busca espiritual
- Criativa (Marte em Leão), mas estruturada (Saturno em Capricórnio)
- Expansiva (Júpiter em Sagitário), mas discernidora (Netuno em Peixes)
- Inovadora (Urano em Aquário), mas enraizada (Vênus em Touro)

Essa não é contradição — é **plenitude**. Você é complexa, multifacetada, e essa complexidade é sua força genuína e seu propósito neste tempo.

## Orientações Práticas

1. **Integre suas múltiplas naturezas**: Você não precisa escolher entre criatividade e estrutura, inovação e tradição. Seu mapa pede que você as *reconcilie* — isso é seu trabalho evolutivo específico.

2. **Proteja sua sensibilidade sem perder a coragem**: Seu Netuno pede discernimento; seu Plutão pede coragem. Ambas são necessárias. Use sua intuição como bússola, mas sua ação como âncora.

3. **Confie no seu processo lento e profundo**: O Caminho 7 não é rápido. Você está aqui para *compreender*, não apenas fazer. Isso é revolucionário em um mundo que valoriza apenas a velocidade.`;

async function testePipelineFinal() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE PIPELINE FINAL — renderMarkdownToPDF V2             ║');
  console.log('║  Juliana Mendes | 11 Planetas | Numerologia Completa      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('📋 DADOS DE ENTRADA:\n');
  console.log(`   Nome: ${JulianaMendes.nome}`);
  console.log(`   Data: ${JulianaMendes.dataNascimento}`);
  console.log(`   Hora: ${JulianaMendes.horaNascimento}`);
  console.log(`   Local: ${JulianaMendes.localNascimento}\n`);

  console.log('🌍 ASTROLOGIA CALCULADA:\n');
  console.log(`   Ascendente: ${JulianaMendes.astrologia.ascendente.signo} ${JulianaMendes.astrologia.ascendente.grau}°`);
  console.log(`   Sol: ${JulianaMendes.astrologia.sol.signo} ${JulianaMendes.astrologia.sol.grau}°`);
  console.log(`   Lua: ${JulianaMendes.astrologia.lua.signo} ${JulianaMendes.astrologia.lua.grau}°`);
  console.log(`   Mercúrio: ${JulianaMendes.astrologia.mercurio.signo} ${JulianaMendes.astrologia.mercurio.grau}°`);
  console.log(`   Vênus: ${JulianaMendes.astrologia.venus.signo} ${JulianaMendes.astrologia.venus.grau}°`);
  console.log(`   Marte: ${JulianaMendes.astrologia.marte.signo} ${JulianaMendes.astrologia.marte.grau}°`);
  console.log(`   Júpiter: ${JulianaMendes.astrologia.jupiter.signo} ${JulianaMendes.astrologia.jupiter.grau}°`);
  console.log(`   Saturno: ${JulianaMendes.astrologia.saturno.signo} ${JulianaMendes.astrologia.saturno.grau}°`);
  console.log(`   Urano: ${JulianaMendes.astrologia.urano.signo} ${JulianaMendes.astrologia.urano.grau}°`);
  console.log(`   Netuno: ${JulianaMendes.astrologia.netuno.signo} ${JulianaMendes.astrologia.netuno.grau}°`);
  console.log(`   Plutão: ${JulianaMendes.astrologia.plutao.signo} ${JulianaMendes.astrologia.plutao.grau}°\n`);

  console.log('🔢 NUMEROLOGIA:\n');
  console.log(`   Caminho de Vida: ${JulianaMendes.numerologia.caminhoDeVida}`);
  console.log(`   Essência: ${JulianaMendes.numerologia.essencia}\n`);

  console.log('📝 GERANDO PDF COM V2...\n');

  return new Promise((resolve, reject) => {
    const outputPath = path.join(__dirname, 'relatorio-juliana-mendes-v2-final.pdf');
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // Página de capa (simples, sem imagem)
    doc.fontSize(22).font('Helvetica-Bold').text('Mapa Integrado ZUNI Suprema', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(14).font('Helvetica').text(JulianaMendes.nome, { align: 'center' });
    doc.fontSize(10).fillColor('gray').text(`${JulianaMendes.dataNascimento} | ${JulianaMendes.horaNascimento} | ${JulianaMendes.localNascimento}`, { align: 'center' });
    doc.moveDown(2);
    doc.fillColor('black');

    // Página de índice
    doc.addPage();
    doc.fontSize(18).font('Helvetica-Bold').text('ÍNDICE', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(11).font('Helvetica');
    doc.text('Seu Mapa Astral.........................................................................3');
    doc.text('Astrologia Expandida (11 Planetas).....................................................4');
    doc.text('Sua Numerologia..........................................................................12');
    doc.text('Integração Final.........................................................................14');

    doc.moveDown(2);
    doc.fontSize(9).fillColor('gray').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

    // Página de conteúdo
    doc.addPage();
    doc.fillColor('black');
    renderMarkdownToPDF(doc, relatorioJuliana, {
      fontSize: 11,
      lineGap: 4,
      maxWidth: 500
    });

    // Footer em todas as páginas
    doc.on('pageAdded', () => {
      doc.fontSize(9).fillColor('gray');
      doc.text('ZUNI Suprema — A ciência da excelência humana', { align: 'center' });
    });

    doc.end();

    stream.on('finish', () => {
      const stats = fs.statSync(outputPath);
      console.log('✅ PDF GERADO COM SUCESSO\n');
      console.log(`📄 Arquivo: ${path.basename(outputPath)}`);
      console.log(`📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`⏰ Criado: ${stats.mtime.toLocaleString('pt-BR')}\n`);

      resolve(outputPath);
    });

    stream.on('error', (err) => {
      console.error('❌ Erro ao criar PDF:', err.message);
      reject(err);
    });
  });
}

testePipelineFinal()
  .then((pdfPath) => {
    console.log('🎉 PIPELINE CONCLUÍDO — PDF PRONTO PARA ANÁLISE\n');
    console.log(`📦 Arquivo salvo em: ${pdfPath}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro no pipeline:', err.message);
    process.exit(1);
  });
