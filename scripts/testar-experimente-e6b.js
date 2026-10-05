// Teste local (sem rede, sem Supabase, sem Stripe, sem Pinterest real, sem IA, sem Google Cloud) da E6B — amostra OFICIAL
// do audiobook de Ela Tem Classe no Experimente ZUNI (arquivo curto estático; o áudio integral nunca toca a página).
// Uso: node scripts/testar-experimente-e6b.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

const raiz = path.join(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const { CATALOGO, buscarLivro } = require(path.join(raiz, 'src/lib/catalogoLivros'));
const { AMOSTRAS, obterAmostra } = require(path.join(raiz, 'src/lib/amostrasExperimente'));
const { renderizarExperimenteObra, PAGINA_INDISPONIVEL } = require(path.join(raiz, 'src/lib/experimenteObra'));

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); ok++; console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); }
}

const ARQ_REL = 'public/audio/amostras/ela-tem-classe.mp3';
const ARQ = path.join(raiz, ARQ_REL);
const URL_AMOSTRA = '/audio/amostras/ela-tem-classe.mp3';
const amostra = obterAmostra('ela-tem-classe');
const livro = buscarLivro('ela-tem-classe');
const render = (params = {}, deps = {}) => renderizarExperimenteObra({ livroId: 'ela-tem-classe', ...params }, deps);
const pagina = render().html;
const template = ler('templates/experimente-obra.html');
const visivel = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const palavras = (t) => t.trim().split(/\s+/).filter(Boolean).length;

function ffprobe() {
  const base = path.join(raiz, 'node_modules/ffprobe-static/bin');
  const achados = [];
  (function varrer(d) { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) varrer(p); else if (/^ffprobe(\.exe)?$/.test(e.name)) achados.push(p); } })(base);
  const alvo = achados.find((p) => p.includes(process.platform)) || achados[0];
  assert.ok(alvo, 'ffprobe-static não encontrado');
  const r = spawnSync(alvo, ['-v', 'error', '-show_entries', 'format=duration,bit_rate:stream=codec_name,sample_rate,channels:format_tags', '-of', 'json', ARQ], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, 'ffprobe falhou');
  return JSON.parse(r.stdout);
}

