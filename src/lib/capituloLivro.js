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
const RE_CAP_NUM = new RegExp(`\\bcap(?:itulo|itulos)?\\.?\\s*(?:n(?:o|umero)?\\.?\\s*)?(${NUM_TOKEN})\\b`, 'i');
const RE_ORDINAL = /\b(decimo (?:primeiro|segundo|terceiro|quarto|quinto|sexto|setimo|oitavo|nono)|primeiro|segundo|terceiro|quarto|quinto|sexto|setimo|oitavo|nono|decimo|vigesimo)\s+capitulo\b/i;

// Deíticos: a pergunta é sobre o capítulo que o leitor tem aberto.
const RE_DEITICO = /\b(?:este|esse|esta|essa|neste|nesse|nesta|nessa|deste|desse|desta|dessa)\s+(?:capitulo|trecho|parte|secao)\b|\b(?:capitulo|trecho)\s+(?:atual|aberto)\b|\bcapitulo\s+que\s+(?:estou|to|ando)\s+lendo\b|\bo\s+que\s+(?:estou|to)\s+lendo\b/i;

// Extrai o número do capítulo citado (ou null). `texto` é a pergunta crua.
function numeroCitado(texto) {
  const t = norm(texto);
  let m = RE_CAP_NUM.exec(t);
  if (m) { const n = numeroDeToken(m[1]); if (n) return n; }
  m = RE_ORDINAL.exec(t);
  if (m && ORDINAIS[m[1]]) return ORDINAIS[m[1]];
  return null;
}

function ehPerguntaSobreCapituloAberto(texto) { return RE_DEITICO.test(norm(texto)); }

// ---- título do capítulo a partir do rótulo dos trechos em `documentos`
// "Capítulo 17 — O ano da virada — parte 2/3" → { numero: 17, base: "Capítulo 17 — O ano da virada", titulo: "O ano da virada" }
// "2. O balcão — parte 1/3" (Herança)         → { numero: 2,  base: "2. O balcão", titulo: "O balcão" }
function lerRotulo(titulo) {
  const bruto = String(titulo || '').trim();
  const base = bruto.replace(/\s*[—–-]\s*parte\s+\d+\s*\/\s*\d+\s*$/i, '').replace(/\s*\(parte\s+\d+\s*\/\s*\d+\)\s*$/i, '').trim();
  let m = /^cap[íi]tulo\s+(\d{1,3})\s*(?:[—–:.-]\s*)?(.*)$/i.exec(base);
  if (!m) m = /^(\d{1,3})\.\s+(.*)$/.exec(base);
  if (!m) return { numero: null, base, titulo: base };
  return { numero: parseInt(m[1], 10), base, titulo: (m[2] || '').trim() || base };
}

function numeroDoCaminho(caminho) { const m = /tema-(\d+)$/.exec(String(caminho || '')); return m ? parseInt(m[1], 10) : 0; }

// rows: [{ id, titulo, caminho }] → { capitulos: Map(numero → {numero, base, titulo, ids:[...]}), porTitulo: [{chave, numero}], total }
function montarIndice(rows) {
  const capitulos = new Map();
  [...rows].sort((a, b) => numeroDoCaminho(a.caminho) - numeroDoCaminho(b.caminho)).forEach((r) => {
    const l = lerRotulo(r.titulo);
    if (l.numero == null) return;
    if (!capitulos.has(l.numero)) capitulos.set(l.numero, { numero: l.numero, base: l.base, titulo: l.titulo, ids: [] });
    capitulos.get(l.numero).ids.push(r.id);
  });
  const porTitulo = [...capitulos.values()].map((c) => ({ chave: norm(c.titulo), numero: c.numero, palavras: norm(c.titulo).split(' ').filter(Boolean).length }));
  const numeros = [...capitulos.keys()].sort((a, b) => a - b);
  return { capitulos, porTitulo, numeros, maior: numeros.length ? numeros[numeros.length - 1] : 0 };
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
    const pista = /\b(capitulo|cap|secao|trecho|parte|intitulado|chamado|titulo)\s*(?:de|do|da|o|a)?\s*$/.test(antes) || comAspas;
    if (c.palavras >= 3 || pista) { if (!melhor || c.chave.length > melhor.chave.length) melhor = c; }
  }
  return melhor ? melhor.numero : null;
}

// Resultado: { tipo: 'numero'|'titulo'|'aberto', numero } | { tipo: 'inexistente', numero } | null
function detectarReferenciaCapitulo(pergunta, indice, capituloAberto) {
  const n = numeroCitado(pergunta);
  if (n != null) return indice.capitulos.has(n) ? { tipo: 'numero', numero: n } : { tipo: 'inexistente', numero: n };
  const porTitulo = numeroPorTitulo(pergunta, indice);
  if (porTitulo != null) return { tipo: 'titulo', numero: porTitulo };
  if (ehPerguntaSobreCapituloAberto(pergunta) && capituloAberto && Number.isInteger(capituloAberto.numero) && indice.capitulos.has(capituloAberto.numero)) {
    return { tipo: 'aberto', numero: capituloAberto.numero };
  }
  return null;
}

// Aceita só o que o widget manda de forma segura: { numero:int|null, titulo:string|null } (nunca vai ao prompt; só escolhe o capítulo).
function sanitizarCapituloAberto(bruto) {
  if (!bruto || typeof bruto !== 'object') return null;
  const n = Number.isInteger(bruto.numero) ? bruto.numero : (typeof bruto.numero === 'string' && /^\d{1,3}$/.test(bruto.numero.trim()) ? parseInt(bruto.numero, 10) : null);
  const titulo = typeof bruto.titulo === 'string' ? bruto.titulo.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120) : null;
  if (n == null || n < 1 || n > 200) return titulo ? { numero: null, titulo } : null;
  return { numero: n, titulo: titulo || null };
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

module.exports = { norm, romanoParaNumero, numeroDeToken, numeroCitado, ehPerguntaSobreCapituloAberto, lerRotulo, montarIndice, numeroPorTitulo, detectarReferenciaCapitulo, sanitizarCapituloAberto, carregarIndiceCapitulos, buscarTrechosDoCapitulo, limparCache, MAX_TRECHOS_CAPITULO };
