// Teste local (sem rede, sem Pinterest real, sem Supabase, sem Stripe, sem IA) da E5 — mensuração mínima do funil:
// a página /experimente/<id>/ carrega a MESMA tag oficial do Pinterest e registra só o PageVisit (load + page).
// Nenhum evento novo: sem ViewContent, sem clique de compra, sem "ouvir". AddToCart e Purchase seguem só no checkout.
// Uso: node scripts/testar-experimente-e5.js
//
// O bloco da tag é extraído do HTML real renderizado e executado em um contexto isolado (vm) com document/window
// falsos: nenhuma requisição é feita; o que a tag "enviaria" fica na fila (window.pintrk.queue) para inspeção.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

const raiz = path.join(__dirname, '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const { renderizarExperimenteObra } = require(path.join(raiz, 'src/lib/experimenteObra'));
const { AMOSTRAS } = require(path.join(raiz, 'src/lib/amostrasExperimente'));

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); ok++; console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); }
}

const html = (params = {}) => { const r = renderizarExperimenteObra({ livroId: 'ela-tem-classe', ...params }); assert.strictEqual(r.status, 200); return r.html; };
const BLOCO = /<!-- Pinterest Tag oficial[\s\S]*?<\/script>/;
const ID_OFICIAL = '2612519382245';
const pagina = html();
const bloco = pagina.match(BLOCO)[0];
const codigo = bloco.match(/<script>([\s\S]*?)<\/script>/)[1];
const trecho = AMOSTRAS['ela-tem-classe'].trecho;
const paginaSemComentarios = pagina.replace(/<!--[\s\S]*?-->/g, ''); // o comentário do bloco cita nomes de eventos só para documentar

// Executa o código da tag em um navegador falso. Devolve a fila de chamadas e o que a tag tentou inserir.
function executar(opcoes = {}) {
  const inseridos = [];
  const document = opcoes.documentoQuebrado ? undefined : {
    createElement: (tag) => { if (opcoes.createElementLanca) throw new Error('bloqueado'); return { tag }; },
    getElementsByTagName: () => [{ parentNode: { insertBefore: (n) => inseridos.push(n) } }]
  };
  const ctx = vm.createContext({ document });
  ctx.window = ctx; // no navegador window === globalThis
  const rodar = () => vm.runInContext(codigo, ctx);
  return { ctx, inseridos, rodar, fila: () => (ctx.pintrk && ctx.pintrk.queue) || [] };
}