(async () => {
  console.log('E6B — amostra oficial do audiobook (Ela Tem Classe)\n');

  console.log('Arquivo da amostra');
  await teste('existe, ≤ 2 MB, não é o áudio integral (o integral tem ~7,1 MB)', async () => {
    const st = fs.statSync(ARQ);
    assert.ok(st.isFile() && st.size > 100 * 1024 && st.size <= 2 * 1024 * 1024, 'tamanho: ' + st.size);
  });
  await teste('MP3 válido (quadro MPEG), mono, 22.050 Hz, duração 60–90 s', async () => {
    const buf = fs.readFileSync(ARQ);
    assert.ok(buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0, 'começa em um quadro MPEG');
    const p = ffprobe();
    const s = p.streams[0];
    assert.strictEqual(s.codec_name, 'mp3'); assert.strictEqual(s.channels, 1); assert.strictEqual(String(s.sample_rate), '22050');
    const dur = parseFloat(p.format.duration);
    assert.ok(dur >= 60 && dur <= 90, 'duração ' + dur);
    assert.ok(Math.abs(dur - amostra.audioAmostra.duracaoSegundos) <= 3, 'duração declarada próxima da real');
  });
  await teste('sem ID3 (nem v2 no início, nem v1 no fim) e sem metadados de formato', async () => {
    const buf = fs.readFileSync(ARQ);
    assert.notStrictEqual(buf.slice(0, 3).toString('latin1'), 'ID3');
    assert.notStrictEqual(buf.slice(buf.length - 128, buf.length - 125).toString('latin1'), 'TAG');
    const tags = ffprobe().format.tags || {};
    assert.deepStrictEqual(Object.keys(tags), []);
  });
  await teste('decodificação completa sem erro', async () => {
    const ff = require(path.join(raiz, 'node_modules/ffmpeg-static'));
    const r = spawnSync(ff, ['-v', 'error', '-i', ARQ, '-f', 'null', '-'], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0); assert.strictEqual((r.stderr || '').trim(), '');
  });
  await teste('o arquivo não contém caminho, UUID, token, URL ou bucket (varredura de strings)', async () => {
    const txt = fs.readFileSync(ARQ).toString('latin1');
    assert.ok(!/supabase|storage|bucket|token|https?:|audiolivros|zuni-audiobooks|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(txt));
  });

  console.log('\nRegistro editorial (fail-closed)');
  await teste('registro: só aprovada/arquivo/duração; caminho público exato; sem duplicar preço, título, capa ou checkout', async () => {
    assert.deepStrictEqual(Object.keys(amostra.audioAmostra).sort(), ['aprovada', 'arquivo', 'duracaoSegundos']);
    assert.strictEqual(amostra.audioAmostra.arquivo, URL_AMOSTRA); assert.strictEqual(amostra.audioAmostra.aprovada, true);
    assert.strictEqual(amostra.ttsDisponivel, false);
  });
  await teste('fail-closed: sem aprovação, sem audiobook no catálogo, caminho diferente ou arquivo ausente → sem bloco de áudio (a página continua 200)', async () => {
    const semBloco = (h) => !h.includes('id="audio-amostra"') && !h.includes('<audio') && !h.includes('.mp3') && !h.includes('Ouça um trecho do audiobook');
    assert.ok(semBloco(render({}, { amostra: () => ({ ...amostra, audioAmostra: { ...amostra.audioAmostra, aprovada: false } }) }).html));
    assert.ok(semBloco(render({}, { amostra: () => ({ ...amostra, audioAmostra: { ...amostra.audioAmostra, aprovada: 'true' } }) }).html));
    assert.ok(semBloco(render({}, { amostra: () => ({ ...amostra, audioAmostra: undefined }) }).html));
    assert.ok(semBloco(render({}, { buscar: (id) => ({ ...buscarLivro(id), audiobookDisponivel: false }) }).html));
    assert.ok(semBloco(render({}, { amostra: () => ({ ...amostra, audioAmostra: { ...amostra.audioAmostra, arquivo: '/audio/amostras/outro.mp3' } }) }).html));
    assert.ok(semBloco(render({}, { amostra: () => ({ ...amostra, audioAmostra: { ...amostra.audioAmostra, arquivo: 'https://x.test/a.mp3' } }) }).html));
    assert.ok(semBloco(render({}, { arquivoExiste: () => false }).html));
    assert.strictEqual(render({}, { arquivoExiste: () => false }).status, 200);
  });
  await teste('sem amostra de áudio e sem TTS (fail-closed total): não há seção de áudio alguma; o resto da página segue igual', async () => {
    const h = render({}, { arquivoExiste: () => false }).html;
    assert.ok(!/Ouça um trecho|btn-ouvir|id="ouvir"|audio-player/.test(h));
    assert.ok(h.includes('Leia um trecho da obra') && h.includes('Adquirir livro — R$ 34,90'));
  });
  await teste('404 / fail-closed da página preservados (mesma resposta para tudo que não é publicável)', async () => {
    for (const id of ['inexistente', 'a-mulher-que-permanece-inteira', 'constructor', '../x', '']) assert.deepStrictEqual(render({ livroId: id }), { status: 404, html: PAGINA_INDISPONIVEL }, id);
    assert.strictEqual(render({}, { amostra: () => ({ ...amostra, aprovada: false }) }).status, 404);
  });

  console.log('\nPágina (Ela Tem Classe)');
  await teste('bloco oficial: título, texto e botão aprovados; vem antes da leitura; sem autoplay', async () => {
    assert.ok(pagina.includes('<h2 id="audio-titulo" class="secao-titulo">Ouça um trecho do audiobook</h2>'));
    assert.ok(pagina.includes('<p class="secao-texto">Conheça uma amostra da versão narrada de Ela Tem Classe.</p>'));
    assert.ok(pagina.includes('<span id="audio-rotulo">Ouvir amostra</span>'));
    assert.ok(pagina.indexOf('id="audio-titulo"') < pagina.indexOf('id="leia-titulo"'));
    assert.ok(visivel(pagina).includes('Cerca de 1 minuto'));
    assert.ok(!/autoplay/i.test(pagina.match(/<audio[^>]*>/)[0]), 'sem atributo autoplay no elemento');
    assert.ok(!/autoplay/i.test(pagina.replace(/\/\/.*$/gm, '')), 'nenhum autoplay no código (comentários à parte)');
    // o único .play() do script está dentro do handler de clique
    const js = pagina.match(/<script>\s*\/\/ Amostra do audiobook[\s\S]*?<\/script>/)[0];
    const iClique = js.indexOf("tocar.addEventListener('click'");
    assert.ok(iClique > 0 && js.indexOf('.play()') > iClique);
  });
  await teste('funciona sem JavaScript: <audio controls preload="none"> nativo com o arquivo curto e texto de fallback; a interface JS fica oculta', async () => {
    assert.ok(/<audio id="audio-player" controls preload="none" src="\/audio\/amostras\/ela-tem-classe\.mp3">/.test(pagina));
    assert.ok(/<div class="audio-ui" id="audio-ui" hidden>/.test(pagina), 'JS revela; sem JS permanece oculta');
    assert.ok(/\.ouvir-audio\.com-js audio \{ display: none; \}/.test(template), 'só esconde o player nativo depois que o JS assumiu');
  });
  await teste('controles ≥ 44px (botões .btn 48px) e acessíveis: botão real, aria-label, status em região viva, foco visível', async () => {
    assert.ok(/\.btn \{[^}]*min-height: 48px/.test(template));
    assert.ok(/\.ouvir-audio audio \{[^}]*min-height: 48px/.test(template));
    assert.ok(/<button class="btn btn-audio" type="button" id="audio-tocar" aria-label="Ouvir amostra">/.test(pagina));
    assert.ok(/id="audio-status" role="status" aria-live="polite"/.test(pagina) && /:focus-visible/.test(template));
  });
  await teste('sem jargão técnico/comercial indevido na seção: nada de narradora, voz humana, IA, Google Cloud, TTS ou voz sintética', async () => {
    const bloco = pagina.match(/<section class="ouvir-audio"[\s\S]*?<\/section>/)[0];
    assert.ok(!/narradora|voz humana|\bIA\b|Google|\bTTS\b|sintétic|robô|computador/i.test(visivel(bloco)));
  });
  await teste('TTS (voz do navegador) NÃO aparece para Ela: nem bloco, nem módulo, nem script, nem texto; infraestrutura genérica continua disponível', async () => {
    assert.ok(!/btn-ouvir|id="ouvir"|data-tts|Ouça um trecho da obra|Ouvir este trecho|speechSynthesis|experimente-tts/.test(pagina));
    assert.deepStrictEqual([...pagina.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]), []);
    const variante = render({}, { amostra: () => ({ ...amostra, ttsDisponivel: true, audioAmostra: undefined }) }).html;
    assert.ok(variante.includes('id="btn-ouvir"') && variante.includes('/js/experimente-tts.js') && !variante.includes('audio-player'));
    assert.ok(fs.existsSync(path.join(raiz, 'public/js/experimente-tts.js')));
  });
  await teste('leitura: título, chamada e trecho aprovado intactos — 7 parágrafos, 422 palavras, idêntico ao registro', async () => {
    assert.ok(pagina.includes('<h2 id="leia-titulo" class="secao-titulo">Leia um trecho da obra</h2>') && pagina.includes('Conheça algumas páginas de Ela Tem Classe.'));
    assert.ok(pagina.includes('<h3>Da aparência à presença</h3>'));
    const dentro = pagina.match(/<div class="trecho" id="trecho">([\s\S]*?)<\/div>/)[1];
    assert.strictEqual((dentro.match(/<p>/g) || []).length, 7);
    const t = [...dentro.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')).join('\n\n');
    assert.strictEqual(t, amostra.trecho);
    assert.strictEqual(palavras(t), 422);
    assert.ok(!/id="audio/.test(dentro));
  });
  await teste('temas: lista editorial com os 5 títulos, sem links, botões ou pills (E6A preservada)', async () => {
    const lista = pagina.match(/<ul class="temas-lista">([\s\S]*?)<\/ul>/)[1];
    assert.deepStrictEqual([...lista.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]), ['Perfumes e Assinatura Feminina', 'O Poder das Cores', 'A Voz Elegante', 'Rotinas e Hábitos da Mulher Elegante', 'O Envelhecimento Elegante']);
    assert.ok(!/<a\b|<button|onclick|role="button"/.test(lista));
  });
  await teste('formatos: livro digital sem promessa de baixar/salvar/PDF/permanente/30 dias; audiobook só como opção adicional, sem venda avulsa', async () => {
    const s = pagina.match(/<section class="opcoes"[\s\S]*?<\/section>/)[0];
    assert.deepStrictEqual([...s.match(/<h3>Livro digital<\/h3>\s*<ul>([\s\S]*?)<\/ul>/)[1].matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]), ['Leia na tela do seu aparelho.', 'Depois da compra, você recebe as orientações de acesso.']);
    assert.ok(!/baixar|salvar|pdf|permanente|definitiv|30 dias|vital[ií]ci|ilimitad|para sempre/i.test(visivel(pagina)));
    assert.ok(s.includes('<h3>Audiobook (opção adicional)</h3>') && s.includes('você poderá acrescentá-la durante a compra do livro.'));
    assert.ok(!/comprar (o )?audiobook|audiobook avulso|apenas o audiobook|só o audiobook|R\$[^<]*audiobook/i.test(visivel(s)));
  });
  await teste('pagamento: texto aprovado, didático, sem Stripe/token/webhook/HTML/storage', async () => {
    const s = pagina.match(/<section class="seguro"[\s\S]*?<\/section>/)[0];
    assert.strictEqual(visivel(s), 'Compra simples e segura Escolha sua opção e faça o pagamento com cartão em ambiente seguro. Após a confirmação, você receberá as orientações para acessar sua compra. Você faz tudo aqui, nesta página, de forma simples e segura.');
    assert.ok(!/stripe|token|webhook|html|storage/i.test(visivel(s)));
  });
  await teste('CTA e preço: vêm do catálogo (R$ 34,90), checkout/origem/cupom preservados; sem promoção nem preço riscado', async () => {
    const preco = livro.precoPromocional || livro.preco;
    assert.strictEqual(preco, 34.9);
    assert.ok(pagina.includes('Adquirir livro — R$ 34,90'));
    const alterado = render({}, { buscar: (id) => ({ ...buscarLivro(id), preco: 41.5, precoPromocional: undefined }) }).html;
    assert.ok(alterado.includes('Adquirir livro — R$ 41,50') && !alterado.includes('34,90'));
    assert.ok(render({ origem: 'universo-feminino', cupom: 'X1' }).html.includes('href="/checkout-livro.html?livro=ela-tem-classe&amp;origem=universo-feminino&amp;cupom=X1"'));
    assert.ok(!render({ origem: 'evil' }).html.includes('origem='));
    assert.ok(!/<s>|<del>|line-through|de R\$|por R\$/.test(pagina));
  });

  console.log('\nSegurança');
  await teste('nada do áudio integral na página: sem storage/bucket/signed URL/token/UUID/URL legada; a única mídia é a amostra curta', async () => {
    const privados = [livro.audiobookStorage && livro.audiobookStorage.bucket, livro.audiobookStorage && livro.audiobookStorage.path, livro.audiobookUrl, 'audiobookStorage', 'audiobookUrl', 'audiobookPartes', 'supabase', 'zuni-audiobooks', 'audiolivros', 'bucket', 'signed', 'token=', 'sk_', 'whsec', 'service_role'].filter(Boolean);
    for (const p of privados) assert.ok(!pagina.includes(p), 'vazou: ' + String(p).slice(0, 30));
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(pagina), 'UUID na página');
    assert.deepStrictEqual([...pagina.matchAll(/[^"'\s=(]*\.mp3/g)].map((m) => m[0]), [URL_AMOSTRA]);
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(visivel(pagina)), 'e-mail visível');
  });
  await teste('rota pública da amostra não passa por entrega do audiobook comprado (/audiolivros/...) e não referencia o catálogo privado', async () => {
    assert.ok(!/audiolivros/.test(pagina) && !/audiolivros/.test(JSON.stringify(amostra)));
    const fonte = ler('src/lib/experimenteObra.js');
    assert.ok(!/audiobookStorage|audiobookUrl|audiobookPartes|gerarUrlAssinada|audiolivroStorage/.test(fonte.replace(/\/\/.*$/gm, '')));
    assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(template.replace(/\/\/.*$/gm, '')));
  });
  await teste('nenhuma outra obra ganha áudio: só Ela tem audioAmostra; as demais do Universo Feminino seguem sem Experimente', async () => {
    assert.deepStrictEqual(Object.keys(AMOSTRAS), ['ela-tem-classe']);
    assert.deepStrictEqual(Object.entries(CATALOGO).filter(([, l]) => l.amostraDisponivel === true).map(([id]) => id), ['ela-tem-classe']);
    const pub = path.join(raiz, 'public/audio'); const mp3 = [];
    (function varrer(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) varrer(p); else mp3.push(path.relative(pub, p).replace(/\\/g, '/')); } })(pub);
    assert.deepStrictEqual(mp3, ['amostras/ela-tem-classe.mp3'], 'public/audio só contém a amostra curta');
  });
  await teste('Pinterest/checkout intocados: a página ainda só tem load + page; nenhum evento por ouvir/clicar', async () => {
    assert.strictEqual((pagina.match(/pintrk\(/g) || []).length, 2);
    assert.ok(!/pintrk\([^)]*(audio|ouvir|play|amostra)/i.test(pagina));
    const player = pagina.match(/<script>\s*\/\/ Amostra do audiobook[\s\S]*?<\/script>/)[0];
    assert.ok(!/pintrk|Pinterest|fetch|sendBeacon|XMLHttpRequest/.test(player));
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${total - ok}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — E6B: amostra oficial curta, fail-closed, sem TTS comercial, sem exposição do integral.');
})();
