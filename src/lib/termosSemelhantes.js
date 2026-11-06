// lib/termosSemelhantes.js
//
// Livro-Vivo — quando a pessoa pergunta por um termo que NÃO existe no livro (erro de memória: "colchão-mole" em vez de "coxão mole"),
// procura no vocabulário da obra palavras/expressões PARECIDAS e as entrega ao assistente para apontá-las, em vez de dizer só que
// "o livro não trata disso".
//
// Segurança do prompt: o que sai daqui para o prompt são palavras DO LIVRO (e o rótulo da seção onde aparecem), nunca o texto digitado
// pela pessoa (a pergunta continua entrando só como mensagem de usuário).
//
// Como: vocabulário normalizado (sem acento, minúsculas) das palavras e dos pares de palavras vizinhas do livro; para cada termo da
// pergunta ausente do vocabulário, distância de edição (Levenshtein) contra as palavras (e, para termos compostos, contra os pares
// juntos: "colchaomole" ≈ "coxaomole").

const { norm } = require('./capituloLivro');

const PARADAS = new Set(('a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre entre ate apos ante ao aos a ' +
  'e ou mas que se como quando onde quem qual quais quanto quanta porque pois entao tambem ja ainda so mais menos muito muita pouco ' +
  'eu voce vc ele ela eles elas nos me te lhe meu minha seu sua nosso isso isto esse essa este esta aquele aquela aquilo ' +
  'ser estar ter haver fazer ir vir poder dever querer saber ver dar dizer falar ficar ' +
  'resuma resumir resumo explique explicar explica diga dizer fale falar conte contar interprete interpretar interpretacao significa significado sentido ' +
  'capitulo capitulos livro livros obra trecho trechos texto autor autora parte partes secao pagina assunto tema ideia ideias ' +
  'quero queria gostaria preciso poderia pode podem favor entender entendi entendo lendo li ler leitura mostre fala falou fez faz acontece aconteceu ' +
  'exemplo exemplos importante principal principais basicamente resumidamente detalhe detalhes').split(' '));

function palavras(texto) { return norm(texto).split(' ').filter(Boolean); }

function levenshtein(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let menor = i;
    for (let j = 1; j <= b.length; j++) { const c = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); cur.push(c); if (c < menor) menor = c; }
    if (menor > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

// rows: [{ titulo, corpo }] → { palavras: Map(norm → {texto, secao}), pares: Map(norm-junto → {texto, secao}) }
function montarVocabulario(rows) {
  const ws = new Map(); const ps = new Map();
  for (const r of rows) {
    const secao = r.titulo || null;
    const tokens = String(r.corpo || '').match(/[\p{L}\p{N}]+/gu) || [];
    for (let i = 0; i < tokens.length; i++) {
      const n = norm(tokens[i]);
      if (n.length >= 4 && !ws.has(n)) ws.set(n, { texto: tokens[i].toLowerCase(), secao });
      if (i + 1 < tokens.length) {
        const a = norm(tokens[i]); const b = norm(tokens[i + 1]);
        if (a.length >= 3 && b.length >= 3) { const k = a + b; if (!ps.has(k)) ps.set(k, { texto: `${tokens[i]} ${tokens[i + 1]}`.toLowerCase(), secao }); }
      }
    }
  }
  return { palavras: ws, pares: ps };
}

// Termos candidatos da pergunta: palavras de conteúdo (≥5 letras, fora da lista de paradas) e pares vizinhos/hifenizados.
function termosDaPergunta(pergunta) {
  const brutos = (String(pergunta).match(/[\p{L}\p{N}]+/gu) || []);
  const uteis = brutos.map((t) => ({ t, n: norm(t) })).filter((x) => x.n.length >= 5 && !PARADAS.has(x.n) && !/^\d+$/.test(x.n));
  const pares = [];
  for (let i = 0; i + 1 < brutos.length; i++) { const a = norm(brutos[i]); const b = norm(brutos[i + 1]); if (a.length >= 4 && b.length >= 3 && !PARADAS.has(a) && !PARADAS.has(b)) pares.push(a + b); }
  return { palavras: [...new Set(uteis.map((x) => x.n))], pares: [...new Set(pares)] };
}

// Sugestões: [{ palavra, secao }] — no máximo 3. Só para termos que NÃO existem no livro e que têm vizinho bem próximo.
function sugerirTermos(vocab, pergunta) {
  const { palavras: ts, pares } = termosDaPergunta(pergunta);
  const out = []; const vistos = new Set();
  const adicionar = (item) => { if (item && !vistos.has(item.texto)) { vistos.add(item.texto); out.push({ palavra: item.texto, secao: item.secao }); } };

  // 1) pares/compostos ("colchão mole", "colchão-mole"): compara o par junto com os pares do livro
  for (const p of pares) {
    if (vocab.pares.has(p)) continue; // existe literalmente → nada a sugerir
    const max = Math.max(2, Math.floor(p.length * 0.3)); let melhor = null; let dm = max + 1;
    for (const [k, v] of vocab.pares) { const d = levenshtein(p, k, max); if (d < dm) { dm = d; melhor = v; if (d === 1) break; } }
    if (melhor && dm <= max) adicionar(melhor);
  }
  // 2) palavras soltas ausentes do vocabulário
  for (const t of ts) {
    if (vocab.palavras.has(t)) continue;
    const max = t.length >= 8 ? 3 : 2; let melhor = null; let dm = max + 1;
    for (const [k, v] of vocab.palavras) { const d = levenshtein(t, k, max); if (d < dm) { dm = d; melhor = v; if (d === 1) break; } }
    if (melhor && dm <= max && dm / t.length <= 0.34) adicionar(melhor);
  }
  return out.slice(0, 3);
}

// ---- Supabase (cache de 10 min por livro)
const CACHE_MS = 10 * 60 * 1000; const cache = new Map();
async function carregarVocabulario(supabase, livroId) {
  const c = cache.get(livroId);
  if (c && Date.now() - c.em < CACHE_MS) return c.vocab;
  const { data, error } = await supabase.from('documentos').select('titulo, corpo').eq('livro_id', livroId).limit(2000);
  if (error) throw new Error(`Falha ao ler o vocabulário do livro: ${error.message}`);
  const vocab = montarVocabulario(data || []);
  cache.set(livroId, { em: Date.now(), vocab });
  return vocab;
}
function limparCache() { cache.clear(); }

module.exports = { montarVocabulario, termosDaPergunta, sugerirTermos, carregarVocabulario, levenshtein, limparCache };
