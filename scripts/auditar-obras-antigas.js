// Auditoria estática das obras "antigas" (as de private/livros que NÃO passaram pelos lotes de 05 a 11/11): botões de imprimir e de
// "Baixar" do próprio leitor, o que cada "Baixar" entrega, e se a obra tem PDF na rota protegida. SOMENTE LEITURA (não grava nada).
//
// Para cada obra lê private/livros/<id>/index.html, extrai o template do leitor (bundle) ou o próprio HTML e procura:
//   - elementos <button>/<a> com texto ou id/título ligados a imprimir/baixar/PDF;
//   - nos scripts: window.print(), Blob/createObjectURL/download= (download de arquivo) e o TIPO do arquivo entregue
//     (text/html = o livro inteiro sem token = VAZAMENTO; application/pdf; texto puro);
//   - se a obra está em LIVROS_SEM_IMPRESSAO e se resolverPdf() a conhece (rota /livros/:id/pdf).
// Uso: node scripts/auditar-obras-antigas.js [--json]

const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const { CATALOGO } = require('../src/lib/catalogoLivros');
const { ehLivroSemImpressao } = require('../src/lib/leitorSemImpressao');
const { resolverPdf } = require('../src/lib/pdfLivro');

const LOTE = new Set(['da-terra-ao-resultado', 'fazenda-lucrativa', 'a-bussola-do-adolescente', 'situacoes-da-vida-real', 'heranca-de-papel', 'vender-bem-vender-sempre', 'toda-mesa-tem-dois-lados', 'toda-reuniao-tem-duas-pautas',
  'a-casa-da-neblina', 'a-segunda-margem', 'a-tradutora', 'almas-silenciadas', 'entre-o-encanto-e-a-escolha', 'falsa-moralidade', 'guerra-de-compadre', 'mascara-para-o-controle', 'ninguem-avisou-que-ele-morreu', 'ninguem-reage-do-nada',
  'o-baile-dos-herdeiros-posticos', 'o-disfarce-da-alma', 'o-falecido-esta-a-mesa', 'o-lugar-a-mesa', 'o-ultimo-baile-do-moinho', 'onze-dias-de-sorte', 'senti-percebi-escolhi', 'toda-briga-tem-dois-comecos', 'toda-familia-tem-duas-historias']);

const MARCADOR = '<script type="__bundler/template">';
function templateDe(html) {
  const i = html.lastIndexOf(MARCADOR); if (i < 0) return { bundler: false, texto: html };
  let j = i + MARCADOR.length; while (/\s/.test(html[j])) j++;
  const fim = html.indexOf('</script>', j);
  try { return { bundler: true, texto: JSON.parse(html.slice(j, fim)) }; } catch (e) { return { bundler: true, texto: html.slice(j, fim) }; }
}

const RE_ROTULO = /imprimir|print|baixar|download|salvar|pdf|exportar/i;
function botoes(texto) {
  const achados = [];
  const re = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi; let m;
  while ((m = re.exec(texto)) !== null) {
    const attrs = m[2]; const interno = m[3].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const id = (/\bid="([^"]*)"/.exec(attrs) || [])[1] || ''; const titulo = (/\btitle="([^"]*)"/.exec(attrs) || [])[1] || ''; const aria = (/\baria-label="([^"]*)"/.exec(attrs) || [])[1] || '';
    const handler = (/\b(?:onclick|sc-camel-on-click)="([^"]*)"/.exec(attrs) || [])[1] || '';
    if (RE_ROTULO.test(`${interno} ${id} ${titulo} ${aria}`)) achados.push({ tag: m[1], id, texto: interno.slice(0, 40), titulo: titulo.slice(0, 50), handler: handler.slice(0, 60) });
  }
  return achados;
}

// Trecho do corpo de uma função/método chamado nome(...){...} (primeira ocorrência com corpo), até ~1200 caracteres.
function corpoDe(texto, nome) {
  const re = new RegExp(`(?:^|[\\s;{,])(?:async\\s+)?${nome}\\s*\\([^)]*\\)\\s*\\{`, 'g'); let m;
  while ((m = re.exec(texto)) !== null) { const ini = m.index + m[0].length; let prof = 1; let k = ini; while (k < texto.length && prof > 0 && k - ini < 4000) { const c = texto[k++]; if (c === '{') prof++; else if (c === '}') prof--; } return texto.slice(ini, k); }
  return null;
}

