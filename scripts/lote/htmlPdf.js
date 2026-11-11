// scripts/lote/htmlPdf.js
//
// Modelo do livro (extrairLivro.js) → HTML de impressão para o Chromium gerar o PDF. O PDF nasce do TEXTO limpo, não
// da máquina de impressão do leitor: é a única forma de garantir que ele traz exatamente o texto aprovado (ver relatório).
// Capa: a imagem da capa da loja (1024×1536) em página inteira. Depois: folha de rosto, página legal, sumário (com links),
// partes/capítulos. Numeração de página no rodapé via margin box (@page), sem rodapé na capa.

const fs = require('fs');
const { esc } = require('./extrairLivro');

const CSS = `
@page { size: A5; margin: 17mm 15mm 19mm 15mm; @bottom-center { content: counter(page); font: 8.5pt Georgia, serif; color: #8a8a8a; } }
@page capa { margin: 0; @bottom-center { content: none; } }
@page rosto { @bottom-center { content: none; } }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt; line-height: 1.5; color: #1c1c1c; margin: 0; hyphens: auto; text-align: left; }
.capa { page: capa; width: 148mm; height: 210mm; break-after: page; }
.capa img { display: block; width: 148mm; height: 210mm; object-fit: cover; }
.rosto { page: rosto; height: 172mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; break-after: page; }
.rosto .serie { font-size: 8pt; letter-spacing: .25em; text-transform: uppercase; color: #8a7340; margin-bottom: 14mm; }
.rosto h1 { font-size: 26pt; line-height: 1.15; margin: 0 0 6mm; font-weight: 700; }
.rosto .sub { font-style: italic; font-size: 12pt; color: #444; margin: 0 8mm 14mm; }
.rosto .autor { font-size: 9pt; letter-spacing: .3em; text-transform: uppercase; color: #8a7340; }
.legal { page: rosto; height: 172mm; display: flex; flex-direction: column; justify-content: flex-end; font-size: 8pt; line-height: 1.45; color: #555; break-after: page; }
.legal p { margin: 0 0 3mm; text-align: justify; }
.epigrafe { font-style: italic; text-align: center; margin: 0 10mm 8mm; color: #444; }
h2.toc-t { font-size: 15pt; text-align: center; margin: 0 0 8mm; letter-spacing: .08em; text-transform: uppercase; }
.toc { break-after: page; }
.toc a { display: block; color: inherit; text-decoration: none; padding: 1.1mm 0; border-bottom: .2pt dotted #bbb; font-size: 9.5pt; line-height: 1.3; }
.toc .parte { font-weight: 700; margin-top: 3mm; border-bottom: 0; text-transform: uppercase; font-size: 8.5pt; letter-spacing: .06em; color: #6b5a2c; }
section.sec { break-before: page; }
section.parte-sec { break-before: page; height: 150mm; display: flex; flex-direction: column; justify-content: center; text-align: center; }
section.parte-sec .r { font-size: 9pt; letter-spacing: .3em; text-transform: uppercase; color: #8a7340; }
section.parte-sec h2 { font-size: 22pt; margin: 4mm 0 8mm; }
.cab { margin: 0 0 8mm; break-after: avoid; }
.cab .rot { font-size: 8.5pt; letter-spacing: .28em; text-transform: uppercase; color: #8a7340; margin: 0 0 2mm; }
.cab h2 { font-size: 17pt; line-height: 1.2; margin: 0; font-weight: 700; break-after: avoid; }
.cab .parte { font-size: 8pt; color: #888; margin: 2mm 0 0; letter-spacing: .05em; }
p { margin: 0 0 2.8mm; orphans: 3; widows: 3; }
p.indent { text-indent: 5mm; margin-bottom: 0; }
h3.s { font-size: 11.5pt; margin: 6mm 0 2mm; break-after: avoid; }
h4.s { font-size: 10.5pt; margin: 4mm 0 1.5mm; font-style: italic; break-after: avoid; }
.scene { text-align: center; margin: 5mm 0; color: #8a7340; letter-spacing: .3em; }
blockquote, .aside { margin: 4mm 6mm; padding-left: 4mm; border-left: 1.2pt solid #c9b26b; font-style: italic; color: #333; break-inside: avoid; }
.callout, .box { margin: 4mm 0; padding: 3mm 4mm; background: #f6f1e3; border-left: 2pt solid #b79a42; break-inside: avoid; }
.box h4 { margin: 0 0 2mm; font-style: normal; font-weight: 700; }
.box p:last-child, .callout p:last-child { margin-bottom: 0; }
ul, ol { margin: 1mm 0 3mm 5mm; padding-left: 3mm; }
li { margin-bottom: 1.2mm; }
.listlabel { margin: 3mm 0 1mm; font-weight: 700; break-after: avoid; }
dl.def { margin: 0 0 3mm; break-inside: avoid; } dl.def dt { font-weight: 700; margin-top: 1.5mm; } dl.def dd { margin: 0 0 1mm 4mm; }
.ref { font-size: 8.5pt; line-height: 1.35; color: #444; margin: 0 0 1.5mm; padding-left: 4mm; text-indent: -4mm; }
.check { list-style: none; margin-left: 0; padding-left: 0; } .check li::before { content: '\\2610\\00a0'; }
.field { margin: 2mm 0; font-size: 9.5pt; color: #444; } .field span { display: inline-block; margin-right: 6mm; } .field span::after { content: '\\00a0____________'; color: #999; }
table { border-collapse: collapse; width: 100%; margin: 3mm 0 4mm; font-size: 8.8pt; line-height: 1.3; }
th { background: #efe8d2; text-align: left; padding: 1.4mm 1.8mm; border: .4pt solid #c9bd96; }
td { padding: 1.3mm 1.8mm; border: .4pt solid #d9d2b8; vertical-align: top; }
tr { break-inside: avoid; }
table { hyphens: manual; }
thead { display: table-header-group; break-after: avoid; }
tfoot { display: table-footer-group; }
/* Medidos no Chromium antes de imprimir (gerar-pdf-lote.js): cabem numa página → não partem; maiores → partem com o cabeçalho repetido. */
table.evita, ul.evita, ol.evita, blockquote.evita, .aside.evita { break-inside: avoid; }
.listlabel + ul, .listlabel + ol { break-before: avoid; }
h3.s, h4.s { break-inside: avoid; }
/* Títulos nunca hifenizam: a hifenização automática aparecia no título impresso e nos marcadores do painel lateral ("nasci-mento"). */
h1, h2, h3, h4, .cab h2, .rosto h1, .rosto .sub, section.parte-sec h2, h2.toc-t, .toc a { hyphens: manual; -webkit-hyphens: manual; }
/* O marcador do painel lateral é montado a partir das linhas do título: sem isto o espaço no fim da linha some e vira "onascimento". */
h1, h2, h3, h4 { white-space: break-spaces; }
.idx { display: flex; font-size: 9.5pt; margin: 0 0 1mm; } .idx .t { flex: 1; } .idx .r { color: #888; margin-left: 3mm; white-space: nowrap; }
`;

