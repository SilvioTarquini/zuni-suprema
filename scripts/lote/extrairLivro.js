// scripts/lote/extrairLivro.js
//
// Extrai o TEXTO de um flipbook (o que a leitora lê) para um modelo único, igual para todos os leitores do lote:
//   { slug, formato, meta, secoes: [{ tipo, rotulo, titulo, parte, blocos: [...] }] }
// Esse modelo é a única fonte do PDF, dos .txt do Livro-Vivo e da trava de resíduos — por isso os três nunca divergem.
//
// Formatos suportados (cada um foi lido no próprio HTML, nada é transcrito à mão):
//   dtr      <script id="dtrDataJson">     Da Terra ao Resultado, Fazenda Lucrativa
//   bookdata <script id="bookData">        Herança de Papel (blocos com "runs": negrito/itálico)
//   bundler  módulo "svrData" no manifesto Situações da Vida Real
//   dados    const DADOS = {...}           A Bússola do Adolescente (html por capítulo)
//
// Marcadores de formatação dentro dos dados: \u0001…\u0002 = itálico, \u0003…\u0004 = negrito. Eles saem do texto puro.
// Qualquer tipo de bloco desconhecido LANÇA erro (nada é descartado em silêncio).
//
// Tipos de bloco do modelo: p, sec, sub, list, def, ref, check, field, tabela, box, callout, quote, scene, aside, idx.

const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

const MARCADORES = { '\u0001': '<em>', '\u0002': '</em>', '\u0003': '<strong>', '\u0004': '</strong>' };

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Texto com marcadores → { html (escapado, com <em>/<strong>), texto (puro) }
function inline(bruto) {
  const s = String(bruto == null ? '' : bruto);
  const html = esc(s).replace(/[\u0001-\u0004]/g, (m) => MARCADORES[m]);
  const texto = s.replace(/[\u0001-\u0004]/g, '');
  return { html, texto };
}

function deRuns(runs, textoBase) {
  const partes = (runs || []).filter((r) => r && typeof r.text === 'string');
  if (!partes.length) return { html: esc(textoBase || ''), texto: textoBase || '' };
  const texto = partes.map((r) => r.text).join('');
  const html = partes.map((r) => {
    let h = esc(r.text);
    if (r.italic) h = `<em>${h}</em>`;
    if (r.bold) h = `<strong>${h}</strong>`;
    return h;
  }).join('');
  const ws = (x) => String(x || '').replace(/\s+/g, ' ').trim();
  return { html, texto, igualAoTexto: ws(texto) === ws(textoBase) };
}

function decodificarEntidades(s) {
  return s.replace(/&(quot|amp|lt|gt|apos|nbsp|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
    const t = e.toLowerCase();
    if (t === 'quot') return '"'; if (t === 'amp') return '&'; if (t === 'lt') return '<'; if (t === 'gt') return '>';
    if (t === 'apos') return "'"; if (t === 'nbsp') return ' ';
    if (t[0] === '#') return String.fromCodePoint(t[1] === 'x' ? parseInt(t.slice(2), 16) : parseInt(t.slice(1), 10));
    return m;
  });
}

// ---------------------------------------------------------------- leitura dos dados de cada formato

function achar(h, abre, fecha) {
  const i = h.indexOf(abre);
  if (i < 0) throw new Error(`marcador não encontrado: ${abre}`);
  const a = i + abre.length;
  const b = h.indexOf(fecha, a);
  if (b < 0) throw new Error(`fim não encontrado: ${fecha}`);
  return h.slice(a, b);
}

function jsonScript(h, id) {
  const i = h.indexOf(`<script id="${id}"`);
  if (i < 0) throw new Error(`<script id="${id}"> não encontrado`);
  const a = h.indexOf('>', i) + 1;
  return JSON.parse(h.slice(a, h.indexOf('</script>', a)));
}

function objetoDepoisDe(h, marcador) {
  const i = h.indexOf(marcador);
  if (i < 0) throw new Error(`marcador não encontrado: ${marcador}`);
  const ini = i + marcador.length;
  let prof = 0; let fora = true; let esc2 = false; let j = ini;
  for (; j < h.length; j++) {
    const c = h[j];
    if (!fora) { if (esc2) esc2 = false; else if (c === '\\') esc2 = true; else if (c === '"') fora = true; continue; }
    if (c === '"') fora = false; else if (c === '{') prof++; else if (c === '}') { prof--; if (prof === 0) { j++; break; } }
  }
  return JSON.parse(h.slice(ini, j));
}

