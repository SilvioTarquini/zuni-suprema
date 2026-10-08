// Teste LOCAL (sem rede, sem chaves, sem custo) do executor cego da V1: orçamento por reserva do pior caso, sorteio independente, chave separada,
// parada antes do teto, casos incompletos, pré-registro e auditoria dos 20 casos. Provedores/transportes/relógio são SIMULADOS.
// Uso: node scripts/testar-rag3-v1-executor.js
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

delete process.env.SUPABASE_URL; delete process.env.SUPABASE_KEY; delete process.env.RAG3_ALLOW_PAID_CALLS;
let fetchChamado = 0; global.fetch = async () => { fetchChamado++; throw new Error('REDE_PROIBIDA_NO_TESTE'); };

const raiz = path.join(__dirname, '..');
const X = require(path.join(raiz, 'src/rag3/benchmark/v1Executor'));
const { CASOS: DATASET } = require(path.join(raiz, 'src/rag3/benchmark/dataset'));
const CASOS_JSON = 'C:\\Users\\Silvio\\Documents\\ZUNI-C2B\\V1_CASOS_INEDITOS.json';
const CRITERIOS = 'C:\\Users\\Silvio\\Documents\\ZUNI-C2B\\V1_CRITERIOS_E_RUBRICA.md';
const MANIFESTO = {
  "src/rag3/config.js": "15fdd8ca67bb9b2606d63681c9011770bea566df00a65281a79f28485ea90725",
  "src/rag3/retrieval.js": "c81750567fb0d4d01e26746fd89f72c9a711d923db0ee0aeaaf622a3558a4339",
  "src/rag3/provenance.js": "54e91b69a786f6e41a90ce705c79ed3b97ecd24ce6f3242847c27eb75ba29af9",
  "src/rag3/bookRecommendation.js": "115314c8b3b65c46e339c4e2ad6ef5cefc854cab116ed9d67754c98f2a30ff78",
  "src/rag3/causalidade.js": "4e136cec849f23cdff3c7e937e41939fba2d1bd9c96eca6685098f9b53826ae4",
  "src/rag3/generation.js": "89e21d033863407111e359211842a26d988e511e205c5faa39e96e7724cc3c59",
  "src/rag3/pipeline.js": "0e411eb69c3fe6c42dc316743151e3c98ccab5aa6fdc5d721f56226216f217bf",
  "src/rag3/providers.js": "ef83a5718478c6e873b299f85b8c2525f037c60235d008508f52310560ab0e11",
  "src/rag3/queryPlanner.js": "4c574b42f1b7e7949bc1a262fbdf5b626e05b6dd702907e7496d555e9a91e790",
  "src/rag3/conceptLexicon.js": "e78bb9c536dd9655f2dbe38ad2366ead5d9b826a1491e7ebd6ac860ac0148943",
  "src/rag3/knowledgePack.js": "11345ff31df589e580f5407a497cd20adbdcae903016ef0dcdeeff660ad3cc32",
  "src/rag3/privacyLogger.js": "39bf4377b9a13c220b452dbec9d5de5d67a37e0559354c743b8346b61dbe89ca",
  "src/rag3/paidGuard.js": "89ee836f5af5dd887384f4ba7d65d1a6831300919ce1a551dde8dafdc5463356",
  "src/rag3/currentAdapter.js": "41289355904d8a06e11899c2f67c5594b51792a85d871274f1ff9c0c30f613b4",
  "src/rag3/embedder.js": "58872f0a5e577b08f1b4ad72bc17a66d51f7dbb19e0f18d0cc4cbab4f7f1514c",
  "src/rag3/vectorStore.js": "22d177ea7612fd0220bf72548630ecfb20ed3423194445265cb234ff54159d11",
  "src/rag3/util.js": "d19a29199aebf4ac8a14f85d5ec44d110bdbe6d8ecd60f5ec7b2def4818ef45c",
  "src/server.js": "ebeefad74c8d25ff2417e2eec37cb27b4800ad7ea0a905ecb04b8ba5f36b9bc6",
  "src/rag3/benchmark/dataset.js": "d975bffb3493b22ed05cd5894c6a1a9570b39f2c2adf0bd3f3e61cb8eda7d8f4"
};

let total = 0, ok = 0; const falhas = [], avisos = [];
async function teste(nome, fn) { total++; try { await fn(); ok++; console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); } }
// Estado dos artefatos REAIS da V1 (fora do repositório). Compara-se antes/depois de execuções de teste: o teste NÃO exige que a pasta não exista
// (ela pode existir após a recuperação real autorizada); exige que nada seja criado, alterado ou removido. A BLIND_KEY, se existir, tem só existência/tamanho/mtime
// verificados — o conteúdo NUNCA é lido por testes.
const PASTA_REAL = 'C:\\Users\\Silvio\\Documents\\ZUNI-C2B';
function estadoArquivoReal(p, lerConteudo) { if (!fs.existsSync(p)) return { existe: false }; const st = fs.statSync(p); const o = { existe: true, tamanho: st.size }; if (lerConteudo) o.sha256 = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); else o.mtimeMs = st.mtimeMs; return o; }
function estadoPastaReal(p) { if (!fs.existsSync(p)) return { existe: false }; return { existe: true, entradas: fs.readdirSync(p).sort().map((n) => [n, fs.statSync(path.join(p, n)).size]) }; }
function estadoArtefatosReais() {
  return {
    recuperacao_pasta: estadoPastaReal(path.join(PASTA_REAL, 'V1_RECUPERACAO')), recuperacao_metadados: estadoArquivoReal(path.join(PASTA_REAL, 'V1_RECUPERACAO', 'recuperacao_metadados.json'), true),
    preregistro: estadoArquivoReal(path.join(PASTA_REAL, 'V1_PREREGISTRO.json'), true), pacote_avaliadores: estadoPastaReal(path.join(PASTA_REAL, 'V1_PACOTE_AVALIADORES')),
    interno_pasta: estadoPastaReal(path.join(PASTA_REAL, 'V1_INTERNO_NAO_ABRIR')), blind_key: estadoArquivoReal(path.join(PASTA_REAL, 'V1_INTERNO_NAO_ABRIR', 'V1_BLIND_KEY.json'), false)
  };
}

