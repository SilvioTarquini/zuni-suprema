// scripts/lote/extrairLote2.js
//
// Extratores do lote 2 (formatos que scripts/lote/extrairLivro.js não lia). Todos devolvem o MESMO modelo
// { formato, meta, secoes: [{ tipo, rotulo, titulo, parte, tituloOriginal, blocos }] } e o mesmo "texto cru" para a conferência
// de cobertura (letras do que a leitora lê × letras do modelo), então o PDF, o Livro-Vivo e a trava de resíduos saem do mesmo texto.
//
//   modulo    módulo de dados dentro do bundle do flipbook ({"meta":…,"front":[…],"parts":[…]}), ids diferentes por obra
//             (neblinaData, almasData, MARGEM_DATA…): 10 obras.
//   pagsjson  const pages=[{kind,title,content(HTML),anchor}] dentro do <script>: A Tradutora, Falsa Moralidade, O Baile dos Herdeiros.
//   estatico  <article class="page"> já paginado no HTML: Toda Família, Toda Briga, Entre o Encanto e a Escolha, Senti Percebi Escolhi.
//
// Decisões (todas registradas no relatório): capas, sumários, páginas de imagem/ilustração (legenda de design), cabeçalhos
// correntes e números de página NÃO entram; todo o resto que a leitora lê entra. Tipo de bloco desconhecido LANÇA erro.

const fs = require('fs');
const zlib = require('zlib');
const H = require('./htmlMini');

const FIM_FRASE = /[.!?…”"»)\]:;]$/;

// ----------------------------------------------------------------------------- utilitários

function inlineLocal(bruto) {
  const { inline } = require('./extrairLivro');
  return inline(bruto);
}
const semFlipbook = (s) => String(s || '').replace(/\s*[·•|-]\s*flipbook.*$/i, '').replace(/\bflipbook( de luxo)?( master)?\b/gi, '').trim();
// Título que veio em MAIÚSCULAS do flipbook → caixa de título em português:
//   - algarismos romanos ficam em maiúsculas (Parte II, Capítulo XX) quando vêm depois de "capítulo", "parte", "ato"…;
//   - artigos e preposições ficam em minúsculas só no MEIO do título; a primeira palavra e a primeira depois de travessão ou
//     dois-pontos têm maiúscula ("Capítulo I — A Arte do Velório");
//   - palavra composta com hífen mantém a segunda parte em minúsculas ("Quinta-feira").
// Título que já está em caixa mista não é tocado.
const MENORES = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'e', 'ou', 'com', 'por', 'para', 'ao', 'aos', 'à', 'às', 'sem', 'sobre', 'que', 'pelo', 'pela', 'pelos', 'pelas']);
const ANTES_DE_ROMANO = new Set(['capítulo', 'capitulo', 'parte', 'ato', 'volume', 'livro', 'conto', 'seção', 'secao', 'tomo']);
const ROMANO = /^(?=[ivxlcdm]+$)m{0,3}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
function capitalizar(s) {
  const t = String(s || '').trim();
  if (!(t && t === t.toUpperCase() && /[A-ZÀ-Ý]/.test(t) && t.length > 3 && !/^[IVXLC]+$/.test(t))) return t;
  let inicio = true; let ant = '';
  return t.toLowerCase().split(/(\s+)/).map((tok) => {
    if (tok === '' || /^\s+$/.test(tok)) return tok;
    if (/^[—–:·-]+$/.test(tok)) { inicio = true; return tok; }
    const puro = tok.replace(/[^\p{L}]/gu, '');
    let out;
    if (ROMANO.test(tok.replace(/[.,;:]+$/, '')) && ANTES_DE_ROMANO.has(ant)) out = tok.toUpperCase();
    else if (!inicio && MENORES.has(puro)) out = tok;
    else out = tok.replace(/\p{L}/u, (c) => c.toUpperCase());
    inicio = /[:—–]$/.test(tok);
    ant = puro;
    return out;
  }).join('');
}
const BLOCOS_P = (txt) => ({ t: 'p', ...inlineLocal(txt) });

// ----------------------------------------------------------------------------- 1. módulo de dados no bundle

