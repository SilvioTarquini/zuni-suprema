// src/indexarTema.js
//
// Pipeline de ingestao da base RAG de um TEMA (ex.: timidez_comunicacao,
// namoro_conquista_romance), usado pela busca hibrida do Mentor
// (funcao public.buscar_documentos_hibrido). Adaptado de indexarLivro.js,
// que faz o mesmo trabalho mas grava por livro_id em vez de tema.
//
// Aceita um arquivo .txt organizado em blocos temáticos, em um destes
// dois formatos (detectados automaticamente):
//
//   [TEMA]                              === TEMA: NOME ===
//   texto do bloco...          ou       texto do bloco...
//   ==========
//
// Cada bloco vira um ou mais chunks em public.documentos, com a coluna
// `tema` preenchida diretamente no INSERT (nao via UPDATE posterior).
// Rodar de novo para o mesmo tema substitui os chunks anteriores
// (apaga e reinsere).
//
// DIFERENCA IMPORTANTE em relacao a indexarLivro.js:
// Blocos que excedem o limite de tokens do modelo de embedding
// (text-embedding-3-small: 8191 tokens) sao automaticamente divididos
// em sub-chunks, respeitando fronteiras de paragrafo (nunca corta uma
// frase ao meio). Todos os sub-chunks de um mesmo bloco original
// recebem o mesmo `tema` e um `titulo` sufixado com "(parte N/M)".
// Isso foi necessario porque, diferente dos livros ja fatiados
// manualmente em blocos pequenos, alguns temas foram compostos por
// obras inteiras como bloco unico (dezenas de milhares de palavras).
//
// Uso: node src/indexarTema.js <tema> <caminho-do-arquivo.txt>

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 10;
const DELAY_MS = 500;

// Limite de seguranca por sub-chunk, bem abaixo do teto real do modelo
// (8191 tokens), para deixar margem de erro na estimativa de tokens
// (que aqui e feita por contagem de palavras, nao por tokenizer real).
const MAX_PALAVRAS_POR_CHUNK = 2500;

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseBlocosColchetes(raw) {
  const segmentos = raw
    .split(/\n={5,}\n?/)
    .map(b => b.trim())
    .filter(Boolean);

  const blocos = [];

  segmentos.forEach((bloco, i) => {
    // Variante A (Volume IV): "[Título]\ncorpo" — o título inteiro fica dentro dos colchetes.
    const variantA = bloco.match(/^\[([^\]]+)\]\s*\n([\s\S]+)$/);
    if (variantA) {
      blocos.push({ tema: variantA[1].trim(), corpo: variantA[2].trim() });
      return;
    }

    // Variante B (Volume II): "[TEMA] Título\ncorpo" — "[TEMA]" é rótulo fixo, título vem depois.
    const variantB = bloco.match(/^\[TEMA\]\s+(.+?)\n([\s\S]+)$/);
    if (variantB) {
      blocos.push({ tema: variantB[1].trim(), corpo: variantB[2].trim() });
      return;
    }

    if (i === 0 || i === segmentos.length - 1) {
      // Primeiro/último segmento sem o formato esperado costuma ser
      // cabeçalho ou rodapé do arquivo (título da obra, "FIM DA BASE") —
      // ignora. Qualquer bloco no meio fora do padrão é erro real.
      return;
    }

    throw new Error(`Bloco fora do formato [TEMA] esperado:\n${bloco.slice(0, 80)}...`);
  });

  return blocos;
}

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

function parseBlocos(raw) {
  return parseBlocosDelimitador(raw) || parseBlocosColchetes(raw);
}

// Divide um corpo de texto longo em sub-blocos menores que
// MAX_PALAVRAS_POR_CHUNK, respeitando fronteiras de paragrafo
// (nunca corta uma frase ao meio). Se um unico paragrafo isolado ja
// exceder o limite, cai no fallback dividirParagrafoPorFrase que divide
// por frases para garantir seguranca.
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
      subChunks.push(...dividirParagrafoPorFrase(paragrafo, maxPalavras));
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

