// scripts/lote/analisePdf.js
//
// Onde cada tabela do livro caiu no PDF: página do início e do fim, e quanto da página anterior ficou em branco.
// Usa só pdftotext -bbox (posição de cada palavra). O modelo (modelo.json) diz quais tabelas existem e em que ordem;
// cada uma é localizada pelas primeiras palavras do cabeçalho e da última linha, procuradas em sequência no PDF.

const { execFileSync } = require('child_process');

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const dec = (s) => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENT[m]);
const norm = (s) => dec(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// [{ palavras: [{ t, y0, y1 }] }] — a posição vertical é a LINHA do texto no modo -layout do pdftotext (o pdftotext
// disponível aqui, xpdf 4.06, não tem -bbox), sem o número de página do rodapé. É uma estimativa: serve para saber em
// que página cada tabela caiu e quanto da página anterior ficou vazia, não para medir milímetros.
function palavrasPorPagina(pdf) {
  const txt = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdf, '-'], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  const paginas = txt.split('\f');
  if (paginas.length && !paginas[paginas.length - 1].trim()) paginas.pop();
  const ultimaLinha = (linhas) => { let u = -1; linhas.forEach((l, i) => { if (l.trim()) u = i; }); return u; };
  return paginas.map((pg) => {
    const linhas = pg.split('\n');
    const u = ultimaLinha(linhas);
    if (u >= 0 && /^[\s\d]+$/.test(linhas[u])) linhas[u] = ''; // número de página do rodapé
    const palavras = [];
    linhas.forEach((l, i) => { for (const w of l.split(/\s+/).filter(Boolean)) palavras.push({ t: norm(w), y0: i, y1: i + 1 }); });
    return { palavras };
  });
}

// Cada tabela é localizada por dois marcadores invisíveis (zzt<n>azz no cabeçalho e zzt<n>fzz na última célula) que o
// gerador injeta só numa renderização de ANÁLISE (mesmas classes e mesmo layout; o PDF final não leva marcador).
// Devolve uma entrada por tabela: página do início e do fim, e quanto da página anterior ficou vazia quando a tabela
// começa no topo da página.
// Até onde vai o conteúdo de cada página, em pt a partir do topo. O modo -lineprinter com espaçamento fixo de 8 pt dá a
// posição vertical física (o -layout não dá: depende da fonte de cada trecho). Texto de uma página A5 vai de ~48 a ~541 pt.
const PASSO_PT = 8; const TOPO_PT = 48; const BASE_PT = 541;
function fimFisicoPorPagina(pdf) {
  const txt = execFileSync('pdftotext', ['-lineprinter', '-linespacing', String(PASSO_PT), '-fixed', '3', '-enc', 'UTF-8', pdf, '-'], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  const paginas = txt.split('\f');
  if (paginas.length && !paginas[paginas.length - 1].trim()) paginas.pop();
  return paginas.map((pg) => {
    const linhas = pg.split('\n'); let u = -1;
    linhas.forEach((l, i) => { if (l.trim()) u = i; });
    if (u >= 0 && /^[\s\d]+$/.test(linhas[u])) { linhas[u] = ''; u = -1; linhas.forEach((l, i) => { if (l.trim()) u = i; }); }
    return u < 0 ? 0 : (u + 1) * PASSO_PT;
  });
}

function analisarTabelas(pdfComMarcadores, total) {
  const paginas = palavrasPorPagina(pdfComMarcadores);
  const pos = new Map();
  paginas.forEach((p, pi) => p.palavras.forEach((w) => { if (/^zzt\d+[af]zz$/.test(w.t) && !pos.has(w.t)) pos.set(w.t, { p: pi + 1, y: w.y0 }); }));
  const fimConteudo = paginas.map((p) => {
    const ws = p.palavras.filter((w) => !/^zzt\d+[af]zz$/.test(w.t));
    return ws.length ? Math.max(...ws.map((w) => w.y1)) : 0;
  });
  const fimFisico = fimFisicoPorPagina(pdfComMarcadores);
  const out = [];
  for (let n = 1; n <= total; n++) {
    const ini = pos.get('zzt' + n + 'azz'); const fim = pos.get('zzt' + n + 'fzz');
    if (!ini || !fim) { out.push({ n, achou: false }); continue; }
    const noTopo = ini.y < 3; // começa nas 3 primeiras linhas da página
    out.push({
      n, achou: true, pagIni: ini.p, pagFim: fim.p, cortada: ini.p !== fim.p,
      brancoAntes: noTopo && ini.p > 1 ? Math.max(0, Math.min(100, Math.round((1 - (fimFisico[ini.p - 2] - TOPO_PT) / (BASE_PT - TOPO_PT)) * 100))) : null
    });
  }
  return out;
}

module.exports = { palavrasPorPagina, analisarTabelas };