function blocoHtml(b, ctx) {
  switch (b.t) {
    case 'p': {
      const cls = ctx.romance ? 'indent' : '';
      return `<p${cls ? ` class="${cls}"` : ''}>${b.html}</p>`;
    }
    case 'sec': return `<h3 class="s">${esc(b.texto)}</h3>`;
    case 'sub': return `<h4 class="s">${esc(b.texto)}</h4>`;
    case 'scene': return `<div class="scene">${esc(b.texto)}</div>`;
    case 'orn': return '<div class="scene">✦ ✦ ✦</div>';
    case 'quote': return `<blockquote>${b.html}</blockquote>`;
    case 'aside': return `<div class="aside">${b.html}</div>`;
    case 'callout': return `<div class="callout"><p>${b.html}</p></div>`;
    case 'ref': return `<p class="ref">${b.html}</p>`;
    case 'idx': return `<div class="idx"><span class="t">${esc(b.texto)}</span><span class="r">${esc(b.ref)}</span></div>`;
    case 'def': return `<dl class="def"><dt>${esc(b.termo)}</dt><dd>${b.html}</dd></dl>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      return `${b.label ? `<div class="listlabel">${esc(b.label)}</div>` : ''}<${tag}>${b.itens.map((x) => `<li>${x.html}</li>`).join('')}</${tag}>`;
    }
    case 'check': return `<ul class="check">${b.itens.map((x) => `<li>${x.html}</li>`).join('')}</ul>`;
    case 'field': return `<div class="field">${b.labels.map((l) => `<span>${esc(l)}</span>`).join('')}</div>`;
    case 'tabela': {
      const nT = ++ctx.nTabela;
      const larg = b.larguras && b.larguras.length === b.headers.length ? b.larguras : null;
      const cg = larg ? `<colgroup>${larg.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>` : '';
      return `<table data-t="${nT}">${cg}<thead><tr>${b.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.linhas.map((l) => `<tr>${l.map((c) => `<td>${c.html}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    case 'box': return `<div class="box">${b.titulo ? `<h4>${esc(b.titulo)}</h4>` : ''}${b.paragrafos.map((x) => `<p>${x.html}</p>`).join('')}</div>`;
    default: throw new Error(`htmlPdf: tipo de bloco ${b.t}`);
  }
}

// Texto da linha de série da folha de rosto. Vem do campo "series" do próprio flipbook ("EDIÇÃO PREMIUM · FLIPBOOK");
// "Flipbook" é o formato digital do site, não faz sentido num PDF: só no PDF a linha vira "Edição Premium" (o HTML da obra não é tocado).
function serieDoPdf(serie) {
  const t = String(serie || '').replace(/\s*[·•|]\s*flipbook\b.*$/i, '').replace(/\bflipbook\b/gi, '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t === t.toUpperCase()) return t.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/ (De|Da|Do) /g, (w) => w.toLowerCase());
  return t;
}

function montarHtmlPdf(modelo, capaJpgPath, { romance = false } = {}) {
  const ctx = { romance, nTabela: 0 };
  const m = modelo.meta;
  const capa = capaJpgPath && fs.existsSync(capaJpgPath) ? `data:image/jpeg;base64,${fs.readFileSync(capaJpgPath).toString('base64')}` : '';
  const sumario = [];
  let ultimaParte = '';
  modelo.secoes.forEach((s, i) => {
    if (s.parte && s.parte !== ultimaParte && s.tipo !== 'parte') { sumario.push(`<div class="parte">${esc(s.parte)}</div>`); ultimaParte = s.parte; }
    sumario.push(`<a href="#s${i}">${esc([s.rotulo, s.titulo].filter(Boolean).join(' — '))}</a>`);
  });
  const corpo = modelo.secoes.map((s, i) => {
    if (s.tipo === 'parte') {
      return `<section class="parte-sec" id="s${i}"><div class="r">${esc(s.rotulo)}</div><h2>${esc(s.titulo)}</h2>${s.blocos.map((b) => blocoHtml(b, ctx)).join('')}</section>`;
    }
    const cab = `<div class="cab">${s.rotulo ? `<div class="rot">${esc(s.rotulo)}</div>` : ''}<h2>${esc(s.titulo)}</h2>${s.parte && s.tipo === 'capitulo' ? `<div class="parte">${esc(s.parte)}</div>` : ''}</div>`;
    return `<section class="sec" id="s${i}">${cab}${s.blocos.map((b) => blocoHtml(b, ctx)).join('')}</section>`;
  }).join('\n');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(m.titulo)}</title><style>${CSS}</style></head><body>
${capa ? `<div class="capa"><img src="${capa}" alt="Capa de ${esc(m.titulo)}"></div>` : ''}
<div class="rosto"><div class="serie">${esc(serieDoPdf(m.serie))}</div><h1>${esc(m.titulo)}</h1>${m.subtitulo ? `<div class="sub">${esc(m.subtitulo)}</div>` : ''}<div class="autor">${esc(m.autor || 'Zuni Suprema')}</div></div>
<div class="legal">${m.epigrafe ? `<p class="epigrafe">${esc(m.epigrafe)}</p>` : ''}${m.avisoLegal ? `<p>${esc(m.avisoLegal)}</p>` : ''}<p>${esc(m.copyright ? `© ${m.copyright}` : '© Zuni Suprema & Co.')}</p></div>
<div class="toc"><h2 class="toc-t">Sumário</h2>${sumario.join('')}</div>
${corpo}
</body></html>`;
}

module.exports = { montarHtmlPdf, serieDoPdf };
