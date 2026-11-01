// Pipeline de indexação para o banco vetorial
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const NOME_VAR_CHAVE = 'SUPABASE_KEY'; // so o NOME da variavel de ambiente da chave do Supabase, nunca o valor
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_KEY = process.env[NOME_VAR_CHAVE] || null;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || null;

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const DOCUMENTS_ROOT = path.resolve(__dirname, '..', 'documentos-zuni');
const DOCUMENT_SOURCE = 'documentos-zuni';
const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 100;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const CHUNK_DELAY_MS = 2000; // Delay de 2 segundos entre chunks
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 segundo inicial
const MAX_BATCH_EMBED_SIZE = 10; // Batch size para embeddings
const FLAG_CONFIRMA_TUDO = '--confirmo-reindexar-tudo';

// Arquivos que NAO devem ser reindexados por este script (comparados pelo NOME do arquivo, em qualquer subpasta).
const ARQUIVOS_IGNORADOS = {
  'cabala_astrologia_numerologia_integrativa_base_mentor.txt': 'ja indexado por indexarTema.js (tema cabala_astrologia_numerologia_integrativa); reindexar duplicaria',
  'vertical_pais_adolescentes_completo_base_mentor.txt': 'ja indexado por indexarTema.js (tema educar_filhos); reindexar duplicaria',
  'desenvolvimento_humano_adolescencia.txt': 'nao esta em documentos nem em documentos_quarentena (origem desconhecida); conteudo nao revisado - revisar posologia e escopo antes de indexar'
};

// Camada por conteudo: chunk com posologia nao entra, mesmo que o id nao esteja em documentos_quarentena.
// (\b do JS e ASCII; os padroes abaixo so usam \b junto de digitos/letras ASCII.)
const PADROES_POSOLOGIA = [
  { nome: 'P1', re: /\b[0-9]+([.,][0-9]+)?\s*(mg|mcg|µg|ml|gotas|c[aá]psulas?|comprimidos?|UI)\b/i },
  { nome: 'P2', re: /\b[0-9]+([.,][0-9]+)?(\s*(a|–|-)\s*[0-9]+([.,][0-9]+)?)?\s*(microgramas?|miligramas?|mililitros?|gramas?|g)\s*(\/|por|ao)\s*dia|\b(micrograma|miligrama)s?\b|\bdose\s*(usual|di[aá]ria|recomendada|orientativa|fisiol[oó]gica|suplementar|de refer[eê]ncia)?\s*:/i }
];

function acharPosologia(texto) {
  for (const { nome, re } of PADROES_POSOLOGIA) {
    const m = re.exec(texto);
    if (m) {
      const ini = Math.max(0, m.index - 40);
      return { padrao: nome, trecho: texto.slice(ini, m.index + m[0].length + 40).replace(/\s+/g, ' ') };
    }
  }
  return null;
}

function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP) {
  const tokens = text.split(/\s+/);
  const chunks = [];
  let start = 0;

  while (start < tokens.length) {
    const end = Math.min(tokens.length, start + chunkSize);
    const chunk = tokens.slice(start, end).join(' ').trim();
    if (chunk) {
      chunks.push(chunk);
    }
    start += Math.max(1, chunkSize - overlap);
  }

  return chunks;
}

async function collectTextFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTextFiles(entryPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
      files.push(entryPath);
    }
  }

  return files;
}