function dadosBundler(h, idRecurso) {
  const bloco = (tipo) => { const m = h.lastIndexOf(`type="__bundler/${tipo}"`); const a = h.indexOf('>', m) + 1; return h.slice(a, h.indexOf('</script>', a)); };
  const ext = JSON.parse(bloco('ext_resources'));
  const manifest = JSON.parse(bloco('manifest'));
  const alvo = ext.find((e) => e.id === idRecurso);
  if (!alvo) throw new Error(`recurso ${idRecurso} não está no ext_resources`);
  const v = manifest[alvo.uuid];
  let buf = Buffer.from(v.data, 'base64');
  if (v.compressed) buf = zlib.gunzipSync(buf);
  const js = buf.toString('utf8').replace(/^\s*export default\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(js);
}

function detectarFormato(h) {
  if (h.includes('<script id="dtrDataJson"')) return 'dtr';
  if (h.includes('<script id="bookData"')) return 'bookdata';
  if (h.includes('type="__bundler/manifest"') && h.includes('"svrData"')) return 'bundler';
  if (h.includes('const DADOS = ')) return 'dados';
  throw new Error('formato de flipbook não reconhecido');
}

// ---------------------------------------------------------------- blocos → modelo

function blocoInline(tipo, bruto) { return { t: tipo, ...inline(bruto) }; }

// Blocos dos formatos dtr / bundler (campo t + text/items/…).
function converterBlocos(blocos) {
  const out = [];
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    switch (b.t) {
      case 'p': case 'quote': case 'callout': case 'aside': out.push(blocoInline(b.t, b.text)); break;
      case 'sec': case 'sub': out.push({ t: b.t, texto: inline(b.text).texto }); break;
      case 'list': out.push({ t: 'list', label: inline(b.label || '').texto, ordered: !!b.ordered, itens: b.items.map((x) => inline(x)) }); break;
      case 'def': out.push({ t: 'def', termo: inline(b.term).texto, ...inline(b.text) }); break;
      case 'ref': out.push(blocoInline('ref', b.text)); break;
      case 'idx': out.push({ t: 'idx', texto: inline(b.text).texto, ref: b.ref || '' }); break;
      case 'check': {
        const itens = [inline(b.text)];
        while (blocos[i + 1] && blocos[i + 1].t === 'check') itens.push(inline(blocos[++i].text));
        out.push({ t: 'check', itens });
        break;
      }
      case 'field': out.push({ t: 'field', labels: b.labels.map((l) => inline(l).texto) }); break;
      case 'thead': {
        const linhas = [];
        while (blocos[i + 1] && blocos[i + 1].t === 'trow' && blocos[i + 1].tid === b.tid) linhas.push(blocos[++i].cells.map((c) => inline(c)));
        out.push({ t: 'tabela', headers: b.headers.map((x) => inline(x).texto), larguras: b.cols || null, linhas });
        break;
      }
      case 'trow': throw new Error('linha de tabela sem cabeçalho (trow sem thead)');
      case 'table': out.push({ t: 'tabela', headers: b.headers.map((x) => inline(x).texto), larguras: null, linhas: b.rows.map((r) => r.map((c) => inline(c))) }); break;
      case 'boxhead': {
        const paragrafos = [];
        while (blocos[i + 1] && blocos[i + 1].t === 'boxp') paragrafos.push(inline(blocos[++i].text));
        out.push({ t: 'box', titulo: inline(b.text).texto, paragrafos });
        break;
      }
      case 'boxp': out.push({ t: 'box', titulo: '', paragrafos: [inline(b.text)] }); break;
      default: throw new Error(`tipo de bloco desconhecido: ${b.t}`);
    }
  }
  return out;
}