function classificarEntrega(corpo) {
  if (!corpo) return 'não achei o corpo da função';
  const partes = [];
  if (/window\.print\(\)/.test(corpo)) partes.push('IMPRIME (window.print)');
  if (/text\/html/.test(corpo)) partes.push('entrega ARQUIVO HTML (text/html)');
  if (/application\/pdf|\.pdf/.test(corpo)) partes.push('PDF');
  if (/text\/plain|\.txt/.test(corpo)) partes.push('texto puro');
  if (/location\.href|window\.open|\/pdf/.test(corpo)) partes.push('navega/abre URL');
  if (/outerHTML|documentElement|serializeToString|XMLSerializer/.test(corpo)) partes.push('serializa a PÁGINA inteira');
  return partes.length ? partes.join(' + ') : 'outro: ' + corpo.replace(/\s+/g, ' ').slice(0, 110);
}

const ids = Object.keys(CATALOGO).filter((id) => !LOTE.has(id) && fs.existsSync(path.join(RAIZ, 'private', 'livros', id, 'index.html')));
const saida = [];
for (const id of ids) {
  const html = fs.readFileSync(path.join(RAIZ, 'private', 'livros', id, 'index.html'), 'utf8');
  const { bundler, texto } = templateDe(html);
  const todos = texto + '\n' + (bundler ? '' : '');
  const bs = botoes(todos);
  const chamadas = new Set(); const re = /(?:this\.)?(\w+)\(\)/g; // métodos citados pelos botões (ex.: this.download())
  for (const b of bs) { const mm = /(\w+)\(\)/.exec(b.handler); if (mm) chamadas.add(mm[1]); }
  // ouvintes ligados por id: $('btnX').addEventListener('click', () => this.metodo())
  const ouvintes = []; let m; const reO = /\$\(\s*['"](\w+)['"]\s*\)\.(?:addEventListener\(\s*['"]click['"]\s*,|onclick\s*=)\s*(?:\(\)\s*=>\s*|function\s*\(\)\s*\{)\s*(?:this\.)?(\w+)/g;
  while ((m = reO.exec(todos)) !== null) ouvintes.push({ id: m[1], metodo: m[2] });
  const reO2 = /getElementById\(\s*['"](\w+)['"]\s*\)\.(?:addEventListener\(\s*['"]click['"]\s*,|onclick\s*=)\s*(?:\(\)\s*=>\s*|function\s*\(\)\s*\{)?\s*\{?\s*(?:this\.)?(\w+)?/g;
  while ((m = reO2.exec(todos)) !== null) ouvintes.push({ id: m[1], metodo: m[2] || '(inline)' });
  const detalhe = bs.map((b) => {
    const o = ouvintes.find((x) => x.id === b.id); const metodo = o ? o.metodo : (/(\w+)\(\)/.exec(b.handler) || [])[1];
    const corpo = metodo ? corpoDe(todos, metodo) : null;
    return { ...b, metodo: metodo || '', entrega: /imprimir|print/i.test(`${b.texto} ${b.id}`) && !/baixar|download/i.test(`${b.texto} ${b.titulo}`) ? classificarEntrega(corpo) : classificarEntrega(corpo) };
  });
  saida.push({ id, bundler, semImpressao: ehLivroSemImpressao(id), temPdfRota: !!resolverPdf(id), chat: !!CATALOGO[id].chatDisponivel, temWindowPrint: /window\.print\(\)/.test(todos), temBlobHtml: /new Blob\(\s*\[[^\]]*\]\s*,\s*\{[^}]*text\/html/.test(todos), temDownloadAttr: /\.download\s*=|download=/.test(todos), botoes: detalhe });
}

if (process.argv.includes('--json')) { console.log(JSON.stringify(saida, null, 1)); process.exit(0); }
for (const o of saida) {
  console.log(`\n■ ${o.id}  [${o.bundler ? 'bundle' : 'estático'}] chat=${o.chat ? 'sim' : 'não'} semImpressao=${o.semImpressao ? 'sim' : 'NÃO'} PDF-na-rota=${o.temPdfRota ? 'sim' : 'NÃO'} window.print=${o.temWindowPrint ? 'SIM' : 'não'} Blob-html=${o.temBlobHtml ? 'SIM' : 'não'} download=${o.temDownloadAttr ? 'sim' : 'não'}`);
  for (const b of o.botoes) console.log(`   - <${b.tag}${b.id ? '#' + b.id : ''}> "${b.texto}" ${b.titulo ? `(title: ${b.titulo})` : ''} → ${b.metodo || '?'}: ${b.entrega}`);
}
console.log(`\n${saida.length} obras antigas`);
