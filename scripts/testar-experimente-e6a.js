// Teste local (sem rede, sem Stripe, sem Pinterest real, sem banco, sem IA) da E6A — clareza comercial e UX da página
// /experimente/ela-tem-classe/ para público frio (inclusive pessoas maduras ou pouco familiarizadas com o digital).
// Uso: node scripts/testar-experimente-e6a.js
//
// Garante: seções OUÇA / LEIA / temas / como aproveitar / compra segura com os textos aprovados; trecho intacto (422
// palavras); temas sem aparência de link; audiobook só como OPÇÃO ADICIONAL; nenhuma promessa de PDF, cópia
// permanente, download definitivo ou prazo; nenhum termo técnico nem selo de segurança inventado; preço, checkout,
// origem, Pinterest e TTS preservados; nada de obra integral, storage ou áudio privado.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

const html = (params = {}, deps = {}) => { const r = renderizarExperimenteObra({ livroId: 'ela-tem-classe', ...params }, deps); assert.strictEqual(r.status, 200); return r.html; };
const pagina = html();
const template = ler('templates/experimente-obra.html');
const amostra = obterAmostra('ela-tem-classe');
const livro = buscarLivro('ela-tem-classe');
// E6B: Ela usa a amostra oficial do audiobook; a voz do navegador (E6A) vale para obras sem audiobook — variante da mesma obra.
const htmlTtsVariante = renderizarExperimenteObra({ livroId: 'ela-tem-classe' }, { amostra: () => ({ ...amostra, ttsDisponivel: true, audioAmostra: undefined }) }).html;
const palavras = (t) => t.trim().split(/\s+/).filter(Boolean).length;
// Texto que a pessoa realmente vê: sem <style>, <script>, comentários e tags.
const visivel = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const texto = visivel(pagina);
const secao = (id) => { const m = pagina.match(new RegExp(`<section[^>]*aria-labelledby="${id}"[\\s\\S]*?</section>`)); assert.ok(m, 'seção ausente: ' + id); return m[0]; };