function converterBlocosBookdata(blocos) {
  return blocos.map((b) => {
    if (b.t === 'scene') return { t: 'scene', texto: b.text };
    if (b.t === 'sec') return { t: 'sec', texto: b.text };
    // list_item: item de lista solto (só aparece em rascunhos); tratado como parágrafo para o texto não se perder
    if (b.t !== 'p' && b.t !== 'list_item') throw new Error(`tipo de bloco desconhecido (bookData): ${b.t}`);
    if (b.src || (b.rows && b.rows.length) || (b.list_kind && b.t !== 'list_item')) throw new Error('bloco de imagem/tabela/lista em bookData: não tratado');
    const r = deRuns(b.runs, b.text);
    if (r.igualAoTexto === false) throw new Error(`runs não somam o texto: ${b.text.slice(0, 50)}`);
    return { t: 'p', html: r.html, texto: b.text };
  });
}

function blocosDeHtmlBussola(html) {
  const out = [];
  const negrito = (t) => decodificarEntidades(t.replace(/<strong>([\s\S]*?)<\/strong>/g, (_, x) => `\u0003${x}\u0004`));
  const resto = html.replace(/<(p|ul|ol)( class='epig')?>([\s\S]*?)<\/\1>/g, (m, tag, epig, interno) => {
    if (tag === 'p') {
      const marcado = negrito(interno);
      if (/[<>]/.test(marcado)) throw new Error('HTML inesperado dentro de <p>');
      out.push({ t: epig ? 'quote' : 'p', ...inline(marcado) });
    } else {
      const itens = [...interno.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => {
        const marcado = negrito(x[1]);
        if (/[<>]/.test(marcado)) throw new Error('HTML inesperado dentro de <li>');
        return inline(marcado);
      });
      if (!itens.length) throw new Error('lista vazia');
      out.push({ t: 'list', label: '', ordered: tag === 'ol', itens });
    }
    return '';
  });
  if (resto.trim()) throw new Error(`conteúdo fora de <p>/<ul>: ${resto.trim().slice(0, 60)}`);
  return out;
}

// ---------------------------------------------------------------- montagem por formato

function rotuloENome(titulo, eyebrow, name) {
  if (eyebrow && name) return { rotulo: eyebrow, titulo: name };
  const m = /^(\d+)[.\s]\s*(.+)$/.exec(titulo || '');
  if (m) return { rotulo: `Capítulo ${m[1]}`, titulo: m[2] };
  return { rotulo: '', titulo: titulo || '' };
}

function secoesDtrLike(d, { conversor }) {
  const secoes = [];
  const add = (tipo, s, parte) => {
    const { rotulo, titulo } = tipo === 'capitulo' ? rotuloENome(s.title, s.eyebrow, s.name) : { rotulo: '', titulo: s.title || s.name || '' };
    secoes.push({ tipo, rotulo, titulo, parte: parte || '', tituloOriginal: s.title || '', blocos: conversor(s.blocks || []) });
  };
  (d.front || []).forEach((s) => add('front', s));
  (d.parts || []).forEach((p) => {
    const nome = p.name ? [p.roman ? `Parte ${p.roman}` : '', p.name].filter(Boolean).join(' — ') : (p.title || '');
    (p.chapters || []).forEach((c) => add('capitulo', c, nome));
  });
  (d.back || []).forEach((s) => add('back', s));
  return secoes;
}

function metaDe(m) {
  return {
    titulo: m.title || m.fullTitle || '', subtitulo: m.subtitle || '', autor: m.author || '', tagline: m.tagline || '',
    epigrafe: m.epigraph || '', avisoLegal: m.legalNotice || '', copyright: [m.copyrightHolder, m.copyrightYear].filter(Boolean).join(' '),
    serie: m.series || ''
  };
}