function dadosModulo(h) {
  const bloco = (tipo) => { const m = h.lastIndexOf(`type="__bundler/${tipo}"`); const a = h.indexOf('>', m) + 1; return h.slice(a, h.indexOf('</script>', a)); };
  const manifest = JSON.parse(bloco('manifest'));
  for (const v of Object.values(manifest)) {
    if (!String(v.mime).includes('javascript')) continue;
    let buf = Buffer.from(v.data, 'base64'); if (v.compressed) buf = zlib.gunzipSync(buf);
    const t = buf.toString('utf8');
    const m = /^\s*(?:export default|export const \w+\s*=|window\.\w+\s*=)\s*(\{\s*"meta")/.exec(t);
    if (m) { const ini = t.indexOf('{', t.indexOf(m[1]) - 1 > 0 ? t.indexOf(m[1]) - 1 : 0); return JSON.parse(t.slice(ini, t.lastIndexOf('}') + 1)); }
  }
  return null;
}

function blocosModulo(blocos, ctx) {
  const out = [];
  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i];
    switch (b.t) {
      case 'p': case 'lead': out.push(BLOCOS_P(b.text)); break;
      case 'quote': out.push({ t: 'quote', ...inlineLocal(b.text) }); break;
      case 'note': out.push({ t: 'aside', ...inlineLocal(b.text) }); break;
      case 'sec': case 'subhead': out.push({ t: 'sec', texto: inlineLocal(b.text).texto }); break;
      case 'bullet': {
        const itens = [inlineLocal(b.text)];
        while (blocos[i + 1] && blocos[i + 1].t === 'bullet') itens.push(inlineLocal(blocos[++i].text));
        out.push({ t: 'list', label: '', ordered: false, itens }); break;
      }
      case 'orn': case 'break': out.push({ t: 'orn' }); break;
      case 'endpart': out.push({ t: 'scene', texto: inlineLocal(b.text).texto }); break;
      default: {
        // tipos da família dtr (callout, list, table, aside, check, thead/trow, boxhead/boxp, def, ref, idx, field): mesmo conversor do extrairLivro
        const grupo = [b];
        while (blocos[i + 1] && ['trow', 'boxp', 'check'].includes(blocos[i + 1].t) && ['thead', 'boxhead', 'check'].includes(b.t)) grupo.push(blocos[++i]);
        out.push(...require('./extrairLivro').converterBlocos(grupo));
      }
    }
  }
  if (ctx && ctx.dateline) out.unshift({ t: 'scene', texto: ctx.dateline });
  return out;
}

function extrairModulo(h) {
  const d = dadosModulo(h);
  if (!d) throw new Error('módulo de dados não encontrado no bundle');
  const m = d.meta || {};
  const meta = {
    titulo: m.title || m.fullTitle || '', subtitulo: m.subtitle || '', autor: m.author || '', tagline: m.tagline || '', epigrafe: m.epigraph || '',
    avisoLegal: m.legalNotice || '', copyright: m.copyright ? '' : [m.copyrightHolder, m.copyrightYear].filter(Boolean).join(' '), serie: semFlipbook(m.series) || m.genre || ''
  };
  if (m.copyright) meta.avisoLegal = [meta.avisoLegal, m.copyright].filter(Boolean).join(' ');
  const secoes = [];
  const add = (tipo, s, parte) => {
    const blocos = blocosModulo(s.blocks || [], { dateline: s.dateline });
    const refl = Array.isArray(s.reflection) ? s.reflection : (s.reflection ? [s.reflection] : []);
    refl.forEach((r) => blocos.push({ t: 'quote', ...inlineLocal(typeof r === 'string' ? r : JSON.stringify(r)) }));
    secoes.push({ tipo, rotulo: s.eyebrow || '', titulo: s.title || s.name || '', parte: parte || '', tituloOriginal: s.title || '', blocos, subtitulo: s.subtitle || '' });
  };
  (d.front || []).forEach((s) => add('front', s));
  (d.parts || []).forEach((p) => {
    const nome = [p.roman ? `Parte ${p.roman}` : '', p.name || p.title || ''].filter(Boolean).join(' — ');
    (p.chapters || []).forEach((c) => add('capitulo', c, nome));
  });
  (d.back || []).forEach((s) => add('back', s));
  (Array.isArray(d.closing) ? d.closing : d.closing ? [d.closing] : []).forEach((s) => add('back', s));
  // subtítulo do capítulo (quando existe) entra como primeira linha do texto, para não se perder
  secoes.forEach((s) => { if (s.subtitulo) s.blocos.unshift({ t: 'scene', texto: s.subtitulo }); delete s.subtitulo; });
  return { formato: 'modulo', meta, secoes, _fonte: fonteModulo(d) };
}