(async () => {
  console.log('E6A — clareza comercial e UX do Experimente (Ela Tem Classe)\n');

  console.log('Ouça / Leia');
  await teste('"OUÇA UM TRECHO DA OBRA" com o texto aprovado, ANTES do controle de áudio e antes da leitura', async () => {
    const v = htmlTtsVariante; // variante sem audiobook oficial (voz do navegador)
    assert.ok(v.includes('<h2 id="ouca-titulo" class="secao-titulo">Ouça um trecho da obra</h2>'));
    assert.ok(v.includes('<p class="secao-texto">Experimente uma amostra em áudio de Ela Tem Classe.</p>'));
    const iTitulo = v.indexOf('id="ouca-titulo"'), iBtn = v.indexOf('id="btn-ouvir"'), iLeia = v.indexOf('id="leia-titulo"');
    assert.ok(iTitulo > 0 && iTitulo < iBtn && iBtn < iLeia, 'ouça → controle → leia');
    assert.ok(/text-transform: uppercase/.test(template.match(/\.secao-titulo \{[^}]*\}/)[0]), 'títulos de seção em caixa-alta (visual)');
  });
  // E6B substituiu a demonstração por voz do navegador (E6A) pela amostra oficial do audiobook para Ela Tem Classe.
  // A estrutura de voz do navegador continua válida para obras SEM audiobook (variante abaixo).
  await teste('E6B: o áudio é a amostra oficial do audiobook ("amostra da versão narrada"), sem jargão técnico', async () => {
    const bloco = pagina.match(/<section class="ouvir-audio"[\s\S]*?<\/section>/)[0];
    assert.ok(/Ouça um trecho do audiobook/.test(bloco) && /Conheça uma amostra da versão narrada de Ela Tem Classe\./.test(bloco));
    assert.ok(!/narradora|voz humana|\bIA\b|Google|\bTTS\b|sintétic/i.test(visivel(bloco)));
  });
  await teste('variante sem audiobook oficial: a seção de voz do navegador (título, texto e controle) fica oculta até o aparelho ter voz', async () => {
    const bloco = htmlTtsVariante.match(/<div class="ouvir" id="ouvir" data-tts="1" hidden>[\s\S]*?<\/div>\s*\n\s*<section class="leitura"/);
    assert.ok(bloco, 'título, texto e controle estão dentro do contêiner oculto');
    assert.ok(bloco[0].includes('id="ouca-titulo"') && bloco[0].includes('id="btn-ouvir"') && bloco[0].includes('role="status"'));
    assert.ok(/caixa\.hidden = false;/.test(template) && /if \(!synth \|\| !Utterance\) return;/.test(template));
    assert.ok(!pagina.includes('id="ouvir"'), 'Ela Tem Classe não tem o bloco de voz do navegador');
  });
  await teste('"LEIA UM TRECHO DA OBRA" com o texto aprovado, antes do título do trecho e do trecho', async () => {
    assert.ok(pagina.includes('<h2 id="leia-titulo" class="secao-titulo">Leia um trecho da obra</h2>'));
    assert.ok(pagina.includes('<p class="secao-texto">Conheça algumas páginas de Ela Tem Classe.</p>'));
    assert.ok(pagina.indexOf('id="leia-titulo"') < pagina.indexOf('<h3>Da aparência à presença</h3>') && pagina.indexOf('<h3>Da aparência à presença</h3>') < pagina.indexOf('id="trecho"'));
  });
  await teste('o trecho segue exatamente o aprovado: 422 palavras, 7 parágrafos, nenhum outro parágrafo da obra', async () => {
    assert.strictEqual(palavras(amostra.trecho), 422);
    const dentro = pagina.match(/<div class="trecho" id="trecho">([\s\S]*?)<\/div>/)[1];
    assert.strictEqual((dentro.match(/<p>/g) || []).length, 7);
    const escapar = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    amostra.trecho.split('\n\n').forEach((p) => assert.ok(dentro.includes(escapar(p))));
    assert.ok(pagina.includes('<p class="fim-trecho">Este é apenas um trecho da obra.</p>'));
    assert.ok(!/Capítulo 2|A Psicologia da Presença Feminina/.test(pagina));
  });

  console.log('\nTemas da obra');
  await teste('"VOCÊ TAMBÉM ENCONTRARÁ NESTA OBRA" + "Entre os temas abordados em Ela Tem Classe:" + os 5 temas exatos', async () => {
    const s = secao('temas-titulo');
    assert.ok(s.includes('>Você também encontrará nesta obra</h2>'));
    assert.ok(s.includes('Entre os temas abordados em Ela Tem Classe:'));
    assert.deepStrictEqual([...s.matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]), ['Perfumes e Assinatura Feminina', 'O Poder das Cores', 'A Voz Elegante', 'Rotinas e Hábitos da Mulher Elegante', 'O Envelhecimento Elegante']);
    assert.ok(!pagina.includes('Continue explorando na obra'), 'rótulo antigo removido');
    assert.ok(pagina.indexOf('Este é apenas um trecho da obra.') < pagina.indexOf('id="temas-titulo"'));
  });
  await teste('os temas NÃO são links nem botões e não têm aparência clicável (sem pílula, sem cursor, sem foco, sem papel)', async () => {
    const s = secao('temas-titulo');
    assert.ok(!/<a\b|<button|href=|onclick|role=|tabindex|data-/.test(s), 'marcação clicável');
    const css = template.match(/\.temas-lista[^{]*\{[^}]*\}/g).join('\n');
    assert.ok(!/cursor|border-radius|background|box-shadow|:hover/.test(css.replace(/border-radius: 50%; background: var\(--dourado\)/, '')), 'estilo de botão/chip: ' + css);
    assert.ok(!/\.capitulos|chip/.test(template));
    assert.ok(!/<ul class="temas-lista"[^>]*role=/.test(pagina));
  });
  await teste('os temas continuam sendo só títulos: nenhuma descrição, nenhum texto de outro capítulo', async () => {
    const s = secao('temas-titulo');
    assert.strictEqual(visivel(s), 'Você também encontrará nesta obra Entre os temas abordados em Ela Tem Classe: Perfumes e Assinatura Feminina O Poder das Cores A Voz Elegante Rotinas e Hábitos da Mulher Elegante O Envelhecimento Elegante');
  });

  console.log('\nComo aproveitar a obra (verdade comercial)');
  await teste('"COMO VOCÊ PODE APROVEITAR ESTA OBRA": livro digital — ler na tela, orientações após a compra, baixar/salvar hoje', async () => {
    const s = secao('opcoes-titulo');
    assert.ok(s.includes('>Como você pode aproveitar esta obra</h2>'));
    assert.deepStrictEqual([...s.match(/<h3>Livro digital<\/h3>\s*<ul>([\s\S]*?)<\/ul>/)[1].matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]), [
      'Leia na tela do seu aparelho.']); // E6B: removidos "baixar ou salvar" e, após a compra real, "Depois da compra, você recebe as orientações de acesso."
    assert.ok(!/baixar|salvar/i.test(s));
  });
  await teste('nenhuma promessa de PDF, cópia permanente, download definitivo, prazo (30 dias) ou acesso vitalício', async () => {
    const proibidos = /pdf|permanente|definitiv|30 dias|trinta dias|vital[ií]ci|para sempre|ilimitad|sem prazo|cópia|copia|imprim/i;
    assert.ok(!proibidos.test(texto), 'promessa: ' + (texto.match(proibidos) || [])[0]);
    assert.ok(!proibidos.test(template.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<style[\s\S]*?<\/style>/, '').replace(/<script[\s\S]*?<\/script>/g, '')), 'nem no template');
  });
  await teste('audiobook só como OPÇÃO ADICIONAL à compra do livro: sem venda avulsa, sem preço duplicado, sem link, sem player', async () => {
    const s = secao('opcoes-titulo');
    assert.ok(s.includes('<h3>Audiobook (opção adicional)</h3>'));
    assert.ok(s.includes('<p>Existe uma versão em áudio de Ela Tem Classe. Se desejar, você poderá acrescentá-la durante a compra do livro.</p>'));
    assert.ok(!/somente o audiobook|apenas o audiobook|só o audiobook|compre o audiobook|comprar o audiobook|audiobook avulso|avulso|separadamente|sem o livro/i.test(texto));
    assert.ok(!/19,90|24,90|R\$ ?\d+,\d{2}[^.]*audio/i.test(s), 'sem preço do audiobook na seção (o checkout é a autoridade)');
    assert.ok(!/<a\b|<audio|<video|href=/.test(s));
    // o bloco acompanha o catálogo: obra sem audiobook não o anuncia
    const semAudio = html({}, { buscar: (id) => ({ ...buscarLivro(id), audiobookDisponivel: false }), amostra: obterAmostra });
    assert.ok(!semAudio.includes('Audiobook (opção adicional)') && !/versão em áudio/.test(visivel(semAudio)));
    assert.ok(semAudio.includes('<h3>Livro digital</h3>'));
  });
  await teste('as outras obras seguem 404 e o preço/CTA continuam vindo do catálogo (R$ 34,90)', async () => {
    for (const id of Object.keys(CATALOGO)) if (id !== 'ela-tem-classe') assert.strictEqual(renderizarExperimenteObra({ livroId: id }).html, PAGINA_INDISPONIVEL, id);
    assert.strictEqual((pagina.match(/Adquirir livro — R\$ 34,90/g) || []).length, 2);
    assert.ok(!/R\$|\d{2},\d{2}/.test(template));
    assert.ok(html({}, { buscar: (id) => ({ ...buscarLivro(id), preco: 41.9 }), amostra: obterAmostra }).includes('Adquirir livro — R$ 41,90'));
  });

  console.log('\nCompra simples e segura');
  await teste('"COMPRA SIMPLES E SEGURA" com o texto aprovado', async () => {
    const s = secao('seguro-titulo');
    assert.ok(s.includes('>Compra simples e segura</h2>'));
    assert.strictEqual(visivel(s), 'Compra simples e segura Escolha sua opção e faça o pagamento com cartão em ambiente seguro. Após a confirmação, você receberá as orientações para acessar sua compra. Você faz tudo aqui, nesta página, de forma simples e segura.');
    assert.ok(pagina.indexOf('id="seguro-titulo"') < pagina.indexOf('id="continue-leitura"'), 'antes do CTA final');
  });
  await teste('sem termos técnicos nem selos de segurança inventados em nenhum texto visível', async () => {
    assert.ok(!/stripe|token|html|supabase|storage|webhook|\bapi\b|infraestrutura|servidor|checkout|flipbook|\.js\b|json|railway|resend/i.test(texto), 'termo técnico: ' + (texto.match(/stripe|token|html|supabase|storage|webhook|\bapi\b|infraestrutura|servidor|checkout|flipbook|json|railway|resend/i) || [])[0]);
    assert.ok(!/certific|\bpci\b|\bssl\b|\btls\b|criptograf|100% seguro|totalmente seguro|garantia|garantid|selo|norton|google safe/i.test(texto), 'selo/certificação inventada');
  });

  console.log('\nCTA, origem, Pinterest e TTS preservados')
  await teste('um único botão de compra (primário) + atalho de texto no topo; "Voltar ao Universo Feminino" mantido; sem CTA de audiobook', async () => {
    assert.strictEqual((pagina.match(/class="btn btn-primario"/g) || []).length, 1);
    assert.strictEqual((pagina.match(/href="\/checkout-livro\.html[^"]*"/g) || []).length, 2);
    assert.ok(pagina.includes('class="compra-topo"') && pagina.includes('>Voltar ao Universo Feminino</a>') && pagina.includes('id="continue-leitura">Gostou da experiência? Continue a leitura.</h2>'));
    assert.ok(!/livro=ela-tem-classe&amp;audio|audiolivro/i.test(pagina));
  });
  await teste('origem e cupom preservados; origem arbitrária ignorada', async () => {
    const h = html({ origem: 'universo-feminino', cupom: 'SMOKE30' });
    assert.strictEqual((h.match(/livro=ela-tem-classe&amp;origem=universo-feminino&amp;cupom=SMOKE30/g) || []).length, 2);
    assert.ok(!html({ origem: 'evil' }).includes('origem='));
  });
  await teste('Pinterest preservado: só o bloco oficial (load + page), depois do conteúdo; nenhum evento novo', async () => {
    assert.deepStrictEqual([...pagina.matchAll(/pintrk\(\s*'(\w+)'/g)].map((m) => m[1]), ['load', 'page']);
    assert.ok(pagina.includes("pintrk('load', '2612519382245')"));
    assert.ok(pagina.indexOf('id="seguro-titulo"') < pagina.indexOf('<!-- Pinterest Tag oficial'));
    assert.ok(!/addtocart|pintrk\(\s*'track'/i.test(pagina.replace(/<!--[\s\S]*?-->/g, '')));
  });
  await teste('TTS preservado: mesmo módulo, mesmos ids e rótulo; lê só o #trecho', async () => {
    // E6B: módulo preservado para obras sem audiobook (variante); Ela Tem Classe não exibe o bloco.
    const v = htmlTtsVariante;
    for (const id of ['btn-ouvir', 'btn-ouvir-rotulo', 'btn-parar', 'ouvir-status']) assert.ok(v.includes(`id="${id}"`), id);
    assert.ok(v.includes('<span id="btn-ouvir-rotulo">Ouvir este trecho</span>'));
    assert.ok(v.includes('src="/js/experimente-tts.js"') && v.includes("var texto = document.getElementById('trecho').innerText;"));
    assert.strictEqual(fs.readFileSync(path.join(raiz, 'public/js/experimente-tts.js'), 'utf8').includes('fetch'), false);
  });

  console.log('\nLegibilidade (público maduro)');
  await teste('fontes essenciais ≥ 14–17px: títulos de seção 15px, textos 17px, rodapé e avisos 14px; nenhuma regra abaixo de 13px', async () => {
    const css = template.match(/<style>([\s\S]*?)<\/style>/)[1];
    const px = (re) => parseFloat(css.match(re)[1]) * 16;
    assert.ok(px(/\.secao-titulo \{[^}]*font-size: ([\d.]+)rem/) >= 15);
    assert.ok(px(/\.secao-texto \{[^}]*font-size: ([\d.]+)rem/) >= 17);
    assert.ok(px(/\.temas-lista \{[^}]*font-size: ([\d.]+)rem/) >= 17);
    assert.ok(px(/\.opcao p \{[^}]*font-size: ([\d.]+)rem/) >= 17 && px(/\.opcao ul \{[^}]*font-size: ([\d.]+)rem/) >= 17 && px(/\.seguro p \{[^}]*font-size: ([\d.]+)rem/) >= 17);
    assert.ok(px(/footer \{[^}]*font-size: ([\d.]+)rem/) >= 14 && px(/\.aviso \{[^}]*font-size: ([\d.]+)rem/) >= 14);
    // Regras com texto de conteúdo: nenhuma abaixo de 14px. Exceção explícita: elementos de marca/decoração do topo.
    const decorativos = ['.marca', '.marca .selo', '.barra .rotulo'];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const fs = m[2].match(/font-size: ([\d.]+)rem/); if (!fs) continue;
      const seletor = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (decorativos.includes(seletor)) continue;
      assert.ok(parseFloat(fs[1]) * 16 >= 14, `fonte pequena em "${seletor}": ${fs[0]}`);
    }
    assert.ok(/\.btn \{[^}]*min-height: 48px/.test(css));
  });

  console.log('\nSegurança');
  await teste('nada de obra integral, storage privado, URL/token/PII/segredo ou MP3 na página', async () => {
    const privados = [livro.audiobookStorage && livro.audiobookStorage.bucket, livro.audiobookStorage && livro.audiobookStorage.path, livro.audiobookUrl, 'audiobookStorage', 'audiobookUrl', 'audiobookPartes', 'supabase.co', 'zuni-audiobooks', 'bucket', 'signed', 'token=', 'export default', '"blocks"', '__bundler', 'sk_', 'whsec', 'service_role', livro.indicadoPara, livro.descricao.slice(0, 50), livro.resumo.slice(0, 50)].filter(Boolean);
    for (const p of privados) assert.ok(!pagina.includes(p), 'vazou: ' + String(p).slice(0, 40));
    assert.deepStrictEqual([...pagina.matchAll(/[^"'\s=]*\.mp3/g)].map((m) => m[0]), ['/audio/amostras/ela-tem-classe.mp3'], 'única mídia: a amostra curta');
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(texto), 'e-mail visível');
    assert.deepStrictEqual([...pagina.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]), []); // E6B: sem módulo de voz do navegador na Ela
    assert.deepStrictEqual(Object.keys(AMOSTRAS), ['ela-tem-classe']);
  });
  await teste('HTML dos novos blocos é escapado (título da obra vindo do catálogo não vira marcação)', async () => {
    const h = html({}, { buscar: (id) => ({ ...buscarLivro(id), tituloPublico: '<img src=x onerror=1>Ela' }), amostra: obterAmostra });
    assert.ok(!h.includes('<img src=x') && h.includes('&lt;img src=x onerror=1&gt;Ela'));
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${total - ok}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — E6A: estrutura clara (ouça/leia/temas/opções/compra segura), verdade comercial preservada.');
})();
