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
  'fazenda-lucrativa': 'Fazenda-Lucrativa-ZUNI.pdf',
  'a-bussola-do-adolescente': 'A-Bussola-do-Adolescente-ZUNI.pdf',
  'situacoes-da-vida-real': 'Situacoes-da-Vida-Real-ZUNI.pdf',
  'heranca-de-papel': 'Heranca-de-Papel-ZUNI.pdf',
  'vender-bem-vender-sempre': 'Vender-Bem-Vender-Sempre-ZUNI.pdf',
  'toda-mesa-tem-dois-lados': 'Toda-Mesa-Tem-Dois-Lados-ZUNI.pdf',
  'toda-reuniao-tem-duas-pautas': 'Toda-Reuniao-Tem-Duas-Pautas-ZUNI.pdf',
  // lote 2 (preparação local; só passam a valer na rota quando a obra for cadastrada)
  'a-casa-da-neblina': 'A-Casa-da-Neblina-ZUNI.pdf',
  'a-segunda-margem': 'A-Segunda-Margem-ZUNI.pdf',
  'a-tradutora': 'A-Tradutora-ZUNI.pdf',
  'almas-silenciadas': 'Almas-Silenciadas-ZUNI.pdf',
  'entre-o-encanto-e-a-escolha': 'Entre-o-Encanto-e-a-Escolha-ZUNI.pdf',
  'falsa-moralidade': 'Falsa-Moralidade-ZUNI.pdf',
  'guerra-de-compadre': 'Guerra-de-Compadre-ZUNI.pdf',
  'mascara-para-o-controle': 'Mascara-para-o-Controle-ZUNI.pdf',
  'ninguem-avisou-que-ele-morreu': 'Ninguem-Avisou-Que-Ele-Morreu-ZUNI.pdf',
  'ninguem-reage-do-nada': 'Ninguem-Reage-do-Nada-ZUNI.pdf',
  'o-baile-dos-herdeiros-posticos': 'O-Baile-dos-Herdeiros-Posticos-ZUNI.pdf',
  'o-disfarce-da-alma': 'O-Disfarce-da-Alma-ZUNI.pdf',
  'o-falecido-esta-a-mesa': 'O-Falecido-Esta-a-Mesa-ZUNI.pdf',
  'o-lugar-a-mesa': 'O-Lugar-a-Mesa-ZUNI.pdf',
  'o-ultimo-baile-do-moinho': 'O-Ultimo-Baile-do-Moinho-ZUNI.pdf',
  'onze-dias-de-sorte': 'Onze-Dias-de-Sorte-ZUNI.pdf',
  'senti-percebi-escolhi': 'Senti-Percebi-Escolhi-ZUNI.pdf',
  'toda-briga-tem-dois-comecos': 'Toda-Briga-Tem-Dois-Comecos-ZUNI.pdf',
  'toda-familia-tem-duas-historias': 'Toda-Familia-Tem-Duas-Historias-ZUNI.pdf',
  // obras antigas, grupo 1 (Universo Feminino; PDF gerado de texto extraído, 12/11/2026)
  'ela-tem-classe': 'Ela-Tem-Classe-ZUNI.pdf',
  'codigo-feminino': 'Codigo-Feminino-ZUNI.pdf',
  'a-inteligencia-do-corpo-feminino': 'A-Inteligencia-do-Corpo-Feminino-ZUNI.pdf',
  'inesquecivel-charme-feminino': 'Inesquecivel-Charme-Feminino-ZUNI.pdf',
  'a-mulher-que-permanece-inteira': 'A-Mulher-que-Permanece-Inteira-ZUNI.pdf'
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
