#!/usr/bin/env node
// Extrai texto puro de um manuscrito .docx para uso no pipeline de audiolivros.
//
// REGRA PADRÃO DO PIPELINE (desde 19/08/2026, obra "Ela Tem Classe"): a seção
// de Sumário/Índice (títulos de capítulo + números de página) é SEMPRE
// removida antes da síntese de voz. Motivo: o Sumário lista os mesmos títulos
// de capítulo do corpo do livro, e no manuscrito bruto os números de página
// costumam ficar colados ao texto (ex.: "Introdução3", "Capítulo 1 — ...5"),
// o que o TTS lê de forma incompreensível. Ver também CLAUDE.md.
//
// Detecção da faixa do Sumário a EXCISAR (não um corte único do início — um
// manuscrito real já mostrou ter conteúdo válido ANTES do Sumário, ver
// abaixo):
//   1. Localiza o bloco cujo texto é exatamente "Sumário" (heading OU
//      parágrafo em negrito — varia por manuscrito).
//   2. O fim da faixa é o PRÓXIMO heading (<h1-3>) com texto depois dele —
//      a lista de capítulos do Sumário é sempre texto corrido em <p>, nunca
//      heading, então o próximo heading real já é o recomeço do conteúdo.
//   3. Remove-se só esse intervalo [Sumário, próximo heading) — tudo antes e
//      tudo depois é mantido.
// Por que faixa e não "corte a partir do índice X": no manuscrito "Os
// Bastidores da Mente", a ordem real é Título → Apresentação (introdução de
// verdade, heading <h1>) → Sumário → PARTE I/Capítulo 1 (repetido). Um corte
// simples "a partir do primeiro heading" cortaria a Apresentação fora (ela é
// heading, viria antes do Sumário); um corte "a partir de depois do Sumário"
// perderia a Apresentação também, porque ela vem ANTES do Sumário no texto.
// Só excisar a faixa do Sumário preserva os dois.
// Em "Ela Tem Classe" a faixa cai bem no começo (não há nada de real antes
// do Sumário), então o efeito prático coincide com um corte do início — mas
// o algoritmo é o mesmo nos dois casos.
//
// Se nenhum bloco "Sumário" for encontrado, nada é removido — o script avisa
// para revisão manual (pode ser que o manuscrito não tenha Sumário, ou que
// use um texto ligeiramente diferente que não bateu com o regex).
//
// IMPORTANTE — cobertura de blocos: manuscritos podem ter listas (<ul>/<ol>)
// e tabelas (<table>) com conteúdo real (não só parágrafos <p>). Um bug já
// causou perda silenciosa de ~22% de um livro (209 itens de lista + 1 tabela
// descartados) porque o regex de blocos só capturava <p>/<h1-3>. Por isso:
//   - listas e tabelas são capturadas e linearizadas em texto (cada <li> vira
//     um parágrafo próprio; cada linha de tabela vira "célula — célula —...")
//   - ao final, a contagem de palavras do texto final é comparada com a
//     extração bruta (mammoth.extractRawText) do documento inteiro — a
//     faixa do Sumário excisada explica uma diferença pequena; muito mais
//     que isso indica perda de conteúdo, e o script avisa alto e claro em
//     vez de silenciar.
//
// Uso: node scripts/extrair-texto-docx.js <caminho.docx> <caminho-saida.txt>

const fs = require('fs');
const mammoth = require('mammoth');
const { textoPuro, ehNegritoTotal } = require('./formatar-livro-docx');

function textoDeLista(blocoHtml) {
  const itens = blocoHtml.match(/<li>.*?<\/li>/gs) || [];
  return itens.map((li) => textoPuro(li)).filter(Boolean).join('\n\n');
}

function textoDeTabela(blocoHtml) {
  const linhas = blocoHtml.match(/<tr>.*?<\/tr>/gs) || [];
  return linhas
    .map((linha) => {
      const celulas = linha.match(/<t[dh]>.*?<\/t[dh]>/gs) || [];
      return celulas.map((c) => textoPuro(c)).filter(Boolean).join(' — ');
    })
    .filter(Boolean)
    .join('\n\n');
}

function blocoParaTexto(blocoHtml) {
  if (blocoHtml.startsWith('<ul') || blocoHtml.startsWith('<ol')) return textoDeLista(blocoHtml);
  if (blocoHtml.startsWith('<table')) return textoDeTabela(blocoHtml);
  return textoPuro(blocoHtml);
}

