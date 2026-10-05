// Teste local (sem rede, sem Supabase, sem Stripe, sem pedido) da F2b: o preço exibido no checkout
// de livros bate com o cobrado pelo servidor, e o valor do Pinterest vem do estado estruturado.
// Uso: node scripts/testar-f2b-consistencia-preco.js
//
// Código real exercitado (extraído do source, sem subir o servidor):
//   - calcularPrecoFinalLivro e a rota GET /api/validar-cupom, de src/server.js
//   - calcularPrecoBaseLivro (src/lib/precoLivro.js) e calcularDesconto (src/lib/cupons.js)
//   - public/js/checkout-livro-cliente.js (estado de preço + Pinterest)
// Só o acesso a cupons no banco (validarCupom/validarCupomSemMarcar) é trocado por fixtures.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

const raiz = path.join(__dirname, '..');
const { CATALOGO, buscarLivro, serializarLivroCatalogo } = require(path.join(raiz, 'src/lib/catalogoLivros'));
const { calcularPrecoBaseLivro } = require(path.join(raiz, 'src/lib/precoLivro'));
const { calcularDesconto, mascararCodigo } = require(path.join(raiz, 'src/lib/cupons'));
const cliente = require(path.join(raiz, 'public/js/checkout-livro-cliente.js'));

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); ok++; console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); }
}

// ── Fixtures de cupom (substituem o banco) ──
const CUPONS = {
  PCT30: { tipo: 'sessao', percentual: 30, teto_reais: null, codigo: 'PCT30' },
  TETO15: { tipo: 'campanha', percentual: 30, teto_reais: 15, codigo: 'TETO15' },
  CEM: { tipo: 'sessao', percentual: 100, teto_reais: null, codigo: 'CEM' }
};
const buscarCupom = async (codigo) => (typeof codigo === 'string' ? CUPONS[codigo.trim().toUpperCase()] || null : null);

// ── Código real do servidor, extraído de server.js ──
const srcServer = fs.readFileSync(path.join(raiz, 'src/server.js'), 'utf8');
const mFn = srcServer.match(/async function calcularPrecoFinalLivro[\s\S]*?\n}\n/);
assert.ok(mFn, 'calcularPrecoFinalLivro não encontrada em server.js');
const calcularPrecoFinalLivro = new Function(
  'validarCupom', 'calcularDesconto', 'calcularPrecoBaseLivro',
  `${mFn[0]}; return calcularPrecoFinalLivro;`
)(buscarCupom, calcularDesconto, calcularPrecoBaseLivro);

const iniRota = srcServer.indexOf("app.get('/api/validar-cupom'");
const fimRota = srcServer.indexOf("app.post('/api/checkout/livro/preference'");
assert.ok(iniRota > 0 && fimRota > iniRota, 'rota /api/validar-cupom não encontrada em server.js');
let handlerValidarCupom = null;
const appFalso = { get: (rota, h) => { if (rota === '/api/validar-cupom') handlerValidarCupom = h; } };
new Function(
  'app', 'validarCupomSemMarcar', 'buscarLivro', 'calcularDesconto', 'calcularPrecoBaseLivro', 'mascararCodigo',
  srcServer.slice(iniRota, fimRota).replace(/console\.log\([^;]*\);/g, '')
)(appFalso, buscarCupom, buscarLivro, calcularDesconto, calcularPrecoBaseLivro, mascararCodigo);
assert.ok(handlerValidarCupom, 'handler não registrado');

async function chamarValidarCupom(query) {
  let status = 200, corpo;
  const res = { status(c) { status = c; return res; }, json(b) { corpo = b; return res; } };
  await handlerValidarCupom({ query }, res);
  return { status, corpo };
}

// validarCupomFn do cliente, ligada ao handler REAL (equivale ao fetch de /api/validar-cupom).
const validarViaServidor = async (codigo, livroId, audio) => {
  const { status, corpo } = await chamarValidarCupom({ codigo, livroId, audiolivroIncluido: audio ? 'true' : 'false' });
  if (status !== 200 || !corpo.valido) return { ok: false, erro: corpo.error };
  return { ok: true, precoOriginal: corpo.precoOriginal, desconto: corpo.desconto, precoFinal: corpo.precoFinal };
};

