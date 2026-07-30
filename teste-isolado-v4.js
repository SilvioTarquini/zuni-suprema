// TESTE ISOLADO V4 — renderMarkdownToPDF V2
// Conteúdo TRIPLICADO (20+ parágrafos) para forçar 4+ páginas com múltiplas quebras
// Inclui parágrafo que COMEÇA COM NEGRITO para testar renderização no topo de página

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Importar função V2
const { renderMarkdownToPDF } = require('./src/renderMarkdownToPDF-v2');

async function testeV4ComMuitoConteudo() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE ISOLADO V4 — renderMarkdownToPDF V2                ║');
  console.log('║  Conteúdo TRIPLICADO + Parágrafo com **negrito inicial** ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Conteúdo SUBSTANCIALMENTE MAIOR (20+ parágrafos)
  const textoMuito = `# Teste Isolado V4 — Renderização com Múltiplas Quebras

## Introdução e Contexto

Este teste valida a renderização de **negrito** e *itálico* em um documento com volume substancial que atravessa 4 ou mais páginas. O objetivo é garantir que múltiplas quebras de página automáticas não degradem a formatação, e que trechos formatados no início de uma página nova são renderizados corretamente.

## Parágrafo 1 — Base de Validação

O primeiro parágrafo contém um exemplo simples: *aqui temos itálico* no meio de um texto normal, seguido de **negrito** e depois *voltamos a itálico*. Isso simula o padrão encontrado no Mapa Integrado com descrições de planetas e casas astrológicas. A frase deve fluir naturalmente sem quebras forçadas a cada mudança de formatação, mesmo que cruze de uma página para outra. O conteúdo continua aqui com mais texto para garantir volume.

## Parágrafo 2 — Cenário Complexo

Agora temos um cenário mais desafiador: **inicialmente em negrito**, depois *transição para itálico*, depois de volta a **negrito novamente**. Este parágrafo é propositalmente longo para simular conteúdo real do Mapa Integrado. Aqui temos várias frases que podem quebrar entre páginas, e precisamos validar que cada trecho mantém sua formatação específica, independentemente de onde a quebra ocorra. O parágrafo continua crescendo.

## Parágrafo 3 — Teste de Continuidade

Este é o terceiro parágrafo, com ainda mais **conteúdo formatado intercalado**. Observe como *estamos alternando* entre tipos de formatação constantemente. Isso é importante porque simula a realidade de um relatório profissional onde negrito destaca termos-chave e itálico destaca nuances emocionais ou conceituais. A renderização deve ser suave e profissional, sem que o leitor note quebras de página como artefatos visuais indesejados.

## Parágrafo 4 — Frase Longa Intencional

Este parágrafo contém uma única frase muito longa que será forçosamente quebrada entre múltiplas linhas (e possivelmente páginas) para validar que o fluxo de texto funciona corretamente. A frase começa aqui: *você vê itálico no início*, depois entra **negrito mais à frente**, depois *volta a itálico novamente*, e **termina em negrito** para completar o teste. Se esta frase atravessar uma quebra de página, precisamos confirmar visualmente que ela continua legível.

## Parágrafo 5 — Validação Adicional

**Começamos este parágrafo em negrito**, o que é importante porque testa se o PDFKit consegue aplicar negrito no início de uma página nova. Depois temos *itálico*, e mais **negrito**. O parágrafo continua com conteúdo suficiente para garantir que estamos exercitando múltiplos cenários de quebra. Cada formatação deve ser preservada rigorosamente do início ao fim.

## Parágrafo 6 — Mais Conteúdo para Volume

*Iniciando em itálico*, este parágrafo testa o oposto do anterior. Depois há **negrito**, depois *volta a itálico*, depois mais **negrito**. Tudo isso em um documento que deve atravessar várias páginas. A qualidade visual deve ser consistente do início ao fim, sem degradação de formatação em nenhum ponto do documento. Continuamos adicionando volume.

## Parágrafo 7 — Teste de Resilência Nível 1

Este parágrafo é propositalmente longo e repleto de mudanças de formatação para estressar a função. **Aqui temos negrito**, *depois itálico*, **de volta a negrito**, *mais itálico*, e assim por diante. O objetivo é garantir que a técnica de continuidade consegue lidar com múltiplas mudanças rápidas de formatação sem falhas visuais, quebras de linha desejadas, ou perda de conteúdo em qualquer lugar do documento.

## Parágrafo 8 — Teste de Resilência Nível 2

**Este parágrafo começa completamente em negrito** para testar especificamente o cenário de um trecho formatado no topo de uma página nova. Depois temos *itálico*, **negrito**, *itálico novamente*, e continuamos alternando. O volume é suficiente para garantir múltiplas quebras. A qualidade deve ser mantida rigorosamente, inclusive quando negrito ou itálico é o primeiro elemento de uma página nova.

## Parágrafo 9 — Continuação com Mais Volume

*Este parágrafo começa com itálico*, testando o cenário oposto ao anterior. Depois há **negrito**, *mais itálico*, e assim por diante. O conteúdo continua crescendo para garantir que temos páginas suficientes com quebras reais. Cada parágrafo tem volume deliberado para forçar comportamento realista do PDFKit em relação a quebras automáticas.

## Parágrafo 10 — Validação de Meio de Documento

**Aqui estamos no meio do documento aproximadamente**, com ainda mais **conteúdo formatado** intercalado. *Itálico*, **negrito**, *volta a itálico*, tudo funcionando conforme esperado. O volume total deve ser suficiente para atingir pelo menos 4 páginas reais, com múltiplas quebras de parágrafo no meio de frases.

## Parágrafo 11 — Mais Conteúdo Estruturado

Este parágrafo continua o teste com **negrito intercalado**, *itálico estrategicamente colocado*, e mais **negrito para encerramento de frases**. O conteúdo é propositalmente verbose para garantir volume. Cada palavra contribui para o total, aumentando a probabilidade de quebras em múltiplos pontos.

## Parágrafo 12 — Teste de Formatação Mista Intensiva

*Iniciamos com itálico*, seguido imediatamente de **negrito**, depois *volta a itálico*, depois **negrito**, tudo em sucessão rápida. Isso testa a capacidade de processar múltiplas mudanças de formatação consecutivas. O parágrafo continua com volume adicional.

## Parágrafo 13 — Preparação para Mais Páginas

**Começamos em negrito**, *depois itálico*, e mantemos alternância contínua. O documento está crescendo em volume, e esperamos atingir página 4 ou 5 em breve. Cada parágrafo é construído deliberadamente com frases longas para forçar quebras naturais e realistas de página.

## Parágrafo 14 — Continuar Adicionando Volume

*Aqui temos itálico no início*, seguido de **negrito**, *mais itálico*, **negrito novamente**. O conteúdo é suficiente para continuar preenchendo páginas. O objetivo é ter múltiplas quebras de parágrafo no meio (não apenas no final), para validar que a formatação é mantida quando um parágrafo é dividido entre páginas.

## Parágrafo 15 — Ainda Mais Conteúdo

**Este parágrafo começa forte em negrito**, testando novamente o cenário de negrito no topo de página (aumentando chances estatísticas). *Depois itálico*, **negrito**, *itálico*, etc. O volume continua crescendo para garantir cobertura adequada.

## Parágrafo 16 — Teste de Formato na Transição

*Iniciamos com itálico* para validar itálico no topo de página. Depois **negrito**, *volta a itálico*, **negrito novamente**. O parágrafo tem comprimento suficiente para ocupar espaço significativo, aumentando a probabilidade de cruzar limite de página.

## Parágrafo 17 — Volume Substancial Adicional

**Começamos em negrito**, porque queremos realmente testar esse cenário. *Itálico*, **negrito**, *itálico*, **negrito final**. Este é um parágrafo longo, deliberadamente construído para ocupar espaço e criar quebras naturais em diferentes pontos.

## Parágrafo 18 — Aproximação do Final com Mais Conteúdo

*Iniciamos em itálico*, seguido de **negrito**, *volta a itálico*, e mais **negrito**. O documento está quase completo em termos de volume, mas ainda há espaço para um ou dois parágrafos finais. Cada elemento é cuidadosamente mantido para garantir teste rigoroso.

## Parágrafo 19 — Penúltimo com Formatação Completa

**Começamos este penúltimo parágrafo em negrito**, *depois itálico*, **negrito**, *itálico*, **negrito final**. O volume total agora deve estar próximo ou em 5 páginas. Cada quebra de página deve ser criada naturalmente pelo PDFKit.

## Parágrafo 20 — Parágrafo Final de Encerramento

*Este é o parágrafo final*, com **negrito**, *itálico*, **negrito**, e *itálico novamente*. Tudo deve estar funcionando perfeitamente neste ponto, sem nenhuma degradação de qualidade desde a primeira página até aqui. A formatação deve estar consistente do início ao fim.

---

## Resumo Executivo

Se você abrir este PDF e todos os parágrafos acima estiverem com formatação legível, contínua, sem sobreposição e sem quebras forçadas desnecessárias, então a função renderMarkdownToPDF V2 está funcionando corretamente.

Especialmente importante: procure por parágrafo 2, 5, 8, 13, 15, 17 e 19 que começam com **negrito** — valide que o negrito aparece corretamente até se esses parágrafos caírem no topo de uma página nova.`;

  return new Promise((resolve, reject) => {
    const outputPath = path.join(__dirname, 'teste-isolado-v4.pdf');
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // Renderizar com a função V2
    renderMarkdownToPDF(doc, textoMuito, {
      fontSize: 11,
      lineGap: 4,
      maxWidth: 500
    });

    // Footer
    doc.fontSize(9).fillColor('gray');
    doc.text('Teste isolado V4 — renderMarkdownToPDF V2 com múltiplas quebras de página', { align: 'center' });
    doc.text(`Gerado: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

    doc.end();

    stream.on('finish', () => {
      const stats = fs.statSync(outputPath);
      console.log('✅ PDF V4 GERADO COM SUCESSO\n');
      console.log(`📄 Arquivo: ${outputPath}`);
      console.log(`📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`⏰ Criado: ${stats.mtime.toLocaleString('pt-BR')}\n`);

      console.log('📋 ESPECIFICAÇÕES DO TESTE:\n');
      console.log('   • 20 parágrafos H2 (seções)');
      console.log('   • 7 parágrafos começam com **negrito** (seções 2, 5, 8, 13, 15, 17, 19)');
      console.log('   • 5 parágrafos começam com *itálico* (seções 3, 6, 9, 14, 16, 18, 20)');
      console.log('   • Múltiplas frases longas com formatação intercalada');
      console.log('   • Volume triplicado vs teste anterior');
      console.log('   • Esperado: 4-5 páginas com múltiplas quebras reais\n');

      console.log('🎯 PRÓXIMAS AÇÕES:\n');
      console.log('   1. Contar páginas reais do PDF');
      console.log('   2. Identificar em quais páginas há quebra de parágrafo no meio');
      console.log('   3. Validar formatação em cada quebra');
      console.log('   4. Reportar findings precisamente\n');

      resolve(outputPath);
    });

    stream.on('error', reject);
  });
}

testeV4ComMuitoConteudo()
  .then((pdfPath) => {
    console.log('🎉 TESTE V4 PRONTO PARA ANÁLISE\n');
  })
  .catch((err) => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });
