// lib/htmlLivroStorage.js
//
// Origem alternativa do HTML de um livro: bucket PRIVADO do Supabase Storage. É só a ORIGEM do arquivo — quem decide
// se o cliente pode ler continua sendo exigirAcesso (routes/livros.js), que roda antes de qualquer chamada daqui.
//
// Ordem de busca (routes/livros.js): primeiro private/livros/<livroId>/index.html no disco (as obras atuais, como estão);
// só se o arquivo NÃO existir no disco é que este módulo baixa html/<livroId>.html do bucket LIVRO_HTML_BUCKET.
// O HTML baixado recebe o mesmo patch de celular das obras do disco (aplicarPatchLeitor) e fica num cache em memória
// por LIVRO_HTML_CACHE_SEGUNDOS (arquivos têm vários MB; o bucket não tem "mtime" barato para validar o cache).

const { aplicarPatchLeitor, MOTIVO_SEM_BUNDLE, MOTIVO_NATIVO } = require('./leitorMobile');

const BUCKET_PADRAO = 'zuni-livros-html-private';
const CACHE_PADRAO_SEGUNDOS = 600;
const CACHE_MAX = 6;

class LivroNaoEncontradoNoBucket extends Error {
  constructor(livroId) { super(`HTML do livro não encontrado no bucket: ${livroId}`); this.name = 'LivroNaoEncontradoNoBucket'; }
}

function obterBucket(env = process.env) {
  const b = env.LIVRO_HTML_BUCKET;
  return typeof b === 'string' && b.trim() ? b.trim() : BUCKET_PADRAO;
}

function obterCacheSegundos(env = process.env) {
  const bruto = env.LIVRO_HTML_CACHE_SEGUNDOS;
  if (bruto === undefined || !/^\d+$/.test(String(bruto).trim())) return CACHE_PADRAO_SEGUNDOS;
  return parseInt(bruto, 10);
}

// Convenção do caminho (mesma lógica de pdfLivro.caminhoPdf): html/<livroId>.html
function caminhoHtml(livroId) {
  return `html/${livroId}.html`;
}

let clienteStorage = null;
function obterClienteStorage() {
  if (clienteStorage) return clienteStorage;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados para ler o HTML do bucket.');
  }
  const { createClient } = require('@supabase/supabase-js');
  clienteStorage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  return clienteStorage;
}

// Texto do objeto, ou LivroNaoEncontradoNoBucket se ele não existir (qualquer outra falha propaga).
async function baixarHtml(livroId) {
  const { data, error } = await obterClienteStorage().storage.from(obterBucket()).download(caminhoHtml(livroId));
  if (error || !data) {
    const msg = String((error && (error.message || error.error)) || '');
    const status = error && (error.statusCode || error.status);
    if (!error || /not.?found|não encontrad|404/i.test(msg) || String(status) === '404' || String(status) === '400') {
      throw new LivroNaoEncontradoNoBucket(livroId);
    }
    throw new Error(`Falha ao baixar o HTML do bucket: ${msg}`);
  }
  if (typeof data === 'string') return data;
  if (typeof data.text === 'function') return data.text();
  return Buffer.from(await data.arrayBuffer()).toString('utf8');
}

const cache = new Map();

// HTML do livro já com o patch de celular (se o patch falhar, devolve o original, como lerLivroComPatch).
async function lerLivroDoBucket(livroId, opcoes = {}) {
  const ttl = obterCacheSegundos() * 1000;
  const agora = Date.now();
  const noCache = cache.get(livroId);
  if (noCache && ttl > 0 && agora - noCache.em < ttl) {
    cache.delete(livroId);
    cache.set(livroId, noCache);
    return noCache.html;
  }

  const original = await baixarHtml(livroId);
  let html = original;
  const resultado = aplicarPatchLeitor(original, { livroId, semImpressao: opcoes.semImpressao });
  if (resultado.ok) {
    html = resultado.html;
  } else if (resultado.motivo !== MOTIVO_SEM_BUNDLE && resultado.motivo !== MOTIVO_NATIVO) {
    console.error(`[LEITOR_PATCH_FALHOU] livroId=${livroId} origem=bucket motivo=${resultado.motivo} — entregando o livro original.`);
  }

  cache.set(livroId, { em: agora, html });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return html;
}

function limparCache() { cache.clear(); }

module.exports = { BUCKET_PADRAO, LivroNaoEncontradoNoBucket, obterBucket, caminhoHtml, baixarHtml, lerLivroDoBucket, limparCache };
