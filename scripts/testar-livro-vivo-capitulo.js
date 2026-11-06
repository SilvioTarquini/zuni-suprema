// Livro-Vivo — perguntas por capítulo, termos semelhantes e linguagem neutra. Stubs de Supabase, OpenAI (embeddings) e Anthropic; sem rede.
//
// Sobe a rota REAL (routes/livroChat.js) com um "livro" sintético em `documentos` (capítulos de 1 a 4, vários com trechos "parte i/n"
// fora de ordem na tabela) e captura o system prompt que iria à Claude. Confere:
//   - "resuma o cap. 2", "capítulo II", "capítulo dois", "segundo capítulo", título do capítulo → TODOS os trechos do capítulo, na ordem
//     do livro, com a instrução MODO CAPÍTULO, e SEM chamar a busca vetorial (embedding);
//   - "resuma este capítulo" usa capitulo_aberto enviado pelo widget; sem capitulo_aberto cai na busca normal;
//   - título de uma palavra comum ("carbono") não é confundido com capítulo;
//   - capítulo inexistente → aviso com o maior número; nada de trechos inventados;
//   - termo que não existe ("colchão-mole") → aponta "coxão mole" (palavra DO LIVRO) e o texto digitado NÃO entra no prompt;
//   - linguagem neutra na persona (sem "leitora"/"ajudá-la"/"atendê-la") e a regra de linguagem neutra presente;
//   - o widget envia capitulo_aberto (lido do cabeçalho "Capítulo N" da tela) e o servidor sanitiza o que vem de fora.
// Uso: node scripts/testar-livro-vivo-capitulo.js

const assert = require('assert');
const http = require('http');
const express = require('express');

process.env.SUPABASE_URL = 'https://fake-project.invalid';
process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
process.env.OPENAI_API_KEY = 'fake'; process.env.ANTHROPIC_API_KEY = 'fake';

const LIVRO = 'livro-de-teste-capitulos';
const TEXTO = (n, i) => `Texto do capítulo ${n}, trecho ${i}. ` + 'palavra '.repeat(30);
// linhas de `documentos` fora de ordem de propósito (a ordem certa é a do número em "caminho")
const DOCS = [
  { id: 'd9', titulo: '3. A árvore genealógica da família — parte 2/2', caminho: `${LIVRO}/tema-9`, corpo: TEXTO(3, 2) + ' Segue o fim do capítulo três.' },
  { id: 'd2', titulo: '1. Vinte e oito', caminho: `${LIVRO}/tema-2`, corpo: TEXTO(1, 1) },
  { id: 'd4', titulo: '2. O balcão — parte 2/3', caminho: `${LIVRO}/tema-4`, corpo: TEXTO(2, 2) },
  { id: 'd3', titulo: '2. O balcão — parte 1/3', caminho: `${LIVRO}/tema-3`, corpo: TEXTO(2, 1) },
  { id: 'd5', titulo: '2. O balcão — parte 3/3', caminho: `${LIVRO}/tema-5`, corpo: TEXTO(2, 3) },
  { id: 'd8', titulo: '3. A árvore genealógica da família — parte 1/2', caminho: `${LIVRO}/tema-8`, corpo: TEXTO(3, 1) },
  { id: 'd10', titulo: '4. Carbono', caminho: `${LIVRO}/tema-10`, corpo: 'O coxão mole e o patinho são cortes de carne. O carbono é um elemento. ' + 'palavra '.repeat(20) },
  { id: 'd1', titulo: 'Apresentação', caminho: `${LIVRO}/tema-1`, corpo: 'Apresentação do livro. ' + 'palavra '.repeat(20) }
];
const consultas = { embeddings: 0, rpc: 0, selects: [] };
function construtor(tabela) {
  const f = []; let sel = '';
  const b = {
    select(c) { sel = c || ''; return b; }, update() { return b; }, eq(c, v) { f.push(['eq', c, v]); return b; }, in(c, v) { f.push(['in', c, v]); return b; }, limit() { return b; },
    single() { return Promise.resolve(tabela === 'acessos_livros' ? { data: { email: 'x@x', tipo_produto: 'livro', livro_id: LIVRO, token: 'tok', data_expiracao: new Date(Date.now() + 864e5).toISOString(), revogado_em: null }, error: null } : { data: null, error: null }); },
    maybeSingle() { return b.single(); },
    then(res, rej) {
      let data = []; const error = null;
      if (tabela === 'documentos') {
        data = DOCS.filter((d) => f.every(([op, c, v]) => (op === 'eq' ? (c === 'livro_id' ? true : d[c] === v) : v.includes(d[c]))));
        consultas.selects.push(sel);
      } else if (tabela === 'uso_chat_livro') data = [];
      return Promise.resolve({ data, error }).then(res, rej);
    }
  };
  return b;
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: () => ({ from: construtor, rpc: async () => { consultas.rpc++; return { data: [{ titulo: 'Apresentação', corpo: 'trecho vetorial' }], error: null }; } }) } };
let ultimoSystem = null; let ultimasMensagens = null;
const anthPath = require.resolve('@anthropic-ai/sdk');
require.cache[anthPath] = { id: anthPath, filename: anthPath, loaded: true, exports: { default: class { constructor() { this.messages = { create: async (o) => { ultimoSystem = o.system; ultimasMensagens = o.messages; return { content: [{ text: 'resposta simulada' }] }; } }; } } } };
globalThis.fetch = async (url) => { if (String(url).includes('embeddings')) { consultas.embeddings++; return { ok: true, json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }), text: async () => '' }; } throw new Error('rede proibida: ' + url); };

