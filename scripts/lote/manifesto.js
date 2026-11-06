// scripts/lote/manifesto.js
//
// Manifesto com hash (pdf-manifesto.json): amarra, por obra, o HTML da loja, o texto limpo, o HTML-fonte do PDF e o PDF.
// Quem sobe arquivo (subir-pdfs-livros.js, e o futuro envio de HTML) recusa o que não bate com o manifesto. Trocar o texto
// de uma obra muda o hash do texto, e o PDF antigo deixa de valer sozinho.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PASTA_PADRAO = path.join(__dirname, '..', '..', '..', 'lote-piloto');

const sha256Arquivo = (arq) => crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');

function caminhoManifesto(pasta = PASTA_PADRAO) { return path.join(pasta, 'pdf-manifesto.json'); }

function lerManifesto(pasta = PASTA_PADRAO) {
  const arq = caminhoManifesto(pasta);
  if (!fs.existsSync(arq)) return { versao: 1, obras: {} };
  return JSON.parse(fs.readFileSync(arq, 'utf8'));
}

function gravarManifesto(m, pasta = PASTA_PADRAO) {
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(caminhoManifesto(pasta), JSON.stringify(m, null, 2) + '\n');
}

// Confere um PDF contra o manifesto. Devolve lista de problemas (vazia = pode subir).
function conferirPdf(slug, arquivoPdf, pasta = PASTA_PADRAO) {
  const o = lerManifesto(pasta).obras[slug];
  const p = [];
  if (!o) return [`${slug}: não consta no manifesto`];
  if (!o.pdf) return [`${slug}: manifesto sem PDF gerado`];
  if (!fs.existsSync(arquivoPdf)) return [`${slug}: PDF ausente (${arquivoPdf})`];
  if (sha256Arquivo(arquivoPdf) !== o.pdf.sha256) p.push(`${slug}: hash do PDF ≠ manifesto`);
  if (o.pdf.textoSha256 !== o.texto.sha256) p.push(`${slug}: PDF foi gerado de outro texto (hash do texto mudou)`);
  if (o.pdf.residuosBloqueantes !== 0) p.push(`${slug}: PDF com resíduos bloqueantes`);
  if (!o.pdf.conferenciaTexto || o.pdf.conferenciaTexto.faltam !== 0) p.push(`${slug}: conferência texto × PDF não zerada`);
  return p;
}

const WIDGET_INICIO = '<!-- ZUNI-CHAT-WIDGET-START -->';
const WIDGET_FIM = '<!-- ZUNI-CHAT-WIDGET-END -->';

// Mesmo recorte de scripts/injetar-chat-livros.js (removerInjecaoAnterior): o widget do Livro-Vivo não muda o texto do livro,
// então o HTML com widget é aceito se, SEM o bloco do widget, ele for byte a byte o HTML do manifesto.
function semWidget(html) {
  const i = html.indexOf(WIDGET_INICIO); const f = html.indexOf(WIDGET_FIM);
  if (i < 0 || f < 0 || f < i) return html;
  return `${html.slice(0, i).replace(/\s+$/, '')}\n${html.slice(f + WIDGET_FIM.length).replace(/^\s+/, '')}`;
}

// Confere o HTML da loja (o arquivo que vai ao bucket) contra o manifesto.
function conferirHtmlLoja(slug, arquivoHtml, pasta = PASTA_PADRAO) {
  const o = lerManifesto(pasta).obras[slug];
  if (!o) return [`${slug}: não consta no manifesto`];
  if (!fs.existsSync(arquivoHtml)) return [`${slug}: HTML ausente (${arquivoHtml})`];
  const bruto = fs.readFileSync(arquivoHtml, 'utf8');
  const h = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
  if (h(bruto) === o.htmlLoja.sha256 || h(semWidget(bruto)) === o.htmlLoja.sha256) return [];
  return [`${slug}: hash do HTML ≠ manifesto (o texto pode ter mudado; regenerar o manifesto)`];
}

module.exports = { PASTA_PADRAO, sha256Arquivo, lerManifesto, gravarManifesto, conferirPdf, conferirHtmlLoja, caminhoManifesto };