function livroDoCliente(livroId) {
  return serializarLivroCatalogo(livroId, buscarLivro(livroId)); // o que /api/livros/catalogo/:id devolve
}
async function estadoCliente(livroId) {
  const e = cliente.criarEstadoPreco(validarViaServidor);
  e.definirLivro(livroId, livroDoCliente(livroId));
  return e;
}
const centavos = (n) => Math.round(n * 100);

// Livros de teste do catálogo real
const L_NORMAL = 'ela-tem-classe';                       // só preco (34,90) + áudio 19,90
const L_PROMO = 'protocolo-90s-executive-black';         // precoPromocional, SEM preco
const L_PROMO_AUDIO = 'a-arte-da-presenca-masculina';    // preco + precoPromocional + áudio
const L_PROMO_SEM_PRECO_COM_AUDIO = 'alem-do-que-voce-ve'; // precoPromocional, sem preco, com áudio (29,90)

(async () => {
  console.log('F2b — consistência de preço: servidor → checkout → Pinterest\n');

  console.log('Preço no servidor (calcularPrecoFinalLivro real)');
  await teste('A. preco normal, sem cupom, sem áudio', async () => {
    const r = await calcularPrecoFinalLivro({ livro: buscarLivro(L_NORMAL), audiolivroIncluido: false, cupom: null });
    assert.strictEqual(r.precoFinal, 34.9);
  });
  await teste('B. preco normal + áudio', async () => {
    const r = await calcularPrecoFinalLivro({ livro: buscarLivro(L_NORMAL), audiolivroIncluido: true, cupom: null });
    assert.strictEqual(r.precoFinal, 54.8);
  });
  await teste('C. precoPromocional com preco ausente', async () => {
    const livro = buscarLivro(L_PROMO);
    assert.strictEqual(livro.preco, undefined);
    const r = await calcularPrecoFinalLivro({ livro, audiolivroIncluido: false, cupom: null });
    assert.strictEqual(r.precoFinal, 97.9);
  });
  await teste('D. precoPromocional + áudio', async () => {
    const livro = buscarLivro(L_PROMO_SEM_PRECO_COM_AUDIO);
    assert.strictEqual(livro.preco, undefined);
    const r = await calcularPrecoFinalLivro({ livro, audiolivroIncluido: true, cupom: null });
    assert.strictEqual(r.precoFinal, 77.8); // 47,90 + 29,90
  });

  console.log('\nPré-visualização de cupom (/api/validar-cupom real) = cobrança do servidor');
  await teste('Bug A: obra sem preco (só precoPromocional) não gera NaN no preview', async () => {
    const { status, corpo } = await chamarValidarCupom({ codigo: 'PCT30', livroId: L_PROMO });
    assert.strictEqual(status, 200);
    for (const k of ['precoOriginal', 'desconto', 'precoFinal']) assert.ok(Number.isFinite(corpo[k]), `${k} = ${corpo[k]}`);
    assert.strictEqual(corpo.precoOriginal, 97.9);
  });
  await teste('E. cupom percentual sem áudio', async () => {
    const { corpo } = await chamarValidarCupom({ codigo: 'PCT30', livroId: L_NORMAL });
    const srv = await calcularPrecoFinalLivro({ livro: buscarLivro(L_NORMAL), audiolivroIncluido: false, cupom: 'PCT30' });
    assert.strictEqual(corpo.precoFinal, 24.43); // 34,90 - 30%
    assert.strictEqual(corpo.precoFinal, srv.precoFinal);
  });
  await teste('F. cupom percentual + áudio (preview inclui o áudio)', async () => {
    const { corpo } = await chamarValidarCupom({ codigo: 'PCT30', livroId: L_NORMAL, audiolivroIncluido: 'true' });
    const srv = await calcularPrecoFinalLivro({ livro: buscarLivro(L_NORMAL), audiolivroIncluido: true, cupom: 'PCT30' });
    assert.strictEqual(corpo.precoOriginal, 54.8);
    assert.strictEqual(corpo.precoFinal, 38.36); // 54,80 - 30%
    assert.strictEqual(corpo.precoFinal, srv.precoFinal);
  });
  await teste('G. cupom com teto (principal: desconto limitado a R$ 15), com e sem áudio', async () => {
    const sem = await chamarValidarCupom({ codigo: 'TETO15', livroId: L_NORMAL });
    assert.strictEqual(sem.corpo.desconto, 10.47); // 30% de 34,90 < teto
    const com = await chamarValidarCupom({ codigo: 'TETO15', livroId: L_NORMAL, audiolivroIncluido: 'true' });
    assert.strictEqual(com.corpo.desconto, 15);    // 30% de 54,80 = 16,44 -> teto
    assert.strictEqual(com.corpo.precoFinal, 39.8);
    const srv = await calcularPrecoFinalLivro({ livro: buscarLivro(L_NORMAL), audiolivroIncluido: true, cupom: 'TETO15' });
    assert.strictEqual(com.corpo.precoFinal, srv.precoFinal);
  });
  await teste('H. cupom 100%: preview e servidor chegam a 0 (com e sem áudio)', async () => {
    for (const audio of [false, true]) {
      const { corpo } = await chamarValidarCupom({ codigo: 'CEM', livroId: L_NORMAL, audiolivroIncluido: String(audio) });
      const srv = await calcularPrecoFinalLivro({ livro: buscarLivro(L_NORMAL), audiolivroIncluido: audio, cupom: 'CEM' });
      assert.strictEqual(corpo.precoFinal, 0);
      assert.strictEqual(srv.precoFinal, 0);
    }
  });
  await teste('MATRIZ: as 38 obras públicas × áudio {não,sim} × 3 cupons — exibido == cobrado, em centavos', async () => {
    let comparacoes = 0;
    for (const [id, livro] of Object.entries(CATALOGO)) {
      if (livro.teaser) continue;
      for (const audio of [false, true]) {
        for (const cod of Object.keys(CUPONS)) {
          const e = await estadoCliente(id);
          await e.definirAudio(audio);
          const r = await e.aplicarCupom(cod);
          const srv = await calcularPrecoFinalLivro({ livro, audiolivroIncluido: audio, cupom: cod });
          assert.ok(r.ok, `${id}: cupom ${cod} recusado`);
          assert.strictEqual(centavos(r.visao.precoFinal), centavos(srv.precoFinal), `${id} áudio=${audio} ${cod}: tela ${r.visao.precoFinal} ≠ servidor ${srv.precoFinal}`);
          comparacoes++;
        }
        const semCupom = await estadoCliente(id);
        await semCupom.definirAudio(audio);
        const srv0 = await calcularPrecoFinalLivro({ livro, audiolivroIncluido: audio, cupom: null });
        assert.strictEqual(centavos(semCupom.visao().precoFinal), centavos(srv0.precoFinal), `${id} áudio=${audio} sem cupom`);
        comparacoes++;
      }
    }
    assert.strictEqual(comparacoes, 38 * 2 * 4);
  });

  console.log('\nTela: áudio × cupom (estado do checkout)');
  await teste('I. selecionar áudio DEPOIS de aplicar cupom atualiza o total com desconto', async () => {
    const e = await estadoCliente(L_NORMAL);
    let r = await e.aplicarCupom('PCT30');
    assert.strictEqual(r.visao.precoFinal, 24.43);
    r = await e.definirAudio(true);
    assert.strictEqual(r.visao.precoOriginal, 54.8);
    assert.strictEqual(r.visao.desconto, 16.44);
    assert.strictEqual(r.visao.precoFinal, 38.36);
    assert.strictEqual(r.visao.cupom, 'PCT30');
  });
  await teste('J. remover áudio depois de aplicar cupom volta ao total sem áudio, ainda com desconto', async () => {
    const e = await estadoCliente(L_NORMAL);
    await e.definirAudio(true);
    await e.aplicarCupom('PCT30');
    const r = await e.definirAudio(false);
    assert.strictEqual(r.visao.precoOriginal, 34.9);
    assert.strictEqual(r.visao.precoFinal, 24.43);
  });
  await teste('sem cupom: marcar/desmarcar áudio usa a base local (soma simples)', async () => {
    const e = await estadoCliente(L_NORMAL);
    assert.strictEqual((await e.definirAudio(true)).visao.precoFinal, 54.8);
    assert.strictEqual((await e.definirAudio(false)).visao.precoFinal, 34.9);
  });
  await teste('cupom que deixa de valer ao mudar o áudio é descartado e a tela volta ao preço cheio', async () => {
    let chamadas = 0;
    const e = cliente.criarEstadoPreco(async (...a) => { chamadas++; return chamadas === 1 ? validarViaServidor(...a) : { ok: false, erro: 'Cupom inválido ou expirado.' }; });
    e.definirLivro(L_NORMAL, livroDoCliente(L_NORMAL));
    await e.aplicarCupom('PCT30');
    const r = await e.definirAudio(true);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.visao.cupomPerdido, true);
    assert.strictEqual(r.visao.precoFinal, 54.8);
    assert.strictEqual(e.estado.cupom, null); // o checkout não enviará cupom ao servidor
  });
  await teste('toque rápido no checkbox: resposta antiga não sobrescreve a nova', async () => {
    const e = cliente.criarEstadoPreco(async (codigo, id, audio) => {
      if (!audio) await new Promise((r) => setTimeout(r, 30)); // resposta "sem áudio" chega depois
      return validarViaServidor(codigo, id, audio);
    });
    e.definirLivro(L_NORMAL, livroDoCliente(L_NORMAL));
    await e.aplicarCupom('PCT30');
    const lenta = e.definirAudio(false);
    const rapida = e.definirAudio(true);
    await Promise.all([lenta, rapida]);
    assert.strictEqual(e.estado.audio, true);
    assert.strictEqual(e.visao().precoFinal, 38.36);
  });
  await teste('base do cliente == base do servidor (todas as obras, com e sem áudio)', async () => {
    for (const [id, livro] of Object.entries(CATALOGO)) {
      for (const audio of [false, true]) {
        assert.strictEqual(cliente.precoBaseCliente(livroDoCliente(id), audio), calcularPrecoBaseLivro(livro, audio), `${id} áudio=${audio}`);
      }
    }
  });

  console.log('\nPinterest');
  function criarAmbientePin(opcoes = {}) {
    const eventos = [];
    const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; };
    const sessionStorage = opcoes.storageQuebrado ? { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } } : mem();
    const localStorage = opcoes.storageQuebrado ? { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } } : mem();
    const pintrk = opcoes.semPintrk ? undefined : (opcoes.pintrkQuebrado ? () => { throw new Error('pinterest fora do ar'); } : (...a) => eventos.push(a));
    return { eventos, sessionStorage, localStorage, pin: cliente.criarPinterestLivro({ pintrk, sessionStorage, localStorage, livroId: L_NORMAL }) };
  }
  await teste('K. AddToCart recebe o valor do estado (cupom + áudio), não do texto da tela', async () => {
    const e = await estadoCliente(L_NORMAL);
    await e.definirAudio(true);
    await e.aplicarCupom('TETO15');
    const amb = criarAmbientePin();
    amb.pin.inicioCheckout('ped-1', e.valorTransacao());
    assert.strictEqual(amb.eventos.length, 1);
    const [acao, nome, dados] = amb.eventos[0];
    assert.deepStrictEqual([acao, nome], ['track', 'addtocart']);
    assert.strictEqual(dados.value, 39.8);
    assert.strictEqual(dados.currency, 'BRL');
    assert.strictEqual(dados.product_id, L_NORMAL);
    const srv = await calcularPrecoFinalLivro({ livro: buscarLivro(L_NORMAL), audiolivroIncluido: true, cupom: 'TETO15' });
    assert.strictEqual(centavos(dados.value), centavos(srv.precoFinal)); // PINTEREST_MATCHES_TRANSACTION
  });
  await teste('K2. sem cupom e sem áudio: valor = preço vigente do catálogo', async () => {
    const e = await estadoCliente(L_PROMO);
    const amb = criarAmbientePin();
    amb.pin.inicioCheckout('ped-2', e.valorTransacao());
    assert.strictEqual(amb.eventos[0][2].value, 97.9);
  });
  await teste('K3. valor ausente/zero (cupom 100%) não envia value nem currency', async () => {
    const amb = criarAmbientePin();
    amb.pin.inicioCheckout('ped-3', null);
    assert.ok(!('value' in amb.eventos[0][2]) && !('currency' in amb.eventos[0][2]));
  });
  await teste('L. Purchase usa o valor guardado no início e mantém a deduplicação', async () => {
    const amb = criarAmbientePin();
    amb.pin.inicioCheckout('ped-4', 54.8);
    assert.strictEqual(amb.pin.compra('ped-4'), true);
    const compras = amb.eventos.filter((e) => e[1] === 'checkout');
    assert.strictEqual(compras.length, 1);
    assert.deepStrictEqual(compras[0][2], { product_id: L_NORMAL, order_id: 'ped-4', order_quantity: 1, value: 54.8, currency: 'BRL' });
    assert.strictEqual(amb.pin.compra('ped-4'), false); // polling repetido
    assert.strictEqual(amb.eventos.filter((e) => e[1] === 'checkout').length, 1);
    const outroAmbiente = cliente.criarPinterestLivro({ pintrk: (...a) => amb.eventos.push(a), sessionStorage: amb.sessionStorage, localStorage: amb.localStorage, livroId: L_NORMAL });
    assert.strictEqual(outroAmbiente.compra('ped-4'), false); // recarga da página (localStorage)
    assert.strictEqual(amb.eventos.filter((e) => e[1] === 'checkout').length, 1);
  });
  await teste('L2. Purchase sem valor guardado é enviado sem value (nunca inventa valor)', async () => {
    const amb = criarAmbientePin();
    amb.pin.compra('ped-5');
    const dados = amb.eventos.find((e) => e[1] === 'checkout')[2];
    assert.ok(!('value' in dados));
  });
  await teste('PII: eventos só carregam ids do produto/pedido, quantidade, valor e moeda', async () => {
    const amb = criarAmbientePin();
    amb.pin.inicioCheckout('ped-6', 49.9);
    amb.pin.compra('ped-6');
    const permitidas = new Set(['product_id', 'order_id', 'order_quantity', 'value', 'currency']);
    for (const ev of amb.eventos) for (const k of Object.keys(ev[2])) assert.ok(permitidas.has(k), `chave inesperada: ${k}`);
  });
  await teste('M. fail-open: pintrk lançando erro, pintrk ausente e storage bloqueado não propagam exceção', async () => {
    for (const op of [{ pintrkQuebrado: true }, { semPintrk: true }, { storageQuebrado: true }]) {
      const amb = criarAmbientePin(op);
      assert.doesNotThrow(() => amb.pin.inicioCheckout('ped-7', 34.9));
      assert.doesNotThrow(() => amb.pin.compra('ped-7'));
    }
  });
  await teste('checkout-livro.html: sem parsing do texto da tela nem estado de cupom legado', async () => {
    const html = fs.readFileSync(path.join(raiz, 'public/checkout-livro.html'), 'utf8');
    assert.ok(!html.includes('valorExibidoAtual'));
    assert.ok(!/\bcupomAplicado\b/.test(html));
    assert.ok(html.includes('/js/checkout-livro-cliente.js'));
    assert.ok(html.includes('precoEstado.valorTransacao()'));
    assert.ok(!/pintrk\('track'/.test(html)); // eventos só via módulo testado
  });

  console.log('\nInvariantes F2 (preços e áudio)');
  await teste('cinco preços da F2 e precoAudiobook preservados', async () => {
    const esperado = {
      'ela-tem-classe': [34.9, 19.9], 'a-inteligencia-do-corpo-feminino': [39.9, 24.9], 'codigo-feminino': [44.9, 24.9],
      'a-mulher-que-permanece-inteira': [49.9, 24.9], 'inesquecivel-charme-feminino': [49.9, 24.9]
    };
    for (const [id, [p, a]] of Object.entries(esperado)) {
      assert.strictEqual(CATALOGO[id].preco, p, id);
      assert.strictEqual(CATALOGO[id].precoAudiobook, a, id);
      assert.strictEqual(CATALOGO[id].precoOriginal, undefined);
      assert.strictEqual(CATALOGO[id].precoPromocional, undefined);
    }
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${total - ok}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — F2b: preço exibido == preço cobrado; Pinterest usa o estado estruturado.');
})();
