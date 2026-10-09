// Teste local (sem rede, sem Supabase, sem Stripe, sem e-mail, sem IA) da E2 do Experimente ZUNI:
//   - /experimente/<id>/: template único, fail-closed, preço/capa do catálogo, origem por whitelist, sem chat;
//   - leitura em voz (TTS do navegador): iniciar/pausar/continuar/parar, sem rede;
//   - endurecimento: endpoint de lead desativado (410) e proteção de custo do Mentor demo.
// Uso: node scripts/testar-experimente-e2.js
//
// Rotas do server.js (lead e Mentor demo) são extraídas do código-fonte real e executadas com dependências
// falsas: nenhum e-mail, nenhuma chamada ao Claude/OpenAI/Supabase.
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

const raiz = path.join(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const { CATALOGO, buscarLivro } = require(path.join(raiz, 'src/lib/catalogoLivros'));
const { AMOSTRAS, obterAmostra, MAX_TRECHO_CHARS } = require(path.join(raiz, 'src/lib/amostrasExperimente'));
const { renderizarExperimenteObra, PAGINA_INDISPONIVEL } = require(path.join(raiz, 'src/lib/experimenteObra'));
const tts = require(path.join(raiz, 'public/js/experimente-tts.js'));
const { extrairIpConfiavel } = require(path.join(raiz, 'src/lib/ipCliente'));
const protecao = require(path.join(raiz, 'src/lib/protecaoMentorDemo'));
const rl = require(path.join(raiz, 'src/lib/rateLimitExperimente'));

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); ok++; console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); }
}

// ── Fixtures da página (sintéticas; o registro real de produção não tem trecho aprovado) ──
const livroReal = buscarLivro('ela-tem-classe');
const catalogoFixture = (over = {}) => (id) => (id === 'ela-tem-classe' ? { ...livroReal, amostraDisponivel: true, ...over } : buscarLivro(id));
const amostraFixture = (over = {}) => ({ livroId: 'ela-tem-classe', aprovada: true, trecho: 'Primeiro parágrafo sintético de teste.\n\nSegundo parágrafo sintético de teste.', tituloTrecho: null, chamada: 'Chamada sintética de teste.', origemUniverso: 'universo-feminino', avisoInformativo: false, ttsDisponivel: true, ...over });
const render = (params = {}, deps = {}) => renderizarExperimenteObra({ livroId: 'ela-tem-classe', ...params }, {
  buscar: catalogoFixture(), amostra: (id) => (id === 'ela-tem-classe' ? amostraFixture() : null), ...deps
});
const templateSrc = ler('templates/experimente-obra.html');

// ── Rotas reais extraídas do server.js ──
const srv = ler('src/server.js');
function fatiar(inicio, fim) {
  const i = srv.indexOf(inicio), f = srv.indexOf(fim, i);
  assert.ok(i > 0 && f > i, 'trecho não encontrado em server.js: ' + inicio);
  return srv.slice(i, f);
}

