// Teste local (sem rede, sem Supabase, sem Stripe, sem e-mail, sem IA) da E3B — primeira degustação comercial:
// "Ela Tem Classe", trecho aprovado = Introdução + Capítulo 1 (texto idêntico ao da obra).
// Uso: node scripts/testar-experimente-e3b.js
//
// Integridade: o trecho publicado é comparado, em tempo de teste, com o módulo de dados do flipbook
// (private/livros/ela-tem-classe/index.html, lido só em memória). Se o flipbook não estiver presente
// (ambiente sem a pasta private/), os testes que dependem dele são marcados como pulados.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

const raiz = path.join(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const { CATALOGO, buscarLivro } = require(path.join(raiz, 'src/lib/catalogoLivros'));
const { AMOSTRAS, obterAmostra, MAX_TRECHO_CHARS } = require(path.join(raiz, 'src/lib/amostrasExperimente'));
const { renderizarExperimenteObra, escapar, PAGINA_INDISPONIVEL } = require(path.join(raiz, 'src/lib/experimenteObra'));
const protecao = require(path.join(raiz, 'src/lib/protecaoMentorDemo'));

let total = 0, ok = 0, pulados = 0; const falhas = [];
async function teste(nome, fn) {
  total++;
  try { const r = await fn(); if (r === 'PULADO') { pulados++; ok++; console.log(`  pula ${nome} (flipbook ausente)`); } else { ok++; console.log(`  ok   ${nome}`); } }
  catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); }
}

// ── Obra de referência (flipbook, só leitura, só em memória) ──
function lerObra() {
  const arq = path.join(raiz, 'private/livros/ela-tem-classe/index.html');
  if (!fs.existsSync(arq)) return null;
  const s = fs.readFileSync(arq, 'utf8');
  const man = JSON.parse(s.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/)[1]);
  const mod = Object.values(man).find((v) => v.mime === 'application/javascript');
  let buf = Buffer.from(mod.data, 'base64'); if (mod.compressed) buf = zlib.gunzipSync(buf);
  const d = JSON.parse(buf.toString('utf8').replace(/^export default\s*/, '').replace(/;\s*$/, ''));
  const secoes = [];
  d.front.forEach((c, i) => secoes.push({ id: 'F' + (i + 1), titulo: c.title, paragrafos: c.blocks.map((b) => b.text) }));
  d.parts.forEach((p, pi) => p.chapters.forEach((c, ci) => secoes.push({ id: `V${pi + 1}C${ci + 1}`, titulo: c.title, paragrafos: c.blocks.map((b) => b.text) })));
  return secoes;
}
const obra = lerObra();
const palavras = (t) => t.trim().split(/\s+/).filter(Boolean).length;

const html200 = (params = {}) => {
  const r = renderizarExperimenteObra({ livroId: 'ela-tem-classe', ...params });
  assert.strictEqual(r.status, 200);
  return r.html;
};
const amostra = obterAmostra('ela-tem-classe');
const srvAmostra = ler('src/lib/amostrasExperimente.js');
const srv = ler('src/server.js');

