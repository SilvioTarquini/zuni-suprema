// src/indexarLivro.js
//
// Pipeline de ingestão da base RAG de um livro individual, usada pelo chat
// de leitura (routes/livroChat.js). Diferente de indexar.js (que faz
// chunking genérico por tamanho de texto para a base do Mentor), este
// script espera um arquivo .txt já organizado em blocos temáticos, em um
// destes dois formatos (detectados automaticamente):
//
//   [TEMA]                              === TEMA: NOME ===
//   texto do bloco...          ou       texto do bloco...
//   ==========
//
// Cada bloco vira um chunk em public.documentos, com livro_id preenchido,
// para ser recuperado por match_documents_livro(). Rodar de novo para o
// mesmo livro_id substitui os chunks anteriores (apaga e reinsere).
//
// Uso: node src/indexarLivro.js <livro_id> <caminho-do-arquivo.txt>

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 10;
const DELAY_MS = 500;

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseBlocosColchetes(raw) {
  const blocos = raw
    .split(/\n={5,}\n?/)
    .map(b => b.trim())
    .filter(Boolean);

  return blocos.map(bloco => {
    const match = bloco.match(/^\[([^\]]+)\]\s*\n([\s\S]+)$/);
    if (!match) {
      throw new Error(`Bloco fora do formato [TEMA] esperado:\n${bloco.slice(0, 80)}...`);
    }
    return { tema: match[1].trim(), corpo: match[2].trim() };
  });
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

async function indexarLivro(livroId, arquivoPath) {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados para usar o Supabase.');
  }

  const raw = fs.readFileSync(arquivoPath, 'utf8');
  const blocos = parseBlocos(raw);
  console.log(`Blocos encontrados: ${blocos.length}`);

  const fonte = path.basename(arquivoPath, '.txt');

  const { error: erroDelete } = await supabase.from('documentos').delete().eq('livro_id', livroId);
  if (erroDelete) {
    throw new Error(`Falha ao limpar chunks anteriores deste livro: ${erroDelete.message}`);
  }

  const rows = [];
  for (let start = 0; start < blocos.length; start += BATCH_SIZE) {
    const batch = blocos.slice(start, start + BATCH_SIZE);
    console.log(`Gerando embeddings ${start + 1}-${start + batch.length}...`);
    const embeddings = await gerarEmbeddingsBatch(batch.map(b => b.corpo));

    batch.forEach((b, i) => {
      rows.push({
        fonte,
        caminho: `${livroId}/tema-${start + i + 1}`,
        titulo: b.tema,
        categoria: 'livro',
        corpo: b.corpo,
        livro_id: livroId,
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

  console.log(`OK — ${rows.length} chunks indexados para livro_id="${livroId}"`);
  return rows.length;
}

if (require.main === module) {
  const [, , livroId, arquivoArg] = process.argv;

  if (!livroId || !arquivoArg) {
    console.error('Uso: node src/indexarLivro.js <livro_id> <caminho-do-arquivo.txt>');
    process.exit(1);
  }

  const arquivoPath = path.isAbsolute(arquivoArg) ? arquivoArg : path.resolve(process.cwd(), arquivoArg);

  indexarLivro(livroId, arquivoPath).catch(err => {
    console.error('Erro na indexação:', err.message);
    process.exit(1);
  });
}

module.exports = { indexarLivro, parseBlocos };
