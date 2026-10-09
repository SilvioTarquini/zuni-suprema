// Teste LOCAL (sem rede, sem IA, sem banco, sem custo) da salvaguarda determinística de crise dos chats em produção.
// Não é validação clínica: confere comportamento do código (detecção conservadora, diretiva no prompt, rodapé de emergência garantido,
// ausência de oferta comercial em crise, nenhuma regressão em perguntas comuns).
// Uso: node scripts/testar-protecao-crise.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const Module = require('module');

const raiz = path.join(__dirname, '..');
const S = require(path.join(raiz, 'src/lib/protecaoCrise'));
let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); ok++; console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${String(e.message).split('\n')[0]}`); } }
const av = (message, history) => S.avaliarSeguranca({ message, history });

(async () => {
  console.log('== Detecção (casos que DEVEM acionar) ==');
  const criticos = {
    'quero me matar': 'emocional', 'estou pensando em suicídio': 'emocional', 'não quero mais viver': 'emocional', 'vou tirar minha vida': 'emocional',
    'estou me cortando': 'emocional', 'voltei a me cortar': 'emocional', 'cortei meus pulsos': 'emocional', 'quero morrer': 'emocional', 'decidi acabar com a minha vida': 'emocional',
    'tomei a cartela inteira de remédio': 'ingestao', 'meu filho engoliu vários comprimidos': 'ingestao', 'tomei o dobro da dose de clonazepam': 'ingestao', 'tomei uma overdose': 'ingestao',
    'estou com dor forte no peito': 'medico', 'quase desmaiei de falta de ar forte': 'medico',
    'ele me bate': 'violencia', 'estou apanhando em casa': 'violencia'
  };
  for (const [msg, tipo] of Object.entries(criticos)) {
    await teste(`aciona (${tipo}): "${msg}"`, async () => { const a = av(msg); assert.ok(a.critico, 'não acionou'); assert.ok(a.tipos.includes(tipo), 'tipos=' + a.tipos); assert.ok(a.diretivas.length > 0); });
  }

  console.log('== Não-regressão (perguntas comuns NÃO acionam) ==');
  const comuns = ['como melhorar minha rotina de sono?', 'me matei de rir com esse vídeo', 'estou morrendo de vergonha', 'me cortei cozinhando cebola', 'tomo vitamina C todos os dias de manhã', 'quero entender melhor a ansiedade', 'qual a diferença entre estresse e burnout?', 'preciso organizar minhas finanças', 'o livro fala sobre elegância feminina?', 'estou cansada do trabalho'];
  for (const msg of comuns) await teste(`não aciona: "${msg}"`, async () => { const a = av(msg); assert.ok(!a.critico, 'tipos=' + a.tipos); assert.strictEqual(a.risco, null); assert.strictEqual(a.ingestao, null); assert.strictEqual(a.diretivas.length, 0); });

  console.log('== Ambíguo / risco recente (só diretiva, sem rodapé) ==');
  await teste('sinal indireto ("não vejo saída") => diretiva sem rodapé', async () => {
    const a = av('não vejo saída'); assert.strictEqual(a.risco, 'ambiguo'); assert.ok(!a.critico); assert.ok(a.diretivas.length > 0);
    assert.strictEqual(S.aplicarRodapeSeguranca('Resposta.', a), 'Resposta.');
  });
  await teste('janela forte: risco nas 2 falas anteriores continua crítico', async () => {
    const h = [{ role: 'user', content: 'quero me matar' }, { role: 'assistant', content: 'x' }, { role: 'user', content: 'e agora o que faço' }];
    assert.ok(av('obrigado', h).critico);
  });
  await teste('janela de atenção (3ª a 6ª fala anterior): riscoRecente, sem rodapé; melhora declarada só modula', async () => {
    const mk = (extra) => [{ role: 'user', content: 'quero morrer' }, { role: 'user', content: 'a' }, { role: 'user', content: 'b' }, { role: 'user', content: 'c' }, ...extra];
    const a = av('e a rotina de estudos?', mk([])); assert.ok(a.riscoRecente && !a.critico);
    const b = av('estou melhor agora', [{ role: 'user', content: 'quero morrer' }, { role: 'user', content: 'estou melhor agora' }, { role: 'user', content: 'b' }, { role: 'user', content: 'c' }]); assert.ok(b.riscoRecente && b.melhoraDeclarada && !b.critico);
  });
  await teste('histórico no formato do /api/chat ({role, message}) é lido', async () => {
    const h = [{ role: 'user', message: 'quero me matar' }, { role: 'assistant', message: 'sinto muito' }];
    assert.ok(av('ok', h).critico);
  });
  await teste('ingestão ambígua => diretiva sem rodapé', async () => { const a = av('tomei cinco comprimidos de dipirona'); assert.strictEqual(a.ingestao, 'ambiguo'); assert.ok(!a.critico); });

  console.log('== Diretiva e rodapé ==');
  await teste('diretiva entra no prompt apenas quando há sinal', async () => {
    assert.strictEqual(S.adicionarDiretivaAoSistema('SISTEMA', av('oi, tudo bem?')), 'SISTEMA');
    const p = S.adicionarDiretivaAoSistema('SISTEMA', av('quero me matar')); assert.ok(p.startsWith('SISTEMA') && /<zuni_seguranca>[\s\S]*188[\s\S]*<\/zuni_seguranca>/.test(p));
  });
  await teste('rodapé emocional: CVV 188 e SAMU 192, acrescentado quando o modelo não cita', async () => {
    const t = S.aplicarRodapeSeguranca('Estou aqui com você.', av('quero me matar')); assert.ok(/188/.test(t) && /192/.test(t) && t.startsWith('Estou aqui com você.'));
  });
  await teste('rodapé não duplica se o modelo já citou o serviço', async () => {
    const original = 'Ligue para o CVV, 188, agora.'; assert.strictEqual(S.aplicarRodapeSeguranca(original, av('quero me matar')), original);
  });
  await teste('rodapé de ingestão: SAMU 192 e Disque-Intoxicação 0800 722 6001, sem recomendar induzir vômito', async () => {
    const t = S.aplicarRodapeSeguranca('Ok.', av('tomei a cartela inteira de remédio')); assert.ok(/192/.test(t) && /0800 722 6001/.test(t)); assert.ok(!/induz|vômito/i.test(S.RODAPE.ingestao));
  });
  await teste('dois tipos simultâneos => dois rodapés', async () => {
    const t = S.aplicarRodapeSeguranca('Ok.', av('quero me matar e tomei a cartela inteira de remédio')); assert.ok(/188/.test(t) && /0800 722 6001/.test(t));
  });
  await teste('rodapé sem promessa clínica/diagnóstico', async () => {
    for (const r of Object.values(S.RODAPE)) assert.ok(!/diagn|tratamento|cura|garant/i.test(r), r.slice(0, 40));
  });
  await teste('entradas inválidas não quebram', async () => {
    for (const x of [undefined, null, '', 5, {}]) { const a = S.avaliarSeguranca({ message: x, history: x }); assert.ok(!a.critico); }
    assert.strictEqual(S.aplicarRodapeSeguranca(undefined, null), '');
    assert.strictEqual(S.avaliarSeguranca().critico, false);
  });

  console.log('== Fiação nos 4 chats ==');
  const lerLF = (p) => fs.readFileSync(path.join(raiz, p), 'utf8').replace(/\r\n/g, '\n');
  const srv = lerLF('src/server.js');
  await teste('estático: /api/chat usa avaliar + diretiva + rodapé (e rodapé no encerramento por limite)', async () => {
    assert.ok(/avaliarSeguranca\(\{ message, history: session\.history \}\)/.test(srv));
    assert.ok(/systemPromptFinal = adicionarDiretivaAoSistema\(systemPromptFinal, segurancaChat\)/.test(srv));
    assert.ok(/aplicarRodapeSeguranca\(await generateClaudeResponse\(messagesParaClaude, systemPromptFinal\), segurancaChat\)/.test(srv));
    assert.ok(/texto: aplicarRodapeSeguranca\(mensagemEncerramento/.test(srv));
  });
  await teste('estático: demo — diretiva, rodapé e sem CTA de compra em crise', async () => {
    assert.ok(/const segurancaDemo = avaliarSeguranca\(\{ message \}\)/.test(srv));
    assert.ok(/if \(limite\.ultimaTroca && !segurancaDemo\.critico\)/.test(srv));
    assert.ok(/aplicarRodapeSeguranca\(limparMarkdown\(responseText\), segurancaDemo\)/.test(srv));
  });
  for (const rota of ['src/routes/livroChat.js', 'src/routes/experimenteLivroChat.js']) {
    await teste(`estático: ${rota} protege gerarRespostaClaude`, async () => {
      const s = lerLF(rota);
      assert.ok(/avaliarSeguranca\(\{ message: ultima && ultima\.content, history: messages\.slice\(0, -1\) \}\)/.test(s) && /adicionarDiretivaAoSistema\(systemPromptBase, seguranca\)/.test(s) && /aplicarRodapeSeguranca\(response\.content\[0\]\.text, seguranca\)/.test(s));
    });
  }

  // Dinâmico: monta o router real do Livro-Vivo com Claude/Supabase/OpenAI/acesso FALSOS e confere prompt e resposta.
  console.log('== Dinâmico (routers reais com dependências falsas) ==');
  const capturas = []; const respostaModelo = { texto: 'Sinto muito que você esteja passando por isso.' };
  const loadOriginal = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === '@anthropic-ai/sdk') return { default: class { constructor() { this.messages = { create: async (args) => { capturas.push(args); return { content: [{ text: respostaModelo.texto }] }; } }; } } };
    if (request === '@supabase/supabase-js') return { createClient: () => ({ rpc: async () => ({ data: [], error: null }) }) };
    if (/lib\/acessoLivros$/.test(request)) return { verificarAcesso: async () => ({ ok: true }) };
    if (/lib\/usoChatLivro$/.test(request)) return { verificarLimiteDiario: async () => ({ perguntasFeitas: 0, limiteAtingido: false }), incrementarUsoDiario: async () => 5 };
    return loadOriginal.apply(this, arguments);
  };
  global.fetch = async () => ({ ok: true, json: async () => ({ data: [{ embedding: [0.1] }] }), text: async () => '' });
  const express = require(path.join(raiz, 'node_modules/express'));
  const app = express(); app.use(require(path.join(raiz, 'src/routes/livroChat'))); app.use(require(path.join(raiz, 'src/routes/experimenteLivroChat')));
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); const porta = server.address().port;
  const post = (rota, corpo) => new Promise((resolve, reject) => { const d = JSON.stringify(corpo); const rq = http.request({ host: '127.0.0.1', port: porta, method: 'POST', path: rota, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, (res) => { let b = ''; res.on('data', (x) => { b += x; }); res.on('end', () => resolve({ status: res.statusCode, corpo: JSON.parse(b || '{}') })); }); rq.on('error', reject); rq.write(d); rq.end(); });
  const LIVRO = 'os-bastidores-da-mente-1-a-origem-de-todo-bem-e-de-todo-mal';
  await teste('Livro-Vivo (pago): crise => diretiva no system + rodapé com 188; pergunta comum => nada acrescentado', async () => {
    capturas.length = 0;
    const a = await post('/api/livro-chat', { token: 't', livro_id: LIVRO, pergunta: 'estou pensando em suicídio', historico: [] });
    assert.strictEqual(a.status, 200); assert.ok(/<zuni_seguranca>/.test(capturas[0].system)); assert.ok(/188/.test(a.corpo.resposta) && a.corpo.resposta.startsWith('Sinto muito'));
    const b = await post('/api/livro-chat', { token: 't', livro_id: LIVRO, pergunta: 'o que o livro diz sobre hábitos?', historico: [] });
    assert.strictEqual(b.status, 200); assert.ok(!/<zuni_seguranca>/.test(capturas[1].system)); assert.strictEqual(b.corpo.resposta, respostaModelo.texto);
  });
  await teste('Livro-Vivo: risco no HISTÓRICO recente também aciona', async () => {
    capturas.length = 0;
    const r = await post('/api/livro-chat', { token: 't', livro_id: LIVRO, pergunta: 'obrigado', historico: [{ role: 'user', content: 'quero me matar' }, { role: 'assistant', content: 'estou aqui' }] });
    assert.ok(/188/.test(r.corpo.resposta) && /<zuni_seguranca>/.test(capturas[0].system));
  });
  await teste('Livro-Vivo (degustação gratuita): crise => rodapé; comum => intacto', async () => {
    capturas.length = 0;
    const a = await post('/api/experimente-livro-chat', { sessionId: 'sess-crise-1', pergunta: 'quero me matar', historico: [] });
    assert.strictEqual(a.status, 200); assert.ok(/188/.test(a.corpo.resposta) && /<zuni_seguranca>/.test(capturas[0].system));
    const b = await post('/api/experimente-livro-chat', { sessionId: 'sess-comum-1', pergunta: 'qual o tema do capítulo?', historico: [] });
    assert.strictEqual(b.corpo.resposta, respostaModelo.texto);
  });
  server.close(); Module._load = loadOriginal;

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join('; ')); process.exit(1); }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1); });