function fonteModulo(d) {
  const out = [];
  const CAMPOS = new Set(['text', 'eyebrow', 'title', 'dateline', 'subtitle', 'name']);
  const secs = [...(d.front || []), ...(d.parts || []).flatMap((p) => p.chapters || []), ...(d.back || []), ...(Array.isArray(d.closing) ? d.closing : d.closing ? [d.closing] : [])];
  secs.forEach((s) => { CAMPOS.forEach((c) => { if (typeof s[c] === 'string') out.push(s[c]); }); (s.blocks || []).forEach((b) => { if (typeof b.text === 'string') out.push(b.text); }); (Array.isArray(s.reflection) ? s.reflection : s.reflection ? [s.reflection] : []).forEach((r) => out.push(String(r))); });
  return out.join('\n');
}

// ----------------------------------------------------------------------------- 2. páginas em JSON (HTML de cada página no script)

function arrayDepoisDe(h, re) {
  const i = h.search(re); if (i < 0) throw new Error('array de páginas não encontrado');
  const ini = h.indexOf('[', i);
  let prof = 0; let fora = true; let esc = false; let j = ini;
  for (; j < h.length; j++) {
    const c = h[j];
    if (!fora) { if (esc) esc = false; else if (c.charCodeAt(0) === 92) esc = true; else if (c === '"') fora = true; continue; }
    if (c === '"') fora = false; else if (c === '[') prof++; else if (c === ']') { prof--; if (prof === 0) { j++; break; } }
  }
  return JSON.parse(h.slice(ini, j));
}

const INLINE = new Set(['em', 'i', 'strong', 'b', 'span', 'small', 'a', 'br', 'sup', 'sub', 'u', 'mark']);
const ehInline = (n) => n.texto !== undefined || INLINE.has(n.tag);

