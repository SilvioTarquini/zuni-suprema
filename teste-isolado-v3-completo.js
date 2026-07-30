// TESTE ISOLADO COMPLETO — renderMarkdownToPDF V2
// Conteúdo SUFICIENTE para forçar 3-4 quebras de página
// Objetivo: validar que negrito/itálico são mantidos após quebra de página

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Importar função V2
const { renderMarkdownToPDF } = require('./src/renderMarkdownToPDF-v2');

async function testeCompletoComQuebras() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  TESTE ISOLADO COMPLETO — renderMarkdownToPDF V2          ║');
  console.log('║  Com volume de conteúdo para forçar quebras de página     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Conteúdo com 10+ parágrafos (suficiente para 3-4 páginas)
  const textoCompleto = `# Teste de Renderização com Quebras de Página

## Introdução

Este teste valida a renderização de **negrito** e *itálico* em um documento que atravessa múltiplas páginas. O objetivo é garantir que quando uma frase com formatação é quebrada entre páginas, a formatação é **mantida corretamente** na página seguinte.

## Parágrafo 1 — Texto Normal com Formatação

O primeiro parágrafo contém um exemplo simples: *aqui temos itálico* no meio de um texto normal, seguido de **negrito** e depois *voltamos a itálico*. Isso simula o padrão encontrado no Mapa Integrado com descrições de planetas e casas astrológicas. A frase deve fluir naturalmente sem quebras forçadas a cada mudança de formatação, mesmo que cruze de uma página para outra.

## Parágrafo 2 — Cenário Complexo

Agora temos um cenário mais desafiador: **inicialmente em negrito**, depois *transição para itálico*, depois de volta a **negrito novamente**. Este parágrafo é propositalmente longo para simular conteúdo real do Mapa Integrado. Aqui temos várias frases que podem quebrar entre páginas, e precisamos validar que cada trecho mantém sua formatação específica, independentemente de onde a quebra ocorra.

## Parágrafo 3 — Teste de Continuidade

Este é o terceiro parágrafo, com ainda mais **conteúdo formatado intercalado**. Observe como *estamos alternando* entre tipos de formatação constantemente. Isso é importante porque simula a realidade de um relatório profissional onde negrito destaca termos-chave e itálico destaca nuances emocionais ou conceituais. A renderização deve ser suave e profissional, sem que o leitor note quebras de página como "artifatos" visuais.

## Parágrafo 4 — Frase Longa Intencional

Este parágrafo contém uma única frase muito longa que será forçosamente quebrada entre múltiplas linhas (e possivelmente páginas) para validar que o fluxo de texto funciona corretamente. A frase começa aqui: *você vê itálico no início*, depois entra **negrito mais à frente**, depois *volta a itálico novamente*, e **termina em negrito** para completar o teste. Se esta frase atravessar uma quebra de página, precisamos confirmar visualmente que ela continua legível e corretamente formatada na próxima página.

## Parágrafo 5 — Validação Adicional

**Começamos este parágrafo em negrito**, o que é importante porque testa se o PDFKit consegue aplicar negrito no início de uma página nova. Depois temos *itálico*, e mais **negrito**. O parágrafo continua com conteúdo suficiente para garantir que estamos exercitando múltiplos cenários de quebra. Cada formatação deve ser preservada rigorosamente.

## Parágrafo 6 — Mais Conteúdo

*Iniciando em itálico*, este parágrafo testa o oposto do anterior. Depois há **negrito**, depois *volta a itálico*, depois mais **negrito**. Tudo isso em um documento que deve atravessar várias páginas. A qualidade visual deve ser consistente do início ao fim, sem degradação de formatação em nenhum ponto.

## Parágrafo 7 — Teste de Resilência

Este parágrafo é propositalmente longo e repleto de mudanças de formatação para estressar a função. **Aqui temos negrito**, *depois itálico*, **de volta a negrito**, *mais itálico*, e assim por diante. O objetivo é garantir que o PDFKit com a técnica de continuidade consegue lidar com múltiplas mudanças rápidas de formatação sem falhas visuais, quebras de linha desejadas, ou perda de conteúdo.

## Parágrafo 8 — Validação de Rodapé

*Este é o penúltimo parágrafo*, com **conteúdo suficiente para atingir próximas páginas**. Aqui testamos se o rodapé e outras informações aparecem corretamente. O parágrafo continua: *mais itálico*, **mais negrito**, tudo funcionando conforme esperado. A função renderMarkdownToPDF deve ser capaz de lidar com documentos de tamanho real sem nenhuma regressão.

## Parágrafo 9 — Teste Final

**Este é o parágrafo final do teste**, onde validamos que a formatação funciona até o fim do documento. *Aqui temos itálico*, depois **negrito**, depois *itálico novamente*, e **terminamos em negrito**. Tudo deve estar funcionando perfeitamente neste ponto, sem nenhuma degradação de qualidade desde a primeira página até aqui.

---

## Resumo

Se você abrir este PDF e todos os parágrafos acima estiverem com formatação **legível, contínua, sem sobreposição e sem quebras forçadas**, então a função renderMarkdownToPDF V2 está **FUNCIONANDO CORRETAMENTE** para o caso real de uso.

Especialmente importante: se você ver uma frase que atravessa de uma página para outra (ex: parágrafo 4 ou 5), confirme que a formatação é **mantida na página seguinte**.`;

  return new Promise((resolve, reject) => {
    const outputPath = path.join(__dirname, 'teste-isolado-v3-completo.pdf');
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // Renderizar com a função V2
    renderMarkdownToPDF(doc, textoCompleto, {
      fontSize: 11,
      lineGap: 4,
      maxWidth: 500
    });

    // Footer
    doc.fontSize(9).fillColor('gray');
    doc.text('Teste isolado completo — renderMarkdownToPDF V2 com quebras de página', { align: 'center' });
    doc.text(`Gerado: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

    doc.end();

    stream.on('finish', () => {
      const stats = fs.statSync(outputPath);

      console.log('✅ PDF TESTE COMPLETO GERADO\n');
      console.log(`📄 Arquivo: ${outputPath}`);
      console.log(`📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB\n`);

      console.log('🎯 O QUE ESTE TESTE VALIDA:\n');
      console.log('   1️⃣  QUEBRAS DE PÁGINA REAIS');
      console.log('      Este documento tem conteúdo suficiente para gerar 3-4 páginas');
      console.log('      Vai forçar quebras de página automáticas\n');

      console.log('   2️⃣  FORMATAÇÃO APÓS QUEBRA');
      console.log('      Procure por frases que cruzam de uma página para outra');
      console.log('      Exemplo: se uma frase em negrito termina na página 2');
      console.log('               e continua na página 3, o negrito deve continuar');
      console.log('               (não ficar normal na página 3)\n');

      console.log('   3️⃣  CONTINUIDADE DE TEXTO');
      console.log('      Nenhuma palavra deve aparecer duplicada ou cortada');
      console.log('      Negrito (**)e itálico (*) devem funcionar em todo documento\n');

      console.log('   4️⃣  APARÊNCIA PROFISSIONAL');
      console.log('      De página 1 até a última, tudo deve parecer um documento');
      console.log('      profissional, sem artefatos visuais\n');

      console.log('✨ PRÓXIMOS PASSOS:');
      console.log('   1. Abra: teste-isolado-v3-completo.pdf');
      console.log('   2. Navegue por TODAS as páginas');
      console.log('   3. Procure especialmente por frases que cruzam páginas');
      console.log('   4. Tire PRINT SCREEN de 2-3 páginas diferentes');
      console.log('   5. Confirme se formatação foi mantida em todas\n');

      resolve(outputPath);
    });

    stream.on('error', reject);
  });
}

testeCompletoComQuebras()
  .then((pdfPath) => {
    console.log('🎉 TESTE COMPLETO PRONTO\n');
  })
  .catch((err) => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });
