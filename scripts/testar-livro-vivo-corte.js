// Livro-Vivo — resposta cortada por max_tokens ("O cap"). Rota real, Supabase/OpenAI/Anthropic simulados; sem rede.
//   - encerrarEmFraseCompleta: resposta cortada termina na última frase completa (nunca palavra pela metade); resposta normal fica intacta;
//     abreviações ("Sr.", "p. ex.") não contam como fim de frase; negrito aberto é fechado/removido;
//   - rota: modo capítulo pede max_tokens maior que o modo normal, o prompt orienta ~400 palavras, e o log registra stop_reason;
//   - rota: quando a Claude devolve stop_reason=max_tokens com texto cortado, o leitor recebe só frases completas.
// Uso: node scripts/testar-livro-vivo-corte.js

const assert = require('assert');
const http = require('http');
const express = require('express');

process.env.SUPABASE_URL = 'https://fake-project.invalid';
process.env.SUPABASE_KEY = 'FAKE_SECRET_KEY_FOR_TESTS_ONLY';
process.env.OPENAI_API_KEY = 'fake'; process.env.ANTHROPIC_API_KEY = 'fake';

const LIVRO = 'livro-de-teste-corte';
const DOCS = [
  { id: 'a1', titulo: 'Capítulo 1 — A chegada', caminho: `${LIVRO}/tema-1`, corpo: 'Texto do capítulo um. ' + 'palavra '.repeat(30) },
  { id: 'a2', titulo: 'Capítulo 2 — A partida', caminho: `${LIVRO}/tema-2`, corpo: 'Texto do capítulo dois. ' + 'palavra '.repeat(30) }
];
function construtor(tabela) {
  const f = [];
  const b = {
    select() { return b; }, update() { return b; }, eq(c, v) { f.push(['eq', c, v]); return b; }, in(c, v) { f.push(['in', c, v]); return b; }, limit() { return b; },
    single() { return Promise.resolve(tabela === 'acessos_livros' ? { data: { email: 'x@x', tipo_produto: 'livro', livro_id: LIVRO, token: 'tok', data_expiracao: new Date(Date.now() + 864e5).toISOString(), revogado_em: null }, error: null } : { data: null, error: null }); },
    maybeSingle() { return b.single(); },
    then(res, rej) {
      let data = [];
      if (tabela === 'documentos') data = DOCS.filter((d) => f.every(([op, c, v]) => (op === 'eq' ? (c === 'livro_id' ? true : d[c] === v) : v.includes(d[c]))));
      return Promise.resolve({ data, error: null }).then(res, rej);
    }
  };
  return b;
}
const supaPath = require.resolve('@supabase/supabase-js');
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: () => ({ from: construtor, rpc: async () => ({ data: [{ titulo: 'Capítulo 1 — A chegada', corpo: 'trecho vetorial' }], error: null }) }) } };
let ultimaChamada = null; let respostaDaClaude = { texto: 'ok', stop: 'end_turn' };
const anthPath = require.resolve('@anthropic-ai/sdk');
require.cache[anthPath] = { id: anthPath, filename: anthPath, loaded: true, exports: { default: class { constructor() { this.messages = { create: async (o) => { ultimaChamada = o; return { content: [{ text: respostaDaClaude.texto }], stop_reason: respostaDaClaude.stop, usage: { output_tokens: 1234 } }; } }; } } } };
globalThis.fetch = async (url) => { if (String(url).includes('embeddings')) return { ok: true, json: async () => ({ data: [{ embedding: [0.1, 0.2] }] }), text: async () => '' }; throw new Error('rede proibida: ' + url); };
const uso = require.resolve('../src/lib/usoChatLivro'); require.cache[uso] = { id: uso, filename: uso, loaded: true, exports: { verificarLimiteDiario: async () => ({ perguntasFeitas: 0, limiteAtingido: false }), incrementarUsoDiario: async () => {} } };
for (const [m, ex] of [['../src/lib/limiteLivroVivo', { permitirPergunta: () => true }], ['../src/lib/alertaCustoLivroVivo', { verificarCustoMensal: () => {} }]]) { const r = require.resolve(m); require.cache[r] = { id: r, filename: r, loaded: true, exports: ex }; }
const catalogo = require('../src/lib/catalogoLivros'); catalogo.CATALOGO[LIVRO] = { titulo: 'Livro de Teste', preco: 1, categoria: 'principal' };

const { encerrarEmFraseCompleta } = require('../src/lib/fraseCompleta');
const app = express(); app.use('/', require('../src/routes/livroChat'));
const post = (porta, corpo) => new Promise((resolve, reject) => { const d = JSON.stringify(corpo); const r = http.request({ host: '127.0.0.1', port: porta, path: '/api/livro-chat', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, (res) => { const b = []; res.on('data', (x) => b.push(x)); res.on('end', () => resolve({ status: res.statusCode, corpo: JSON.parse(Buffer.concat(b).toString('utf8')) })); }); r.on('error', reject); r.end(d); });

let total = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }

(async () => {
  console.log('encerrarEmFraseCompleta (função pura)');
  await teste('resposta completa fica intacta, mesmo sem ponto final', () => {
    assert.strictEqual(encerrarEmFraseCompleta('Resposta inteira sem ponto', false).texto, 'Resposta inteira sem ponto');
  });
  await teste('cortada no meio de palavra ("O cap") termina na última frase completa', () => {
    const r = encerrarEmFraseCompleta('O capítulo abre com a chegada. Depois vem a partida! O cap', true);
    assert.strictEqual(r.texto, 'O capítulo abre com a chegada. Depois vem a partida!'); assert.strictEqual(r.aparada, true);
  });
  await teste('frase completa que termina o texto não é aparada', () => {
    const r = encerrarEmFraseCompleta('Primeira frase. Segunda frase.', true);
    assert.strictEqual(r.texto, 'Primeira frase. Segunda frase.'); assert.strictEqual(r.aparada, false);
  });
  await teste('"Sr.", "p. ex." e "3.5" não contam como fim de frase', () => {
    assert.strictEqual(encerrarEmFraseCompleta('Fim da frase um. Falou o Sr. Teodoro e disse que, p. ex. o ano de 3.5 meses pas', true).texto, 'Fim da frase um.');
  });
  await teste('aspas e parênteses depois do ponto ficam; negrito aberto é removido', () => {
    assert.strictEqual(encerrarEmFraseCompleta('Ele disse: "Basta." E então o parágr', true).texto, 'Ele disse: "Basta."');
    assert.strictEqual(encerrarEmFraseCompleta('Uma frase. **Título aberto sem fec', true).texto, 'Uma frase.');
    assert.strictEqual(encerrarEmFraseCompleta('**Início.** Segue o texto. E **Parte cort', true).texto, '**Início.** Segue o texto.');
  });
  await teste('sem nenhuma frase completa: tira a palavra pela metade e fecha com reticências', () => {
    assert.strictEqual(encerrarEmFraseCompleta('O capítulo trata da chegada e do cap', true).texto, 'O capítulo trata da chegada e do…');
  });

  const srv = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const porta = srv.address().port;
  const logs = []; const logOriginal = console.log; console.log = (...a) => { const l = a.join(' '); if (l.startsWith('[LIVRO_CHAT]')) logs.push(l); else logOriginal(...a); };
  const perguntar = async (pergunta) => { logs.length = 0; return post(porta, { token: 'tok', livro_id: LIVRO, pergunta, historico: [] }); };

  console.log('Rota');
  await teste('modo capítulo: max_tokens maior que o normal, prompt de ~400 palavras e log com stop_reason', async () => {
    respostaDaClaude = { texto: 'Resumo completo do capítulo.', stop: 'end_turn' };
    await perguntar('Resuma o capítulo 2'); const cap = ultimaChamada;
    await perguntar('Quem é o personagem principal?'); const normal = ultimaChamada;
    assert.ok(cap.max_tokens >= 1800, `max_tokens do capítulo = ${cap.max_tokens}`); assert.ok(cap.max_tokens > normal.max_tokens, 'capítulo deve ter teto maior');
    assert.ok(cap.system.includes('MODO CAPÍTULO') && cap.system.includes('cerca de 400 palavras') && cap.system.includes('termine SEMPRE com uma frase completa'));
    assert.ok(!normal.system.includes('cerca de 400 palavras'));
  });
  await teste('log registra stop_reason, modo e tokens de saída', async () => {
    respostaDaClaude = { texto: 'Resumo completo.', stop: 'end_turn' }; await perguntar('Resuma o capítulo 1');
    const l = logs.find((x) => x.includes('stop_reason=')); assert.ok(l && l.includes('modo=capitulo') && l.includes('stop_reason=end_turn') && l.includes('max_tokens=') && l.includes('tokens_saida=1234'), l);
  });
  await teste('stop_reason=max_tokens: o leitor nunca recebe palavra cortada, e o log marca aparada=sim', async () => {
    respostaDaClaude = { texto: 'O capítulo abre com a chegada. Depois vem a partida. E o cap', stop: 'max_tokens' };
    const r = await perguntar('Resuma o capítulo 2');
    assert.strictEqual(r.status, 200); assert.strictEqual(r.corpo.resposta, 'O capítulo abre com a chegada. Depois vem a partida.');
    const l = logs.find((x) => x.includes('stop_reason=max_tokens')); assert.ok(l && l.includes('aparada=sim'), l);
  });
  await teste('stop_reason=end_turn: texto entregue sem alteração', async () => {
    respostaDaClaude = { texto: 'Texto inteiro sem ponto final', stop: 'end_turn' };
    const r = await perguntar('Resuma o capítulo 2'); assert.strictEqual(r.corpo.resposta, 'Texto inteiro sem ponto final');
  });

  console.log = logOriginal; srv.close();
  console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`);
  process.exit(falhas.length ? 1 : 0);
})().catch((e) => { console.error('ERRO', e); process.exit(1); });
