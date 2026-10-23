// lib/pdfLivro.js
//
// PDF para guardar dos livros à venda. O arquivo fica num bucket PRIVADO do Supabase Storage (nunca em public/) e só sai
// por URL assinada de curta duração, gerada pela rota GET /livros/:livroId/pdf depois de exigirAcesso validar o token
// (sem checar o prazo: o PDF é do cliente; só o reembolso bloqueia). Este módulo não conhece token, pedido nem Stripe.
//
// Convenção do caminho: pdf/<livroId>.pdf no bucket LIVRO_PDF_BUCKET. O gerador (scripts/gerar-pdf-livro.js) e o envio
// (scripts/subir-pdfs-livros.js) usam os mesmos nomes daqui.

const { gerarUrlAssinada } = require('./audiolivroStorage');

// Nome amigável que o cliente recebe no download.
const NOMES_ARQUIVO = {
  'da-terra-ao-resultado': 'Da-Terra-ao-Resultado-ZUNI.pdf',
  'vender-bem-vender-sempre': 'Vender-Bem-Vender-Sempre-ZUNI.pdf',
  'toda-mesa-tem-dois-lados': 'Toda-Mesa-Tem-Dois-Lados-ZUNI.pdf',
  'toda-reuniao-tem-duas-pautas': 'Toda-Reuniao-Tem-Duas-Pautas-ZUNI.pdf'
};

const BUCKET_PADRAO = 'zuni-livros-pdf-private';
const TTL_PADRAO_SEGUNDOS = 300; // 5 min: o navegador começa o download na hora; a URL não precisa viver mais que isso

function obterBucket(env = process.env) {
  const b = env.LIVRO_PDF_BUCKET;
  return typeof b === 'string' && b.trim() ? b.trim() : BUCKET_PADRAO;
}

function obterTtlSegundos(env = process.env) {
  const bruto = env.LIVRO_PDF_SIGNED_URL_TTL_SECONDS;
  if (bruto === undefined || !/^\d+$/.test(String(bruto).trim())) return TTL_PADRAO_SEGUNDOS;
  const ttl = parseInt(bruto, 10);
  return ttl > 0 ? ttl : TTL_PADRAO_SEGUNDOS;
}

function caminhoPdf(livroId) {
  return `pdf/${livroId}.pdf`;
}

// { bucket, path, nomeArquivo } do livro, ou null se ele não tem PDF configurado.
function resolverPdf(livroId, env = process.env) {
  if (!Object.prototype.hasOwnProperty.call(NOMES_ARQUIVO, livroId)) return null;
  return { bucket: obterBucket(env), path: caminhoPdf(livroId), nomeArquivo: NOMES_ARQUIVO[livroId] };
}

// URL assinada de download (Content-Disposition: attachment com o nome amigável). Só depois de exigirAcesso.
async function urlDownloadPdf(livroId) {
  const alvo = resolverPdf(livroId);
  if (!alvo) throw new Error(`livro sem PDF configurado: ${livroId}`);
  return gerarUrlAssinada({ bucket: alvo.bucket, path: alvo.path, ttlSegundos: obterTtlSegundos(), download: alvo.nomeArquivo });
}

module.exports = { NOMES_ARQUIVO, BUCKET_PADRAO, TTL_PADRAO_SEGUNDOS, obterBucket, obterTtlSegundos, caminhoPdf, resolverPdf, urlDownloadPdf };
