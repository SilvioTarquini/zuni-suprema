// lib/capasLoja.js
//
// URL da capa de cada obra, resolvida no servidor e entregue em /api/livros no campo `capa`.
// Substitui a lista fixa "novasObras" (e as listas de universos) que decidia entre .jpg e .png dentro de
// public/loja/index.html: agora uma obra nova só precisa do arquivo em public/loja/capas/<livroId>.jpg (ou .png).
//
// Ordem: campo `capa` do catálogo (se existir e apontar para /loja/capas/) → <livroId>.jpg → <livroId>.png → null.
// A leitura da pasta é guardada por CAPAS_CACHE_MS para não ir ao disco a cada requisição.

const fs = require('fs');
const path = require('path');

const PASTA_CAPAS = path.join(__dirname, '..', '..', 'public', 'loja', 'capas');
const CAPAS_CACHE_MS = 60 * 1000;
const EXTENSOES = ['jpg', 'png']; // jpg primeiro: é o formato das capas otimizadas

let cache = { em: 0, arquivos: new Set() };

function arquivosDeCapa(agora = Date.now()) {
  if (agora - cache.em < CAPAS_CACHE_MS && cache.em !== 0) return cache.arquivos;
  let nomes = [];
  try { nomes = fs.readdirSync(PASTA_CAPAS); } catch (_) { nomes = []; }
  cache = { em: agora, arquivos: new Set(nomes) };
  return cache.arquivos;
}

function resolverCapa(livroId, livro) {
  if (livro && typeof livro.capa === 'string' && livro.capa.startsWith('/loja/capas/')) return livro.capa;
  const arquivos = arquivosDeCapa();
  for (const ext of EXTENSOES) {
    if (arquivos.has(`${livroId}.${ext}`)) return `/loja/capas/${encodeURIComponent(livroId)}.${ext}`;
  }
  return null;
}

// Mesma lista de listarLivrosPublicos(), cada item com `capa`.
function comCapas(lista) {
  return lista.map((livro) => ({ ...livro, capa: resolverCapa(livro.livroId, livro) }));
}

function limparCache() { cache = { em: 0, arquivos: new Set() }; }

module.exports = { PASTA_CAPAS, resolverCapa, comCapas, limparCache };