function createDocumentId(caminho, chunkIndex) {
  const hash = crypto.createHash('sha256').update(`${caminho}:${chunkIndex}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function assertSupabase() {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados para usar o Supabase.');
  }
  return supabase;
}

function assertOpenAI() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY deve estar configurada para gerar embeddings.');
  }
  if (typeof fetch !== 'function') {
    throw new Error('Fetch não está disponível no ambiente. Use Node 18+ ou adicione um polyfill.');
  }
  return fetch;
}

// Ids em public.documentos_quarentena (chunks retirados por conterem posologia).
// Falha fechada: erro de leitura OU resultado vazio abortam a indexacao (RLS sem policy devolve vazio, sem erro).
async function carregarIdsQuarentena() {
  const client = assertSupabase();
  console.log(`🔑 Lendo documentos_quarentena com a chave da variavel ${NOME_VAR_CHAVE}`);
  const ids = new Set();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from('documentos_quarentena').select('id').range(offset, offset + 999);
    if (error) {
      throw new Error(`Nao foi possivel ler documentos_quarentena (${error.message}). Indexacao abortada por seguranca.`);
    }
    data.forEach(row => ids.add(row.id));
    if (data.length < 1000) break;
  }
  if (ids.size === 0) {
    throw new Error('documentos_quarentena retornou 0 ids — provável chave sem permissão (RLS sem policy devolve vazio, sem erro). Use a service role. Indexação abortada.');
  }
  return ids;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return [429, 500, 502, 503].includes(status);
}

async function requestOpenAIEmbeddings(inputs) {
  const fetchFn = assertOpenAI();

  const response = await fetchFn(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || data?.error || response.statusText;
    const error = new Error(`OpenAI error ${response.status}: ${message}`);
    error.status = response.status;
    throw error;
  }

  if (!data || !Array.isArray(data.data)) {
    throw new Error('Resposta inválida do OpenAI para embeddings.');
  }

  return data.data.map(item => {
    if (!Array.isArray(item.embedding)) {
      throw new Error('Embedding inválido retornado pelo OpenAI.');
    }
    return item.embedding;
  });
}

async function batchGetEmbeddings(texts, attempt = 1) {
  try {
    const embeddings = await requestOpenAIEmbeddings(texts);
    if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
      throw new Error('Número de embeddings retornados não corresponde ao número de entradas.');
    }
    return embeddings;
  } catch (error) {
    const status = error?.status;
    if (attempt < MAX_RETRIES && isRetryableStatus(status)) {
      const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`  ⏳ Tentativa ${attempt}/${MAX_RETRIES} falhou. Aguardando ${delayMs}ms antes de tentar novamente...`);
      await sleep(delayMs);
      return batchGetEmbeddings(texts, attempt + 1);
    }
    throw error;
  }
}

async function getEmbeddingWithRetry(text, attempt = 1) {
  const [embedding] = await batchGetEmbeddings([text], attempt);
  return embedding;
}

async function indexarDocumentos(options = {}) {
  const sourceDir = options.sourceDir ? path.resolve(options.sourceDir) : DOCUMENTS_ROOT;
  const files = await collectTextFiles(sourceDir);

  if (!files.length) {
    throw new Error(`Nenhum arquivo .txt encontrado em ${sourceDir}`);
  }

  console.log(`📄 Encontrados ${files.length} arquivo(s) para indexar\n`);

  const idsQuarentena = await carregarIdsQuarentena();
  console.log(`🔒 ${idsQuarentena.size} id(s) em documentos_quarentena serao ignorados\n`);

  const rows = [];
  let chunkCount = 0;
  let ignoradosQuarentena = 0;
  let ignoradosPosologia = 0;
  let arquivosIgnorados = 0;

  for (const filePath of files) {
    const caminhoRel = path.relative(sourceDir, filePath).replace(/\\/g, '/');
    const nomeArquivo = path.basename(filePath);
    if (Object.prototype.hasOwnProperty.call(ARQUIVOS_IGNORADOS, nomeArquivo)) {
      console.log(`\n[INDEXAR_IGNORADO] ${caminhoRel} ${ARQUIVOS_IGNORADOS[nomeArquivo]}`);
      arquivosIgnorados++;
      continue;
    }
    const rawText = await fs.readFile(filePath, 'utf8');
    const text = normalizeText(rawText);
    const chunks = chunkText(text, options.chunkSize || DEFAULT_CHUNK_SIZE, options.overlap || DEFAULT_OVERLAP);
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, '/');
    const titulo = path.basename(filePath, '.txt').replace(/_/g, ' ').trim();
    const categoria = path.dirname(relativePath).replace(/\\/g, '/');

    console.log(`\n📖 Processando: ${relativePath}`);
    console.log(`   Chunks: ${chunks.length}`);

    // Mantem o indice original (o id depende dele) e tira os chunks barrados antes de gerar embedding.
    const pendentes = [];
    chunks.forEach((corpo, chunkIndex) => {
      const id = createDocumentId(relativePath, chunkIndex);
      if (idsQuarentena.has(id)) {
        console.log(`   [INDEXAR_QUARENTENA] ${id} ${relativePath}`);
        ignoradosQuarentena++;
        return;
      }
      const achado = acharPosologia(corpo);
      if (achado) {
        console.log(`   [INDEXAR_POSOLOGIA] ${id} ${relativePath} (${achado.padrao}) ...${achado.trecho}...`);
        ignoradosPosologia++;
        return;
      }
      pendentes.push({ chunkIndex, corpo, id });
    });

    // Processar chunks em batches
    for (let batchStart = 0; batchStart < pendentes.length; batchStart += MAX_BATCH_EMBED_SIZE) {
      const batchEnd = Math.min(batchStart + MAX_BATCH_EMBED_SIZE, pendentes.length);
      const batchItens = pendentes.slice(batchStart, batchEnd);
      const batchChunks = batchItens.map(item => item.corpo);
      
      try {
        console.log(`   Gerando embeddings para chunks ${batchStart + 1}-${batchEnd}...`);
        const embeddings = await batchGetEmbeddings(batchChunks);

        for (let i = 0; i < batchChunks.length; i++) {
          const { chunkIndex, corpo, id } = batchItens[i];
          const embedding = embeddings[i];

          rows.push({
            id,
            fonte: DOCUMENT_SOURCE,
            caminho: relativePath,
            titulo,
            categoria: categoria === '.' ? null : categoria,
            corpo,
            embedding
          });

          chunkCount++;
          console.log(`   ✓ Chunk ${chunkIndex + 1} pronto`);

          // Delay entre chunks
          if (batchStart + i < pendentes.length - 1) {
            await sleep(CHUNK_DELAY_MS);
          }
        }

        console.log(`   ✅ Batch ${Math.floor(batchStart / MAX_BATCH_EMBED_SIZE) + 1} concluído`);
      } catch (error) {
        console.error(`   ❌ Erro ao processar chunks ${batchStart + 1}-${batchEnd}:`, error.message);
        throw error;
      }
    }
  }

  console.log('\n🔒 Resumo das travas:');
  console.log(`   ignorados por quarentena (id): ${ignoradosQuarentena} chunk(s)`);
  console.log(`   ignorados por posologia (conteudo): ${ignoradosPosologia} chunk(s)`);
  console.log(`   arquivos ignorados (ARQUIVOS_IGNORADOS): ${arquivosIgnorados}`);
  console.log(`\n💾 Salvando ${rows.length} documento(s) no Supabase...`);

  const supabaseClient = assertSupabase();
  const batchSize = 20;

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const batchNum = Math.floor(offset / batchSize) + 1;
    const totalBatches = Math.ceil(rows.length / batchSize);

    try {
      console.log(`   Salvando batch ${batchNum}/${totalBatches}...`);
      const { error } = await supabaseClient.from('documentos').upsert(batch, { onConflict: ['id'] });
      if (error) {
        throw error;
      }
      console.log(`   ✓ Batch ${batchNum}/${totalBatches} salvo`);
    } catch (error) {
      console.error(`   ❌ Erro ao salvar batch ${batchNum}:`, error.message);
      throw error;
    }
  }

  console.log(`\n✨ Indexação concluída com sucesso!`);
  return { indexed: rows.length, files: files.length, chunks: rows.length, ignoradosQuarentena, ignoradosPosologia, arquivosIgnorados };
}

async function buscarDocumentos(pesquisa, limite = 5) {
  if (!pesquisa || !pesquisa.trim()) {
    throw new Error('A consulta de pesquisa é obrigatória.');
  }

  const embedding = await getEmbeddingWithRetry(normalizeText(pesquisa));
  const supabaseClient = assertSupabase();
  const { data, error } = await supabaseClient.rpc('buscar_documentos', {
    query_embedding: embedding,
    limite
  });

  if (error) {
    throw error;
  }

  return data || [];
}

if (require.main === module) {
  if (!process.argv.includes(FLAG_CONFIRMA_TUDO)) {
    console.error('Indexacao abortada: este script reindexa TODOS os .txt de documentos-zuni (id deterministico + upsert).');
    console.error('Isso regrava chunks removidos em limpezas anteriores e duplica arquivos ja indexados por indexarTema.js.');
    console.error(`Para temas use: node src/indexarTema.js <tema> <arquivo>. Para reindexar tudo de proposito: node src/indexar.js ${FLAG_CONFIRMA_TUDO}`);
    process.exit(1);
  }
  indexarDocumentos()
    .then((result) => {
      console.log('Indexação concluída:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erro na indexação:', error);
      process.exit(1);
    });
}

module.exports = {
  indexarDocumentos,
  buscarDocumentos,
  getEmbeddingWithRetry,
  batchGetEmbeddings,
  collectTextFiles,
  chunkText,
  acharPosologia,
  PADROES_POSOLOGIA,
  ARQUIVOS_IGNORADOS
};