// Fallback para dividir um paragrafo isolado que excede maxPalavras.
// Divide por frases (termino em .!?) para garantir que nenhum chunk
// ultrapasse o limite de tokens mesmo para paragrafos gigantes.
function dividirParagrafoPorFrase(paragrafo, maxPalavras) {
  const frases = paragrafo.match(/[^.!?]+[.!?]+(\s|$)/g) || [paragrafo];

  const partes = [];
  let atual = [];
  let palavrasAtual = 0;

  for (const frase of frases) {
    const palavrasFrase = frase.split(/\s+/).length;

    if (palavrasAtual > 0 && palavrasAtual + palavrasFrase > maxPalavras) {
      partes.push(atual.join(''));
      atual = [];
      palavrasAtual = 0;
    }

    atual.push(frase);
    palavrasAtual += palavrasFrase;
  }

  if (atual.length) {
    partes.push(atual.join(''));
  }

  return partes;
}

// Expande a lista de blocos {tema, corpo} em uma lista de chunks prontos
// para indexar, dividindo os blocos grandes demais em partes menores.
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

async function gerarEmbeddingsBatch(textos) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: textos })
  });

  if (!resp.ok) {
    throw new Error(`Falha ao gerar embeddings (status ${resp.status}): ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.data.map(item => item.embedding);
}

async function indexarTema(tema, arquivoPath) {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados para usar o Supabase.');
  }

  const raw = fs.readFileSync(arquivoPath, 'utf8');
  const blocos = parseBlocos(raw);
  console.log(`Blocos encontrados no arquivo: ${blocos.length}`);

  const chunks = expandirBlocosParaChunks(blocos, MAX_PALAVRAS_POR_CHUNK);
  const divididos = chunks.length - blocos.length;
  if (divididos > 0) {
    console.log(`${divididos} sub-chunk(s) extra(s) gerado(s) a partir de blocos que excediam ${MAX_PALAVRAS_POR_CHUNK} palavras.`);
  }
  console.log(`Total de chunks a indexar: ${chunks.length}`);

  const fonte = path.basename(arquivoPath, '.txt');

  const { error: erroDelete } = await supabase.from('documentos').delete().eq('tema', tema);
  if (erroDelete) {
    throw new Error(`Falha ao limpar chunks anteriores deste tema: ${erroDelete.message}`);
  }

  const rows = [];
  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    console.log(`Gerando embeddings ${start + 1}-${start + batch.length}...`);
    const embeddings = await gerarEmbeddingsBatch(batch.map(c => c.corpo));

    batch.forEach((c, i) => {
      rows.push({
        fonte,
        caminho: `${tema}/bloco-${start + i + 1}`,
        titulo: c.titulo,
        categoria: 'tema',
        corpo: c.corpo,
        tema: tema,
        embedding: embeddings[i]
      });
    });

    await sleep(DELAY_MS);
  }

  console.log(`Inserindo ${rows.length} chunks no Supabase...`);
  const { error } = await supabase.from('documentos').insert(rows);
  if (error) {
    throw new Error(`Falha ao inserir chunks: ${error.message}`);
  }

  console.log(`OK — ${rows.length} chunks indexados para tema="${tema}"`);
  return rows.length;
}

if (require.main === module) {
  const [, , tema, arquivoArg] = process.argv;

  if (!tema || !arquivoArg) {
    console.error('Uso: node src/indexarTema.js <tema> <caminho-do-arquivo.txt>');
    process.exit(1);
  }

  const arquivoPath = path.isAbsolute(arquivoArg) ? arquivoArg : path.resolve(process.cwd(), arquivoArg);

  indexarTema(tema, arquivoPath).catch(err => {
    console.error('Erro na indexação:', err.message);
    process.exit(1);
  });
}

module.exports = { indexarTema, parseBlocos, dividirEmSubChunks, expandirBlocosParaChunks, dividirParagrafoPorFrase };
