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
  // Textos APROVADOS em 09/10/2026 (copiados da aprovação; qualquer mudança no código quebra este teste de propósito).
  const APROVADO = {
    emocional: 'Se você está pensando em se machucar ou sente que não aguenta, não precisa enfrentar isso sozinho(a). Procure alguém de confiança que possa ficar com você. Para apoio emocional, ligue gratuitamente para o CVV, 188 (24 horas). Se houver perigo imediato, ligue para o SAMU, 192, ou procure atendimento de emergência.',
    ingestao: 'Atenção: ingerir medicamentos ou outras substâncias em quantidade excessiva pode ser uma emergência, mesmo sem sintomas. Ligue imediatamente para o SAMU, 192, ou para o Disque-Intoxicação, 0800 722 6001. Não provoque vômito nem tente neutralizar a substância por conta própria. Se possível, tenha a embalagem disponível para informar aos profissionais de saúde.',
    medico: 'Se você está apresentando dor forte no peito, falta de ar súbita, desmaio, sangramento intenso ou outro sinal grave, ligue imediatamente para o SAMU, 192. Procure atendimento de emergência sem demora.',
    violencia: 'Se você está em perigo imediato, procure um local seguro, se isso for possível sem aumentar o risco, e ligue para a Polícia, 190. Mulheres em situação de violência também podem buscar orientação e apoio pela Central de Atendimento à Mulher, 180.'
  };
  const FRASE = { emocional: 'quero me matar', ingestao: 'tomei a cartela inteira de remédio', medico: 'estou com dor forte no peito', violencia: 'ele me bate' };
  await teste('os quatro textos implementados são EXATAMENTE os aprovados', async () => {
    assert.deepStrictEqual({ ...S.RODAPE }, APROVADO);
  });
  for (const tipo of Object.keys(APROVADO)) {
    await teste(`tipo ${tipo}: classificado sozinho e o rodapé aprovado é anexado AO FINAL, preservando a resposta principal`, async () => {
      const a = av(FRASE[tipo]); assert.deepStrictEqual(a.tipos, [tipo]);
      const t = S.aplicarRodapeSeguranca('Resposta principal do modelo.', a); assert.strictEqual(t, 'Resposta principal do modelo.\n\n' + APROVADO[tipo]);
    });
  }
  await teste('gatilhos legados "overdose"/"envenenei" recebem o rodapé de INTOXICAÇÃO (não o de sintomas cardíacos)', async () => {
    for (const f of ['acho que foi overdose', 'estou envenenada']) { const a = av(f); assert.ok(a.tipos.includes('ingestao') && !a.tipos.includes('medico'), f + ' => ' + a.tipos); }
  });
  await teste('múltiplos riscos: cada tipo recebe o SEU rodapé, na ordem emocional, intoxicação, médico, violência', async () => {
    const a = av('quero me matar, tomei a cartela inteira de remédio, estou com dor forte no peito e ele me bate'); assert.deepStrictEqual(a.tipos, ['emocional', 'ingestao', 'medico', 'violencia']);
    assert.strictEqual(S.aplicarRodapeSeguranca('Ok.', a), 'Ok.\n\n' + ['emocional', 'ingestao', 'medico', 'violencia'].map((k) => APROVADO[k]).join('\n\n'));
    const dois = S.aplicarRodapeSeguranca('Ok.', av('quero me matar e tomei a cartela inteira de remédio')); assert.ok(dois.includes(APROVADO.emocional) && dois.includes(APROVADO.ingestao));
  });
  await teste('resposta da IA que SÓ MENCIONA um telefone NÃO dispensa o rodapé (188, 192, 0800, 190/180, todos)', async () => {
    const casos = [['emocional', 'Ligue para o CVV, 188, agora.'], ['emocional', 'Pode ligar 188 ou 192.'], ['ingestao', 'Ligue 0800 722 6001 e 192.'], ['medico', 'Ligue 192.'], ['violencia', 'Ligue 190 ou 180.']];
    for (const [tipo, modelo] of casos) { const t = S.aplicarRodapeSeguranca(modelo, av(FRASE[tipo])); assert.ok(t.startsWith(modelo) && t.endsWith(APROVADO[tipo]), tipo + ': ' + modelo); }
  });
  await teste('resposta que JÁ CONTÉM a orientação completa (texto aprovado) NÃO duplica; variação de caixa/espaços/quebras também não', async () => {
    for (const tipo of Object.keys(APROVADO)) {
      const a = av(FRASE[tipo]); const original = 'Sinto muito.\n\n' + APROVADO[tipo]; assert.strictEqual(S.aplicarRodapeSeguranca(original, a), original);
      const variado = 'Sinto muito.  ' + APROVADO[tipo].toUpperCase().replace(/ /g, '\n'); assert.strictEqual(S.aplicarRodapeSeguranca(variado, a), variado);
    }
  });
  await teste('orientação PARCIAL ou parafraseada não é verificável => o rodapé é acrescentado', async () => {
    const parcial = APROVADO.emocional.split('. ').slice(0, 2).join('. ') + '.'; const t = S.aplicarRodapeSeguranca(parcial, av(FRASE.emocional)); assert.ok(t.startsWith(parcial) && t.endsWith(APROVADO.emocional));
    const t2 = S.aplicarRodapeSeguranca('Ligue imediatamente para o SAMU, 192, ou Disque-Intoxicação 0800 722 6001 agora.', av(FRASE.ingestao)); assert.ok(t2.endsWith(APROVADO.ingestao));
  });
  await teste('com vários tipos, só o tipo já presente é omitido; os demais são acrescentados', async () => {
    const a = av('quero me matar e tomei a cartela inteira de remédio'); const t = S.aplicarRodapeSeguranca('Ok.\n\n' + APROVADO.emocional, a);
    assert.strictEqual(t, 'Ok.\n\n' + APROVADO.emocional + '\n\n' + APROVADO.ingestao);
  });
  await teste('sem risco alto (nenhum sinal, ambíguo, risco recente): nenhum rodapé e resposta intacta', async () => {
    for (const m of ['como organizar minha semana?', 'não vejo saída', 'tomei cinco comprimidos de dipirona']) assert.strictEqual(S.aplicarRodapeSeguranca('Resposta normal.', av(m)), 'Resposta normal.', m);
    assert.strictEqual(S.aplicarRodapeSeguranca('Resposta normal.', av('e a rotina?', [{ role: 'user', content: 'quero morrer' }, { role: 'user', content: 'a' }, { role: 'user', content: 'b' }, { role: 'user', content: 'c' }])), 'Resposta normal.');
  });
  await teste('removerConviteComercial: tira só as frases comerciais, preserva o acolhimento; nunca acrescenta oferta', async () => {
    const bruto = 'Sinto muito que você esteja passando por isso. Estou aqui com você.\n\nSe quiser aprofundar, conheça a Sessão Completa do Mentor (R$ 27,90). Acesse o checkout nos botões da tela.';
    const t = S.removerConviteComercial(bruto); assert.ok(/Estou aqui com você/.test(t) && !/Sess[ãa]o Completa|R\$|checkout|bot[õo]es/i.test(t));
    assert.strictEqual(S.removerConviteComercial('Texto sem oferta.'), 'Texto sem oferta.'); assert.strictEqual(S.removerConviteComercial(undefined), '');
  });
  await teste('rodapé sem promessa clínica/diagnóstico e sem chamada comercial', async () => {
    for (const r of Object.values(S.RODAPE)) assert.ok(!/diagn|tratamento|cura\b|garant|sess[ãa]o completa|compr|R\$/i.test(r), r.slice(0, 40));
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
    assert.ok(/if \(segurancaDemo\.critico\) responseText = removerConviteComercial\(responseText\)/.test(srv));
    assert.ok(/responseText = aplicarRodapeSeguranca\(responseText, segurancaDemo\)/.test(srv));
    assert.ok(/ultimaTroca: limite\.ultimaTroca && !segurancaDemo\.critico/.test(srv));
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
  await teste('degustação do livro, 5ª troca: SEM risco => ultimaTroca true (convite de compra do cliente); COM risco alto => false + rodapé aprovado', async () => {
    for (let i = 0; i < 4; i++) { await post('/api/experimente-livro-chat', { sessionId: 'sess-ultima-ok', pergunta: 'pergunta comum ' + i, historico: [] }); await post('/api/experimente-livro-chat', { sessionId: 'sess-ultima-risco', pergunta: 'pergunta comum ' + i, historico: [] }); }
    const normal = await post('/api/experimente-livro-chat', { sessionId: 'sess-ultima-ok', pergunta: 'última pergunta comum', historico: [] });
    assert.strictEqual(normal.corpo.ultimaTroca, true); assert.strictEqual(normal.corpo.resposta, respostaModelo.texto);
    const risco = await post('/api/experimente-livro-chat', { sessionId: 'sess-ultima-risco', pergunta: 'quero me matar', historico: [] });
    assert.strictEqual(risco.status, 200); assert.strictEqual(risco.corpo.ultimaTroca, false); assert.strictEqual(risco.corpo.resposta, respostaModelo.texto + '\n\n' + APROVADO.emocional);
  });
  await teste('Livro-Vivo pago: os quatro tipos entram com o texto aprovado; conversa normal segue intacta', async () => {
    for (const tipo of Object.keys(APROVADO)) { const r = await post('/api/livro-chat', { token: 't', livro_id: LIVRO, pergunta: FRASE[tipo], historico: [] }); assert.ok(r.corpo.resposta.endsWith(APROVADO[tipo]), tipo); }
    const normal = await post('/api/livro-chat', { token: 't', livro_id: LIVRO, pergunta: 'resuma o capítulo sobre rotina', historico: [] }); assert.strictEqual(normal.corpo.resposta, respostaModelo.texto);
  });
  server.close(); Module._load = loadOriginal;

  console.log('== Demo do Direciona (rota real extraída de server.js, dependências falsas) ==');
  const srvTexto = lerLF('src/server.js'); const bloco = srvTexto.slice(srvTexto.indexOf("app.post('/api/experimente-chat'"), srvTexto.indexOf('/**\n * GET /experimente\n'));
  function montarDemo(textoModelo, ultimaTroca) {
    const reg = { prompts: [] }; let handler;
    const AnthropicFalso = { default: class { constructor() { this.messages = { create: async (args) => { reg.prompts.push(args.system); return { content: [{ text: textoModelo }], usage: { input_tokens: 1, output_tokens: 2 } }; } }; } } };
    new Function('app', 'criarLimiterMentorDemo', 'SESSION_ID_MAX_CHARS', 'MENSAGEM_MAX_CHARS', 'gerarVisitorHash', 'verificarLimite', 'registrarUso', 'auditarConsumo', 'orcamentoDemo', 'extrairIpConfiavel', 'searchKnowledge', 'SYSTEM_PROMPT_DEMO', 'limparMarkdown', 'avaliarSeguranca', 'adicionarDiretivaAoSistema', 'aplicarRodapeSeguranca', 'removerConviteComercial', 'require', 'console', bloco)(
      { post: (r, mw, h) => { handler = h; } }, () => (req, res, next) => next(), 100, 500, () => 'v', () => ({ permitido: true, contador: ultimaTroca ? 4 : 1, ultimaTroca, horasAteReset: 1 }), () => {}, async () => {},
      { consumir: () => ({ permitido: true }) }, () => '1.1.1.1', async () => [], 'PROMPT-DEMO', (t) => t, S.avaliarSeguranca, S.adicionarDiretivaAoSistema, S.aplicarRodapeSeguranca, S.removerConviteComercial,
      (m) => (m === '@anthropic-ai/sdk' ? AnthropicFalso : require(m)), { log() {}, error() {}, warn() {} });
    const chamar = async (message) => { let status = 200, corpo; const res = { status(c) { status = c; return res; }, json(b) { corpo = b; return res; } }; await handler({ body: { message, sessionId: 'S-demo' }, headers: {}, socket: {} }, res); return { status, corpo }; };
    return { reg, chamar };
  }
  const OFERTA = 'Se este diálogo tocou em algo profundo, conheça a Sessão Completa do Mentor (R$ 27,90). Acesse o checkout nos botões da tela.';
  await teste('demo em RISCO ALTO (inclusive na última troca): sem convite de compra, sem ultimaTroca, rodapé aprovado ao final, acolhimento preservado', async () => {
    const d = montarDemo('Sinto muito que você esteja assim. Estou aqui com você. ' + OFERTA, true); const r = await d.chamar('quero me matar');
    assert.strictEqual(r.status, 200); assert.strictEqual(r.corpo.ultimaTroca, false);
    assert.ok(!/Sess[ãa]o Completa|R\$|checkout|bot[õo]es/i.test(r.corpo.texto.replace(APROVADO.emocional, ''))); assert.ok(/Estou aqui com você/.test(r.corpo.texto)); assert.ok(r.corpo.texto.endsWith(APROVADO.emocional));
    assert.ok(/<zuni_seguranca_demo>/.test(d.reg.prompts[0]) && !/INSTRUÇÃO PARA ÚLTIMA TROCA/.test(d.reg.prompts[0]), 'prompt de risco não pode pedir CTA');
  });
  await teste('demo SEM risco: última troca mantém o comportamento anterior (CTA no prompt e ultimaTroca true); resposta intacta e sem rodapé', async () => {
    const d = montarDemo('Resposta normal da demo.', true); const r = await d.chamar('como melhorar meu sono?');
    assert.strictEqual(r.corpo.ultimaTroca, true); assert.strictEqual(r.corpo.texto, 'Resposta normal da demo.'); assert.ok(/INSTRUÇÃO PARA ÚLTIMA TROCA/.test(d.reg.prompts[0])); assert.ok(!/<zuni_seguranca/.test(d.reg.prompts[0]));
    const d2 = montarDemo(OFERTA, false); assert.strictEqual((await d2.chamar('como organizar minhas finanças?')).corpo.texto, OFERTA, 'fora de risco, nada é removido');
  });
  await teste('demo em risco alto (4 tipos): cada tipo recebe o texto aprovado', async () => {
    for (const tipo of Object.keys(APROVADO)) { const d = montarDemo('Estou aqui.', false); const r = await d.chamar(FRASE[tipo]); assert.ok(r.corpo.texto.endsWith(APROVADO[tipo]) && r.corpo.texto.startsWith('Estou aqui.'), tipo); }
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join('; ')); process.exit(1); }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1); });