// Converte os filhos de um contêiner em blocos (folhas = parágrafos; contêiner só com span/small/b = linha de rótulo).
function blocosHtml(raiz, { ignorar = () => false, tipoPorNo }) {
  const out = []; const desconhecidos = new Set();
  const visita = (n) => {
    if (n.texto !== undefined) return;
    if (ignorar(n)) return;
    const cls = H.classes(n);
    const filhosEl = n.filhos.filter((f) => f.tag);
    const soInline = filhosEl.every((f) => INLINE.has(f.tag));
    const txt = H.limpar(H.texto(n));
    if (!txt) { if (cls.some((c) => /orn/.test(c)) && !out.length === false) out.push({ t: 'orn' }); return; }
    if (cls.some((c) => /(^|-)orn(ament)?$/.test(c))) { out.push({ t: 'orn' }); return; }
    if (n.tag === 'h3' || n.tag === 'h4') { out.push({ t: n.tag === 'h3' ? 'sec' : 'sub', texto: txt }); return; }
    if (n.tag === 'li') { out.push({ t: 'list', label: '', ordered: false, itens: [inlineLocal(H.inlineMarcado(n))] }); return; }
    const folha = n.tag === 'p' || n.tag === 'blockquote' || n.tag === 'figcaption' || (soInline && !n.filhos.some((f) => f.tag && ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol'].includes(f.tag)));
    if (folha) {
      const tipo = tipoPorNo ? tipoPorNo(n, cls) : null;
      if (tipo === 'ignorar') return;
      if (n.tag !== 'p' && n.tag !== 'blockquote' && filhosEl.length >= 2 && filhosEl.every((f) => ['span', 'small', 'b', 'strong'].includes(f.tag))) {
        out.push({ t: 'sub', texto: filhosEl.map((f) => H.limpar(H.texto(f))).filter(Boolean).join(' — ') }); return;
      }
      let marcado = H.inlineMarcado(n).replace(/­/g, '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
      if (cls.includes('italic') && !/^\u0001/.test(marcado)) marcado = `\u0001${marcado}\u0002`;
      if (tipo === 'quote' || n.tag === 'blockquote') out.push({ t: 'quote', ...inlineLocal(marcado) });
      else out.push(BLOCOS_P(marcado));
      return;
    }
    n.filhos.forEach(visita);
  };
  raiz.filhos.forEach(visita);
  return { blocos: out, desconhecidos: [...desconhecidos] };
}

function unirContinuacoes(blocos, relatorio) {
  const out = [];
  for (const b of blocos) {
    const ant = out[out.length - 1];
    if (b.t === 'p' && ant && ant.t === 'p' && !FIM_FRASE.test(ant.texto.trim()) && /^\p{Ll}/u.test(b.texto.trim())) {
      const nova = inlineLocal(`${ant.texto} ${b.texto}`); // junta pelo texto puro (sem perder nada); formatação inline do 2º trecho é preservada abaixo
      ant.html = `${ant.html} ${b.html}`; ant.texto = nova.texto; if (relatorio) relatorio.unioes++;
      continue;
    }
    out.push(b);
  }
  return out;
}

function extrairPaginasJson(h) {
  const limpo = h.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, 'DATAURI');
  const paginas = arrayDepoisDe(limpo, /[\s,;](?:const|var|let)?\s*pages\s*=\s*\[\s*\{\s*"kind"/);
  const rel = { unioes: 0 };
  const meta = { titulo: '', subtitulo: '', autor: 'Zuni Suprema', tagline: '', epigrafe: '', avisoLegal: '', copyright: '', serie: '' };
  const secoes = []; let parteAtual = ''; let atual = null; const fonte = [];
  const novaSecao = (tipo, rotulo, titulo) => { atual = { tipo, rotulo, titulo, parte: tipo === 'capitulo' ? parteAtual : '', tituloOriginal: titulo, blocos: [] }; secoes.push(atual); return atual; };
  for (const p of paginas) {
    const raiz = H.parse(p.content || '');
    const achar = (f) => H.achar(raiz, f)[0];
    const textoDe = (n) => (n ? H.limpar(H.texto(n)) : '');
    if (p.kind === 'cover' || p.kind === 'toc') continue;
    if (p.kind === 'title') {
      meta.titulo = capitalizar(textoDe(achar((n) => n.tag === 'h1'))) || p.title;
      meta.subtitulo = textoDe(achar((n) => n.tag === 'h2')) || p.subtitle || '';
      const k = textoDe(achar((n) => H.tem(n, 'kicker') || H.tem(n, 'collection')));
      meta.serie = /flipbook/i.test(k) ? '' : capitalizar(k);
      meta.epigrafe = textoDe(achar((n) => H.tem(n, 'quote') || H.tem(n, 'deck')));
      continue;
    }
    if (p.kind === 'part' || p.kind === 'act') {
      const pre = textoDe(achar((n) => H.tem(n, 'pretitle') || H.tem(n, 'act-label')));
      const tit = textoDe(achar((n) => n.tag === 'h2'));
      const sub = textoDe(achar((n) => H.tem(n, 'part-subtitle')));
      parteAtual = p.kind === 'part' ? [capitalizar(pre), tit].filter(Boolean).join(' — ') : tit;
      const s = novaSecao('parte', p.kind === 'part' ? capitalizar(pre) : '', p.kind === 'part' ? tit : capitalizar(tit));
      s.parte = parteAtual; if (sub) { s.blocos.push(BLOCOS_P(sub)); fonte.push(sub); }
      fonte.push(tit); if (pre && p.kind === 'part') fonte.push(pre); atual = null; continue;
    }
    const cab = achar((n) => n.tag === 'h2' && (H.tem(n, 'chapter-title') || H.tem(n, 'section-title') || H.tem(n, 'epilogue-title')));
    const ehTitulo = (n) => n === cab || H.tem(n, 'chapter-kicker');
    if (cab) {
      const kick = textoDe(achar((n) => H.tem(n, 'chapter-kicker')));
      let titulo = textoDe(cab); let rotulo = '';
      if (/^cap[ií]tulo$/i.test(kick) && /^\d+$/.test(titulo)) titulo = `Capítulo ${titulo}`;
      else if (kick) rotulo = capitalizar(kick);
      novaSecao(p.kind === 'chapter' ? 'capitulo' : p.kind === 'epilogue' ? 'back' : 'front', rotulo, capitalizar(titulo)); fonte.push(textoDe(cab), kick);
    } else if (!atual || p.kind === 'identity' || p.kind === 'front') {
      novaSecao(p.kind === 'chapter' ? 'capitulo' : 'front', '', p.title || ''); fonte.push(p.title || '');
    }
    const { blocos } = blocosHtml(raiz, { ignorar: (n) => ehTitulo(n) });
    blocos.forEach((b) => { if (b.t !== 'orn') fonte.push(b.texto || (b.itens || []).map((x) => x.texto).join(' ')); });
    atual.blocos.push(...blocos);
  }
  secoes.forEach((s) => { s.blocos = unirContinuacoes(s.blocos, rel); });
  return { formato: 'pagsjson', meta, secoes: secoes.filter((s) => s.blocos.length || s.tipo === 'parte'), _fonte: fonte.join('\n'), _unioes: rel.unioes };
}

// ----------------------------------------------------------------------------- 3. páginas estáticas (<article class="page">)

function extrairEstatico(h) {
  const raiz = H.parse(h);
  const paginas = H.achar(raiz, (n) => n.tag === 'article' && H.tem(n, 'page'));
  const rel = { unioes: 0 };
  const meta = { titulo: '', subtitulo: '', autor: 'Zuni Suprema', tagline: '', epigrafe: '', avisoLegal: '', copyright: '', serie: '' };
  const secoes = []; let atual = null; const fonte = []; const ultimoIdPorSecao = new Map();
  const tipoDaPagina = (p) => p.attrs['data-kind'] || (H.classes(p).filter((c) => c !== 'page')[0] || '');
  let parteAtual = '';
  const novaSecao = (rotulo, titulo) => {
    const ehParte = /^parte\b/i.test(rotulo);
    if (ehParte) parteAtual = `${rotulo} — ${titulo}`;
    const tipo = ehParte ? 'parte' : /^(apresenta|introdu|pr[oó]logo|ep[ií]logo|posf|nota|sobre|como ler|agradec)/i.test(titulo) ? 'front' : 'capitulo';
    atual = { tipo, rotulo, titulo, parte: tipo === 'capitulo' || ehParte ? parteAtual : '', tituloOriginal: titulo, blocos: [] };
    secoes.push(atual); fonte.push(titulo); return atual;
  };
  const textoDe = (n) => (n ? H.limpar(H.texto(n)) : '');
  let rotuloPend = ''; // o rótulo ("PRÓLOGO", "CONTO 3") pode vir numa página e o título na seguinte
  for (const p of paginas) {
    const tipo = tipoDaPagina(p);
    if (['cover', 'toc', 'tocpage', 'art', 'image'].includes(tipo)) continue;
    if (tipo === 'title') {
      meta.titulo = capitalizar(textoDe(H.achar(p, (n) => n.tag === 'h1')[0]).replace(/\s*\n\s*/g, ' '));
      meta.subtitulo = textoDe(H.achar(p, (n) => H.tem(n, 'subtitle'))[0]);
      const eb = textoDe(H.achar(p, (n) => H.tem(n, 'eyebrow'))[0]);
      meta.serie = /flipbook|master|retrofit/i.test(eb) ? '' : capitalizar(eb);
      continue;
    }
    // elementos em ordem de documento, sem entrar em figuras/folios/cabeçalhos correntes
    const itens = [];
    const visita = (n) => {
      if (n.texto !== undefined) return;
      const cls = H.classes(n);
      if (cls.includes('folio') || cls.includes('eyebrow') || cls.includes('rule') || cls.includes('imprint') || n.tag === 'img' || n.tag === 'figure' || n.tag === 'nav') return;
      if (n.tag === 'h1' || n.tag === 'h2') { itens.push({ k: 'h', n }); return; }
      if (cls.some((c) => c === 'kicker' || c === 'eyebrow-line')) { itens.push({ k: 'kicker', n }); return; }
      if (cls.includes('deck')) { itens.push({ k: 'deck', n }); return; }
      if (n.tag === 'p') { itens.push({ k: 'p', n }); return; }
      if (n.tag === 'h3') { itens.push({ k: 'sec', n }); return; }
      if (n.tag === 'h4') { itens.push({ k: 'sub', n }); return; }
      if (n.tag === 'li' || n.tag === 'blockquote') { itens.push({ k: 'p', n }); return; }
      const filhosEl = n.filhos.filter((f) => f.tag);
      if (!filhosEl.length && textoDe(n)) { itens.push({ k: 'p', n }); return; }
      n.filhos.forEach(visita);
    };
    p.filhos.forEach(visita);
    for (const it of itens) {
      const t = textoDe(it.n);
      if (!t) continue;
      if (it.k === 'kicker') { rotuloPend = capitalizar(t); fonte.push(t); continue; }
      if (it.k === 'h') { novaSecao(rotuloPend, capitalizar(t.replace(/\s*\n\s*/g, ' ')) === t.replace(/\s*\n\s*/g, ' ') ? t : capitalizar(t)); rotuloPend = ''; continue; }
      if (!atual) throw new Error('texto antes do primeiro título de seção (página estática)');
      if (it.k === 'deck') { atual.blocos.push({ t: 'quote', ...inlineLocal(H.inlineMarcado(it.n).trim()) }); fonte.push(t); continue; }
      if (it.k === 'sec') { atual.blocos.push({ t: 'sec', texto: t }); fonte.push(t); continue; }
      if (it.k === 'sub') { atual.blocos.push({ t: 'sub', texto: t }); fonte.push(t); continue; }
      const marcado = H.inlineMarcado(it.n).replace(/­/g, '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
      // mesmo id de origem em elementos seguidos = o mesmo parágrafo repartido pela paginação
      const id = it.n.attrs['data-src-id'];
      const ant = atual.blocos[atual.blocos.length - 1];
      if (id !== undefined && ant && ant._id === id && ant.t === 'p') {
        ant.html = `${ant.html} ${inlineLocal(marcado).html}`; ant.texto = `${ant.texto} ${inlineLocal(marcado).texto}`; rel.unioes++;
      } else {
        const b = BLOCOS_P(marcado); if (id !== undefined) b._id = id; atual.blocos.push(b);
      }
      fonte.push(t);
    }
  }
  secoes.forEach((s) => { s.blocos.forEach((b) => { delete b._id; }); s.blocos = unirContinuacoes(s.blocos, rel); });
  return { formato: 'estatico', meta, secoes: secoes.filter((s) => s.blocos.length || s.tipo === 'parte'), _fonte: fonte.join('\n'), _unioes: rel.unioes };
}

// ----------------------------------------------------------------------------- detecção

function detectar(h) {
  if (h.includes('type="__bundler/manifest"') && dadosModulo(h)) return 'modulo';
  if (h.includes('type="__bundler/manifest"') && dadosPaginasModulo(h)) return 'paginas-modulo';
  if (/[\s,;](?:const|var|let)?\s*pages\s*=\s*\[\s*\{\s*"kind"/.test(h.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, 'D'))) return 'pagsjson';
  if (/<article class="page\b/.test(h)) return 'estatico';
  return null;
}

// ----------------------------------------------------------------------------- 4. páginas em módulo (const PAGES = {…, pages:[{kind,…}]}) — Inesquecível Charme Feminino

function dadosPaginasModulo(h) {
  const bloco = (tipo) => { const m = h.lastIndexOf(`type="__bundler/${tipo}"`); if (m < 0) return null; const a = h.indexOf('>', m) + 1; return h.slice(a, h.indexOf('</script>', a)); };
  const man = bloco('manifest'); if (!man) return null;
  for (const v of Object.values(JSON.parse(man))) {
    if (!String(v.mime).includes('javascript')) continue;
    let buf = Buffer.from(v.data, 'base64'); if (v.compressed) buf = zlib.gunzipSync(buf);
    const t = buf.toString('utf8');
    if (/^\s*const PAGES = \{/.test(t)) { try { const d = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); if (Array.isArray(d.pages) && d.pages.some((p) => p.kind === 'text')) return d; } catch (e) { /* não é este módulo */ } }
  }
  return null;
}

// Páginas já paginadas: "text" com showHeader abre uma seção (rótulo "CAPÍTULO n" ou título avulso); "text" sem cabeçalho continua a seção;
// "part" dá o nome da parte aos capítulos seguintes; "qa" (perguntas do apêndice) vira seção com lista numerada. title/epigraph/toc são
// montados pelo PDF (folha de rosto, sumário). Nenhum parágrafo é unido nem alterado.
function extrairPaginasModulo(h) {
  const d = dadosPaginasModulo(h);
  if (!d) throw new Error('módulo de páginas não encontrado no bundle');
  const meta = { titulo: capitalizar(d.title), subtitulo: d.description || '', autor: capitalizar(d.brand), tagline: capitalizar(d.tagline), epigrafe: d.epigraph || '', avisoLegal: '', copyright: '', serie: '' };
  const secoes = []; const fonte = []; let parte = ''; let viuParte = false; let ultimoCapitulo = false;
  for (const pg of d.pages) {
    if (pg.kind === 'part') { parte = pg.isAppendix ? capitalizar(pg.title) : [pg.numeral ? `Parte ${pg.numeral}` : '', capitalizar(pg.title)].filter(Boolean).join(' — '); viuParte = true; continue; }
    if (pg.kind === 'text') {
      if (pg.showHeader) {
        const rotulo = pg.label ? capitalizar(pg.label) : '';
        const tipo = pg.label ? 'capitulo' : (viuParte ? 'back' : 'front');
        if (pg.label) ultimoCapitulo = true;
        secoes.push({ tipo, rotulo, titulo: pg.title || '', parte: pg.label ? parte : '', tituloOriginal: pg.title || '', blocos: [] });
        if (rotulo) fonte.push(rotulo); fonte.push(pg.title || '');
      }
      const atual = secoes[secoes.length - 1]; if (!atual) throw new Error('página de texto antes de qualquer seção');
      (pg.paragraphs || []).forEach((t) => { atual.blocos.push(BLOCOS_P(t)); fonte.push(t); });
      continue;
    }
    if (pg.kind === 'qa') {
      const itens = (pg.questions || []).map((q) => inlineLocal(q.text));
      // página de continuação (sem título nem introdução: as perguntas 7 a 10 da mesma lista) segue a lista da seção anterior
      const anterior = secoes[secoes.length - 1];
      if (!pg.title && !pg.intro && anterior && anterior.blocos.length && anterior.blocos[anterior.blocos.length - 1].t === 'list') {
        anterior.blocos[anterior.blocos.length - 1].itens.push(...itens); (pg.questions || []).forEach((q) => fonte.push(q.text)); continue;
      }
      const blocos = []; if (pg.intro) { blocos.push(BLOCOS_P(pg.intro)); fonte.push(pg.intro); }
      blocos.push({ t: 'list', label: '', ordered: true, itens }); (pg.questions || []).forEach((q) => fonte.push(q.text));
      secoes.push({ tipo: 'back', rotulo: '', titulo: pg.title || '', parte: '', tituloOriginal: pg.title || '', blocos }); fonte.push(pg.title || '');
    }
  }
  void ultimoCapitulo;
  return { formato: 'paginas-modulo', meta, secoes, _fonte: fonte.join('\n') };
}

function extrairLote2(htmlPath) {
  const h = fs.readFileSync(htmlPath, 'utf8');
  const f = detectar(h);
  if (!f) throw new Error('formato de flipbook não reconhecido');
  const r = f === 'modulo' ? extrairModulo(h) : f === 'paginas-modulo' ? extrairPaginasModulo(h) : f === 'pagsjson' ? extrairPaginasJson(h) : extrairEstatico(h);
  return r;
}

module.exports = { extrairLote2, detectar, extrairModulo, extrairPaginasJson, extrairEstatico, capitalizar };
