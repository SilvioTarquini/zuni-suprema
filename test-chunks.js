// test-chunks.js
// Teste de parsing e tokenização antes de indexar — Etapa 4 do pipeline

const fs = require('fs');
const path = require('path');

const MAX_PALAVRAS_POR_CHUNK = 2500;

function parseBlocosDelimitador(raw) {
  const regex = /={3,}\s*TEMA:\s*(.+?)\s*={3,}/g;
  const marcadores = [];
  let m;
  while ((m = regex.exec(raw)) !== null) {
    marcadores.push({ tema: m[1].trim(), inicioMarcador: m.index, fimMarcador: m.index + m[0].length });
  }

  if (!marcadores.length) return null;

  return marcadores.map((marcador, i) => {
    const fimCorpo = i + 1 < marcadores.length ? marcadores[i + 1].inicioMarcador : raw.length;
    return { tema: marcador.tema, corpo: raw.slice(marcador.fimMarcador, fimCorpo).trim() };
  });
}

function parseBlocosColchetes(raw) {
  const segmentos = raw
    .split(/\n={5,}\n?/)
    .map(b => b.trim())
    .filter(Boolean);

  const blocos = [];

  segmentos.forEach((bloco, i) => {
    const variantA = bloco.match(/^\[([^\]]+)\]\s*\n([\s\S]+)$/);
    if (variantA) {
      blocos.push({ tema: variantA[1].trim(), corpo: variantA[2].trim() });
      return;
    }

    const variantB = bloco.match(/^\[TEMA\]\s+(.+?)\n([\s\S]+)$/);
    if (variantB) {
      blocos.push({ tema: variantB[1].trim(), corpo: variantB[2].trim() });
      return;
    }

    if (i === 0 || i === segmentos.length - 1) {
      return;
    }

    throw new Error(`Bloco fora do formato [TEMA] esperado:\n${bloco.slice(0, 80)}...`);
  });

  return blocos;
}

function parseBlocos(raw) {
  return parseBlocosDelimitador(raw) || parseBlocosColchetes(raw);
}

function dividirEmSubChunks(corpo, maxPalavras) {
  const paragrafos = corpo.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const subChunks = [];
  let atual = [];
  let palavrasAtual = 0;

  for (const paragrafo of paragrafos) {
    const palavrasParagrafo = paragrafo.split(/\s+/).length;

    if (palavrasParagrafo > maxPalavras) {
      if (atual.length) {
        subChunks.push(atual.join('\n\n'));
        atual = [];
        palavrasAtual = 0;
      }
      // Para parágrafos muito longos, dividir por frases
      const frases = paragrafo.match(/[^.!?]+[.!?]+(\s|$)/g) || [paragrafo];
      let frasesBuffer = [];
      let frasesBufferCount = 0;
      for (const frase of frases) {
        const palavrasFrase = frase.split(/\s+/).length;
        if (frasesBufferCount > 0 && frasesBufferCount + palavrasFrase > maxPalavras) {
          subChunks.push(frasesBuffer.join(''));
          frasesBuffer = [];
          frasesBufferCount = 0;
        }
        frasesBuffer.push(frase);
        frasesBufferCount += palavrasFrase;
      }
      if (frasesBuffer.length) {
        subChunks.push(frasesBuffer.join(''));
      }
      continue;
    }

    if (palavrasAtual > 0 && palavrasAtual + palavrasParagrafo > maxPalavras) {
      subChunks.push(atual.join('\n\n'));
      atual = [];
      palavrasAtual = 0;
    }

    atual.push(paragrafo);
    palavrasAtual += palavrasParagrafo;
  }

  if (atual.length) {
    subChunks.push(atual.join('\n\n'));
  }

  return subChunks;
}