(async () => {
  console.log('E5 — mensuração mínima: PageVisit no Experimente (sem eventos novos)\n');

  console.log('Tag e PageVisit');
  await teste('A. a tag é a oficial: mesmo ID e mesmo snippet da Loja, da vitrine e do checkout', async () => {
    assert.ok(codigo.includes(`pintrk('load', '${ID_OFICIAL}')`));
    const normalizar = (t) => t.replace(/\s+/g, '');
    const snippet = (t) => normalizar(t.match(/!function\(e\)\{[\s\S]*?\}\("https:\/\/s\.pinimg\.com\/ct\/core\.js"\);/)[0]);
    const nosso = snippet(codigo);
    for (const f of ['public/loja/index.html', 'public/loja/universo-feminino/index.html', 'public/checkout-livro.html', 'public/checkout.html']) {
      const src = ler(f);
      assert.ok(src.includes(`pintrk('load', '${ID_OFICIAL}')`), f);
      assert.strictEqual(snippet(src), nosso, 'snippet diferente em ' + f);
    }
  });
  await teste('B. page tracking: exatamente load + page, uma vez — mesmo se o script rodar duas vezes', async () => {
    const e = executar(); e.rodar();
    assert.strictEqual(JSON.stringify(e.fila()), JSON.stringify([['load', ID_OFICIAL], ['page']])); // JSON: a fila nasce em outro contexto do vm
    e.rodar(); // execução duplicada
    assert.strictEqual(e.fila().length, 2, 'PageVisit não pode duplicar');
    assert.strictEqual(e.inseridos.length, 1, 'o loader da tag é inserido uma única vez');
    assert.strictEqual(e.inseridos[0].src, 'https://s.pinimg.com/ct/core.js');
    assert.strictEqual(e.inseridos[0].async, true, 'carregamento assíncrono');
  });
  await teste('C/D/E/F. ViewContent NÃO foi implementado: nenhum evento de "track", nenhum valor, nenhuma moeda, nenhum product_id', async () => {
    // Decisão: o Pinterest não tem "ViewContent" (é nome da Meta); o equivalente padrão é o próprio PageVisit (pintrk('page')).
    const e = executar(); e.rodar();
    assert.ok(e.fila().every((a) => a[0] === 'load' || a[0] === 'page'));
    assert.ok(!/pintrk\(\s*'track'/.test(paginaSemComentarios) && !/viewcontent|pagevisit|product_id|currency|value\s*:/i.test(codigo.replace(/\/\/.*$/gm, '')));
  });
  await teste('G/H. payload sem PII e sem texto da amostra: só load(ID) e page, sem objeto de dados', async () => {
    const e = executar(); e.rodar();
    for (const chamada of e.fila()) assert.ok(chamada.every((x) => typeof x === 'string'), 'nenhum objeto/dado extra: ' + JSON.stringify(chamada));
    assert.strictEqual(JSON.stringify(e.fila()), JSON.stringify([['load', ID_OFICIAL], ['page']]));
    assert.ok(!/email|e-mail|\bem\s*:|pd\[em\]|nome|telefone|cpf|token|session|stripe|storage|audiobook|\.mp3|origem|cupom/i.test(codigo), 'nada pessoal/sensível no código da tag');
    for (const p of trecho.split('\n\n')) assert.ok(!bloco.includes(p.slice(0, 30)), 'texto da amostra no bloco');
    assert.ok(!/<noscript>[\s\S]*pinterest/i.test(pagina), 'sem pixel <noscript> com parâmetros');
  });

  console.log('\nFalha, performance e independência');
  await teste('I. falha da tag não quebra a página: erro interno é engolido (createElement bloqueado, document ausente)', async () => {
    assert.doesNotThrow(() => executar({ createElementLanca: true }).rodar());
    assert.doesNotThrow(() => executar({ documentoQuebrado: true }).rodar());
    assert.ok(/try \{[\s\S]*\} catch \(e\) \{\}/.test(codigo));
  });
  await teste('desempenho: a tag vem DEPOIS do conteúdo e do script de voz, em bloco próprio e assíncrona (não bloqueia a renderização)', async () => {
    const iBloco = pagina.indexOf('<!-- Pinterest Tag oficial');
    for (const antes of ['id="trecho"', 'id="temas-titulo"', 'Continue a leitura', "document.getElementById('audio-player')", '</footer>']) assert.ok(pagina.indexOf(antes) > 0 && pagina.indexOf(antes) < iBloco, 'deveria vir antes da tag: ' + antes);
    assert.ok(/t\.async=!0/.test(codigo) && !/document\.write/.test(codigo));
    assert.strictEqual((pagina.match(/pintrk\(/g) || []).length, 2); // só load + page em toda a página
    assert.ok(!/<script[^>]+src="https?:/.test(pagina), 'nenhum <script src> externo estático; o loader é criado pela própria tag');
  });
  await teste('J. TTS independe do Pinterest: o script de voz não referencia pintrk nem espera pela tag', async () => {
    // E6B: o template tem dois scripts de interface (amostra do audiobook e voz do navegador); nenhum referencia a tag.
    // A variante sem amostra oficial (obras sem audiobook) mantém o script de voz; ambos ficam antes da tag.
    const variante = renderizarExperimenteObra({ livroId: 'ela-tem-classe' }, { amostra: () => ({ ...AMOSTRAS['ela-tem-classe'], ttsDisponivel: true, audioAmostra: undefined }) }).html;
    const pega = (h) => (h.match(/<script>([\s\S]*?)<\/script>/g) || []).filter((s) => /getElementById\('(btn-ouvir|audio-player)'\)/.test(s));
    assert.strictEqual(pega(pagina).length, 1);
    assert.strictEqual(pega(variante).length, 1);
    assert.ok(pega(variante)[0].includes("document.getElementById('btn-ouvir')"));
    [...pega(pagina), ...pega(variante)].forEach((w) => assert.ok(!/pintrk|Pinterest|__zuniPin/.test(w)));
    assert.ok(!/pintrk|Pinterest/.test(ler('public/js/experimente-tts.js')));
  });
  await teste('K. o CTA de compra independe do Pinterest: âncoras simples, sem handler nem atributo de rastreio', async () => {
    const ctas = [...pagina.matchAll(/<a [^>]*href="\/checkout-livro\.html[^"]*"[^>]*>/g)].map((m) => m[0]);
    assert.strictEqual(ctas.length, 2);
    ctas.forEach((a) => assert.ok(!/onclick|data-|ping=|target=/.test(a), a));
    assert.ok(!/onclick=|addEventListener\('click'[^)]*(buy|compr|adquir)/i.test(pagina));
  });

  console.log('\nSemântica preservada (AddToCart, Purchase, ouvir)');
  await teste('L. origem interna preservada e separada do Pinterest (F3C): links levam origem; a tag não a recebe', async () => {
    const h = html({ origem: 'universo-feminino', cupom: 'SMOKE30' });
    assert.strictEqual((h.match(/livro=ela-tem-classe&amp;origem=universo-feminino&amp;cupom=SMOKE30/g) || []).length, 2);
    assert.ok(!h.match(BLOCO)[0].match(/<script>([\s\S]*?)<\/script>/)[1].includes('universo-feminino'));
    assert.ok(!html({ origem: 'evil' }).includes('origem='));
  });
  await teste('M. AddToCart não foi antecipado para o Experimente (continua só ao montar o checkout Stripe)', async () => {
    assert.ok(!/addtocart/i.test(paginaSemComentarios));
    const chk = ler('public/checkout-livro.html');
    assert.ok(/await montarEmbeddedCheckout\(data\.clientSecret\);\s*registrarInicioCheckoutPinterest\(data\.pedidoId\);/.test(chk));
    assert.ok(ler('public/js/checkout-livro-cliente.js').includes("pinTrack('addtocart', dados)"));
  });
  await teste('N. Purchase não existe no Experimente (continua só após pago:true no checkout)', async () => {
    assert.ok(!/pintrk\(\s*'track'|order_id|'checkout'/.test(paginaSemComentarios));
    const chk = ler('public/checkout-livro.html');
    assert.ok(/if \(data\.pago && data\.token\) \{\s*clearInterval\(pollingInterval\);\s*registrarCompraPinterest\(pedidoIdRetorno\);/.test(chk));
    assert.ok(ler('public/js/checkout-livro-cliente.js').includes("pinTrack('checkout', dados)"));
  });
  await teste('O. nenhum evento por "Ouvir este trecho" (não é conversão): o único código com pintrk roda uma vez, no carregamento', async () => {
    const wiring = pagina.match(/<script>([\s\S]*?)<\/script>/)[1];
    assert.ok(!/pintrk/.test(wiring));
    assert.strictEqual((pagina.match(/pintrk\(/g) || []).length, 2); // as duas chamadas: load e page
    // fora do bloco da tag não há nenhuma referência a pintrk
    assert.ok(!/pintrk/.test(pagina.replace(BLOCO, '')));
  });
  await teste('conteúdo intacto: trecho (422 palavras), título, CTAs, "Você também encontrará nesta obra", rodapé e TTS não mudaram', async () => {
    assert.strictEqual(trecho.trim().split(/\s+/).length, 422);
    for (const t of ['Da aparência à presença', 'Você também encontrará nesta obra', 'Continue a leitura', 'Voltar ao Universo Feminino', 'Adquirir livro — R$ 34,90', '<footer>Livro digital • acesso após a confirmação do pagamento</footer>', 'id="audio-tocar"']) assert.ok(pagina.includes(t), t); // E6B: amostra oficial do audiobook no lugar da voz do navegador
    assert.ok(pagina.indexOf('id="audio-tocar"') < pagina.indexOf('id="trecho"'));
  });
  await teste('as outras páginas do funil mantêm só o que já tinham: Loja e vitrine (load+page); checkout-livro (load+page + eventos via módulo); Direciona (load+page+addtocart+checkout)', async () => {
    const eventos = (f) => [...ler(f).matchAll(/pintrk\(\s*'(\w+)'/g)].map((m) => m[1]);
    assert.deepStrictEqual(eventos('public/loja/index.html'), ['load', 'page']);
    assert.deepStrictEqual(eventos('public/loja/universo-feminino/index.html'), ['load', 'page']);
    assert.deepStrictEqual(eventos('public/checkout-livro.html'), ['load', 'page']);
    assert.deepStrictEqual(eventos('public/checkout.html'), ['load', 'page', 'track', 'track']);
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${total - ok}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — E5: Experimente com PageVisit da tag oficial; nenhum evento novo; AddToCart/Purchase intactos.');
})();