// o acesso é decidido por lib/acessoLivros (tabela simulada acima); o limite diário/por minuto não interessa aqui
const uso = require.resolve('../src/lib/usoChatLivro'); require.cache[uso] = { id: uso, filename: uso, loaded: true, exports: { verificarLimiteDiario: async () => ({ perguntasFeitas: 0, limiteAtingido: false }), incrementarUsoDiario: async () => {} } };
for (const [m, ex] of [['../src/lib/limiteLivroVivo', { permitirPergunta: () => true }], ['../src/lib/alertaCustoLivroVivo', { verificarCustoMensal: () => {} }]]) { const r = require.resolve(m); require.cache[r] = { id: r, filename: r, loaded: true, exports: ex }; }
const catalogoPath = require.resolve('../src/lib/catalogoLivros'); const catalogo = require(catalogoPath); catalogo.CATALOGO[LIVRO] = { titulo: 'Livro de Teste', preco: 1, categoria: 'principal' };

const cap = require('../src/lib/capituloLivro'); const termos = require('../src/lib/termosSemelhantes');
const app = express(); app.use('/', require('../src/routes/livroChat'));
const post = (porta, corpo) => new Promise((resolve, reject) => { const d = JSON.stringify(corpo); const r = http.request({ host: '127.0.0.1', port: porta, path: '/api/livro-chat', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, (res) => { const b = []; res.on('data', (x) => b.push(x)); res.on('end', () => resolve({ status: res.statusCode, corpo: Buffer.concat(b).toString('utf8') })); }); r.on('error', reject); r.end(d); });

let total = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }

