// lib/capituloLivro.js
//
// Livro-Vivo — perguntas POR CAPÍTULO. A busca vetorial (match_documents_livro) devolve só os 5 trechos mais parecidos com a pergunta,
// o que não serve para "resuma o capítulo 2" ou "qual o sentido do capítulo 3". Aqui:
//   1. detectarReferenciaCapitulo(): acha na pergunta o capítulo citado — número ("capítulo 3", "cap. 3", "cap 3"), algarismo romano
//      ("capítulo III"), número/ordinal por extenso ("capítulo três", "terceiro capítulo") ou o TÍTULO do capítulo;
//   2. ehPerguntaSobreCapituloAberto(): "este capítulo", "neste capítulo", "o capítulo que estou lendo" → usa o capítulo aberto na tela
//      (o widget envia capitulo_aberto);
//   3. carregarIndiceCapitulos() / buscarTrechosDoCapitulo(): lê de `documentos` TODOS os trechos do capítulo, na ordem do livro.
// Só dados do livro entram no prompt (nunca texto da pergunta): ver routes/livroChat.js.

const ATE = 60; // maior número de capítulo aceito numa pergunta

const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const UNIDADES = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50 };
const ORDINAIS = { primeiro: 1, segundo: 2, terceiro: 3, quarto: 4, quinto: 5, sexto: 6, setimo: 7, oitavo: 8, nono: 9, decimo: 10, 'decimo primeiro': 11, 'decimo segundo': 12, 'decimo terceiro': 13, 'decimo quarto': 14, 'decimo quinto': 15, 'decimo sexto': 16, 'decimo setimo': 17, 'decimo oitavo': 18, 'decimo nono': 19, vigesimo: 20 };

