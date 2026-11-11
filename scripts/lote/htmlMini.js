// scripts/lote/htmlMini.js
//
// Leitor de HTML mínimo (sem dependências) para os flipbooks estáticos do lote 2: devolve uma árvore { tag, attrs, filhos }
// com nós de texto { texto }. Só serve para o HTML regular gerado para os flipbooks (tags bem fechadas); tags <script>/<style>
// são ignoradas e as imagens em data: são descartadas antes (o texto é o que importa).

const VAZIAS = new Set(['img', 'br', 'hr', 'meta', 'link', 'input', 'source', 'col', 'wbr']);

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '­', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ordm: 'º', ordf: 'ª' };
function decodificar(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return Object.prototype.hasOwnProperty.call(ENTIDADES, e) ? ENTIDADES[e] : m;
  });
}

function atributos(s) {
  const a = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(s))) a[m[1].toLowerCase()] = decodificar(m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '');
  return a;
}

function parse(html) {
  const limpo = html.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, 'DATAURI').replace(/<!--[\s\S]*?-->/g, '');
  const raiz = { tag: '#raiz', attrs: {}, filhos: [] };
  const pilha = [raiz];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  let m;
  while ((m = re.exec(limpo))) {
    const topo = pilha[pilha.length - 1];
    if (m[4] !== undefined) { if (m[4]) topo.filhos.push({ texto: decodificar(m[4]) }); continue; }
    const fecha = m[1] === '/'; const tag = m[2].toLowerCase();
    if (!fecha) {
      if (tag === 'script' || tag === 'style') { const f = limpo.toLowerCase().indexOf(`</${tag}>`, re.lastIndex); if (f >= 0) re.lastIndex = f + tag.length + 3; continue; }
      const no = { tag, attrs: atributos(m[3].replace(/\/$/, '')), filhos: [] };
      topo.filhos.push(no);
      if (!VAZIAS.has(tag) && !/\/\s*$/.test(m[3])) pilha.push(no);
    } else {
      if (VAZIAS.has(tag)) continue;
      for (let i = pilha.length - 1; i > 0; i--) if (pilha[i].tag === tag) { pilha.length = i; break; }
    }
  }
  return raiz;
}

const classes = (n) => (n.attrs && n.attrs.class ? n.attrs.class.split(/\s+/).filter(Boolean) : []);
const tem = (n, c) => classes(n).includes(c);

function texto(n) {
  if (n.texto !== undefined) return n.texto;
  if (n.tag === 'br') return '\n';
  return n.filhos.map(texto).join('');
}

// Texto "inline": <em>/<i> → \u0001…\u0002, <strong>/<b> → \u0003…\u0004 (mesmo padrão dos dados dos leitores).
function inlineMarcado(n) {
  if (n.texto !== undefined) return n.texto;
  if (n.tag === 'br') return '\n';
  const dentro = n.filhos.map(inlineMarcado).join('');
  if (n.tag === 'em' || n.tag === 'i') return `\u0001${dentro}\u0002`;
  if (n.tag === 'strong' || n.tag === 'b') return `\u0003${dentro}\u0004`;
  return dentro;
}

function percorrer(n, fn) { if (n.texto !== undefined) return; fn(n); n.filhos.forEach((f) => percorrer(f, fn)); }
function achar(n, pred) { const out = []; percorrer(n, (x) => { if (pred(x)) out.push(x); }); return out; }

const limpar = (s) => String(s).replace(/­/g, '').replace(/[ \t\r\f\v]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

module.exports = { parse, texto, inlineMarcado, achar, percorrer, classes, tem, limpar, decodificar };
