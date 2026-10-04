// lib/audiolivroStorage.js
//
// Resolve ONDE está o arquivo de um audiolivro e, no modelo privado, gera a
// URL assinada temporária. Não conhece token, pedido, preço nem Stripe: quem
// decide se o cliente PODE ouvir é a rota (exigirAcesso, em routes/livros.js);
// este módulo só é chamado depois dessa validação.
//
// Dois modelos de referência convivem durante a migração do bucket público
// `audiolivros` para um bucket privado (decisão: bucket novo, objetos copiados):
//
//   LEGACY  — audiobookUrl (string) ou audiobookPartes (array), URLs públicas
//             completas do Supabase Storage. Comportamento original, intacto.
//   PRIVATE — audiobookStorage, só caminho interno:
//               { bucket: 'x', path: 'obra/obra.mp3' }                  (parte única)
//               { bucket: 'x', parts: [{ path: '...' }, { path: '...' }] } (multipartes)
//             Nunca vai para o catálogo público (ver serializarLivroPublico).
//
// Se uma obra tiver os dois, o modelo PRIVATE vence. Se audiobookStorage vier
// malformado, cai no LEGACY (se houver) em vez de deixar o cliente sem áudio.

const TTL_PADRAO_SEGUNDOS = 14400;
// ATENÇÃO: 4 horas é um valor PROVISÓRIO. Ele cobre uma sessão de escuta longa,
// mas ainda não foi validado contra Range/seek/retomada em player nativo de
// iPhone e Android. Ajustar (AUDIOLIVRO_SIGNED_URL_TTL_SECONDS) só depois
// dessa verificação.

function obterTtlSegundos(env = process.env) {
  const bruto = env.AUDIOLIVRO_SIGNED_URL_TTL_SECONDS;
  if (bruto === undefined || String(bruto).trim() === '') return TTL_PADRAO_SEGUNDOS;
  if (!/^\d+$/.test(String(bruto).trim())) return TTL_PADRAO_SEGUNDOS;
  const ttl = parseInt(bruto, 10);
  return ttl > 0 ? ttl : TTL_PADRAO_SEGUNDOS;
}

function textoNaoVazio(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// audiobookStorage válido (parte única OU multipartes), ou null.
function lerReferenciaPrivada(livro) {
  const s = livro && livro.audiobookStorage;
  if (!s || typeof s !== 'object' || !textoNaoVazio(s.bucket)) return null;

  if (Array.isArray(s.parts)) {
    if (s.parts.length === 0 || !s.parts.every(p => p && textoNaoVazio(p.path))) return null;
    return { bucket: s.bucket, caminhos: s.parts.map(p => p.path) };
  }
  if (textoNaoVazio(s.path)) return { bucket: s.bucket, caminhos: [s.path] };
  return null;
}

// Classifica a obra: { modelo: 'private' | 'legacy' | 'nenhum', multipartes, total }.
function classificarAudiolivro(livro) {
  const privada = livro ? lerReferenciaPrivada(livro) : null;
  if (privada) {
    return {
      modelo: 'private',
      multipartes: Array.isArray(livro.audiobookStorage.parts),
      total: privada.caminhos.length
    };
  }
  if (livro && Array.isArray(livro.audiobookPartes) && livro.audiobookPartes.length > 0) {
    return { modelo: 'legacy', multipartes: true, total: livro.audiobookPartes.length };
  }
  if (livro && livro.audiobookUrl) {
    return { modelo: 'legacy', multipartes: false, total: 1 };
  }
  return { modelo: 'nenhum', multipartes: false, total: 0 };
}

// Objeto privado { bucket, path } da parte n (1-based; parte única = 1), ou null.
function resolverObjetoPrivado(livro, n = 1) {
  const privada = lerReferenciaPrivada(livro);
  if (!privada) return null;
  if (!Number.isInteger(n) || n < 1 || n > privada.caminhos.length) return null;
  return { bucket: privada.bucket, path: privada.caminhos[n - 1] };
}

let clienteStorage = null;
function obterClienteStorage() {
  if (clienteStorage) return clienteStorage;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados para gerar URL assinada.');
  }
  // Import tardio: carregar este módulo nunca abre conexão nem exige variáveis.
  const { createClient } = require('@supabase/supabase-js');
  clienteStorage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  return clienteStorage;
}

/**
 * Gera a URL assinada de UM objeto privado. Só deve ser chamada depois de a
 * rota ter validado token, tipo de produto, prazo e revogação.
 *
 * @param {Object} params
 * @param {string} params.bucket
 * @param {string} params.path
 * @param {number} [params.ttlSegundos] - default: obterTtlSegundos()
 * @returns {Promise<string>} URL assinada
 */
async function gerarUrlAssinada({ bucket, path, ttlSegundos }) {
  const ttl = ttlSegundos || obterTtlSegundos();
  const { data, error } = await obterClienteStorage().storage.from(bucket).createSignedUrl(path, ttl);
  if (error || !data || !data.signedUrl) {
    throw new Error(`Falha ao gerar URL assinada: ${error ? error.message : 'resposta sem signedUrl'}`);
  }
  return data.signedUrl;
}

module.exports = {
  TTL_PADRAO_SEGUNDOS,
  obterTtlSegundos,
  classificarAudiolivro,
  resolverObjetoPrivado,
  gerarUrlAssinada
};