(async () => {
  console.log('E3B — primeira degustação: Ela Tem Classe (Introdução + Capítulo 1)\n');

  console.log('Disponibilidade');
  await teste('A. Ela Tem Classe retorna 200 em /experimente/ela-tem-classe/ (código real de produção)', async () => {
    const r = renderizarExperimenteObra({ livroId: 'ela-tem-classe' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(buscarLivro('ela-tem-classe').amostraDisponivel, true);
    assert.strictEqual(amostra.aprovada, true);
  });
  await teste('B. as outras quatro obras do Universo Feminino continuam 404, com catálogo false e sem amostra', async () => {
    for (const id of ['a-inteligencia-do-corpo-feminino', 'codigo-feminino', 'a-mulher-que-permanece-inteira', 'inesquecivel-charme-feminino']) {
      const r = renderizarExperimenteObra({ livroId: id });
      assert.strictEqual(r.status, 404, id);
      assert.strictEqual(r.html, PAGINA_INDISPONIVEL);
      assert.strictEqual(CATALOGO[id].amostraDisponivel, false, id);
      assert.strictEqual(obterAmostra(id), null, id);
    }
    assert.deepStrictEqual(Object.keys(CATALOGO).filter((id) => CATALOGO[id].amostraDisponivel === true), ['ela-tem-classe']);
    assert.deepStrictEqual(Object.keys(AMOSTRAS), ['ela-tem-classe']);
  });

  console.log('\nIntegridade do trecho');
  await teste('C. o trecho é exatamente o aprovado: Introdução + Capítulo 1, idêntico à obra (parágrafo a parágrafo)', async () => {
    if (!obra) return 'PULADO';
    const esperado = [...obra.find((s) => s.id === 'F1').paragrafos, ...obra.find((s) => s.id === 'V1C1').paragrafos];
    assert.strictEqual(esperado.length, 7);
    assert.strictEqual(amostra.trecho, esperado.join('\n\n'));
    const html = html200();
    esperado.forEach((p, i) => assert.ok(html.includes(escapar(p)), 'parágrafo ' + (i + 1) + ' ausente da página'));
    assert.strictEqual(html.match(/<div class="trecho" id="trecho">([\s\S]*?)<\/div>/)[1].match(/<p>/g).length, 7);
  });
  await teste('C2. contagem e proporção (QA interno): 422 palavras, 2.603 caracteres, ≈ 11,1% da obra (3.791 palavras)', async () => {
    assert.strictEqual(palavras(amostra.trecho), 422);
    assert.strictEqual(amostra.trecho.length, 2603);
    assert.ok(amostra.trecho.length < MAX_TRECHO_CHARS);
    if (obra) {
      const totalObra = obra.reduce((a, s) => a + s.paragrafos.reduce((b, p) => b + palavras(p), 0), 0);
      assert.strictEqual(totalObra, 3791);
      assert.strictEqual(+(422 / totalObra * 100).toFixed(1), 11.1);
    }
    const html = html200();
    assert.ok(!/\b422\b|\b2\.?603\b|11,1|3\.?791/.test(html), 'a proporção é só QA interno: não aparece ao cliente');
  });
  await teste('D. o Capítulo 2 NÃO aparece (nem seu texto, nem seu título), nem na página nem no registro', async () => {
    if (!obra) return 'PULADO';
    const cap2 = obra.find((s) => s.id === 'V1C2');
    const html = html200();
    for (const p of cap2.paragrafos) { assert.ok(!html.includes(escapar(p)) && !srvAmostra.includes(p)); assert.ok(!html.includes(p.slice(0, 60))); }
    assert.ok(!/Capítulo 2|A Psicologia da Presença Feminina/.test(html + srvAmostra));
    assert.ok(!amostra.trecho.includes(cap2.paragrafos[0].slice(0, 40))); // sem repetir o texto do capítulo aqui no teste
  });
  await teste('E. o texto integral NÃO aparece: nenhum outro parágrafo da obra, nenhum trecho de 12 palavras alheio ao aprovado, nenhum módulo de dados', async () => {
    if (!obra) return 'PULADO';
    const html = html200();
    const aprovados = new Set([...obra.find((s) => s.id === 'F1').paragrafos, ...obra.find((s) => s.id === 'V1C1').paragrafos]);
    const textoAprovado = [...aprovados].join(' ');
    const norm = (t) => t.replace(/\s+/g, ' ');
    const visivel = norm(html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' '));
    let outros = 0, janelas = 0;
    for (const s of obra) for (const p of s.paragrafos) {
      if (aprovados.has(p)) continue;
      outros++;
      assert.ok(!html.includes(escapar(p)), 'parágrafo alheio na página: ' + s.id);
      const w = norm(p).split(' ');
      for (let i = 0; i + 12 <= w.length; i++) {
        const janela = w.slice(i, i + 12).join(' ');
        if (norm(textoAprovado).includes(janela)) continue; // frase que o próprio trecho aprovado já contém
        janelas++;
        assert.ok(!visivel.includes(janela), 'trecho alheio na página: ' + s.id + ' «' + janela + '»');
      }
    }
    assert.strictEqual(outros, 54); // 61 parágrafos da obra − 7 do trecho
    assert.ok(janelas > 1000);
    for (const marca of ['export default', '"parts"', '"blocks"', '"chapters"', '__bundler', 'flipbook', 'Flipbook']) assert.ok(!html.includes(marca), marca);
  });

  console.log('\nPágina: estrutura editorial, preço e capa');
  await teste('estrutura: Experimente ZUNI, capa, título, chamada, CTA discreto no topo, "Leia um trecho", título do trecho, trecho, aviso de fim', async () => {
    const h = html200();
    const ordem = ['class="rotulo">Experimente ZUNI', 'class="capa"', '<h1>Ela Tem Classe</h1>', '<p class="chamada">A diferença entre chamar atenção e permanecer na memória de alguém.</p>', 'class="compra-topo"', 'Leia um trecho', '<h3>Da aparência à presença</h3>', 'id="trecho"', 'Este é apenas um trecho da obra.'];
    let pos = -1; for (const o of ordem) { const i = h.indexOf(o); assert.ok(i > pos, 'fora de ordem/ausente: ' + o); pos = i; }
    assert.ok(!h.includes('class="aviso"'), 'sem aviso informativo');
  });
  await teste('F. o preço (topo e CTA final) vem do catálogo e acompanha mudanças dele', async () => {
    const h = html200();
    assert.strictEqual((h.match(/Adquirir livro — R\$ 34,90/g) || []).length, 2); // atalho no topo + CTA final
    const livro = buscarLivro('ela-tem-classe');
    const alt = renderizarExperimenteObra({ livroId: 'ela-tem-classe' }, { buscar: (id) => ({ ...livro, preco: 39.9 }), amostra: obterAmostra }).html;
    assert.strictEqual((alt.match(/Adquirir livro — R\$ 39,90/g) || []).length, 2);
    assert.ok(!alt.includes('R$ 34,90'));
  });
  await teste('G. nenhum preço (nem campo comercial) existe em amostrasExperimente.js ou no template', async () => {
    assert.ok(!/R\$|\b\d{1,3}[.,]\d{2}\b|preco|pre[cç]o|checkout|audiobook|capa\b|Storage|bucket|supabase|\.mp3|https?:/i.test(srvAmostra.replace(/\/\/.*$/gm, '').replace(/"[^"\n]{40,}"/g, '"…"')), 'campo comercial no registro');
    assert.deepStrictEqual(Object.keys(amostra).sort(), ['aprovada', 'avisoInformativo', 'chamada', 'livroId', 'origemUniverso', 'outrosCapitulos', 'tituloTrecho', 'trecho', 'ttsDisponivel']);
    assert.ok(!/R\$|\d{2},\d{2}/.test(ler('templates/experimente-obra.html')));
  });
  await teste('H. a capa vem do catálogo (caminho da Loja) e existe em disco', async () => {
    assert.ok(html200().includes('src="/loja/capas/ela-tem-classe.jpg"'));
    assert.ok(fs.existsSync(path.join(raiz, 'public/loja/capas/ela-tem-classe.jpg')));
    const outra = renderizarExperimenteObra({ livroId: 'ela-tem-classe' }, { buscar: (id) => ({ ...buscarLivro(id), capa: '/loja/capas/alternativa.jpg' }), amostra: obterAmostra }).html;
    assert.ok(outra.includes('src="/loja/capas/alternativa.jpg"'));
  });

  console.log('\nContinue explorando e CTA final');
  await teste('P. "Continue explorando na obra": os 5 títulos reais, só títulos, fora do trecho, em chips', async () => {
    const h = html200();
    const titulos = ['Perfumes e Assinatura Feminina', 'O Poder das Cores', 'A Voz Elegante', 'Rotinas e Hábitos da Mulher Elegante', 'O Envelhecimento Elegante'];
    assert.deepStrictEqual([...amostra.outrosCapitulos], titulos);
    assert.ok(h.includes('<h2 id="explorar-titulo">Continue explorando na obra</h2>'));
    const lista = h.match(/<ul class="capitulos">([\s\S]*?)<\/ul>/)[1];
    assert.deepStrictEqual([...lista.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]), titulos);
    assert.ok(!/<a\b/.test(lista), 'chips não são links (sem falsa promessa de navegação)');
    const trechoHtml = h.match(/<div class="trecho" id="trecho">([\s\S]*?)<\/div>/)[1];
    titulos.forEach((t) => assert.ok(!trechoHtml.includes(t) && !amostra.trecho.includes(t), 'título dentro do trecho: ' + t));
    assert.ok(h.indexOf('Este é apenas um trecho da obra.') < h.indexOf('Continue explorando na obra') && h.indexOf('Continue explorando na obra') < h.indexOf('Continue a leitura'));
    if (obra) { // os títulos existem na obra, em capítulos fora do trecho
      for (const t of titulos) { const s = obra.find((x) => x.titulo.endsWith(t)); assert.ok(s, 'título inexistente na obra: ' + t); assert.ok(!['F1', 'V1C1'].includes(s.id)); }
    }
    assert.ok(/\.capitulos \{[^}]*flex-wrap: wrap/.test(ler('templates/experimente-obra.html')), 'chips quebram linha');
  });
  await teste('CTA final: "Continue a leitura" + Adquirir (preço do catálogo) + Voltar ao Universo Feminino', async () => {
    const h = html200();
    assert.ok(/<h2 id="continue-leitura">Continue a leitura<\/h2>/.test(h));
    const secao = h.match(/<section class="compra"[\s\S]*?<\/section>/)[0];
    assert.ok(secao.includes('Adquirir livro — R$ 34,90') && secao.includes('href="/loja/universo-feminino/">Voltar ao Universo Feminino</a>'));
  });
  await teste('J. checkout correto: livro=ela-tem-classe nos dois CTAs', async () => {
    const hrefs = [...html200().matchAll(/href="(\/checkout-livro\.html[^"]*)"/g)].map((m) => m[1]);
    assert.strictEqual(hrefs.length, 2);
    hrefs.forEach((u) => assert.ok(u.startsWith('/checkout-livro.html?livro=ela-tem-classe')));
  });

  console.log('\nOrigem e cupom');
  await teste('K. origem do Universo Feminino é preservada (topo e CTA final); sem origem na visita, nenhuma é inventada', async () => {
    const com = html200({ origem: 'universo-feminino' });
    assert.strictEqual((com.match(/href="\/checkout-livro\.html\?livro=ela-tem-classe&amp;origem=universo-feminino"/g) || []).length, 2);
    assert.ok(!html200().includes('origem='));
  });
  await teste('L. origem arbitrária é ignorada', async () => {
    for (const origem of ['evil', 'UNIVERSO-FEMININO', '<img src=x onerror=1>', ['universo-feminino'], '', 'universo-masculino']) {
      const h = html200({ origem });
      assert.ok(!h.includes('origem='), JSON.stringify(origem));
      assert.ok(!h.includes('evil') && !h.includes('onerror=1'));
    }
  });
  await teste('M. cupom válido é preservado (checkout e voltar); inválido é descartado', async () => {
    const h = html200({ origem: 'universo-feminino', cupom: 'SMOKE30' });
    assert.strictEqual((h.match(/livro=ela-tem-classe&amp;origem=universo-feminino&amp;cupom=SMOKE30/g) || []).length, 2);
    assert.ok(h.includes('href="/loja/universo-feminino/?cupom=SMOKE30"'));
    for (const cupom of ['"><script>', 'A'.repeat(41), 'a b', '']) assert.ok(!html200({ cupom }).includes('cupom='), cupom);
  });

  console.log('\nLeitura em voz (escopo)');
  await teste('I. "Ouvir este trecho" lê SOMENTE o trecho: o elemento lido contém só os 7 parágrafos aprovados', async () => {
    const h = html200();
    const script = ler('templates/experimente-obra.html').match(/<script>([\s\S]*?)<\/script>/)[1];
    assert.ok(/document\.getElementById\('trecho'\)\.innerText/.test(script));
    assert.strictEqual((script.match(/innerText/g) || []).length, 1); // única fonte de texto falado (textContent só atualiza rótulos da interface)
    assert.ok(script.includes('texto: texto') && script.includes("var texto = document.getElementById('trecho').innerText;"));
    const lido = h.match(/<div class="trecho" id="trecho">([\s\S]*?)<\/div>/)[1];
    const texto = lido.replace(/<[^>]+>/g, '\n').split('\n').map((x) => x.trim()).filter(Boolean).join('\n\n');
    const esperado = amostra.trecho.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    assert.strictEqual(texto, esperado);
    for (const fora of ['Adquirir', 'R$', 'Continue', 'Perfumes e Assinatura', 'Experimente ZUNI', 'Leia um trecho', 'Da aparência à presença', 'A diferença entre chamar atenção e permanecer', 'Voltar ao']) assert.ok(!lido.includes(fora), 'fora do trecho: ' + fora);
  });
  await teste('TTS: sem rede, sem áudio pronto, sem audiobook; o módulo de voz é o mesmo já testado na E2', async () => {
    const src = ler('public/js/experimente-tts.js').replace(/\/\/.*$/gm, '');
    for (const p of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'new Audio', 'audiobook', '.mp3']) assert.ok(!src.includes(p), p);
    assert.ok(!/<audio|<video|\.mp3|audiobook/i.test(html200()));
  });

  console.log('\nVitrine Universo Feminino');
  const vitrine = ler('public/loja/universo-feminino/index.html');
  await teste('N. "Experimentar" só aparece para obras que o catálogo marca com amostra (hoje, só Ela Tem Classe); é secundário ao "Adquirir"', async () => {
    assert.strictEqual((vitrine.match(/>Experimentar</g) || []).length, 1); // um único elemento, controlado por dado
    assert.ok(/id="det-experimentar" href="#" hidden>Experimentar<\/a>/.test(vitrine));
    assert.ok(/experimentar\.hidden = l\.amostraDisponivel !== true;/.test(vitrine));
    assert.ok(/<a class="btn btn-secundario" id="det-experimentar"/.test(vitrine) && /<a class="btn btn-primario" id="det-comprar"/.test(vitrine));
    assert.ok(vitrine.indexOf('id="det-experimentar"') < vitrine.indexOf('id="det-comprar"'), 'Adquirir fica por último (polegar)');
    const flags = Object.entries(CATALOGO).filter(([, l]) => l.departamento === 'Universo Feminino').map(([id, l]) => [id, l.amostraDisponivel === true]);
    assert.deepStrictEqual(flags.filter(([, f]) => f).map(([id]) => id), ['ela-tem-classe']);
    assert.strictEqual(flags.length, 5);
    assert.ok(!/Futuro: quando o catálogo tiver amostra/.test(vitrine));
  });
  await teste('O. o link do Experimente é /experimente/ela-tem-classe/?origem=universo-feminino (cupom repassado) e a rota o atende', async () => {
    const fn = vitrine.match(/function urlExperimente\(id\) \{[\s\S]*?\n  \}/)[0];
    const montar = (search) => new Function('window', 'URLSearchParams', 'ORIGEM', fn + '; return urlExperimente;')({ location: { search } }, URLSearchParams, 'universo-feminino');
    assert.strictEqual(montar('')('ela-tem-classe'), '/experimente/ela-tem-classe/?origem=universo-feminino');
    assert.strictEqual(montar('?cupom=SMOKE30')('ela-tem-classe'), '/experimente/ela-tem-classe/?origem=universo-feminino&cupom=SMOKE30');
    assert.strictEqual(renderizarExperimenteObra({ livroId: 'ela-tem-classe', origem: 'universo-feminino', cupom: 'SMOKE30' }).status, 200);
  });
  await teste('vitrine: preços continuam vindo da API (nenhum valor escrito) e nenhum evento novo de Pinterest', async () => {
    assert.ok(!/\d{2},\d{2}|R\$ ?\d/.test(vitrine));
    assert.deepStrictEqual([...vitrine.matchAll(/pintrk\(\s*'(\w+)'/g)].map((m) => m[1]), ['load', 'page']);
  });

  console.log('\nSegurança e custo zero')
  await teste('Q. nenhuma metadata privada exposta (storage, URLs de áudio, MP3), mesmo a obra tendo áudio privado e legado', async () => {
    const livro = buscarLivro('ela-tem-classe');
    assert.ok(livro.audiobookStorage && livro.audiobookUrl);
    const h = html200({ origem: 'universo-feminino', cupom: 'X1' });
    for (const p of [livro.audiobookStorage.bucket, livro.audiobookStorage.path, livro.audiobookUrl, 'audiobookStorage', 'audiobookUrl', 'audiobookPartes', 'supabase.co', '.mp3', 'zuni-audiobooks', 'bucket', livro.indicadoPara, livro.descricao.slice(0, 50), livro.resumo.slice(0, 50)]) assert.ok(!h.includes(p), 'vazou: ' + String(p).slice(0, 40));
  });
  await teste('R. nenhuma IA, RAG, chat, Mentor, banco, rede externa ou Pinterest na página nova', async () => {
    // E5: a única exceção permitida é o bloco da tag oficial do Pinterest (load + page); fora dele, nenhum pintrk.
    const h = html200().replace(/<!-- Pinterest Tag oficial[\s\S]*?<\/script>/, '').toLowerCase();
    for (const p of ['experimente-livro-chat', 'experimente-chat', 'api/', 'openai', 'anthropic', 'claude', 'supabase', 'embedding', 'mentor', 'livro-vivo', 'fetch(', 'xmlhttprequest', 'sendbeacon', 'pintrk', '<form', '<input', '<textarea', 'stripe']) assert.ok(!h.includes(p), p);
    assert.ok(!/<script[^>]+src="https?:/.test(h) && !/<link[^>]+href="https?:/.test(h));
    assert.deepStrictEqual([...html200().matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]), ['/js/experimente-tts.js']);
  });
  await teste('S. o endpoint de lead continua desativado (410, sem e-mail nem gravação)', async () => {
    assert.ok(/const LEAD_ENDPOINT_ATIVO = false;/.test(srv));
    const i = srv.indexOf("app.post('/api/experimente-capturar-lead'"), f = srv.indexOf('/**\n * POST /api/experimente-calcular-astrologia-b', i);
    let handler; const chamadas = { e: 0 };
    new Function('app', 'enviarResultadoNumerologia', 'registrarCaptura', 'registrarAcesso', 'LEAD_ENDPOINT_ATIVO', 'console', srv.slice(i, f))(
      { post: (r, h) => { handler = h; } }, async () => { chamadas.e++; return { sucesso: true }; }, async () => { chamadas.e++; }, () => { chamadas.e++; }, false, { error() {}, log() {} });
    let status; const res = { status(c) { status = c; return res; }, json() { return res; } };
    await handler({ body: { nomeCompleto: 'X', email: 'a@b.co' } }, res);
    assert.strictEqual(status, 410); assert.strictEqual(chamadas.e, 0);
  });
  await teste('T. a proteção do Mentor demo continua ativa (limiter de rajada, tamanho de mensagem, orçamento por IP e global, resposta sem tokens)', async () => {
    assert.ok(/app\.post\('\/api\/experimente-chat', criarLimiterMentorDemo\(\), async/.test(srv));
    assert.ok(/message\.length > MENSAGEM_MAX_CHARS/.test(srv) && /orcamentoDemo\.consumir\(extrairIpConfiavel\(req\)\)/.test(srv));
    assert.ok(!/tokens: \{ input: inputTokens/.test(srv) && !/custo: \{\s*moeda/.test(srv));
    const o = protecao.criarOrcamentoDemo({ limiteDiaPorIp: 2, limiteDiaGlobal: 3 });
    assert.ok(o.consumir('a').permitido && o.consumir('a').permitido); assert.strictEqual(o.consumir('a').motivo, 'ip');
    assert.ok(o.consumir('b').permitido); assert.strictEqual(o.consumir('c').motivo, 'global');
    assert.strictEqual(protecao.MENSAGEM_MAX_CHARS, 500);
  });
  await teste('rota: /experimente/:livroId convive com o legado /experimente; resposta 200 pública e 404 sem cache', async () => {
    assert.ok(/app\.get\('\/experimente', \(req, res\) => \{\s*res\.sendFile/.test(srv));
    assert.ok(/app\.get\('\/experimente\/:livroId'/.test(srv));
    assert.ok(/resultado\.status === 200 \? 'public, max-age=60' : 'no-store'/.test(srv));
    assert.ok(!/permitirPlaceholder/.test(srv));
    assert.ok(ler('public/experimente.html').includes('Capítulo 1 — O cérebro que reage antes de pensar')); // legado intacto
  });
  await teste('microajuste 1: "Ouvir este trecho" fica logo abaixo de "Da aparência à presença" e ANTES do primeiro parágrafo; o TTS segue lendo só o trecho', async () => {
    const h = html200();
    const iTitulo = h.indexOf('<h3>Da aparência à presença</h3>'), iOuvir = h.indexOf('id="btn-ouvir"'), iTrecho = h.indexOf('id="trecho"'), iPrimeiroP = h.indexOf('<p>Existe uma diferença profunda');
    assert.ok(iTitulo > 0 && iTitulo < iOuvir && iOuvir < iTrecho && iTrecho < iPrimeiroP, 'ordem: título → ouvir → trecho → 1º parágrafo');
    assert.ok(!h.slice(h.indexOf('Este é apenas um trecho da obra.')).includes('id="btn-ouvir"'), 'o controle não fica mais depois do trecho');
    assert.strictEqual((h.match(/id="btn-ouvir"/g) || []).length, 1);
    const lido = h.match(/<div class="trecho" id="trecho">([\s\S]*?)<\/div>/)[1];
    assert.ok(!/btn-ouvir|Ouvir este trecho|ouvir-status/.test(lido), 'o controle não está dentro do elemento lido');
    const texto = lido.replace(/<[^>]+>/g, '\n').split('\n').map((x) => x.trim()).filter(Boolean).join('\n\n');
    assert.strictEqual(texto, amostra.trecho); // continua sendo exatamente o trecho aprovado (422 palavras)
    assert.strictEqual(palavras(texto), 422);
  });
  await teste('microajuste 2: rodapé exatamente "Livro digital • acesso após a confirmação do pagamento"; texto antigo removido; nada mais mudou', async () => {
    const h = html200();
    assert.ok(h.includes('<footer>Livro digital • acesso após a confirmação do pagamento</footer>'));
    assert.ok(!/Produto 100% digital|sem envio físico|O acesso chega por link/.test(h));
    assert.strictEqual((h.match(/<footer>/g) || []).length, 1);
    for (const t of ['Continue explorando na obra', 'Continue a leitura', 'Este é apenas um trecho da obra.', 'Voltar ao Universo Feminino', 'Da aparência à presença', 'A diferença entre chamar atenção e permanecer na memória de alguém.']) assert.ok(h.includes(t), t);
  });
  await teste('acessibilidade: headings, alt da capa, botões reais, região de status do TTS', async () => {
    const h = html200();
    assert.strictEqual((h.match(/<h1>/g) || []).length, 1);
    assert.deepStrictEqual([...h.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]), ['Leia um trecho', 'Continue explorando na obra', 'Continue a leitura']);
    assert.ok(h.includes('alt="Capa de Ela Tem Classe"') && /<button class="btn" type="button" id="btn-ouvir"/.test(h) && /role="status" aria-live="polite"/.test(h));
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok}${pulados ? ` (${pulados} pulados: flipbook ausente)` : ''} | Falharam: ${total - ok}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — E3B: Ela Tem Classe publicável localmente; trecho idêntico à obra; sem vazamento; custo zero.');
})();
