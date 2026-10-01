// Teste sem rede de src/lib/estornoStripe.js, com Stripe e Supabase falsos.
// Uso: node scripts/testar-estorno-stripe.js
const assert = require('assert');
const { processarEstorno } = require('../src/lib/estornoStripe');

function supabaseFalso(tabelas) {
  return {
    from(nome) {
      let patch = null, filtros = [];
      const q = {
        update(p) { patch = p; return q; },
        in(col, vals) { filtros.push(r => vals.includes(r[col])); return q; },
        eq(col, v) { filtros.push(r => r[col] === v); return q; },
        is(col, v) { filtros.push(r => (r[col] ?? null) === v); return q; },
        select() {
          const linhas = tabelas[nome].filter(r => filtros.every(f => f(r)));
          linhas.forEach(r => Object.assign(r, patch));
          return Promise.resolve({ data: linhas.map(r => ({ ...r })), error: null });
        }
      };
      return q;
    }
  };
}

function stripeFalso(sessoes) {
  return { checkout: { sessions: { list: async ({ payment_intent }) => ({ data: sessoes.filter(s => s.payment_intent === payment_intent) }) } } };
}

(async () => {
  const emails = [];
  const enviarEmail = async (e) => { emails.push(e); return { sucesso: true }; };
  const logs = [];
  const logOriginal = console.log;
  console.log = (...a) => { logs.push(a.join(' ')); };

  const tabelas = {
    acessos_livros: [
      { id: 1, livro_id: 'l1', payment_id: 'cs_live_AAA', tipo_produto: 'livro', revogado_em: null },
      { id: 2, livro_id: 'l1', payment_id: 'cs_live_AAA-audiolivro', tipo_produto: 'audiolivro', revogado_em: null },
      { id: 3, livro_id: 'l2', payment_id: 'cs_live_OUTRO', tipo_produto: 'livro', revogado_em: null }
    ],
    sessions: [
      { session_id: 's1', stripe_session_id: 'cs_live_BBB', paid: true, estornado_em: null },
      { session_id: 's2', stripe_session_id: 'cs_live_CCC', paid: true, estornado_em: null }
    ]
  };
  const deps = {
    stripeClient: stripeFalso([
      { id: 'cs_live_AAA', payment_intent: 'pi_A', metadata: { fulfillment_type: 'livro' }, customer_details: { email: 'x@y.com' } },
      { id: 'cs_live_BBB', payment_intent: 'pi_B', metadata: { fulfillment_type: 'chat-mentor' } }
    ]),
    supabase: supabaseFalso(tabelas), enviarEmail
  };
  const ev = (type, obj) => ({ type, data: { object: obj } });

  // 1) estorno total de livro com audiolivro: revoga as 2 linhas, e só elas
  let r = await processarEstorno(ev('charge.refunded', { id: 'ch_A', payment_intent: 'pi_A', refunded: true, amount: 3790, amount_refunded: 3790 }), deps);
  assert.deepStrictEqual(r, { acao: 'revogado', linhas: 2 });
  assert(tabelas.acessos_livros[0].revogado_em && tabelas.acessos_livros[1].revogado_em);
  assert.strictEqual(tabelas.acessos_livros[2].revogado_em, null);
  assert.strictEqual(emails.length, 1);
  assert.strictEqual(emails[0].to, 'zunisuprema@gmail.com');
  assert(logs.some(l => l.startsWith('[ESTORNO_ACESSO_REVOGADO] tipo=livro motivo=estorno')));
  assert(!logs.join('\n').includes('x@y.com'), 'log não pode ter e-mail');

  // 2) reentrega do mesmo evento: nada muda, sem novo e-mail
  r = await processarEstorno(ev('charge.refunded', { id: 'ch_A', payment_intent: 'pi_A', refunded: true, amount: 3790, amount_refunded: 3790 }), deps);
  assert.deepStrictEqual(r, { acao: 'sem-efeito', linhas: 0 });
  assert.strictEqual(emails.length, 1);

  // 3) disputa em sessão do ZUNI Direciona: paid=false + estornado_em; outra sessão intacta
  r = await processarEstorno(ev('charge.dispute.created', { id: 'dp_B', charge: 'ch_B', payment_intent: 'pi_B', amount: 2790 }), deps);
  assert.deepStrictEqual(r, { acao: 'revogado', linhas: 1 });
  assert.strictEqual(tabelas.sessions[0].paid, false);
  assert(tabelas.sessions[0].estornado_em);
  assert.strictEqual(tabelas.sessions[1].paid, true);
  assert.strictEqual(emails.length, 2);
  assert(logs.some(l => l.startsWith('[ESTORNO_ACESSO_REVOGADO] tipo=chat-mentor motivo=disputa')));

  // 4) estorno parcial: não revoga, só avisa
  tabelas.acessos_livros.forEach(l => { l.revogado_em = null; });
  r = await processarEstorno(ev('charge.refunded', { id: 'ch_A', payment_intent: 'pi_A', refunded: false, amount: 3790, amount_refunded: 1000 }), deps);
  assert.deepStrictEqual(r, { acao: 'parcial' });
  assert.strictEqual(tabelas.acessos_livros[0].revogado_em, null);
  assert.strictEqual(emails.length, 3);

  // 5) sem pedido localizável: avisa, não revoga
  r = await processarEstorno(ev('charge.refunded', { id: 'ch_Z', payment_intent: 'pi_Z', refunded: true, amount: 100, amount_refunded: 100 }), deps);
  assert.deepStrictEqual(r, { acao: 'sem-pedido' });
  assert.strictEqual(emails.length, 4);

  console.log = logOriginal;
  console.log('OK — 5 cenários de estorno/disputa passaram.');
})().catch(e => { console.error('FALHOU:', e.message); process.exit(1); });
