#!/usr/bin/env node
// scripts/testar-keepalive-supabase.js
// Teste local do sinal de vida do Supabase: cliente simulado, sem rede.

const assert = require('assert');
const { keepaliveAtivo, pingSupabase, iniciarKeepalive } = require('../src/lib/keepaliveSupabase');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function clienteFalso(respostas) {
  const chamadas = [];
  let i = 0;
  return {
    chamadas,
    from(tabela) {
      return {
        select(coluna) {
          return {
            limit: async (n) => {
              chamadas.push({ tabela, coluna, n });
              const r = respostas[Math.min(i++, respostas.length - 1)];
              if (r instanceof Error) throw r;
              return r;
            },
          };
        },
      };
    },
  };
}

function logFalso() {
  const linhas = [];
  return { linhas, log: (m) => linhas.push(['log', m]), warn: (m) => linhas.push(['warn', m]), error: (m) => linhas.push(['error', m]) };
}

(async () => {
  // Flag SUPABASE_KEEPALIVE
  assert.strictEqual(keepaliveAtivo({ NODE_ENV: 'production' }), true);
  assert.strictEqual(keepaliveAtivo({ RAILWAY_ENVIRONMENT: 'production' }), true);
  assert.strictEqual(keepaliveAtivo({ NODE_ENV: 'production', SUPABASE_KEEPALIVE: '0' }), false);
  assert.strictEqual(keepaliveAtivo({}), false);
  assert.strictEqual(keepaliveAtivo({ SUPABASE_KEEPALIVE: '1' }), true);

  // Ping: sucesso, erro do PostgREST e exceção — nunca rejeita, e só lê 1 linha
  const ok = clienteFalso([{ data: [{ session_id: 'x' }], error: null }]);
  const r1 = await pingSupabase(ok);
  assert.strictEqual(r1.ok, true);
  assert.deepStrictEqual(ok.chamadas[0], { tabela: 'sessions', coluna: 'session_id', n: 1 });
  assert.strictEqual((await pingSupabase(clienteFalso([{ data: null, error: { message: 'paused' } }]))).ok, false);
  const r3 = await pingSupabase(clienteFalso([new Error('ECONNRESET')]));
  assert.strictEqual(r3.ok, false);
  assert.strictEqual(r3.erro, 'ECONNRESET');

  // Agendamento: ping inicial + periódico; falhas seguidas logam só uma vez; recuperação loga
  const cli = clienteFalso([
    { data: [], error: null },
    { data: null, error: { message: 'down' } },
    new Error('down de novo'),
    { data: [], error: null },
  ]);
  const log = logFalso();
  const parar = iniciarKeepalive({ client: cli, env: { SUPABASE_KEEPALIVE: '1' }, intervaloMs: 30, atrasoInicialMs: 5, log });
  await espera(160);
  parar();
  const total = cli.chamadas.length;
  assert.ok(total >= 4, `esperava >=4 pings, houve ${total}`);
  assert.strictEqual(log.linhas.filter(([t]) => t === 'warn').length, 1, 'falhas repetidas devem logar uma vez');
  assert.ok(log.linhas.some(([, m]) => /recuperado/.test(m)), 'deve logar recuperação');
  await espera(80);
  assert.strictEqual(cli.chamadas.length, total, 'parar() deve cancelar os timers');

  // Desligado: nenhum ping
  const cli2 = clienteFalso([{ data: [], error: null }]);
  iniciarKeepalive({ client: cli2, env: { NODE_ENV: 'production', SUPABASE_KEEPALIVE: '0' }, intervaloMs: 10, atrasoInicialMs: 1, log: logFalso() });
  await espera(50);
  assert.strictEqual(cli2.chamadas.length, 0);

  // Sem cliente: avisa e não quebra
  const log3 = logFalso();
  iniciarKeepalive({ client: null, env: { SUPABASE_KEEPALIVE: '1' }, log: log3 });
  assert.strictEqual(log3.linhas.length, 1);

  console.log('OK — keepalive Supabase: todos os testes passaram');
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