function expandirBlocosParaChunks(blocos, maxPalavras) {
  const chunks = [];

  blocos.forEach(bloco => {
    const totalPalavras = bloco.corpo.split(/\s+/).length;

    if (totalPalavras <= maxPalavras) {
      chunks.push({ titulo: bloco.tema, corpo: bloco.corpo });
      return;
    }

    const partes = dividirEmSubChunks(bloco.corpo, maxPalavras);
    partes.forEach((parte, i) => {
      chunks.push({
        titulo: `${bloco.tema} (parte ${i + 1}/${partes.length})`,
        corpo: parte
      });
    });
  });

  return chunks;
}

async function testarArquivo(caminho, nomeTemaPara) {
  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`Testando: ${path.basename(caminho)}`);
  console.log(`Tema para indexar: ${nomeTemaPara}`);
  console.log(`════════════════════════════════════════════════════════`);

  try {
    const raw = fs.readFileSync(caminho, 'utf8');
    const blocos = parseBlocos(raw);

    if (!blocos || blocos.length === 0) {
      console.error('❌ Nenhum bloco encontrado!');
      return false;
    }

    console.log(`✅ Blocos encontrados: ${blocos.length}`);

    const chunks = expandirBlocosParaChunks(blocos, MAX_PALAVRAS_POR_CHUNK);
    console.log(`✅ Chunks gerados: ${chunks.length}`);

    const divididos = chunks.length - blocos.length;
    if (divididos > 0) {
      console.log(`   ⚠️  ${divididos} sub-chunk(s) gerado(s) a partir de blocos > ${MAX_PALAVRAS_POR_CHUNK} palavras`);
    }

    // Encontrar o maior chunk
    let maiorTamanho = 0;
    let maiorChunk = null;

    chunks.forEach(chunk => {
      const palavras = chunk.corpo.split(/\s+/).length;
      if (palavras > maiorTamanho) {
        maiorTamanho = palavras;
        maiorChunk = chunk;
      }
    });

    console.log(`\n📊 Estatísticas:`);
    console.log(`   • Maior chunk: ${maiorTamanho} palavras (${maiorChunk.titulo})`);
    console.log(`   • Estimativa de tokens (palavras × 1.35): ~${Math.ceil(maiorTamanho * 1.35)} tokens`);
    console.log(`   • Limite do modelo (text-embedding-3-small): 8.191 tokens`);

    const estaSeguro = maiorTamanho * 1.35 < 8000;
    if (estaSeguro) {
      console.log(`   ✅ SEGURO: Nenhum chunk ultrapassa o limite`);
      return true;
    } else {
      console.log(`   ❌ PERIGO: Alguns chunks podem exceder o limite!`);
      return false;
    }

  } catch (err) {
    console.error(`❌ Erro ao testar arquivo:`, err.message);
    return false;
  }
}

async function main() {
  console.log(`\n🔍 ETAPA 4 — Teste de Parsing e Tokenização`);
  console.log(`MAX_PALAVRAS_POR_CHUNK: ${MAX_PALAVRAS_POR_CHUNK}`);

  const arquivo1 = `C:\\Users\\Silvio\\Documents\\Subir para o RAG\\elegancia_charme_feminino_RAG.txt`;
  const arquivo2 = `C:\\Users\\Silvio\\Documents\\Subir para o RAG\\elegancia_presenca_masculina_RAG.txt`;

  const resultado1 = await testarArquivo(arquivo1, 'elegancia_charme_feminino');
  const resultado2 = await testarArquivo(arquivo2, 'elegancia_presenca_masculina');

  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`📋 RESUMO DA ETAPA 4`);
  console.log(`════════════════════════════════════════════════════════`);
  console.log(`elegancia_charme_feminino: ${resultado1 ? '✅ PASSA' : '❌ FALHA'}`);
  console.log(`elegancia_presenca_masculina: ${resultado2 ? '✅ PASSA' : '❌ FALHA'}`);

  if (resultado1 && resultado2) {
    console.log(`\n✅ Ambos os arquivos estão prontos para ETAPA 5 (indexação)!\n`);
    process.exit(0);
  } else {
    console.log(`\n❌ Um ou mais arquivos não passaram na validação.\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