function extrair(htmlPath) {
  const h = fs.readFileSync(htmlPath, 'utf8');
  let formato;
  try { formato = detectarFormato(h); } catch (e) {
    // formatos do lote 2 (módulo de dados com outro id, páginas em JSON, páginas estáticas): scripts/lote/extrairLote2.js
    const r = require('./extrairLote2').extrairLote2(htmlPath);
    return { ...r, fonteSha256: crypto.createHash('sha256').update(h).digest('hex') };
  }
  let meta; let secoes;
  if (formato === 'dtr') {
    const d = jsonScript(h, 'dtrDataJson');
    meta = metaDe(d.meta); secoes = secoesDtrLike(d, { conversor: converterBlocos });
  } else if (formato === 'bundler') {
    const d = dadosBundler(h, 'svrData');
    meta = metaDe(d.meta); secoes = secoesDtrLike(d, { conversor: converterBlocos });
  } else if (formato === 'bookdata') {
    const d = jsonScript(h, 'bookData');
    meta = metaDe({ ...d.meta, legalNotice: '' });
    secoes = [];
    d.parts.forEach((p) => p.chapters.forEach((c) => {
      const tipo = c.kind === 'chapter' ? 'capitulo' : c.kind === 'epilogue' ? 'back' : 'front';
      secoes.push({ tipo, rotulo: '', titulo: c.title, parte: tipo === 'capitulo' ? p.title : '', tituloOriginal: c.title, blocos: converterBlocosBookdata(c.blocks) });
    }));
  } else {
    const d = objetoDepoisDe(h, 'const DADOS = ');
    const tituloLivro = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    meta = metaDe({ title: tituloLivro.split('·')[0].trim(), subtitle: d.subtitulo || '', author: 'Zuni Suprema' });
    secoes = [];
    let parte = '';
    d.itens.forEach((it) => {
      if (it.tipo === 'rosto') return;
      if (it.tipo === 'parte') {
        parte = `Parte ${it.num} — ${it.titulo}`;
        secoes.push({ tipo: 'parte', rotulo: `Parte ${it.num}`, titulo: it.titulo, parte, tituloOriginal: it.titulo, blocos: it.abre ? [{ t: 'p', ...inline(it.abre) }] : [] });
      } else if (it.tipo === 'front') {
        secoes.push({ tipo: 'front', rotulo: '', titulo: it.titulo, parte: '', tituloOriginal: it.titulo, blocos: blocosDeHtmlBussola(it.html) });
      } else if (it.tipo === 'cap') {
        secoes.push({ tipo: 'capitulo', rotulo: `Capítulo ${it.num}`, titulo: it.titulo, parte, tituloOriginal: it.titulo, blocos: blocosDeHtmlBussola(it.html) });
      } else if (it.tipo === 'box') {
        secoes.push({ tipo: 'box', rotulo: it.box || '', titulo: it.titulo, parte, tituloOriginal: it.titulo, blocos: blocosDeHtmlBussola(it.html) });
      } else throw new Error(`item desconhecido na Bússola: ${it.tipo}`);
    });
  }
  return { formato, meta, secoes, fonteSha256: crypto.createHash('sha256').update(h).digest('hex') };
}

// ---------------------------------------------------------------- texto puro (Livro-Vivo, trava de resíduos)

function textoDoBloco(b) {
  switch (b.t) {
    case 'p': case 'quote': case 'callout': case 'aside': case 'ref': return b.texto;
    case 'sec': case 'sub': case 'scene': return b.texto;
    case 'orn': return '';
    case 'idx': return b.ref ? `${b.texto} (${b.ref})` : b.texto;
    case 'def': return `${b.termo}: ${b.texto}`;
    case 'list': return [b.label, ...b.itens.map((x, i) => (b.ordered ? `${i + 1}. ` : '- ') + x.texto)].filter(Boolean).join('\n');
    case 'check': return b.itens.map((x) => `[ ] ${x.texto}`).join('\n');
    case 'field': return b.labels.map((l) => `${l} ______`).join('   ');
    case 'tabela': return b.linhas.map((l) => '• ' + l.map((c, i) => (b.headers[i] ? `${b.headers[i]}: ` : '') + c.texto).join(' — ')).join('\n');
    case 'box': return [b.titulo, ...b.paragrafos.map((x) => x.texto)].filter(Boolean).join('\n\n');
    default: throw new Error(`textoDoBloco: tipo ${b.t}`);
  }
}

function tituloCompleto(s) { return [s.rotulo, s.titulo].filter(Boolean).join(' — '); }

function textoDaSecao(s) { return s.blocos.map(textoDoBloco).filter(Boolean).join('\n\n'); }

function textoDoLivro(modelo) {
  return modelo.secoes.map((s) => `${tituloCompleto(s)}\n\n${textoDaSecao(s)}`.trim()).join('\n\n\n');
}

function sha256(t) { return crypto.createHash('sha256').update(t).digest('hex'); }

// ---------------------------------------------------------------- conferência de cobertura (nada do texto-fonte some)