function romanoParaNumero(r) {
  const v = { i: 1, v: 5, x: 10, l: 50 }; const s = String(r).toLowerCase();
  if (!/^[ivxl]+$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i++) { const a = v[s[i]]; const b = v[s[i + 1]] || 0; total += a < b ? -a : a; }
  // confere ida e volta (rejeita "iiii", "vx"…)
  const volta = numeroParaRomano(total);
  return volta === s ? total : null;
}
function numeroParaRomano(n) {
  const tab = [[50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let r = '';
  for (const [v, s] of tab) while (n >= v) { r += s; n -= v; }
  return r;
}

// "21", "xxi", "vinte e um", "três" → número (1..ATE) ou null. Recebe texto já normalizado (sem acento).
function numeroDeToken(t) {
  const s = norm(t);
  if (/^\d{1,3}$/.test(s)) { const n = parseInt(s, 10); return n >= 1 && n <= ATE ? n : null; }
  const r = romanoParaNumero(s); if (r && r <= ATE) return r;
  if (UNIDADES[s]) return UNIDADES[s];
  const m = /^(vinte|trinta|quarenta|cinquenta) e (um|dois|tres|quatro|cinco|seis|sete|oito|nove)$/.exec(s);
  if (m) return UNIDADES[m[1]] + UNIDADES[m[2]];
  return null;
}

const NUM_TOKEN = '(?:\\d{1,3}|[ivxl]{1,6}|(?:vinte|trinta|quarenta|cinquenta)(?: e (?:um|dois|tres|quatro|cinco|seis|sete|oito|nove))?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove)';

// Unidade em que a obra se divide. "capitulo" é o padrão; livros de contos usam "Conto N", outros "Parte N"/"Ato N".
// O índice de cada livro adota UMA unidade (a mais frequente nos rótulos), e a pergunta só é entendida nessa unidade:
// "parte 2" num livro de capítulos NÃO vira capítulo 2.
const TIPOS = {
  capitulo: { palavra: 'cap(?:itulo|itulos)?\\.?', ordinalSubst: 'capitulo', nome: 'capítulo', artigo: 'o' },
  conto: { palavra: 'contos?', ordinalSubst: 'conto', nome: 'conto', artigo: 'o' },
  parte: { palavra: 'partes?', ordinalSubst: 'parte', nome: 'parte', artigo: 'a' },
  ato: { palavra: 'atos?', ordinalSubst: 'ato', nome: 'ato', artigo: 'o' }
};
const PREFERENCIA_TIPOS = ['capitulo', 'conto', 'ato', 'parte']; // desempate quando há o mesmo número de rótulos

const ORD = '(?:decim[oa] (?:primeir|segund|terceir|quart|quint|sext|setim|oitav|non)[oa]|(?:primeir|segund|terceir|quart|quint|sext|setim|oitav|non|decim|vigesim)[oa])';
const reCitacao = {}; const reOrdinal = {};
for (const [tipo, t] of Object.entries(TIPOS)) {
  reCitacao[tipo] = new RegExp(`\\b${t.palavra}\\s*(?:n(?:o|umero)?\\.?\\s*)?(${NUM_TOKEN})\\b`, 'i');
  reOrdinal[tipo] = new RegExp(`\\b(${ORD})\\s+${t.ordinalSubst}\\b`, 'i');
}
const RE_CAP_NUM = reCitacao.capitulo;
const RE_ORDINAL = reOrdinal.capitulo;
// "primeira"/"segunda"… (feminino, para "a segunda parte") → mesmo número que o masculino
const ordinalParaNumero = (o) => ORDINAIS[o.replace(/a(?=\s|$)/g, 'o')] || null;

// Deíticos: a pergunta é sobre o capítulo/conto que a pessoa tem aberto.
const RE_DEITICO = /\b(?:este|esse|esta|essa|neste|nesse|nesta|nessa|deste|desse|desta|dessa)\s+(?:capitulo|conto|historia|trecho|parte|secao|ato)\b|\b(?:capitulo|conto|historia|trecho)\s+(?:atual|aberto)\b|\b(?:capitulo|conto|historia|ato|trecho|texto)\s+que\s+(?:estou|to|ando)\s+lendo\b|\bo\s+que\s+(?:estou|to)\s+lendo\b/i;

// Extrai o número citado (ou null). `texto` é a pergunta crua; `tipo` é a unidade do livro (padrão: capítulo).
function numeroCitado(texto, tipo = 'capitulo') {
  const t = norm(texto);
  let m = (reCitacao[tipo] || reCitacao.capitulo).exec(t);
  if (m) { const n = numeroDeToken(m[1]); if (n) return n; }
  m = (reOrdinal[tipo] || reOrdinal.capitulo).exec(t);
  if (m) { const n = ordinalParaNumero(m[1].toLowerCase()); if (n) return n; }
  return null;
}

function ehPerguntaSobreCapituloAberto(texto) { return RE_DEITICO.test(norm(texto)); }

// ---- título do capítulo a partir do rótulo dos trechos em `documentos`
// "Capítulo 17 — O ano da virada — parte 2/3" → { numero: 17, base: "Capítulo 17 — O ano da virada", titulo: "O ano da virada" }
// "2. O balcão — parte 1/3" (Herança)         → { numero: 2,  base: "2. O balcão", titulo: "O balcão" }
// "Conto 18 — A Vitória que Custa Tudo — parte 5/6" → { numero: 18, tipo: 'conto', base: "Conto 18 — A Vitória que Custa Tudo", titulo: "A Vitória que Custa Tudo" }
// "Capítulo V — O homem que veio buscar uma caixa"  → { numero: 5, tipo: 'capitulo', … }   (algarismo romano)
function lerRotulo(titulo) {
  const bruto = String(titulo || '').trim();
  const base = bruto.replace(/\s*[—–-]\s*parte\s+\d+\s*\/\s*\d+\s*$/i, '').replace(/\s*\(parte\s+\d+\s*\/\s*\d+\)\s*$/i, '').trim();
  let m = /^(cap[íi]tulo|conto|parte|ato)\s+(\d{1,3}|[ivxl]{1,6})(?![\p{L}\p{N}])\s*(?:[—–:.-]\s*)?(.*)$/iu.exec(base);
  let tipo = null; let numero = null; let resto = '';
  if (m) {
    tipo = norm(m[1]);
    numero = /^\d+$/.test(m[2]) ? parseInt(m[2], 10) : romanoParaNumero(m[2]);
    resto = m[3];
  } else {
    m = /^(\d{1,3})\.\s+(.*)$/.exec(base);
    if (m) { tipo = 'capitulo'; numero = parseInt(m[1], 10); resto = m[2]; }
  }
  if (!tipo || !numero) return { numero: null, base, titulo: base };
  return { numero, tipo, base, titulo: (resto || '').trim() || base };
}

function numeroDoCaminho(caminho) { const m = /tema-(\d+)$/.exec(String(caminho || '')); return m ? parseInt(m[1], 10) : 0; }

// rows: [{ id, titulo, caminho }] → { tipo, capitulos: Map(numero → {numero, base, titulo, ids:[...]}), porId: Map(id → numero), porTitulo, numeros, maior }
// O índice adota UMA unidade: a mais frequente entre os rótulos (capítulo > conto > ato > parte no empate), para que "Parte I" de um livro
// de capítulos não colida com "Capítulo 1".
function montarIndice(rows) {
  const lidos = [...rows].sort((a, b) => numeroDoCaminho(a.caminho) - numeroDoCaminho(b.caminho)).map((r) => ({ r, l: lerRotulo(r.titulo) })).filter((x) => x.l.numero != null);
  const contagem = {}; lidos.forEach((x) => { contagem[x.l.tipo] = (contagem[x.l.tipo] || 0) + 1; });
  const tipo = PREFERENCIA_TIPOS.slice().sort((a, b) => (contagem[b] || 0) - (contagem[a] || 0) || PREFERENCIA_TIPOS.indexOf(a) - PREFERENCIA_TIPOS.indexOf(b))[0];
  const capitulos = new Map(); const porId = new Map();
  lidos.filter((x) => x.l.tipo === tipo).forEach(({ r, l }) => {
    if (!capitulos.has(l.numero)) capitulos.set(l.numero, { numero: l.numero, base: l.base, titulo: l.titulo, ids: [] });
    capitulos.get(l.numero).ids.push(r.id); porId.set(r.id, l.numero);
  });
  const porTitulo = [...capitulos.values()].map((c) => ({ chave: norm(c.titulo), numero: c.numero, palavras: norm(c.titulo).split(' ').filter(Boolean).length }));
  const numeros = [...capitulos.keys()].sort((a, b) => a - b);
  return { tipo: capitulos.size ? tipo : 'capitulo', capitulos, porId, porTitulo, numeros, maior: numeros.length ? numeros[numeros.length - 1] : 0 };
}

// Título citado na pergunta. Título de 1–2 palavras só vale com pista ("capítulo X", aspas) para não confundir "carbono" (palavra
// comum) com o capítulo "Carbono"; título com 3+ palavras vale sozinho.
function numeroPorTitulo(texto, indice) {
  const t = ` ${norm(texto)} `;
  const comAspas = /["“”'‘’«»]/.test(String(texto));
  let melhor = null;
  for (const c of indice.porTitulo) {
    if (!c.chave || c.chave.length < 4) continue;
    const i = t.indexOf(` ${c.chave} `);
    if (i < 0) continue;
    const antes = t.slice(Math.max(0, i - 40), i);
    const pista = /\b(capitulo|cap|conto|historia|ato|secao|trecho|parte|intitulado|chamado|titulo)\s*(?:de|do|da|o|a)?\s*$/.test(antes) || comAspas;
    if (c.palavras >= 3 || pista) { if (!melhor || c.chave.length > melhor.chave.length) melhor = c; }
  }
  return melhor ? melhor.numero : null;
}

// Resultado: { tipo: 'numero'|'titulo'|'aberto', numero } | { tipo: 'inexistente', numero } | null
function detectarReferenciaCapitulo(pergunta, indice, capituloAberto) {
  const n = numeroCitado(pergunta, indice.tipo);
  if (n != null) return indice.capitulos.has(n) ? { tipo: 'numero', numero: n } : { tipo: 'inexistente', numero: n };
  const porTitulo = numeroPorTitulo(pergunta, indice);
  if (porTitulo != null) return { tipo: 'titulo', numero: porTitulo };
  if (ehPerguntaSobreCapituloAberto(pergunta)) {
    const aberto = resolverCapituloAberto(capituloAberto, indice);
    if (aberto != null) return { tipo: 'aberto', numero: aberto };
  }
  return null;
}

// Capítulo/conto aberto na tela, só pelo que o widget leu dos cabeçalhos (sem consultar o banco):
//   1. rótulo visível ("Capítulo 3", "Conto 2", "Parte I") — vale só se for a MESMA unidade do índice do livro;
//   2. título da seção visível (ex.: "A Toalha Molhada") — vale se bater, palavra por palavra, com o título de um capítulo do índice.
function resolverCapituloAberto(capituloAberto, indice) {
  if (!capituloAberto) return null;
  if (Number.isInteger(capituloAberto.numero) && (!capituloAberto.tipo || capituloAberto.tipo === indice.tipo) && indice.capitulos.has(capituloAberto.numero)) return capituloAberto.numero;
  const candidatos = [capituloAberto.titulo, ...(capituloAberto.titulos || [])].filter(Boolean).map(norm).filter((c) => c.length >= 4);
  for (const c of candidatos) {
    const achado = indice.porTitulo.find((p) => p.chave && p.chave === c);
    if (achado) return achado.numero;
  }
  return null;
}

const MAX_CHARS_TRECHO_VISIVEL = 90;
// "%" e "_" são curingas do LIKE; "\" é o escape. O texto vem da tela da própria pessoa e só serve para LOCALIZAR o capítulo (nunca vai ao prompt).
const escaparLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// Último recurso para "este capítulo/conto": o leitor está no MEIO do capítulo (sem cabeçalho na tela). O widget manda o início de
// alguns parágrafos visíveis; procuramos qual capítulo do índice contém essa frase. Devolve o número do capítulo ou null.
async function capituloPorTrechosVisiveis(supabase, livroId, indice, trechos) {
  const votos = new Map();
  for (const t of (trechos || []).slice(0, 3)) {
    const frase = String(t || '').trim().slice(0, MAX_CHARS_TRECHO_VISIVEL);
    if (frase.length < 25) continue;
    const { data, error } = await supabase.from('documentos').select('id').eq('livro_id', livroId).ilike('corpo', `%${escaparLike(frase)}%`).limit(4);
    if (error) throw new Error(`Falha ao localizar o capítulo pelo trecho visível: ${error.message}`);
    for (const row of data || []) { const n = indice.porId.get(row.id); if (n != null) votos.set(n, (votos.get(n) || 0) + 1); }
  }
  let melhor = null; let max = 0;
  for (const [n, v] of votos) if (v > max) { melhor = n; max = v; }
  return melhor;
}

const limparTexto = (s, max, colapsar = false) => { const t = String(s).replace(/[\u0000-\u001f\u007f]/g, ' '); return (colapsar ? t.replace(/\s+/g, ' ') : t).trim().slice(0, max); };

// Aceita só o que o widget manda de forma segura (nunca vai ao prompt; só ajuda a escolher o capítulo):
//   { numero:int|null, titulo:string|null, tipo?:'capitulo'|'conto'|'parte'|'ato', titulos?:string[], trechos?:string[] }
function sanitizarCapituloAberto(bruto) {
  if (!bruto || typeof bruto !== 'object') return null;
  const n = Number.isInteger(bruto.numero) ? bruto.numero : (typeof bruto.numero === 'string' && /^\d{1,3}$/.test(bruto.numero.trim()) ? parseInt(bruto.numero, 10) : null);
  const titulo = typeof bruto.titulo === 'string' ? limparTexto(bruto.titulo, 120) || null : null;
  const lista = (v, max, cabem) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => limparTexto(x, max, true)).filter(Boolean).slice(0, cabem) : []);
  const titulos = lista(bruto.titulos, 120, 8); const trechos = lista(bruto.trechos, MAX_CHARS_TRECHO_VISIVEL, 3);
  const tipo = typeof bruto.tipo === 'string' && Object.prototype.hasOwnProperty.call(TIPOS, bruto.tipo) ? bruto.tipo : null;
  const numeroOk = n != null && n >= 1 && n <= 200;
  if (!numeroOk && !titulo && !titulos.length && !trechos.length) return null;
  const saida = { numero: numeroOk ? n : null, titulo };
  if (numeroOk && tipo) saida.tipo = tipo;
  if (titulos.length) saida.titulos = titulos;
  if (trechos.length) saida.trechos = trechos;
  return saida;
}

// ---- Supabase
const CACHE_INDICE_MS = 10 * 60 * 1000; const cache = new Map();

async function carregarIndiceCapitulos(supabase, livroId) {
  const c = cache.get(livroId);
  if (c && Date.now() - c.em < CACHE_INDICE_MS) return c.indice;
  const { data, error } = await supabase.from('documentos').select('id, titulo, caminho').eq('livro_id', livroId).limit(2000);
  if (error) throw new Error(`Falha ao ler o índice de capítulos: ${error.message}`);
  const indice = montarIndice(data || []);
  cache.set(livroId, { em: Date.now(), indice });
  return indice;
}

const MAX_TRECHOS_CAPITULO = 14;
const MAX_PALAVRAS_CAPITULO = 9000;

// Todos os trechos do capítulo, na ordem do livro: [{ titulo, corpo }] (corta no limite de palavras; `cortado` avisa).
async function buscarTrechosDoCapitulo(supabase, indice, numero) {
  const cap = indice.capitulos.get(numero);
  if (!cap) return { trechos: [], cortado: false, capitulo: null };
  const { data, error } = await supabase.from('documentos').select('id, titulo, corpo, caminho').in('id', cap.ids.slice(0, MAX_TRECHOS_CAPITULO * 2));
  if (error) throw new Error(`Falha ao ler o capítulo: ${error.message}`);
  const ordenados = (data || []).sort((a, b) => numeroDoCaminho(a.caminho) - numeroDoCaminho(b.caminho));
  const trechos = []; let palavras = 0; let cortado = false;
  for (const r of ordenados) {
    const p = String(r.corpo || '').split(/\s+/).length;
    if (trechos.length >= MAX_TRECHOS_CAPITULO || (trechos.length && palavras + p > MAX_PALAVRAS_CAPITULO)) { cortado = true; break; }
    trechos.push({ titulo: r.titulo, corpo: r.corpo }); palavras += p;
  }
  return { trechos, cortado, capitulo: cap };
}

function limparCache() { cache.clear(); }

module.exports = { norm, romanoParaNumero, numeroDeToken, numeroCitado, ehPerguntaSobreCapituloAberto, lerRotulo, montarIndice, numeroPorTitulo, detectarReferenciaCapitulo, resolverCapituloAberto, capituloPorTrechosVisiveis, sanitizarCapituloAberto, TIPOS, carregarIndiceCapitulos, buscarTrechosDoCapitulo, limparCache, MAX_TRECHOS_CAPITULO };