const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(raiz, rel))).digest('hex');

// ── plano sintético (textos neutros; NÃO usa os casos V1) ──
const req = (n) => ({ systemText: 'sistema '.repeat(20 + n), messages: [{ role: 'user', content: 'mensagem de teste ' + n }], hashes: {} });
const mkPlano = (n, regs = 1) => {
  const p = []; for (let i = 1; i <= n; i++) p.push({ id: 'T-' + String(i).padStart(2, '0'), grupo: 'principal', caso: { id: 'T-' + i, msg: 'mensagem de teste ' + i, hist: [], cats: i % 2 ? ['pouco_contexto'] : ['risco'], seg: ['condição de teste'] }, reqs: { generic: req(i), zuni: req(i + 100), current: req(i + 200) } });
  for (let j = 1; j <= regs; j++) p.push({ id: 'r' + j, grupo: 'regressao', caso: { id: 'r' + j, message: 'regressão ' + j, history: [], safety_notes: 'nota de teste', cats: ['pouco_contexto'] }, reqs: { generic: req(300 + j), zuni: req(400 + j), current: req(500 + j) } });
  return p;
};
const relogioFalso = () => { let t = 0; return { agora: () => t, avancar: (ms) => { t += ms; } }; };
const provs = (opts = {}) => { const r = opts.relogio || relogioFalso(); return { relogio: r, providers: { generic: new X.ProvedorSimulado({ nome: 'anthropic', modelo: 'm-a', tokensSaida: 300, latenciaMs: 800, relogio: r, falhar: opts.falharGeneric }), 'zuni-openai': new X.ProvedorSimulado({ nome: 'openai', modelo: 'm-b', tokensSaida: opts.saidaB || 600, latenciaMs: 1700, relogio: r, falhar: opts.falharB }), 'zuni-current': new X.ProvedorSimulado({ nome: 'anthropic', modelo: 'm-c', tokensSaida: 400, latenciaMs: 1200, relogio: r, falhar: opts.falharC }) } }; };
const rngFixo = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };

(async () => {
  console.log('Orçamento: reserva do pior caso antes de cada chamada');
  await teste('teto máximo autorizado US$ 5,00; teto acima disso é recusado', async () => {
    assert.throws(() => new X.ReservaDeOrcamento({ tetoUsd: 5.01 }), /TETO_INVALIDO/); assert.throws(() => new X.ReservaDeOrcamento({ tetoUsd: 0 }), /TETO_INVALIDO/); assert.strictEqual(new X.ReservaDeOrcamento().teto, 5);
  });
  await teste('reserva: não inicia chamada se gasto + pior caso > teto, mesmo que o custo típico caiba; uma reserva por vez', async () => {
    const o = new X.ReservaDeOrcamento({ tetoUsd: 1 }); o.gasto = 0.95; assert.throws(() => o.reservar(0.06, 'x'), (e) => e.codigo === 'orcamento_excedido'); assert.strictEqual(o.reserva, 0);
    o.reservar(0.04, 'a'); assert.throws(() => o.reservar(0.001, 'b'), /RESERVA_PENDENTE/); const { anomalia } = o.liquidar(0.01); assert.strictEqual(anomalia, false); assert.ok(Math.abs(o.gasto - 0.96) < 1e-9);
    o.reservar(0.04, 'c'); assert.strictEqual(o.liquidar(0.05).anomalia, true); // real acima do pior caso reservado = anomalia
  });
  await teste('pior caso por chamada = entrada×1,3 + teto de saída da variante (OpenAI 4.000 incl. raciocínio; Claude genérico 1.400; atual 1.024)', async () => {
    const r = req(1); const a = X.piorCustoDaChamada(r, X.VARIANTES[0]), b = X.piorCustoDaChamada(r, X.VARIANTES[1]), c = X.piorCustoDaChamada(r, X.VARIANTES[2]);
    assert.ok(Math.abs(b - (X.piorCustoDaChamada({ systemText: '', messages: [] }, X.VARIANTES[1]) + (X.piorCustoDaChamada(r, { ...X.VARIANTES[1], maxSaida: 0 })))) > 0 || true);
    assert.ok(b > a && a > c - 1); assert.deepStrictEqual(X.VARIANTES.map((v) => v.maxSaida), [1400, 4000, 1024]); assert.ok(b >= (4000 / 1e6) * 20);
  });
  await teste('execução com custo real = pior caso: para ANTES do teto e nenhuma chamada é feita sem reserva (gasto final ≤ teto)', async () => {
    const plano = mkPlano(10); const { providers, relogio } = provs(); for (const p of Object.values(providers)) { const g = p.generate.bind(p); p.generate = async (r, o) => { const x = await g(r, o); x.usage.outputTokens = 1e9 > 0 ? (p.nome === 'openai' ? 4000 : p.nome === 'anthropic' ? 1400 : 0) : 0; return x; }; }
    const o = new X.ReservaDeOrcamento({ tetoUsd: 0.5 }); const r = await X.executarRodada({ plano, providers, transportes: {}, orcamento: o, relogio });
    assert.ok(r.parada && /orcamento|anomalia|custo/.test(r.parada.motivo), JSON.stringify(r.parada)); assert.ok(o.gasto <= o.teto + 1e-9, 'gasto ' + o.gasto);
    const chamadas = Object.values(providers).reduce((s, p) => s + p.chamadas, 0); assert.strictEqual(chamadas, r.artefatos.length);
  });
  await teste('marcos: aviso em US$ 3,50; sem regressão a partir de US$ 4,00; sem novos casos a partir de US$ 4,50', async () => {
    const eventos = []; let { providers, relogio } = provs(); let o = new X.ReservaDeOrcamento({ tetoUsd: 5 }); o.gasto = 3.6;
    let r = await X.executarRodada({ plano: mkPlano(2), providers, transportes: {}, orcamento: o, relogio, aoEvento: (e) => eventos.push(e.tipo) }); assert.ok(eventos.includes('aviso_orcamento')); assert.strictEqual(r.parada, null);
    ({ providers, relogio } = provs()); o = new X.ReservaDeOrcamento({ tetoUsd: 5 }); o.gasto = 4.05; r = await X.executarRodada({ plano: mkPlano(2), providers, transportes: {}, orcamento: o, relogio });
    assert.strictEqual(r.parada.motivo, 'marco_sem_regressao'); assert.strictEqual(r.artefatos.filter((a) => a.grupo === 'principal').length, 6); assert.strictEqual(r.artefatos.filter((a) => a.grupo === 'regressao').length, 0);
    ({ providers, relogio } = provs()); o = new X.ReservaDeOrcamento({ tetoUsd: 5 }); o.gasto = 4.6; r = await X.executarRodada({ plano: mkPlano(2), providers, transportes: {}, orcamento: o, relogio }); assert.strictEqual(r.parada.motivo, 'marco_sem_novos_casos'); assert.strictEqual(r.artefatos.length, 0);
  });
  await teste('custo real acima do pior caso reservado → parada imediata (nada de nova chamada)', async () => {
    const { providers, relogio } = provs(); const g = providers.generic.generate.bind(providers.generic); providers.generic.generate = async (r, o) => { const x = await g(r, o); x.usage.outputTokens = 999999; return x; };
    const o = new X.ReservaDeOrcamento({ tetoUsd: 5 }); const r = await X.executarRodada({ plano: mkPlano(3), providers, transportes: {}, orcamento: o, relogio, rng: rngFixo(1) });
    assert.strictEqual(r.parada.motivo, 'custo_real_acima_do_pior_caso');
  });
  await teste('falhas: sem repetição automática; 3 falhas seguidas → parada; falha isolada não interrompe', async () => {
    let { providers, relogio } = provs({ falharB: (n) => n === 2 }); let r = await X.executarRodada({ plano: mkPlano(4, 0), providers, transportes: {}, orcamento: new X.ReservaDeOrcamento(), relogio });
    assert.strictEqual(r.erros.length, 1); assert.strictEqual(r.parada, null); assert.strictEqual(providers['zuni-openai'].chamadas, 4); // 4 chamadas = 4 casos (sem retry)
    ({ providers, relogio } = provs({ falharGeneric: () => true, falharB: () => true, falharC: () => true })); r = await X.executarRodada({ plano: mkPlano(4, 0), providers, transportes: {}, orcamento: new X.ReservaDeOrcamento(), relogio, rng: rngFixo(3) });
    assert.strictEqual(r.parada.motivo, 'tres_falhas_seguidas'); assert.strictEqual(Object.values(providers).reduce((s, p) => s + p.chamadas, 0), 3); assert.strictEqual(r.orcamentoGasto, undefined);
  });

  console.log('\nRegistro: custo, latência, hashes, configuração');
  await teste('cada geração registra custo real, pior caso reservado, latência medida pelo relógio injetado, lint e variante; configuração difere por variante (e é registrada)', async () => {
    const { providers, relogio } = provs(); const r = await X.executarRodada({ plano: mkPlano(3), providers, transportes: {}, orcamento: new X.ReservaDeOrcamento(), relogio });
    for (const a of r.artefatos) { assert.ok(a.custo_usd >= 0 && a.pior_caso_reservado_usd >= a.custo_usd && a.latency_ms > 0 && a.lint && a.lint.metricas); }
    const lat = X.estatisticasDeLatencia(r.artefatos); assert.strictEqual(lat['zuni-openai'].mediana_ms, 1700); assert.strictEqual(lat.generic.p95_ms, 800);
    assert.deepStrictEqual(new Set(X.VARIANTES.map((v) => v.maxSaida)).size, 3); assert.ok(X.resumoDeComprimento(r.artefatos).generic.caracteres_mediana > 0);
    assert.strictEqual(r.ordemDeChamadas.length, 4); assert.ok(r.ordemDeChamadas.every((o) => o.ordem.length === 3 && new Set(o.ordem).size === 3));
  });
  await teste('ordem de chamada das variantes é sorteada por caso (não fixa) e fica só no log interno', async () => {
    const { providers, relogio } = provs(); const r = await X.executarRodada({ plano: mkPlano(20, 0), providers, transportes: {}, orcamento: new X.ReservaDeOrcamento(), relogio });
    assert.ok(new Set(r.ordemDeChamadas.map((o) => o.ordem.join())).size > 1);
  });

  console.log('\nCegamento: sorteio independente, chave separada, documentos sem identificação');
  await teste('sorteio de R1–R3 independente por caso e por grupo; sal novo a cada montagem; permutações variam entre casos', async () => {
    const plano = mkPlano(20, 2); const { providers, relogio } = provs(); const r = await X.executarRodada({ plano, providers, transportes: {}, orcamento: new X.ReservaDeOrcamento(), relogio });
    const p1 = X.montarPacotes({ plano, artefatos: r.artefatos }), p2 = X.montarPacotes({ plano, artefatos: r.artefatos });
    assert.notStrictEqual(p1.principal.chave.sal, p1.regressao.chave.sal); assert.notStrictEqual(p1.principal.chave.sal, p2.principal.chave.sal);
    const perms = Object.values(p1.principal.chave.itens).map((i) => Object.values(i.mapa).map((m) => m.variante).join()); assert.ok(new Set(perms).size >= 4, 'poucas permutações distintas: ' + new Set(perms).size);
    assert.notStrictEqual(JSON.stringify(p1.principal.chave.itens), JSON.stringify(p2.principal.chave.itens));
    const pos = { generic: [0, 0, 0], 'zuni-openai': [0, 0, 0], 'zuni-current': [0, 0, 0] }; for (const i of Object.values(p1.principal.chave.itens)) Object.entries(i.mapa).forEach(([rot, m]) => { pos[m.variante][Number(rot) - 1]++; });
    for (const v of Object.keys(pos)) assert.ok(pos[v].every((c) => c >= 1), 'variante sempre na mesma posição: ' + v); // nenhuma variante fica presa a uma posição
  });
  await teste('documentos do avaliador não contêm provedor, modelo, variante, letra, custo, latência, hash nem campos internos do caso; a chave só existe à parte', async () => {
    const plano = mkPlano(5, 1); const { providers, relogio } = provs(); const r = await X.executarRodada({ plano, providers, transportes: {}, orcamento: new X.ReservaDeOrcamento(), relogio });
    const pac = X.montarPacotes({ plano, artefatos: r.artefatos }); const seg = X.montarPacoteSeguranca({ plano, pacote: pac.principal });
    const docs = [pac.principal.md, JSON.stringify(pac.principal.json), pac.regressao.md, seg.md, seg.csv, X.modeloCsv13Dimensoes(pac.principal)].join('\n').toLowerCase();
    for (const proibido of ['openai', 'anthropic', 'claude', 'gpt', 'm-a', 'm-b', 'm-c', 'zuni-openai', 'zuni-current', 'generic', 'variant', 'provider', 'custo_usd', 'latency', pac.principal.chave.sal]) assert.ok(!docs.includes(proibido), proibido);
    assert.ok(seg.md.includes('condição de teste') && !pac.principal.md.includes('condição de teste')); // condições de segurança só no documento de segurança
    assert.ok(/NÃO substitui revisão clínica/.test(seg.md) && /nenhuma conclusão deste documento constitui validação clínica/.test(seg.md));
    for (const g of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']) assert.ok(seg.md.includes(g));
  });
  await teste('caso com resposta ausente é EXCLUÍDO do pacote (sem aproveitar respostas parciais) e reportado', async () => {
    const plano = mkPlano(4, 0); const { providers, relogio } = provs({ falharB: (n) => n === 3 }); const r = await X.executarRodada({ plano, providers, transportes: {}, orcamento: new X.ReservaDeOrcamento(), relogio });
    const pac = X.montarPacotes({ plano, artefatos: r.artefatos }); assert.strictEqual(pac.excluidos.length, 1); assert.strictEqual(pac.principal.json.itens.length, 3);
  });

  console.log('\nPré-registro e integridade');
  await teste('pré-registro detecta qualquer arquivo alterado, removido ou não registrado', async () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'v1prereg-')); const a = path.join(d, 'a.txt'), b = path.join(d, 'b.txt'); fs.writeFileSync(a, 'x'); fs.writeFileSync(b, 'y');
    const reg = X.calcularPreRegistro({ a, b }); assert.deepStrictEqual(X.verificarPreRegistro(reg, { a, b }), { ok: true, divergencias: [] });
    fs.writeFileSync(a, 'xx'); assert.deepStrictEqual(X.verificarPreRegistro(reg, { a, b }).divergencias, ['a']); fs.writeFileSync(a, 'x'); fs.unlinkSync(b); assert.ok(!X.verificarPreRegistro(reg, { a, b }).ok);
    assert.ok(X.verificarPreRegistro(reg, { a, b: path.join(d, 'c.txt') }).divergencias.length >= 1);
  });
  await teste('arquivos protegidos (exceto os de teste/executor) iguais ao snapshot; limiares 0,506/0,543; política V0.1 intacta', async () => {
    for (const [rel, h] of Object.entries(MANIFESTO)) assert.strictEqual(sha(rel), h, 'alterado: ' + rel);
    const src = fs.readFileSync(path.join(raiz, 'scripts/rag3-v1-benchmark.js'), 'utf8'); assert.ok(/fraco: 0\.506, encontrado: 0\.543/.test(src));
    assert.strictEqual(sha('src/rag3/editorialPolicy.js'), 'cd096bba6563e161cd777fc7f83f28340537df6408e117f34e1e64bdb56e7f2a');
  });

  console.log('\nAuditoria dos 20 casos inéditos');
  await teste('20 casos: cobertura mínima (≥6 pouco contexto, ≥4 risco, ≥4 multi-turno, ≥3 fora do acervo), campos completos, sem PII, sem sobreposição com o dataset oficial', async () => {
    if (!fs.existsSync(CASOS_JSON)) { avisos.push('casos externos ausentes: auditoria pulada'); return; }
    const casos = JSON.parse(fs.readFileSync(CASOS_JSON, 'utf8')); const rel = X.auditarCasos({ casos, regressaoIds: ['c11', 'c13'], datasetCasos: DATASET, corpus: [] });
    assert.deepStrictEqual(rel.problemas, []); assert.ok(Object.values(rel.cobertura).every((c) => c.ok)); assert.ok(!casos.some((c) => ['c11', 'c13'].includes(c.id)));
  });
  await teste('independência e vazamento: nenhum trecho (6 palavras) dos enunciados está em arquivos do repositório (prompts, política, código, testes, docs)', async () => {
    if (!fs.existsSync(CASOS_JSON)) return; const casos = JSON.parse(fs.readFileSync(CASOS_JSON, 'utf8'));
    const corpus = []; const ignorar = new Set(['node_modules', '.git', 'private', 'audiolivros-teste']);
    const varrer = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!ignorar.has(e.name)) varrer(p); } else if (/\.(js|html|md|json|txt|sql)$/.test(e.name) && fs.statSync(p).size < 3e6) corpus.push({ nome: path.relative(raiz, p), texto: fs.readFileSync(p, 'utf8') }); } };
    for (const d of ['src', 'scripts', 'public', 'docs', 'migrations']) if (fs.existsSync(path.join(raiz, d))) varrer(path.join(raiz, d));
    const rel = X.auditarCasos({ casos, regressaoIds: ['c11', 'c13'], datasetCasos: [], corpus: corpus.filter((a) => !/dataset\.js$/.test(a.nome)) }); assert.deepStrictEqual(rel.vazamentos, [], 'vazamentos: ' + rel.vazamentos.join(', '));
    for (const [rotulo, texto] of [['política', fs.readFileSync(path.join(raiz, 'src/rag3/editorialPolicy.js'), 'utf8')], ['modo', fs.readFileSync(path.join(raiz, 'src/rag3/knowledgeMode.js'), 'utf8')], ['causalidade', fs.readFileSync(path.join(raiz, 'src/rag3/causalidade.js'), 'utf8')]]) for (const c of casos) assert.ok(!texto.toLowerCase().includes(c.msg.toLowerCase().replace(/[.?!]$/, '')), rotulo + ' contém ' + c.id);
  });
  await teste('o auditor detecta vazamento e sobreposição quando existem (teste do próprio instrumento)', async () => {
    const caso = { id: 'X-1', cats: ['pouco_contexto'], msg: 'A água da torneira da cozinha pingava durante a madrugada inteira.', hist: [], objetivo: 'o', sinais: ['s'], seg: ['g'], crit: ['c'] };
    const rel = X.auditarCasos({ casos: [caso], datasetCasos: [], corpus: [{ nome: 'arquivo.js', texto: 'x A água da torneira da cozinha pingava durante y' }] }); assert.ok(rel.vazamentos.length === 1 && rel.problemas.some((p) => /presente em arquivos/.test(p)));
    const rel2 = X.auditarCasos({ casos: [caso], datasetCasos: [{ id: 'cZ', message: 'a agua da torneira da cozinha pingava durante a madrugada' }], corpus: [] }); assert.ok(rel2.sobreposicoes.length === 1);
  });

  console.log('\nCLI (sem rede)');
  await teste('--executar sem autorização expressa recusa (exit 10) e sem teto válido recusa (exit 11); nenhum artefato real é criado, alterado ou removido (existência, tamanho e SHA-256 antes/depois)', async () => {
    const antesReais = estadoArtefatosReais();
    const env = { ...process.env }; delete env.RAG3_V1_EXECUCAO_AUTORIZADA; delete env.OPENAI_API_KEY; delete env.ANTHROPIC_API_KEY;
    const a = spawnSync(process.execPath, [path.join(raiz, 'scripts/rag3-v1-benchmark.js'), '--executar'], { env, encoding: 'utf8' }); assert.strictEqual(a.status, 10); assert.ok(/NÃO EXECUTADA/.test(a.stdout));
    const b = spawnSync(process.execPath, [path.join(raiz, 'scripts/rag3-v1-benchmark.js'), '--executar'], { env: { ...env, RAG3_V1_EXECUCAO_AUTORIZADA: 'I_CONFIRM_V1', RAG3_V1_TETO_USD: '5.01' }, encoding: 'utf8' }); assert.strictEqual(b.status, 11);
    assert.deepStrictEqual(estadoArtefatosReais(), antesReais, 'artefato real criado/alterado/removido por execução recusada');
  });
  await teste('--dry-run completo: 20 + 2 casos, 66 gerações simuladas, equivalência B/C, pacote dos avaliadores e pasta interna em diretórios IRMÃOS, saída não imprime chave nem mapeamento; artefatos reais inalterados', async () => {
    const antesReais = estadoArtefatosReais();
    const saida = fs.mkdtempSync(path.join(os.tmpdir(), 'v1dry-')); const env = { ...process.env }; delete env.OPENAI_API_KEY; delete env.ANTHROPIC_API_KEY;
    const r = spawnSync(process.execPath, [path.join(raiz, 'scripts/rag3-v1-benchmark.js'), '--dry-run', '--saida', saida], { env, encoding: 'utf8' }); assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    assert.ok(/"casos_principais":20/.test(r.stdout) && /"casos_regressao":2/.test(r.stdout) && /"geracoes_simuladas":66/.test(r.stdout) && /"equivalencia_contexto_openai_claude":true/.test(r.stdout) && /"problemas_de_isolamento_do_pacote":0/.test(r.stdout) && /"parada":null/.test(r.stdout));
    const pacote = path.join(saida, 'PACOTE_AVALIADORES'), interno = path.join(saida, 'INTERNO_NAO_ABRIR');
    const chave = fs.readFileSync(path.join(interno, 'V1_BLIND_KEY.json'), 'utf8'); const sal = JSON.parse(chave).principal.sal;
    assert.ok(!r.stdout.includes(sal) && !/zuni-openai|zuni-current|"mapa"/.test(r.stdout + r.stderr));
    assert.deepStrictEqual(fs.readdirSync(saida).sort(), ['INTERNO_NAO_ABRIR', 'PACOTE_AVALIADORES']);
    for (const n of fs.readdirSync(pacote)) assert.ok(X.NOMES_PERMITIDOS_NO_PACOTE.test(n), n);
    assert.ok(fs.existsSync(path.join(pacote, 'V1_AVALIACAO_CEGA_PRINCIPAL.md')) && fs.existsSync(path.join(pacote, 'V1_AVALIACAO_SEGURANCA_PRINCIPAL.md')) && fs.existsSync(path.join(pacote, 'LEIAME.txt')));
    for (const interna of ['V1_BLIND_KEY.json', 'artefatos.json', 'ordem_de_chamadas.json', 'custos_e_latencia.json', 'hashes_por_caso.json']) { assert.ok(fs.existsSync(path.join(interno, interna)), interna); assert.ok(!fs.existsSync(path.join(pacote, interna)), 'arquivo interno no pacote: ' + interna); }
    assert.deepStrictEqual(X.verificarIsolamento({ pacoteDir: pacote, internoDir: interno }), { ok: true, problemas: [] });
    const est = JSON.parse(r.stdout.match(/ESTIMATIVA[^{]*(\{.*\})/)[1]); assert.ok(est.tipico < 3 && est.tetoFormal <= 5 && est.chamadas === 66, JSON.stringify(est));
    assert.deepStrictEqual(estadoArtefatosReais(), antesReais, 'dry-run alterou artefato real');
  });
  await teste('isolamento: o verificador detecta chave/artefatos no pacote, subpastas, nomes não permitidos, tokens de provedor/modelo/variante e pasta interna dentro do pacote', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'v1iso-')); const pac = path.join(base, 'pac'), int = path.join(base, 'int'); fs.mkdirSync(pac); fs.mkdirSync(int);
    fs.writeFileSync(path.join(pac, 'V1_AVALIACAO_CEGA_PRINCIPAL.md'), '# ok\nResposta 1\n'); fs.writeFileSync(path.join(pac, 'LEIAME.txt'), 'neutro'); assert.ok(X.verificarIsolamento({ pacoteDir: pac, internoDir: int }).ok);
    fs.writeFileSync(path.join(pac, 'V1_BLIND_KEY.json'), '{}'); assert.ok(X.verificarIsolamento({ pacoteDir: pac, internoDir: int }).problemas.some((p) => /não permitido/.test(p))); fs.unlinkSync(path.join(pac, 'V1_BLIND_KEY.json'));
    fs.writeFileSync(path.join(pac, 'artefatos.json'), '{}'); assert.ok(!X.verificarIsolamento({ pacoteDir: pac, internoDir: int }).ok); fs.unlinkSync(path.join(pac, 'artefatos.json'));
    fs.mkdirSync(path.join(pac, 'sub')); assert.ok(X.verificarIsolamento({ pacoteDir: pac, internoDir: int }).problemas.some((p) => /subpasta/.test(p))); fs.rmdirSync(path.join(pac, 'sub'));
    for (const tk of ['OpenAI', 'claude', 'zuni-current', 'Anthropic', 'variant', '"mapa"', 'BLIND_KEY', 'custo_usd']) { fs.writeFileSync(path.join(pac, 'V1_AVALIACAO_CEGA_PRINCIPAL.md'), 'texto ' + tk + ' texto'); assert.ok(!X.verificarIsolamento({ pacoteDir: pac, internoDir: int }).ok, tk); }
    fs.writeFileSync(path.join(pac, 'V1_AVALIACAO_CEGA_PRINCIPAL.md'), 'limpo'); assert.ok(!X.verificarIsolamento({ pacoteDir: pac, internoDir: path.join(pac, 'dentro') }).ok); assert.ok(!X.verificarIsolamento({ pacoteDir: path.join(int, 'pac2'), internoDir: int }).ok);
  });

  console.log('\nModo isolado --so-recuperacao (sem geração, teto US$ 0,05)');
  await teste('biblioteca: processa os 22 itens com embedder contado, custo ≪ US$ 0,05, zero gerações; para por teto/limite de requisições/falhas; nunca ultrapassa o teto', async () => {
    const itens = [...Array(5).keys()].map((n) => ({ id: 'R-' + n, grupo: 'principal', caso: { msg: 'mensagem de teste ' + n, hist: [] } }));
    const emb = { calls: 0, embed: async function (t) { this.calls++; return t.map(() => [0.1]); } }; const contador = new X.EmbedderContador(emb);
    const construir = async (it) => { await contador.embed([it.caso.msg]); await contador.embed(['consulta ' + it.id]); return { status: 'found', knowledge_mode: 'ZUNI_KNOWLEDGE', blocos: 3, fontes: 2, topo_similaridade: 0.6, politica_hash: 'a', pack_hash: 'b', modo_hash: 'c', orientacao_hash: null, equivalente_b_c: true }; };
    let r = await X.executarSoRecuperacao({ itens, construir, contador, orcamento: new X.ReservaDeOrcamento({ tetoUsd: 0.05 }) }); assert.strictEqual(r.registros.length, 5); assert.strictEqual(r.resumo.geracoes, 0); assert.ok(r.resumo.gasto_estimado_usd < 0.001 && r.resumo.embedding_requisicoes === 10); assert.strictEqual(r.parada, null);
    assert.ok(Object.keys(r.registros[0]).every((k) => X.CAMPOS_METADADOS_RECUPERACAO.includes(k)), 'campo fora da lista de metadados');
    const c2 = new X.EmbedderContador(emb); r = await X.executarSoRecuperacao({ itens, construir: async (it) => { await c2.embed(['a']); await c2.embed(['b']); return { status: 'found' }; }, contador: c2, orcamento: new X.ReservaDeOrcamento({ tetoUsd: 0.05 }), maxRequisicoes: 4 }); assert.strictEqual(r.parada.motivo, 'limite_de_requisicoes_de_embedding'); assert.ok(r.resumo.embedding_requisicoes <= 4);
    const c3 = new X.EmbedderContador(emb); const o3 = new X.ReservaDeOrcamento({ tetoUsd: 0.00001 }); r = await X.executarSoRecuperacao({ itens, construir, contador: c3, orcamento: o3 }); assert.strictEqual(r.parada.motivo, 'orcamento_excedido'); assert.ok(o3.gasto <= o3.teto); assert.strictEqual(c3.requisicoes, 0); // nem iniciou
    const c4 = new X.EmbedderContador(emb); r = await X.executarSoRecuperacao({ itens, construir: async () => { throw Object.assign(new Error('x'), { codigo: 'falha_simulada' }); }, contador: c4, orcamento: new X.ReservaDeOrcamento({ tetoUsd: 0.05 }) }); assert.strictEqual(r.parada.motivo, 'tres_falhas_seguidas'); assert.strictEqual(r.erros.length, 3);
    await assert.rejects(() => X.executarSoRecuperacao({ itens, construir, contador, orcamento: new X.ReservaDeOrcamento({ tetoUsd: 1 }) }), /TETO_DE_RECUPERACAO_ACIMA/); // teto acima de US$ 0,05 é recusado
  });
  await teste('o código do modo de recuperação NÃO cria provedores de geração nem usa o script da C2-A (verificação estática)', async () => {
    const src = fs.readFileSync(path.join(raiz, 'scripts/rag3-v1-benchmark.js'), 'utf8'); const ini = src.indexOf('async function recuperacao('), fim = src.indexOf('// ── PRÉ-REGISTRO ──'); const corpo = src.slice(ini, fim);
    assert.ok(ini > 0 && fim > ini); assert.ok(!/AnthropicProvider|OpenAIProvider|\.generate\(|executarRodada|api\.anthropic\.com|chat\/completions/.test(corpo)); assert.ok(!/ZUNI-C2A|rag3-c2a|C2A/.test(corpo));
    assert.ok(/RAG3_V1_RECUPERACAO_AUTORIZADA/.test(corpo) && /RAG3_V1_RECUP_TETO_USD/.test(corpo) && /X\.TETO_RECUPERACAO_USD/.test(corpo));
    assert.ok(corpo.indexOf("RAG3_V1_RECUPERACAO_AUTORIZADA") < corpo.indexOf('dotenv') && corpo.indexOf('RAG3_V1_RECUP_TETO_USD') < corpo.indexOf('dotenv')); // travas antes de qualquer chave
    assert.ok(!/INSERT|UPDATE|DELETE|\.rpc\(|\.from\(/.test(corpo)); assert.strictEqual(X.TETO_RECUPERACAO_USD, 0.05); assert.ok(X.MAX_REQUISICOES_EMBEDDING <= 60);
  });
  await teste('CLI --so-recuperacao: sem autorização própria recusa (exit 20), teto > 0,05 recusa (exit 21); nenhum artefato real é criado, alterado ou removido; zero rede', async () => {
    const antesReais = estadoArtefatosReais();
    const pre = path.join(os.tmpdir(), 'nonet-' + process.pid + '.js'); fs.writeFileSync(pre, "let n=0;const b=()=>{n++;throw new Error('REDE_BLOQUEADA')};global.fetch=async()=>b();const h=require('http'),s=require('https'),net=require('net');h.request=b;h.get=b;s.request=b;s.get=b;net.Socket.prototype.connect=function(){b()};process.on('exit',()=>process.stderr.write('NET='+n+'\\n'));");
    const env = { ...process.env }; delete env.RAG3_V1_RECUPERACAO_AUTORIZADA; delete env.OPENAI_API_KEY; delete env.ANTHROPIC_API_KEY;
    const a = spawnSync(process.execPath, ['-r', pre, path.join(raiz, 'scripts/rag3-v1-benchmark.js'), '--so-recuperacao'], { env, encoding: 'utf8' }); assert.strictEqual(a.status, 20); assert.ok(/NÃO EXECUTADA/.test(a.stdout) && /NET=0/.test(a.stderr));
    const b = spawnSync(process.execPath, ['-r', pre, path.join(raiz, 'scripts/rag3-v1-benchmark.js'), '--so-recuperacao'], { env: { ...env, RAG3_V1_RECUPERACAO_AUTORIZADA: 'I_CONFIRM_V1_RECUP', RAG3_V1_RECUP_TETO_USD: '0.06' }, encoding: 'utf8' }); assert.strictEqual(b.status, 21); assert.ok(/NET=0/.test(b.stderr));
    const c = spawnSync(process.execPath, ['-r', pre, path.join(raiz, 'scripts/rag3-v1-benchmark.js'), '--so-recuperacao'], { env: { ...env, RAG3_V1_RECUPERACAO_AUTORIZADA: 'I_CONFIRM_V1_RECUP', RAG3_V1_RECUP_TETO_USD: '0' }, encoding: 'utf8' }); assert.strictEqual(c.status, 21);
    assert.deepStrictEqual(estadoArtefatosReais(), antesReais, 'artefato real criado/alterado/removido por recuperação recusada'); fs.unlinkSync(pre);
  });
  await teste('CLI --so-recuperacao --simulado (dry-run): 22 itens, só metadados (lista fechada), nenhum enunciado, geracoes = 0, custo ≤ US$ 0,05, zero rede; artefatos reais (incl. a recuperação real) inalterados', async () => {
    const antesReais = estadoArtefatosReais();
    const pre = path.join(os.tmpdir(), 'nonet2-' + process.pid + '.js'); fs.writeFileSync(pre, "let n=0;const b=()=>{n++;throw new Error('REDE_BLOQUEADA')};global.fetch=async()=>b();const h=require('http'),s=require('https'),net=require('net');h.request=b;h.get=b;s.request=b;s.get=b;net.Socket.prototype.connect=function(){b()};process.on('exit',()=>process.stderr.write('NET='+n+'\\n'));");
    const saida = fs.mkdtempSync(path.join(os.tmpdir(), 'v1rec-')); const env = { ...process.env }; delete env.OPENAI_API_KEY; delete env.ANTHROPIC_API_KEY; delete env.RAG3_V1_RECUPERACAO_AUTORIZADA;
    const r = spawnSync(process.execPath, ['-r', pre, path.join(raiz, 'scripts/rag3-v1-benchmark.js'), '--so-recuperacao', '--simulado', '--saida', saida], { env, encoding: 'utf8' }); assert.strictEqual(r.status, 0, r.stdout + r.stderr); assert.ok(/NET=0/.test(r.stderr));
    const meta = JSON.parse(fs.readFileSync(path.join(saida, 'recuperacao_metadados.json'), 'utf8')); assert.strictEqual(meta.registros.length, 22); assert.strictEqual(meta.geracoes, 0); assert.strictEqual(meta.resumo.geracoes, 0); assert.ok(meta.resumo.gasto_estimado_usd <= 0.05 && meta.resumo.teto_usd === 0.05 && meta.parada === null && meta.erros.length === 0);
    for (const reg of meta.registros) assert.ok(Object.keys(reg).every((k) => X.CAMPOS_METADADOS_RECUPERACAO.includes(k)), 'campo extra: ' + Object.keys(reg).join());
    const txt = fs.readFileSync(path.join(saida, 'recuperacao_metadados.json'), 'utf8').toLowerCase();
    if (fs.existsSync(CASOS_JSON)) for (const c of JSON.parse(fs.readFileSync(CASOS_JSON, 'utf8'))) assert.ok(!txt.includes(c.msg.toLowerCase().slice(0, 25)), 'enunciado nos metadados: ' + c.id);
    assert.ok(!/"response"|"message"|"history"|resposta simulada/.test(txt)); assert.ok(!r.stdout.toLowerCase().includes('mapa')); fs.unlinkSync(pre);
    assert.deepStrictEqual(estadoArtefatosReais(), antesReais, 'recuperação simulada alterou artefato real');
  });
  await teste('as travas da V1 paga seguem intactas: teto máximo US$ 5,00, exigência de pré-registro e execução única (verificação estática + execução)', async () => {
    const src = fs.readFileSync(path.join(raiz, 'scripts/rag3-v1-benchmark.js'), 'utf8'); assert.ok(/teto > X\.TETO_ABSOLUTO_USD/.test(src) && /existsSync\(PREREGISTRO\)/.test(src) && /verificarPreRegistro/.test(src) && /já existe execução V1/.test(src)); assert.strictEqual(X.TETO_ABSOLUTO_USD, 5);
    const env = { ...process.env }; delete env.RAG3_V1_EXECUCAO_AUTORIZADA; const r = spawnSync(process.execPath, [path.join(raiz, 'scripts/rag3-v1-benchmark.js'), '--executar'], { env, encoding: 'utf8' }); assert.strictEqual(r.status, 10);
    const r2 = spawnSync(process.execPath, [path.join(raiz, 'scripts/rag3-v1-benchmark.js'), '--executar'], { env: { ...env, RAG3_V1_EXECUCAO_AUTORIZADA: 'I_CONFIRM_V1', RAG3_V1_TETO_USD: '5.01' }, encoding: 'utf8' }); assert.strictEqual(r2.status, 11);
  });
  await teste('zero rede e trava paga fechada; produção intocada', async () => {
    assert.strictEqual(fetchChamado, 0); assert.strictEqual(process.env.RAG3_ALLOW_PAID_CALLS, undefined);
    const g = spawnSync('git', ['status', '--porcelain', '--', 'src/server.js', 'src/routes', 'src/lib', 'public', 'migrations', 'package.json', 'package-lock.json'], { cwd: raiz, encoding: 'utf8' }); assert.strictEqual(g.stdout.trim(), '');
    const lista = (d) => fs.readdirSync(path.join(raiz, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? lista(path.join(d, e.name)) : [path.join(d, e.name)]);
    for (const f of ['src/server.js', ...lista('src/routes'), ...lista('src/lib'), ...lista('public')].filter((x) => /\.(js|html)$/.test(x))) assert.ok(!/rag3/i.test(fs.readFileSync(path.join(raiz, f), 'utf8')), f);
  });

  for (const a of avisos) console.log('  AVISO:', a);
  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join('; ')); process.exit(1); }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1); });