function letras(t) {
  return [...String(t).normalize('NFKC').replace(/­/g, '').toLowerCase()].filter((c) => /[\p{L}\p{N}]/u.test(c));
}
function contar(lista) { const m = new Map(); for (const c of lista) m.set(c, (m.get(c) || 0) + 1); return m; }

// Texto "cru" do fonte, folha a folha: só campos de conteúdo (sem ids, larguras, runs duplicados).
function fonteCru(htmlPath) {
  const h = fs.readFileSync(htmlPath, 'utf8');
  const formato = detectarFormato(h);
  const out = [];
  const CAMPOS = new Set(['text', 'term', 'label', 'items', 'cells', 'headers', 'rows', 'labels', 'ref']);
  const coletar = (v, chave) => {
    if (typeof v === 'string') { if (CAMPOS.has(chave) || chave === '*') out.push(v); return; }
    if (Array.isArray(v)) { v.forEach((x) => coletar(x, chave)); return; }
  };
  const bloco = (b) => { for (const k of Object.keys(b)) if (k !== 'runs' && CAMPOS.has(k)) coletar(b[k], k); };
  if (formato === 'dtr' || formato === 'bundler' || formato === 'bookdata') {
    const d = formato === 'dtr' ? jsonScript(h, 'dtrDataJson') : formato === 'bookdata' ? jsonScript(h, 'bookData') : dadosBundler(h, 'svrData');
    const secs = [...(d.front || []), ...(d.parts || []).flatMap((p) => p.chapters || []), ...(d.back || [])];
    secs.forEach((s) => { if (s.title) out.push(s.title); (s.blocks || []).forEach(bloco); });
  } else {
    const d = objetoDepoisDe(h, 'const DADOS = ');
    d.itens.forEach((it) => {
      if (it.titulo) out.push(it.titulo);
      if (it.abre) out.push(it.abre);
      if (it.html) out.push(decodificarEntidades(it.html.replace(/<[^>]+>/g, '')));
    });
  }
  return out.join('\n');
}

function conferirCobertura(htmlPath, modelo) {
  const fonte = contar(letras(modelo._fonte !== undefined ? modelo._fonte : fonteCru(htmlPath)));
  const modeloTexto = modelo.secoes.map((s) => `${tituloCompleto(s)}\n${textoDaSecao(s)}`).join('\n');
  const obtido = contar(letras(modeloTexto));
  let faltam = 0; const exemplos = [];
  for (const [c, n] of fonte) { const d = n - (obtido.get(c) || 0); if (d > 0) { faltam += d; if (exemplos.length < 6) exemplos.push(`${c}×${d}`); } }
  return { letrasFonte: [...fonte.values()].reduce((a, b) => a + b, 0), faltam, exemplos };
}

function contarPalavras(t) { return (String(t).match(/\S+/g) || []).length; }

module.exports = { converterBlocos, extrair, textoDoBloco, textoDaSecao, textoDoLivro, tituloCompleto, sha256, conferirCobertura, contarPalavras, esc, inline };

// Texto como o PDF o desenha (cabeçalhos de tabela uma vez só; sem repetir o cabeçalho em cada linha). Usado só para
// conferir "texto do modelo × texto extraído do PDF".
function textoVisivelDoBloco(b) {
  switch (b.t) {
    case 'tabela': return [b.headers.join(' '), ...b.linhas.map((l) => l.map((c) => c.texto).join(' '))].join('\n');
    case 'field': return b.labels.join(' ');
    case 'check': return b.itens.map((x) => x.texto).join('\n');
    case 'list': return [b.label, ...b.itens.map((x) => x.texto)].filter(Boolean).join('\n');
    default: return textoDoBloco(b);
  }
}

function textoVisivelDoLivro(modelo) {
  const m = modelo.meta;
  const cabeca = [m.titulo, m.subtitulo, m.autor, m.epigrafe].filter(Boolean).join('\n');
  const corpo = modelo.secoes.map((s) => `${tituloCompleto(s)}\n${s.blocos.map(textoVisivelDoBloco).join('\n')}`).join('\n');
  return `${cabeca}\n${corpo}`;
}

module.exports.textoVisivelDoLivro = textoVisivelDoLivro;
module.exports.letras = letras;
module.exports.contar = contar;