function localizarFaixaSumario(blocos) {
  const idxSumario = blocos.findIndex((b) => /^Sum[aá]rio$/i.test(textoPuro(b).trim()));
  if (idxSumario === -1) return { inicio: -1, fim: -1, metodo: null };

  const idxFim = blocos.findIndex(
    (b, i) => i > idxSumario && /^<h[1-3]/.test(b) && textoPuro(b).trim().length > 0
  );
  if (idxFim !== -1) {
    return { inicio: idxSumario, fim: idxFim, metodo: 'bloco "Sumário" até o próximo heading' };
  }

  // achou "Sumário" mas nenhum heading depois — tenta achar o fim pela
  // convenção de negrito manual "CAPÍTULO 1 —" (mesmo heurístico de
  // formatar-livro-docx.js, para manuscritos sem heading nativo).
  const rePrimeiroCapitulo = /^Capítulo 1\s*—/i;
  const idxFimNegrito = blocos.findIndex(
    (b, i) => i > idxSumario && b.startsWith('<p>') && ehNegritoTotal(b) && rePrimeiroCapitulo.test(textoPuro(b))
  );
  if (idxFimNegrito !== -1) {
    return { inicio: idxSumario, fim: idxFimNegrito, metodo: 'bloco "Sumário" até "CAPÍTULO 1 —" em negrito' };
  }

  return { inicio: idxSumario, fim: -1, metodo: null };
}

async function main() {
  const docxPath = process.argv[2];
  const outPath = process.argv[3];

  if (!docxPath || !outPath) {
    console.error('Uso: node scripts/extrair-texto-docx.js <caminho.docx> <caminho-saida.txt>');
    process.exit(1);
  }

  const resultado = await mammoth.convertToHtml({ path: docxPath });
  const semImagens = resultado.value.replace(/<img[^>]*>/g, '');
  const blocos = semImagens.match(/<(p|h1|h2|h3|ul|ol|table)[^>]*>.*?<\/\1>/gs) || [];

  const { inicio: idxSumario, fim: idxFimSumario, metodo } = localizarFaixaSumario(blocos);

  if (idxSumario !== -1 && idxFimSumario === -1) {
    console.error('AVISO: encontrei o bloco "Sumário" mas não consegui detectar onde ele');
    console.error('termina (nenhum heading nem "CAPÍTULO 1 —" em negrito depois dele).');
    console.error('Revise o manuscrito manualmente antes de gerar áudio.');
    process.exit(1);
  }

  if (idxSumario === -1) {
    console.warn('AVISO: não encontrei um bloco "Sumário" — nada foi removido automaticamente.');
    console.warn('Confira manualmente se este manuscrito tem um Sumário/Índice que precise');
    console.warn('ser removido à mão antes de gerar áudio.\n');
  }

  const blocosFiltrados =
    idxSumario === -1 ? blocos : blocos.filter((_, i) => i < idxSumario || i >= idxFimSumario);

  const texto = blocosFiltrados.map(blocoParaTexto).filter(Boolean).join('\n\n');

  fs.writeFileSync(outPath, texto, 'utf-8');

  const palavras = texto.split(/\s+/).filter(Boolean).length;

  // Checagem de cobertura: compara com extractRawText do documento inteiro
  // para detectar conteúdo perdido pelo regex de blocos (ex.: tags não
  // cobertas), não só a faixa do Sumário excisada de propósito.
  const bruto = await mammoth.extractRawText({ path: docxPath });
  const palavrasBrutoTotal = bruto.value.split(/\s+/).filter(Boolean).length;
  const cobertura = palavras / palavrasBrutoTotal;

  console.log(`Faixa do Sumário: ${metodo || 'não encontrada'}`);
  console.log(`Blocos removidos: ${idxSumario === -1 ? 0 : idxFimSumario - idxSumario} (de ${blocos.length} totais)`);
  console.log(`Caracteres (corpo real): ${texto.length}`);
  console.log(`Palavras (corpo real): ${palavras}`);
  console.log(`Palavras no documento bruto (referência, com título/Sumário): ${palavrasBrutoTotal}`);
  console.log(`Cobertura: ${(cobertura * 100).toFixed(1)}%`);
  console.log(`Salvo em: ${outPath}`);
  console.log('\nLembrete: confira se o título comercial (nem sempre igual ao título interno');
  console.log('do .docx) precisa ser adicionado manualmente antes de gerar o áudio.');

  if (cobertura < 0.85) {
    console.warn('\n⚠️  ATENÇÃO: cobertura abaixo de 85% — bem mais do que o Sumário costuma');
    console.warn('representar. Pode haver conteúdo não capturado pelo regex de blocos (ex.:');
    console.warn('notas de rodapé, caixas de texto, elementos HTML não previstos). NÃO gere');
    console.warn('áudio a partir deste arquivo sem investigar antes.');
  }

  if (resultado.messages && resultado.messages.length) {
    console.log('\nAvisos do mammoth:');
    resultado.messages.forEach((m) => console.log(' -', m.message));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
