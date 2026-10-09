// Teste LOCAL (sem rede, sem banco, sem IA) do orçamento PERSISTENTE da demo do ZUNI Direciona.
// O banco é simulado por uma implementação em JS do MESMO algoritmo da função SQL (migrations/008_orcamento_demo.sql).
// O SQL em si NÃO é executado aqui (sem Postgres local): fica "não verificado" até ser aplicado em ambiente autorizado.
// Uso: node scripts/testar-orcamento-demo-persistente.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const { criarOrcamentoDemoPersistente, hashDoIp } = require(path.join(raiz, 'src/lib/orcamentoDemoPersistente'));
const { criarOrcamentoDemo } = require(path.join(raiz, 'src/lib/protecaoMentorDemo'));

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); ok++; console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${String(e.message).split('\n')[0]}`); } }

// Banco simulado: mesma lógica da função SQL.
function bancoSimulado(relogio) {
  const linhas = new Map(); const chamadas = [];
  const rpc = async (nome, a) => {
    chamadas.push({ nome, a });
    if (nome !== 'consumir_orcamento_demo') return { data: null, error: { message: 'rpc inexistente' } };
    const t = relogio.t; const jan = a.p_janela_seg * 1000;
    const pega = (k) => { let l = linhas.get(k); if (!l) { l = { contagem: 0, inicio: t }; linhas.set(k, l); } if (t - l.inicio >= jan) { l.contagem = 0; l.inicio = t; } return l; };
    const gl = pega('global'); const ip = pega(a.p_chave_ip);
    const resta = (l) => Math.max(1, Math.ceil((jan - (t - l.inicio)) / 1000));
    if (ip.contagem >= a.p_limite_ip) return { data: [{ permitido: false, motivo: 'ip', contagem_ip: ip.contagem, contagem_global: gl.contagem, segundos_ate_reset: resta(ip) }], error: null };
    if (gl.contagem >= a.p_limite_global) return { data: [{ permitido: false, motivo: 'global', contagem_ip: ip.contagem, contagem_global: gl.contagem, segundos_ate_reset: resta(gl) }], error: null };
    gl.contagem++; ip.contagem++;
    return { data: [{ permitido: true, motivo: null, contagem_ip: ip.contagem, contagem_global: gl.contagem, segundos_ate_reset: resta(ip) }], error: null };
  };
  return { rpc, linhas, chamadas };
}
const mem = (o) => criarOrcamentoDemo(o);
const relogio = { t: 1000000 };

(async () => {
  console.log('== Limites ==');
  await teste('limite por IP: permite N, bloqueia o N+1 com motivo ip e horas até o reset', async () => {
    const db = bancoSimulado(relogio); const o = criarOrcamentoDemoPersistente({ rpc: db.rpc, fallback: mem(), limiteDiaPorIp: 3, limiteDiaGlobal: 100, sal: 's' });
    for (let i = 0; i < 3; i++) assert.ok((await o.consumir('1.1.1.1')).permitido);
    const r = await o.consumir('1.1.1.1'); assert.ok(!r.permitido && r.motivo === 'ip' && r.horasAteReset >= 1 && r.fonte === 'banco');
    assert.ok((await o.consumir('2.2.2.2')).permitido, 'outro IP não é afetado');
  });
  await teste('limite global: vale para muitos IPs distintos e NÃO gasta o orçamento do IP quando o global acabou', async () => {
    const db = bancoSimulado(relogio); relogio.t += 99999999; const o = criarOrcamentoDemoPersistente({ rpc: db.rpc, fallback: mem(), limiteDiaPorIp: 5, limiteDiaGlobal: 4, sal: 's' });
    for (let i = 0; i < 4; i++) assert.ok((await o.consumir('10.0.0.' + i)).permitido);
    const r = await o.consumir('10.0.0.99'); assert.ok(!r.permitido && r.motivo === 'global');
    assert.strictEqual(db.linhas.get(hashDoIp('10.0.0.99', 's')).contagem, 0, 'IP bloqueado pelo global não consumiu');
  });
  await teste('a janela reinicia (24h) e libera de novo', async () => {
    const db = bancoSimulado(relogio); relogio.t += 99999999; const o = criarOrcamentoDemoPersistente({ rpc: db.rpc, fallback: mem(), limiteDiaPorIp: 1, limiteDiaGlobal: 10, sal: 's' });
    assert.ok((await o.consumir('3.3.3.3')).permitido); assert.ok(!(await o.consumir('3.3.3.3')).permitido);
    relogio.t += 24 * 3600 * 1000 + 1; assert.ok((await o.consumir('3.3.3.3')).permitido);
  });
  await teste('PERSISTE entre reinícios (nova instância, mesmo banco) — o que a memória não faz', async () => {
    const db = bancoSimulado(relogio); relogio.t += 99999999;
    const a = criarOrcamentoDemoPersistente({ rpc: db.rpc, fallback: mem(), limiteDiaPorIp: 2, limiteDiaGlobal: 10, sal: 's' });
    await a.consumir('4.4.4.4'); await a.consumir('4.4.4.4');
    const depoisDoDeploy = criarOrcamentoDemoPersistente({ rpc: db.rpc, fallback: mem(), limiteDiaPorIp: 2, limiteDiaGlobal: 10, sal: 's' });
    assert.ok(!(await depoisDoDeploy.consumir('4.4.4.4')).permitido);
    const memoria = mem({ limiteDiaPorIp: 2 }); memoria.consumir('4.4.4.4'); memoria.consumir('4.4.4.4'); const memoriaNova = mem({ limiteDiaPorIp: 2 });
    assert.ok(memoriaNova.consumir('4.4.4.4').permitido, 'contraste: a memória zera no reinício');
  });

  console.log('== Privacidade e falha segura ==');
  await teste('o banco nunca recebe o IP bruto; hash depende do sal; sem texto de visitante', async () => {
    const db = bancoSimulado(relogio); const o = criarOrcamentoDemoPersistente({ rpc: db.rpc, fallback: mem(), sal: 'segredo' }); await o.consumir('200.100.50.25');
    const enviado = JSON.stringify(db.chamadas); assert.ok(!enviado.includes('200.100.50.25')); assert.ok(/ip:[0-9a-f]{32}/.test(enviado));
    assert.notStrictEqual(hashDoIp('1.1.1.1', 'a'), hashDoIp('1.1.1.1', 'b')); assert.notStrictEqual(hashDoIp('1.1.1.1', 'a'), hashDoIp('1.1.1.2', 'a'));
    assert.deepStrictEqual(Object.keys(db.chamadas[0].a).sort(), ['p_chave_ip', 'p_janela_seg', 'p_limite_global', 'p_limite_ip']);
  });
  await teste('FALHA DO BANCO => usa o orçamento em memória (limite continua valendo; não libera tudo)', async () => {
    let eventos = []; const quebrado = async () => ({ data: null, error: { message: 'timeout' } });
    const o = criarOrcamentoDemoPersistente({ rpc: quebrado, fallback: mem({ limiteDiaPorIp: 2, limiteDiaGlobal: 100 }), aoEvento: (e) => eventos.push(e) });
    assert.ok((await o.consumir('5.5.5.5')).permitido); assert.ok((await o.consumir('5.5.5.5')).permitido);
    const r = await o.consumir('5.5.5.5'); assert.ok(!r.permitido && r.fonte === 'memoria'); assert.ok(eventos.includes('fallback'));
  });
  await teste('exceção, resposta malformada ou vazia => memória', async () => {
    for (const rpc of [async () => { throw new Error('rede'); }, async () => ({ data: [{ foo: 1 }], error: null }), async () => ({ data: [], error: null }), async () => undefined]) {
      const o = criarOrcamentoDemoPersistente({ rpc, fallback: mem({ limiteDiaPorIp: 1 }) }); assert.ok((await o.consumir('6.6.6.6')).permitido); assert.ok(!(await o.consumir('6.6.6.6')).permitido);
    }
  });
  await teste('aviso de 80% do teto global dispara uma única vez por janela', async () => {
    const db = bancoSimulado(relogio); relogio.t += 99999999; const ev = [];
    const o = criarOrcamentoDemoPersistente({ rpc: db.rpc, fallback: mem(), limiteDiaPorIp: 50, limiteDiaGlobal: 10, aoEvento: (e) => ev.push(e), agora: () => relogio.t });
    for (let i = 0; i < 10; i++) await o.consumir('7.7.7.' + i);
    assert.strictEqual(ev.filter((e) => e === 'global_80').length, 1);
  });
  await teste('limites inválidos no ambiente caem nos padrões (20/300) e parâmetros são enviados ao banco', async () => {
    const db = bancoSimulado(relogio); const o = criarOrcamentoDemoPersistente({ rpc: db.rpc, fallback: mem(), limiteDiaPorIp: 'abc', limiteDiaGlobal: '-5' });
    assert.deepStrictEqual({ ...o.limites }, { porIp: 20, global: 300, janelaSeg: 86400 }); await o.consumir('8.8.8.8'); assert.strictEqual(db.chamadas[0].a.p_limite_ip, 20);
    assert.throws(() => criarOrcamentoDemoPersistente({ fallback: mem() })); assert.throws(() => criarOrcamentoDemoPersistente({ rpc: db.rpc }));
  });

  console.log('== Fiação e migração ==');
  const srv = fs.readFileSync(path.join(raiz, 'src/server.js'), 'utf8').replace(/\r\n/g, '\n');
  await teste('servidor: desligado por padrão (flag), cai na memória, rota usa await orcamentoDemo.consumir', async () => {
    assert.ok(/process\.env\.DEMO_LIMITES_PERSISTENTES === '1' && supabase/.test(srv));
    assert.ok(/fallback: orcamentoDemoMemoria/.test(srv)); assert.ok(/const orcamento = await orcamentoDemo\.consumir\(extrairIpConfiavel\(req\)\)/.test(srv));
    assert.ok(/orcamentoDemoPersistente \? orcamentoDemoPersistente\.consumir\(ip\) : orcamentoDemoMemoria\.consumir\(ip\)/.test(srv));
  });
  await teste('oferta comercial inalterada: ainda 5 trocas (não 3) e limites padrão 20/300', async () => {
    const rl = require(path.join(raiz, 'src/lib/rateLimitExperimente')); const p = require(path.join(raiz, 'src/lib/protecaoMentorDemo'));
    assert.strictEqual(rl.LIMITE_TROCAS, 5); assert.strictEqual(p.LIMITE_DIA_POR_IP, 20); assert.strictEqual(p.LIMITE_DIA_GLOBAL, 300);
  });
  await teste('migração 008: RLS ligada, sem acesso anon/authenticated, execução só service_role, atômica, sem IP bruto', async () => {
    const sql = fs.readFileSync(path.join(raiz, 'migrations/008_orcamento_demo.sql'), 'utf8');
    assert.ok(/ENABLE ROW LEVEL SECURITY/.test(sql)); assert.ok(/REVOKE ALL ON orcamento_demo FROM PUBLIC, anon, authenticated/.test(sql));
    assert.ok(/REVOKE ALL ON FUNCTION consumir_orcamento_demo[^;]*FROM PUBLIC, anon, authenticated/.test(sql)); assert.ok(/GRANT EXECUTE ON FUNCTION consumir_orcamento_demo[^;]*TO service_role/.test(sql));
    assert.ok(/FOR UPDATE/.test(sql)); assert.ok(/SECURITY INVOKER/.test(sql)); assert.ok(!/SECURITY DEFINER/.test(sql)); assert.ok(/NÃO APLICADA/.test(sql));
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join('; ')); process.exit(1); }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1); });