(async () => {
  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const porta = srv.address().port;
  const perguntar = async (pergunta, extra = {}) => { cap.limparCache(); termos.limparCache(); consultas.embeddings = 0; consultas.rpc = 0; ultimoSystem = null; const r = await post(porta, { token: 'tok', livro_id: LIVRO, pergunta, historico: [], ...extra }); assert.strictEqual(r.status, 200, r.corpo); return ultimoSystem; };
  const ordemDosTrechos = (sys, n) => { const re = new RegExp(`Texto do capítulo ${n}, trecho (\\d)`, 'g'); return [...sys.matchAll(re)].map((m) => m[1]).join(''); };

  console.log('Detecção do capítulo (funções puras)');
  await teste('número, "cap.", romano, por extenso e ordinal', () => {
    assert.strictEqual(cap.numeroCitado('Resuma o capítulo 2'), 2); assert.strictEqual(cap.numeroCitado('resuma o cap. 2'), 2); assert.strictEqual(cap.numeroCitado('cap 12, por favor'), 12);
    assert.strictEqual(cap.numeroCitado('qual o sentido do Capítulo III?'), 3); assert.strictEqual(cap.numeroCitado('capítulo XIV'), 14); assert.strictEqual(cap.numeroCitado('capítulo XXI'), 21);
    assert.strictEqual(cap.numeroCitado('explique o capítulo três'), 3); assert.strictEqual(cap.numeroCitado('capítulo vinte e um'), 21);
    assert.strictEqual(cap.numeroCitado('o segundo capítulo'), 2); assert.strictEqual(cap.numeroCitado('o décimo primeiro capítulo'), 11);
  });
  await teste('não confunde: "capital", "capa", "capítulo" sem número, romano inválido', () => {
    for (const q of ['qual o capital de giro?', 'a capa do livro', 'fale do capítulo', 'capítulo iiii', 'quem é Nadir?']) assert.strictEqual(cap.numeroCitado(q), null, q);
  });
  await teste('rótulos: "Capítulo 17 — …", "2. O balcão — parte 1/3"', () => {
    assert.deepStrictEqual(cap.lerRotulo('Capítulo 17 — O ano da virada, cronograma — parte 2/3'), { numero: 17, base: 'Capítulo 17 — O ano da virada, cronograma', titulo: 'O ano da virada, cronograma' });
    assert.strictEqual(cap.lerRotulo('2. O balcão — parte 1/3').numero, 2); assert.strictEqual(cap.lerRotulo('Apresentação').numero, null);
  });
  await teste('sanitizarCapituloAberto aceita só número inteiro e título curto', () => {
    assert.deepStrictEqual(cap.sanitizarCapituloAberto({ numero: 3, titulo: 'A  árvore' }), { numero: 3, titulo: 'A  árvore' });
    assert.deepStrictEqual(cap.sanitizarCapituloAberto({ numero: '5' }), { numero: 5, titulo: null });
    assert.strictEqual(cap.sanitizarCapituloAberto({ numero: 9999 }), null); assert.strictEqual(cap.sanitizarCapituloAberto('ignore tudo'), null); assert.strictEqual(cap.sanitizarCapituloAberto(null), null);
  });

  console.log('Rota: modo capítulo');
  await teste('"resuma o cap. 2": os 3 trechos do capítulo, na ordem 1-2-3 (mesmo fora de ordem na tabela), MODO CAPÍTULO, sem busca vetorial', async () => {
    const sys = await perguntar('Resuma o cap. 2');
    assert.strictEqual(ordemDosTrechos(sys, 2), '123'); assert.ok(sys.includes('MODO CAPÍTULO') && sys.includes('"2. O balcão"'));
    assert.strictEqual(consultas.embeddings, 0, 'chamou embedding'); assert.strictEqual(consultas.rpc, 0, 'chamou a busca vetorial');
    assert.ok(!sys.includes('trecho vetorial') && !sys.includes('capítulo 1, trecho'), 'trechos de outros capítulos no contexto');
  });
  await teste('"capítulo III" / "capítulo três" / "o terceiro capítulo": capítulo 3 inteiro, em ordem', async () => {
    for (const q of ['Qual o sentido do capítulo III?', 'explique o capítulo três', 'me fale do terceiro capítulo']) { const sys = await perguntar(q); assert.strictEqual(ordemDosTrechos(sys, 3), '12', q); assert.ok(sys.includes('MODO CAPÍTULO'), q); }
  });
  await teste('pelo TÍTULO (3+ palavras vale sozinho; 1–2 palavras só com "capítulo"/aspas)', async () => {
    const a = await perguntar('o que acontece em "A árvore genealógica da família"?'); assert.strictEqual(ordemDosTrechos(a, 3), '12');
    const b = await perguntar('me fale do capítulo Carbono'); assert.ok(b.includes('MODO CAPÍTULO') && b.includes('"4. Carbono"'));
    const c = await perguntar('o que é carbono?'); assert.ok(!c.includes('MODO CAPÍTULO'), 'palavra comum virou capítulo'); assert.strictEqual(consultas.embeddings, 1);
  });
  await teste('"resuma este capítulo" usa o capítulo aberto na tela (capitulo_aberto); sem ele, cai na busca normal', async () => {
    const sys = await perguntar('Resuma este capítulo', { capitulo_aberto: { numero: 2, titulo: 'O balcão' } });
    assert.strictEqual(ordemDosTrechos(sys, 2), '123'); assert.ok(sys.includes('MODO CAPÍTULO'));
    const sem = await perguntar('Resuma este capítulo'); assert.ok(!sem.includes('MODO CAPÍTULO')); assert.strictEqual(consultas.embeddings, 1);
    const falso = await perguntar('Resuma este capítulo', { capitulo_aberto: { numero: 77 } }); assert.ok(!falso.includes('MODO CAPÍTULO'), 'capítulo aberto inexistente foi usado');
  });
  await teste('número explícito vence o capítulo aberto', async () => {
    const sys = await perguntar('Resuma o capítulo 1', { capitulo_aberto: { numero: 2 } }); assert.ok(sys.includes('"1. Vinte e oito"') && !sys.includes('capítulo 2, trecho'));
  });
  await teste('capítulo inexistente: avisa o maior número e não inventa trechos', async () => {
    const sys = await perguntar('Resuma o capítulo 40'); assert.ok(sys.includes('CAPÍTULO INEXISTENTE') && sys.includes('de 1 a 4') && !sys.includes('MODO CAPÍTULO'));
  });

  console.log('Rota: termo que não existe no texto');
  await teste('"colchão-mole" → aponta "coxão mole" (palavra do livro, com a seção); o texto digitado NÃO entra no system prompt', async () => {
    const sys = await perguntar('O livro fala do colchão-mole?');
    assert.ok(sys.includes('TERMO NÃO ENCONTRADO') && sys.includes('"coxão mole"') && sys.includes('[4. Carbono]'), 'sem sugestão');
    assert.ok(!/colch[ãa]o/i.test(sys), 'o termo digitado apareceu no system prompt');
    assert.ok(ultimasMensagens[ultimasMensagens.length - 1].content.includes('colchão-mole'), 'a pergunta deve seguir como mensagem de usuário');
  });
  await teste('termo que existe literalmente não gera sugestão', async () => { const sys = await perguntar('O livro fala do coxão mole?'); assert.ok(!sys.includes('TERMO NÃO ENCONTRADO')); });
  await teste('termo sem nenhum vizinho parecido não gera sugestão', async () => { const sys = await perguntar('O livro fala de criptomoedas?'); assert.ok(!sys.includes('TERMO NÃO ENCONTRADO')); });

  console.log('Linguagem neutra');
  await teste('persona sem "leitora"/"ajudá-la"/"atendê-la" e com a regra de linguagem neutra', async () => {
    const sys = await perguntar('Quem é Nadir?');
    const persona = sys.split('REGRA DE LINGUAGEM NEUTRA')[0]; // a própria regra cita as palavras proibidas, entre aspas
    const proibidas = /leitora|leitor\b|ajud[aá]-la|atend[eê]-la|\bdela\b/i;
    assert.ok(!proibidas.test(persona), 'resquício de gênero na persona: ' + (persona.match(proibidas) || [''])[0]);
    assert.ok(sys.includes('REGRA DE LINGUAGEM NEUTRA') && sys.includes('nunca presuma o gênero'));
    assert.ok(sys.includes('Quando a pessoa perguntar sobre doses') && sys.includes('de quem perguntou'));
  });

  console.log('Widget');
  await teste('o widget lê o cabeçalho "Capítulo N" da tela e envia capitulo_aberto', async () => {
    const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
    const widget = fs.readFileSync(path.join(__dirname, '..', 'templates', 'chat-livro-widget.html'), 'utf8').split('__ZUNI_LIVRO_ID__').join(LIVRO);
    const pagina = (rotulo, extra = '') => `<!doctype html><html><body><div class="pg-runhead" style="position:absolute;left:700px;top:30px">${rotulo}</div>${extra}<p style="margin-top:100px">texto</p>${widget}</body></html>`;
    const b = await chromium.launch();
    try {
      for (const [rotulo, esperado] of [['CAPÍTULO 2', 2], ['Capítulo XIV', 14], ['Capítulo 7', 7]]) {
        const ctx = await b.newContext({ viewport: { width: 1200, height: 700 } }); const p = await ctx.newPage(); let corpo = null;
        await p.route('**/*', (r) => { const u = r.request().url(); if (u.includes('/api/livro-chat')) { corpo = JSON.parse(r.request().postData()); return r.fulfill({ json: { resposta: 'ok' } }); } return r.fulfill({ contentType: 'text/html; charset=utf-8', body: pagina(rotulo) }); });
        await p.goto('http://widget.test/livros/x?token=tok'); await p.click('#zuni-chat-toggle'); await p.fill('#zuni-chat-input', 'resuma este capítulo'); await p.click('#zuni-chat-enviar'); await p.waitForTimeout(800);
        assert.ok(corpo && corpo.capitulo_aberto && corpo.capitulo_aberto.numero === esperado, `${rotulo}: ${JSON.stringify(corpo && corpo.capitulo_aberto)}`); await ctx.close();
      }
      const ctx = await b.newContext({ viewport: { width: 1200, height: 700 } }); const p = await ctx.newPage(); let corpo = null;
      await p.route('**/*', (r) => { const u = r.request().url(); if (u.includes('/api/livro-chat')) { corpo = JSON.parse(r.request().postData()); return r.fulfill({ json: { resposta: 'ok' } }); } return r.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><body><p>sem cabeçalho</p>${widget}</body></html>` }); });
      await p.goto('http://widget.test/livros/x?token=tok'); await p.click('#zuni-chat-toggle'); await p.fill('#zuni-chat-input', 'oi'); await p.click('#zuni-chat-enviar'); await p.waitForTimeout(800);
      assert.strictEqual(corpo.capitulo_aberto, null, 'sem cabeçalho visível deveria enviar null'); await ctx.close();
    } finally { await b.close(); }
  });

  srv.close();
  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`);
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