(async () => {
  console.log('E2 — Experimente multiobra + endurecimento\n');

  console.log('Fail-closed (/experimente/<id>/)');
  // E3B: Ela Tem Classe passou a ter a primeira amostra aprovada (catálogo amostraDisponivel + registro aprovado).
  // As proteções abaixo valem igual: o que mudou é QUAL obra passa nas duas portas, não o rigor da regra.
  await teste('A. só a obra com amostra aprovada (Ela Tem Classe, E3B) tem página; a regra exige catálogo + registro aprovado', async () => {
    assert.strictEqual(buscarLivro('ela-tem-classe').amostraDisponivel, true);
    assert.strictEqual(obterAmostra('ela-tem-classe').aprovada, true);
    assert.strictEqual(renderizarExperimenteObra({ livroId: 'ela-tem-classe' }).status, 200);
    // sem qualquer uma das duas portas, a mesma obra volta a 404 no código real
    assert.strictEqual(renderizarExperimenteObra({ livroId: 'ela-tem-classe' }, { buscar: (id) => ({ ...buscarLivro(id), amostraDisponivel: false }) }).status, 404);
    assert.strictEqual(renderizarExperimenteObra({ livroId: 'ela-tem-classe' }, { amostra: (id) => ({ ...obterAmostra(id), aprovada: false }) }).status, 404);
    assert.strictEqual(renderizarExperimenteObra({ livroId: 'ela-tem-classe' }, { amostra: () => null }).status, 404);
  });
  await teste('A2. as outras 37 obras públicas e a degustação interna seguem em 404; exatamente uma amostra aprovada', async () => {
    for (const id of Object.keys(CATALOGO)) {
      const r = renderizarExperimenteObra({ livroId: id });
      if (id === 'ela-tem-classe') { assert.strictEqual(r.status, 200); continue; }
      assert.strictEqual(r.status, 404, id);
      assert.strictEqual(r.html, PAGINA_INDISPONIVEL, id);
    }
    assert.deepStrictEqual(Object.keys(AMOSTRAS), ['ela-tem-classe']);
    assert.strictEqual(Object.values(AMOSTRAS).filter((a) => a.aprovada === true).length, 1);
  });
  await teste('B. id inexistente, malformado ou do protótipo → 404 (mesma resposta, sem vazar nada)', async () => {
    const ids = ['nao-existe', 'constructor', 'toString', 'hasOwnProperty', '__proto__', '../etc/passwd', 'ela-tem-classe/../x', '', 'ELA-TEM-CLASSE', 'a'.repeat(200), null, undefined, 123, ['ela-tem-classe'], { x: 1 }, 'ela tem classe', 'ela-tem-classe%00'];
    for (const id of ids) {
      const r = renderizarExperimenteObra({ livroId: id });
      assert.strictEqual(r.status, 404, String(id));
      assert.strictEqual(r.html, PAGINA_INDISPONIVEL, String(id));
    }
    const comFixture = (id) => renderizarExperimenteObra({ livroId: id }, { buscar: catalogoFixture(), amostra: obterAmostra });
    assert.strictEqual(comFixture('constructor').status, 404);
  });
  await teste('fail-closed em cada condição (flag, aprovação, trecho vazio/enorme, placeholder, livroId divergente, teaser, preço)', async () => {
    assert.strictEqual(render().status, 200); // base da fixture
    assert.strictEqual(render({}, { buscar: catalogoFixture({ amostraDisponivel: false }) }).status, 404);
    assert.strictEqual(render({}, { buscar: catalogoFixture({ amostraDisponivel: 'true' }) }).status, 404);
    assert.strictEqual(render({}, { amostra: () => amostraFixture({ aprovada: false }) }).status, 404);
    assert.strictEqual(render({}, { amostra: () => amostraFixture({ aprovada: 'sim' }) }).status, 404);
    assert.strictEqual(render({}, { amostra: () => null }).status, 404);
    assert.strictEqual(render({}, { amostra: () => amostraFixture({ trecho: '   ' }) }).status, 404);
    assert.strictEqual(render({}, { amostra: () => amostraFixture({ trecho: null }) }).status, 404);
    assert.strictEqual(render({}, { amostra: () => amostraFixture({ trecho: 'x'.repeat(MAX_TRECHO_CHARS + 1) }) }).status, 404);
    assert.strictEqual(render({}, { amostra: () => amostraFixture({ livroId: 'outro-livro' }) }).status, 404);
    assert.strictEqual(render({}, { buscar: catalogoFixture({ teaser: true }) }).status, 404);
    assert.strictEqual(render({}, { buscar: catalogoFixture({ preco: 0 }) }).status, 404);
  });
  await teste('placeholder sintético nunca é publicado pelo caminho de produção', async () => {
    const ph = { amostra: () => amostraFixture({ trecho: '[AMOSTRA EDITORIAL AINDA NÃO APROVADA]' }) };
    assert.strictEqual(render({}, ph).status, 404);
    assert.strictEqual(render({}, { ...ph, permitirPlaceholder: true }).status, 200); // só a camada de teste liga isso
    assert.ok(!/permitirPlaceholder/.test(srv), 'server.js nunca habilita placeholder');
    assert.ok(!/AMOSTRA EDITORIAL/.test(ler('src/lib/amostrasExperimente.js').replace(/MARCADOR_PLACEHOLDER = .*\n/, '').replace(/\/\/.*$/gm, '')), 'registro de produção sem texto placeholder');
  });

  console.log('\nO que a página expõe');
  const privados = [livroReal.audiobookStorage && livroReal.audiobookStorage.bucket, livroReal.audiobookStorage && livroReal.audiobookStorage.path, livroReal.audiobookUrl, 'audiobookStorage', 'audiobookUrl', 'audiobookPartes', 'supabase.co', '.mp3', 'zuni-audiobooks', 'bucket', livroReal.indicadoPara, livroReal.descricao.slice(0, 50), livroReal.resumo.slice(0, 50)].filter(Boolean);
  await teste('C/D/E. só o trecho aprovado aparece: nenhum texto do catálogo, storage privado, URL de áudio ou MP3 (mesmo a obra tendo tudo isso)', async () => {
    assert.ok(livroReal.audiobookStorage && livroReal.audiobookUrl, 'fixture parte da obra real com áudio privado e legado');
    const { html, status } = render();
    assert.strictEqual(status, 200);
    for (const p of privados) assert.ok(!html.includes(p), 'vazou: ' + p.slice(0, 40));
    assert.ok(html.includes('Primeiro parágrafo sintético de teste.') && html.includes('Segundo parágrafo sintético de teste.'));
    assert.strictEqual((html.match(/<div class="trecho" id="trecho">([\s\S]*?)<\/div>/)[1].match(/<p>/g) || []).length, 2); // exatamente os 2 parágrafos do trecho (E6A: a página tem outros <p> fora do trecho)
  });
  await teste('HTML do trecho é escapado (nada de tags, entidades ou recursão de template)', async () => {
    const { html } = render({}, { amostra: () => amostraFixture({ trecho: '<script>alert(1)</script> & "aspas" {{TITULO}} {{CHECKOUT_URL}}', chamada: '<img src=x onerror=alert(1)>', tituloTrecho: '<b>x</b>' }) });
    assert.ok(!/<script>alert/.test(html) && !/<img src=x/.test(html) && !/<b>x<\/b>/.test(html));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;aspas&quot; {{TITULO}} {{CHECKOUT_URL}}'));
  });
  await teste('F. preço vem do catálogo (nenhum valor escrito no template)', async () => {
    assert.ok(!/R\$|\d{2},\d{2}/.test(templateSrc), 'template sem preço');
    assert.ok(render().html.includes('Adquirir livro — R$ 34,90'));
    assert.ok(render({}, { buscar: catalogoFixture({ preco: 41.9 }) }).html.includes('Adquirir livro — R$ 41,90'));
    assert.ok(render({}, { buscar: catalogoFixture({ precoPromocional: 29.9 }) }).html.includes('Adquirir livro — R$ 29,90'));
  });
  await teste('G. capa e título vêm do catálogo', async () => {
    const a = render().html;
    assert.ok(a.includes('src="/loja/capas/ela-tem-classe.jpg"') && a.includes('<h1>Ela Tem Classe</h1>') && a.includes('alt="Capa de Ela Tem Classe"'));
    const b = render({}, { buscar: catalogoFixture({ capa: '/loja/capas/outra.png', tituloPublico: 'Título Público' }) }).html;
    assert.ok(b.includes('src="/loja/capas/outra.png"') && b.includes('<h1>Título Público</h1>'));
    const c = render({}, { buscar: catalogoFixture({ capa: 'https://evil.example/x.png' }) }).html; // capa fora de /loja/capas/ é ignorada
    assert.ok(!c.includes('evil.example'));
  });
  await teste('H. o checkout aponta para o livro correto', async () => {
    assert.ok(render().html.includes('href="/checkout-livro.html?livro=ela-tem-classe"'));
  });

  console.log('\nOrigem comercial');
  await teste('I. origem do Universo Feminino é preservada no checkout (e o cupom da URL, se válido)', async () => {
    const { html } = render({ origem: 'universo-feminino', cupom: 'SMOKE30' });
    assert.ok(html.includes('href="/checkout-livro.html?livro=ela-tem-classe&amp;origem=universo-feminino&amp;cupom=SMOKE30"'));
    assert.ok(html.includes('href="/loja/universo-feminino/?cupom=SMOKE30"'));
  });
  await teste('J. origem arbitrária é ignorada; cupom inválido é descartado; nada é refletido', async () => {
    for (const origem of ['evil', 'UNIVERSO-FEMININO', ' universo-feminino', '<img src=x>', ['universo-feminino'], { a: 1 }, 42, '']) {
      const { html } = render({ origem });
      assert.ok(!html.includes('origem='), JSON.stringify(origem));
      assert.ok(!html.includes('evil') && !html.includes('<img src=x>'));
    }
    const { html } = render({ cupom: '"><script>alert(1)</script>' });
    assert.ok(!html.includes('cupom=') && !/<script>alert/.test(html));
    assert.ok(!render({ cupom: 'A'.repeat(41) }).html.includes('cupom='));
  });
  await teste('sem origem na visita, o servidor não inventa uma (tráfego direto não vira "universo-feminino")', async () => {
    assert.ok(!render().html.includes('origem='));
  });
  await teste('origem não altera preço, produto nem conteúdo', async () => {
    const sem = render().html.replace(/&amp;origem=universo-feminino/g, '');
    const com = render({ origem: 'universo-feminino' }).html.replace(/&amp;origem=universo-feminino/g, '');
    assert.strictEqual(com, sem);
  });
  await teste('Voltar: rota determinística do universo da obra (não history.back) e rótulo correto', async () => {
    const { html } = render();
    assert.ok(html.includes('href="/loja/universo-feminino/">Voltar ao Universo Feminino</a>'));
    assert.ok(!/history\.back|history\.go/.test(templateSrc));
    const sem = render({}, { amostra: () => amostraFixture({ origemUniverso: 'inexistente' }) }).html;
    assert.ok(sem.includes('href="/loja/">Ver a Loja ZUNI</a>'));
  });
  await teste('aviso informativo (saúde) só quando a amostra o pede; texto-base preservado', async () => {
    assert.ok(!render().html.includes('Conteúdo de caráter informativo'));
    assert.ok(render({}, { amostra: () => amostraFixture({ avisoInformativo: true }) }).html.includes('Conteúdo de caráter informativo, que não substitui o acompanhamento de um profissional de saúde.'));
    assert.strictEqual(obterAmostra('ela-tem-classe').avisoInformativo, false); // Ela Tem Classe não ativa o aviso
  });
  await teste('título do trecho, chamada e TTS são opcionais; TTS pode ser desligado', async () => {
    assert.ok(!render({}, { amostra: () => amostraFixture({ chamada: null }) }).html.includes('class="chamada"'));
    assert.ok(render({}, { amostra: () => amostraFixture({ tituloTrecho: 'Capítulo X' }) }).html.includes('<h3>Capítulo X</h3>'));
    assert.ok(render({}, { amostra: () => amostraFixture({ ttsDisponivel: true }) }).html.includes('data-tts="1"'));
    // E6B: TTS desligado = o bloco da voz do navegador nem vai para a página (antes ficava oculto com data-tts="0").
    assert.ok(!render({}, { amostra: () => amostraFixture({ ttsDisponivel: false }) }).html.includes('id="btn-ouvir"'));
    assert.ok(!renderizarExperimenteObra({ livroId: 'ela-tem-classe' }).html.includes('id="btn-ouvir"'), 'Ela Tem Classe (amostra oficial do audiobook, registro real) não oferece a voz do navegador');
  });

  console.log('\nSem chat, sem IA, sem custo');
  await teste('L/M. template e código da página não carregam chat, Mentor, OpenAI, Claude, RAG, Supabase nem embeddings', async () => {
    const proibidos = ['experimente-livro-chat', 'experimente-chat', 'api/', 'openai', 'anthropic', 'claude', 'supabase', 'embedding', 'rag', 'mentor', 'livro-vivo', 'livro vivo', 'fetch(', 'xmlhttprequest', 'sendbeacon', 'websocket', 'eventsource', 'pintrk', '<form', '<input', '<textarea'];
    // E5: a única exceção permitida é o bloco da tag oficial do Pinterest (load + page); fora dele, nenhum pintrk.
    const html = render().html.replace(/<!-- Pinterest Tag oficial[\s\S]*?<\/script>/, '').toLowerCase();
    for (const p of proibidos) assert.ok(!html.includes(p), 'página contém: ' + p);
    const codigo = ler('src/lib/experimenteObra.js') + ler('src/lib/amostrasExperimente.js');
    for (const m of ['openai', 'anthropic', 'supabase', 'express-rate-limit']) assert.ok(!new RegExp(`require\\(['"][^'"]*${m}`).test(codigo), 'require de ' + m);
    assert.ok(!/<script[^>]+src="https?:/.test(render().html) && !/<link[^>]+href="https?:/.test(render().html), 'sem recursos externos');
  });
  await teste('K. TTS não faz chamada de rede (código e uso)', async () => {
    const src = ler('public/js/experimente-tts.js').replace(/\/\/.*$/gm, '');
    for (const p of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'new Audio', 'import(']) assert.ok(!src.includes(p), p);
    const script = templateSrc.match(/<script>([\s\S]*?)<\/script>/)[1];
    for (const p of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'new Audio', 'src =']) assert.ok(!script.includes(p), p);
  });

  console.log('\nLeitura em voz (TTS do navegador)');
  function sinteseFalsa(vozes = []) {
    const s = { falas: [], cancelamentos: 0, vozes, speak(u) { s.falas.push(u); }, cancel() { s.cancelamentos++; }, getVoices() { return s.vozes; } };
    return s;
  }
  class UtteranceFalsa { constructor(t) { this.text = t; } }
  const textoLongo = 'Primeira frase curta. Segunda frase, um pouco maior, com vírgula. Terceira frase termina aqui! E uma quarta?';
  await teste('divide o texto em pedaços curtos (frases) e quebra frases muito longas', async () => {
    const p = tts.dividirEmPedacos(textoLongo);
    assert.deepStrictEqual(p, ['Primeira frase curta.', 'Segunda frase, um pouco maior, com vírgula.', 'Terceira frase termina aqui!', 'E uma quarta?']);
    const gigante = ('palavra '.repeat(200)).trim() + '.';
    tts.dividirEmPedacos(gigante).forEach((x) => assert.ok(x.length <= 222, 'pedaço grande: ' + x.length));
    assert.deepStrictEqual(tts.dividirEmPedacos('   '), []);
  });
  await teste('iniciar → falando; cada pedaço só começa quando o anterior termina; fim → parado', async () => {
    const synth = sinteseFalsa(); const estados = [];
    const l = tts.criarLeitor({ synth, Utterance: UtteranceFalsa, texto: textoLongo, onEstado: (e) => estados.push(e.estado) });
    assert.strictEqual(l.suportado, true);
    l.iniciar();
    assert.strictEqual(l.estado(), 'falando');
    assert.strictEqual(synth.falas.length, 1);
    assert.strictEqual(synth.falas[0].lang, 'pt-BR');
    synth.falas[0].onend(); assert.strictEqual(synth.falas.length, 2);
    synth.falas[1].onend(); synth.falas[2].onend(); synth.falas[3].onend();
    assert.strictEqual(l.estado(), 'parado');
    assert.strictEqual(estados[0], 'falando'); assert.strictEqual(estados[estados.length - 1], 'parado');
  });
  await teste('pausar cancela a fala; continuar recomeça do pedaço atual; onend atrasado do pedaço cancelado é ignorado', async () => {
    const synth = sinteseFalsa();
    const l = tts.criarLeitor({ synth, Utterance: UtteranceFalsa, texto: textoLongo });
    l.iniciar(); synth.falas[0].onend();             // falando o pedaço 2 (índice 1)
    const cancelAntes = synth.cancelamentos;
    l.pausar();
    assert.strictEqual(l.estado(), 'pausado');
    assert.ok(synth.cancelamentos > cancelAntes);
    synth.falas[1].onend();                          // evento tardio do pedaço cancelado
    assert.strictEqual(synth.falas.length, 2);        // nada novo foi falado
    l.continuar();
    assert.strictEqual(l.estado(), 'falando');
    assert.strictEqual(synth.falas[2].text, synth.falas[1].text); // recomeça o pedaço interrompido
    l.pausar(); l.pausar(); assert.strictEqual(l.estado(), 'pausado'); // idempotente
  });
  await teste('parar cancela, zera e volta ao início; sem pedaço pendente depois', async () => {
    const synth = sinteseFalsa();
    const l = tts.criarLeitor({ synth, Utterance: UtteranceFalsa, texto: textoLongo });
    l.iniciar(); l.parar();
    assert.strictEqual(l.estado(), 'parado');
    synth.falas[0].onend();
    assert.strictEqual(synth.falas.length, 1);
    l.iniciar(); assert.strictEqual(synth.falas[1].text, 'Primeira frase curta.'); // recomeça do zero
    l.pausar(); l.parar(); assert.strictEqual(l.estado(), 'parado');
  });
  await teste('prefere voz pt-BR; usa pt; avisa quando o aparelho não tem voz em português', async () => {
    const en = { lang: 'en-US', name: 'en' }, pt = { lang: 'pt-PT', name: 'pt' }, br = { lang: 'pt-BR', name: 'br' };
    assert.strictEqual(tts.escolherVoz([en, pt, br]).voz, br);
    assert.strictEqual(tts.escolherVoz([en, pt]).voz, pt);
    assert.deepStrictEqual(tts.escolherVoz([en]), { voz: null, ptDisponivel: false });
    const synth = sinteseFalsa([br]); const l = tts.criarLeitor({ synth, Utterance: UtteranceFalsa, texto: 'Olá.' });
    l.iniciar(); assert.strictEqual(synth.falas[0].voice, br);
    const sem = []; const l2 = tts.criarLeitor({ synth: sinteseFalsa([en]), Utterance: UtteranceFalsa, texto: 'Hello.', onEstado: (e) => sem.push(e.ptDisponivel) });
    l2.iniciar(); assert.ok(sem.includes(false));
  });
  await teste('fallback seguro: sem speechSynthesis nada quebra', async () => {
    for (const cfg of [{ synth: undefined, Utterance: undefined }, { synth: sinteseFalsa(), Utterance: undefined }, { synth: undefined, Utterance: UtteranceFalsa }]) {
      const l = tts.criarLeitor({ ...cfg, texto: 'Texto.' });
      assert.strictEqual(l.suportado, false);
      assert.doesNotThrow(() => { l.iniciar(); l.pausar(); l.continuar(); l.parar(); });
      assert.strictEqual(l.estado(), 'parado');
    }
    const quebrado = { speak() { throw new Error('x'); }, cancel() { throw new Error('y'); }, getVoices() { return []; } };
    const l = tts.criarLeitor({ synth: quebrado, Utterance: UtteranceFalsa, texto: 'Texto.' });
    assert.doesNotThrow(() => { l.iniciar(); l.parar(); });
  });
  await teste('a página cancela a leitura ao sair (pagehide/beforeunload) e esconde o áudio sem suporte', async () => {
    // E6B: o template tem também o script da amostra de audiobook; o da voz do navegador é o que usa criarLeitor.
    const script = (templateSrc.match(/<script>[\s\S]*?<\/script>/g) || []).find((s) => s.includes('criarLeitor'));
    assert.ok(script, 'script do leitor por voz presente');
    assert.ok(/addEventListener\('pagehide'[\s\S]*leitor\.parar\(\)/.test(script) && /addEventListener\('beforeunload'[\s\S]*leitor\.parar\(\)/.test(script));
    assert.ok(/if \(!synth \|\| !Utterance\) return;/.test(script));
    assert.ok(/id="ouvir"[^>]*hidden/.test(templateSrc));
    assert.ok(/role="status" aria-live="polite"/.test(templateSrc));
  });

  console.log('\nSegurança A — endpoint de captura de lead');
  await teste('N. nenhum consumidor no frontend; endpoint responde 410 e não envia e-mail nem grava', async () => {
    const publico = [];
    (function varrer(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) varrer(p); else if (/\.(html|js)$/.test(e.name)) publico.push(p); } })(path.join(raiz, 'public'));
    for (const f of publico) assert.ok(!fs.readFileSync(f, 'utf8').includes('experimente-capturar-lead'), f);
    assert.ok(/const LEAD_ENDPOINT_ATIVO = false;/.test(srv));

    const bloco = fatiar("app.post('/api/experimente-capturar-lead'", "/**\n * POST /api/experimente-calcular-astrologia-b");
    let handler; const chamadas = { email: 0, captura: 0, acesso: 0 };
    new Function('app', 'enviarResultadoNumerologia', 'registrarCaptura', 'registrarAcesso', 'LEAD_ENDPOINT_ATIVO', 'console', bloco)(
      { post: (r, h) => { handler = h; } },
      async () => { chamadas.email++; return { sucesso: true }; }, async () => { chamadas.captura++; }, () => { chamadas.acesso++; }, false, { error() {}, log() {} }
    );
    let status, corpo;
    const res = { status(c) { status = c; return res; }, json(b) { corpo = b; return res; } };
    await handler({ body: { nomeCompleto: 'Fulano', email: 'vitima@example.invalid', dataNascimento: '2000-01-01', caminhoDeVida: 1, essencia: 2, interpretacao: '<h1>spam</h1>' } }, res);
    assert.strictEqual(status, 410);
    assert.strictEqual(corpo.sucesso, false);
    assert.deepStrictEqual(chamadas, { email: 0, captura: 0, acesso: 0 });
    // sem corpo/sem e-mail também é 410 (a desativação vem antes de qualquer validação)
    await handler({ body: {} }, res); assert.strictEqual(status, 410);
    assert.deepStrictEqual(chamadas, { email: 0, captura: 0, acesso: 0 });
  });

  console.log('\nSegurança B — Mentor demo (/api/experimente-chat)');
  await teste('IP confiável: usa a entrada da direita de X-Forwarded-For (a anexada pelo proxy), nunca a da esquerda', async () => {
    const req = (xff, ip) => ({ headers: xff === undefined ? {} : { 'x-forwarded-for': xff }, socket: { remoteAddress: ip } });
    assert.strictEqual(extrairIpConfiavel(req('1.1.1.1, 2.2.2.2, 9.9.9.9')), '9.9.9.9');
    assert.strictEqual(extrairIpConfiavel(req('forjado, 9.9.9.9')), '9.9.9.9');
    assert.strictEqual(extrairIpConfiavel(req('9.9.9.9')), '9.9.9.9');
    assert.strictEqual(extrairIpConfiavel(req(undefined, '10.0.0.5')), '10.0.0.5');
    assert.strictEqual(extrairIpConfiavel(req('', '10.0.0.5')), '10.0.0.5');
    assert.strictEqual(extrairIpConfiavel({ headers: {}, socket: {} }), '0.0.0.0');
    assert.strictEqual(rl.extrairIP(req('forjado, 9.9.9.9')), '9.9.9.9'); // o limite por sessão também usa o IP confiável
  });

  const blocoMentor = fatiar("app.post('/api/experimente-chat'", "/**\n * GET /experimente\n");
  function montarMentor(opcoes = {}) {
    const reg = { claude: 0, rag: [], logs: [], erros: [], chunk: 'CONTEUDO-DO-CHUNK-RAG' };
    let handler;
    const consoleFalso = { log: (...a) => reg.logs.push(a.join(' ')), error: (...a) => reg.erros.push(a.map((x) => (x && x.message) || String(x)).join(' ')), warn: (...a) => reg.logs.push(a.join(' ')) };
    const AnthropicFalso = { default: class { constructor() { this.messages = { create: async (args) => { reg.claude++; reg.ultimoPrompt = args; if (opcoes.claudeFalha) throw new Error('falha-claude'); return { content: [{ text: 'Resposta simulada do Mentor.' }], usage: { input_tokens: 111, output_tokens: 222 } }; } }; } } };
    new Function('app', 'criarLimiterMentorDemo', 'SESSION_ID_MAX_CHARS', 'MENSAGEM_MAX_CHARS', 'gerarVisitorHash', 'verificarLimite', 'registrarUso', 'auditarConsumo', 'orcamentoDemo', 'extrairIpConfiavel', 'searchKnowledge', 'SYSTEM_PROMPT_DEMO', 'limparMarkdown', 'avaliarSeguranca', 'adicionarDiretivaAoSistema', 'aplicarRodapeSeguranca', 'removerConviteComercial', 'require', 'console', blocoMentor)(
      { post: (r, mw, h) => { handler = h; } },
      () => (req, res, next) => next(), protecao.SESSION_ID_MAX_CHARS, protecao.MENSAGEM_MAX_CHARS,
      rl.gerarVisitorHash, rl.verificarLimite, rl.registrarUso, async () => {}, opcoes.orcamento || protecao.criarOrcamentoDemo(), protecao.extrairIpConfiavel,
      async (q, n, t, o) => { reg.rag.push({ q, n, t, o }); return [reg.chunk]; }, 'PROMPT-DE-SISTEMA-SECRETO-DA-DEMO', (t) => t,
      require('../src/lib/protecaoCrise').avaliarSeguranca, require('../src/lib/protecaoCrise').adicionarDiretivaAoSistema, require('../src/lib/protecaoCrise').aplicarRodapeSeguranca, require('../src/lib/protecaoCrise').removerConviteComercial,
      (m) => (m === '@anthropic-ai/sdk' ? AnthropicFalso : require(m)), consoleFalso
    );
    const chamar = async (body, xff, ip = '10.0.0.1') => {
      let status = 200, corpo;
      const res = { status(c) { status = c; return res; }, json(b) { corpo = b; return res; } };
      await handler({ body, headers: xff === undefined ? {} : { 'x-forwarded-for': xff }, socket: { remoteAddress: ip } }, res);
      return { status, corpo };
    };
    return { reg, chamar };
  }

  await teste('O. mensagem acima do limite (500) ou inválida → 400, sem RAG nem Claude', async () => {
    const m = montarMentor();
    const r = await m.chamar({ message: 'x'.repeat(protecao.MENSAGEM_MAX_CHARS + 1), sessionId: 'S-a1' }, '7.7.7.1');
    assert.strictEqual(r.status, 400); assert.strictEqual(r.corpo.bloqueado, false);
    for (const body of [{ message: 'ok', sessionId: 'x'.repeat(101) }, { message: 123, sessionId: 'S-a2' }, { message: ['a'], sessionId: 'S-a3' }, { message: '   ', sessionId: 'S-a4' }, { sessionId: 'S-a5' }, { message: 'ok' }, undefined, {}]) {
      assert.strictEqual((await m.chamar(body, '7.7.7.2')).status, 400, JSON.stringify(body));
    }
    assert.strictEqual(m.reg.claude, 0); assert.strictEqual(m.reg.rag.length, 0);
    assert.strictEqual((await m.chamar({ message: 'x'.repeat(protecao.MENSAGEM_MAX_CHARS), sessionId: 'S-a6' }, '7.7.7.3')).status, 200); // exatamente 500 passa
  });
  await teste('O. trocar o sessionId NÃO dá orçamento novo: teto diário por IP', async () => {
    const m = montarMentor();
    let ok200 = 0, ult;
    for (let i = 0; i < protecao.LIMITE_DIA_POR_IP + 10; i++) {
      ult = await m.chamar({ message: 'pergunta ' + i, sessionId: 'rot-' + i + '-' + Math.random() }, '8.8.8.8');
      if (ult.status === 200) ok200++;
    }
    assert.strictEqual(ok200, protecao.LIMITE_DIA_POR_IP);
    assert.strictEqual(ult.status, 429); assert.strictEqual(ult.corpo.bloqueado, true); assert.ok(/limite gratuito de hoje/.test(ult.corpo.mensagem));
    assert.strictEqual(m.reg.claude, protecao.LIMITE_DIA_POR_IP); // nenhuma chamada paga além do teto
  });
  await teste('O. forjar a entrada da esquerda de X-Forwarded-For não contorna o limite', async () => {
    const m = montarMentor(); let ok200 = 0;
    for (let i = 0; i < protecao.LIMITE_DIA_POR_IP + 5; i++) {
      const r = await m.chamar({ message: 'p' + i, sessionId: 'forja-' + i + Math.random() }, `1.2.3.${i}, 9.9.9.9`);
      if (r.status === 200) ok200++;
    }
    assert.strictEqual(ok200, protecao.LIMITE_DIA_POR_IP);
    assert.strictEqual((await m.chamar({ message: 'p', sessionId: 'outro' + Math.random() }, 'x, 9.9.9.10')).status, 200); // outro cliente real segue normal
  });
  await teste('O. disjuntor global: o gasto diário total da demo tem teto, mesmo com muitos IPs', async () => {
    const m = montarMentor({ orcamento: protecao.criarOrcamentoDemo({ limiteDiaPorIp: 100, limiteDiaGlobal: 5 }) });
    const resultados = [];
    for (let i = 0; i < 8; i++) resultados.push((await m.chamar({ message: 'p' + i, sessionId: 'g-' + i + Math.random() }, '6.6.6.' + i)).status);
    assert.deepStrictEqual(resultados, [200, 200, 200, 200, 200, 429, 429, 429]);
    assert.strictEqual(m.reg.claude, 5);
  });
  await teste('O. janela de 24h: o orçamento renova depois de um dia e é limpo da memória', async () => {
    const o = protecao.criarOrcamentoDemo({ limiteDiaPorIp: 2, limiteDiaGlobal: 10 }); const t0 = 1_000_000;
    assert.ok(o.consumir('ip', t0).permitido && o.consumir('ip', t0 + 1).permitido);
    assert.strictEqual(o.consumir('ip', t0 + 2).permitido, false);
    assert.strictEqual(o.consumir('ip', t0 + 2).motivo, 'ip');
    assert.ok(o.consumir('ip', t0 + 24 * 3600 * 1000 + 5).permitido);
    const g = protecao.criarOrcamentoDemo({ limiteDiaPorIp: 5, limiteDiaGlobal: 1 });
    assert.ok(g.consumir('a', t0).permitido); assert.strictEqual(g.consumir('b', t0 + 1).motivo, 'global');
  });
  await teste('O. o limite funcional por sessão (5 trocas) continua valendo', async () => {
    const m = montarMentor(); const sid = 'sessao-fixa-' + Math.random(); const st = [];
    for (let i = 0; i < 7; i++) st.push((await m.chamar({ message: 'p' + i, sessionId: sid }, '5.5.5.5')).status);
    assert.deepStrictEqual(st, [200, 200, 200, 200, 200, 429, 429]);
    assert.strictEqual(m.reg.claude, 5);
  });
  await teste('rajada por IP (express-rate-limit): 429 claro, chave = IP confiável, sem avisos de configuração', async () => {
    const express = require('express');
    const avisos = []; const origErr = console.error; console.error = (...a) => avisos.push(a.join(' '));
    const app = express(); app.use(express.json());
    app.post('/demo', protecao.criarLimiterMentorDemo(), (req, res) => res.json({ ok: true }));
    const server = http.createServer(app); await new Promise((r) => server.listen(0, r));
    const porta = server.address().port;
    const pedir = (xff) => new Promise((resolve, reject) => {
      const req = http.request({ port: porta, method: 'POST', path: '/demo', headers: { 'content-type': 'application/json', ...(xff ? { 'x-forwarded-for': xff } : {}) } }, (res) => { let b = ''; res.on('data', (d) => b += d); res.on('end', () => resolve({ status: res.statusCode, corpo: b, h: res.headers })); });
      req.on('error', reject); req.end('{}');
    });
    try {
      const st = [];
      for (let i = 0; i < protecao.RAJADA_MAX + 2; i++) st.push((await pedir(`forjado-${i}, 4.4.4.4`)).status);
      assert.deepStrictEqual(st.slice(0, protecao.RAJADA_MAX), Array(protecao.RAJADA_MAX).fill(200));
      assert.deepStrictEqual(st.slice(protecao.RAJADA_MAX), [429, 429]);
      const bloqueado = await pedir('x, 4.4.4.4');
      const j = JSON.parse(bloqueado.corpo);
      assert.strictEqual(j.bloqueado, true); assert.ok(/Muitas tentativas/.test(j.mensagem));
      assert.ok(bloqueado.h['ratelimit-limit'] || bloqueado.h['ratelimit']);
      assert.strictEqual((await pedir('x, 4.4.4.5')).status, 200); // outro IP real não é afetado
      assert.strictEqual((await pedir()).status, 200);             // sem X-Forwarded-For: usa o socket
    } finally { console.error = origErr; server.close(); }
    assert.deepStrictEqual(avisos.filter((a) => /ERR_ERL|ValidationError/.test(a)), []);
  });
  await teste('P. resposta pública não expõe tokens, custo nem dados internos', async () => {
    const m = montarMentor();
    const r = await m.chamar({ message: 'Olá', sessionId: 'resp-' + Math.random() }, '3.3.3.3');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(Object.keys(r.corpo).sort(), ['bloqueado', 'contador', 'texto', 'ultimaTroca']);
    const s = JSON.stringify(r.corpo);
    for (const k of ['tokens', 'custo', 'USD', 'input', 'output', '111', '222']) assert.ok(!s.includes(k), k);
    assert.ok(!/data\.(tokens|custo)/.test(ler('public/js/experimente-client.js')), 'cliente não consome mais tokens/custo');
  });
  await teste('Q. logs da rota não registram mensagem do visitante, prompt, contexto RAG nem sessionId', async () => {
    const m = montarMentor(); const marcador = 'MENSAGEM-PRIVADA-DO-VISITANTE-XYZ'; const sid = 'SESSAO-SECRETA-' + Math.random();
    const r = await m.chamar({ message: marcador, sessionId: sid }, '3.3.3.4');
    assert.strictEqual(r.status, 200);
    const tudo = m.reg.logs.concat(m.reg.erros).join('\n');
    for (const proibido of [marcador, 'PROMPT-DE-SISTEMA-SECRETO-DA-DEMO', 'CONTEUDO-DO-CHUNK-RAG', sid, 'Resposta simulada']) assert.ok(!tudo.includes(proibido), 'log contém: ' + proibido);
    assert.ok(m.reg.logs.some((l) => l.includes('[CHAT_DEMO]')), 'resta o log operacional mínimo');
    assert.strictEqual(m.reg.rag.length, 1);
    assert.deepStrictEqual(m.reg.rag[0].o, { silencioso: true }); // searchKnowledge não registra a pergunta
    assert.ok(m.reg.ultimoPrompt.system.includes('PROMPT-DE-SISTEMA-SECRETO-DA-DEMO')); // o prompt segue sendo usado, só não é logado
    const falha = montarMentor({ claudeFalha: true });
    assert.strictEqual((await falha.chamar({ message: marcador, sessionId: 'f-' + Math.random() }, '3.3.3.5')).status, 500);
    assert.ok(!falha.reg.erros.concat(falha.reg.logs).join('\n').includes(marcador));
  });
  await teste('searchKnowledge: opção silencioso suprime o log da pergunta (uso pago continua logando como antes)', async () => {
    assert.ok(/async function searchKnowledge\(query, limite = 5, tema = null, opcoes = \{\}\)/.test(srv));
    assert.ok(/if \(!opcoes\.silencioso\) console\.log\(`\[RAG_GENERICO\]/.test(srv) && /if \(!opcoes\.silencioso\) console\.log\(`\[RAG_HIBRIDO\]/.test(srv));
    assert.strictEqual((srv.match(/searchKnowledge\([^)]*silencioso/g) || []).length, 1); // só a demo é silenciosa
  });
  await teste('rota registrada com o limiter de rajada e sem logar prompt/mensagem no código', async () => {
    assert.ok(/app\.post\('\/api\/experimente-chat', criarLimiterMentorDemo\(\), async/.test(srv));
    for (const proibido of ['[RAG_DEMO]', 'PROMPT ENVIADO AO CLAUDE', '[USER MESSAGE COM CONTEXTO]', 'console.log(promptFinal)', 'console.log(messagesParaClaude']) assert.ok(!blocoMentor.includes(proibido), proibido);
  });

  console.log('\nXSS legado (experimente-client.js)');
  await teste('R. pergunta e resposta são inseridas como texto (textContent), não como HTML', async () => {
    const cli = ler('public/js/experimente-client.js');
    assert.ok(!/bubble\.innerHTML/.test(cli));
    assert.ok(!/msgDiv\.innerHTML/.test(cli));
    assert.ok(/bubble\.textContent = msg\.texto;/.test(cli) && /bubble\.textContent = texto;/.test(cli));
    assert.ok(/document\.createTextNode\(' ' \+ conteudo\)/.test(cli));
    assert.ok(/maxlength="500"/.test(ler('public/experimente.html')), 'campo do Mentor limitado a 500 caracteres');
  });

  console.log('\nLegado preservado e invariantes');
  await teste('/experimente (legado) e Bastidores seguem de pé: rota, texto do capítulo e catálogo da degustação', async () => {
    assert.ok(/app\.get\('\/experimente', \(req, res\) => \{\s*res\.sendFile/.test(srv));
    assert.ok(ler('public/experimente.html').includes('Capítulo 1 — O cérebro que reage antes de pensar'));
    assert.ok(buscarLivro('os-bastidores-da-mente-1-degustacao').teaser === true);
  });
  await teste('preços e áudios da F2 preservados; flag de amostra só nas cinco do Universo Feminino (E3B: true só em Ela Tem Classe)', async () => {
    const e = { 'ela-tem-classe': [34.9, 19.9], 'a-inteligencia-do-corpo-feminino': [39.9, 24.9], 'codigo-feminino': [44.9, 24.9], 'a-mulher-que-permanece-inteira': [49.9, 24.9], 'inesquecivel-charme-feminino': [49.9, 24.9] };
    for (const [id, [p, a]] of Object.entries(e)) { assert.strictEqual(CATALOGO[id].preco, p); assert.strictEqual(CATALOGO[id].precoAudiobook, a); assert.strictEqual(CATALOGO[id].amostraDisponivel, id === 'ela-tem-classe'); }
    assert.deepStrictEqual(Object.keys(CATALOGO).filter((id) => 'amostraDisponivel' in CATALOGO[id]).sort(), Object.keys(e).sort());
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${total - ok}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — E2: base multiobra fail-closed, TTS sem custo, lead desativado, Mentor demo protegido.');
})();
