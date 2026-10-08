// Teste LOCAL (sem rede, sem custo, sem imprimir credenciais) da CONTENÇÃO OPERACIONAL do acesso ao Supabase (V1-ACCESS, Opção A).
// Contenção ≠ menor privilégio: a identidade (sb_secret) continua privilegiada; a barreira só vale dentro do processo controlado do benchmark.
// Uso: node scripts/testar-rag3-v1-acesso.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

delete process.env.RAG3_ALLOW_PAID_CALLS;
const raiz = path.join(__dirname, '..');
const S = require(path.join(raiz, 'src/rag3/supabaseRestrito'));
const O = S.ORIGEM_SUPABASE_AUTORIZADA;
const RPC = O + '/rest/v1/rpc/buscar_documentos';
const RPC2 = O + '/rest/v1/rpc/buscar_documentos_ranqueado';
const CHAVE_FALSA = 'sb_secret_CHAVE_DE_TESTE_NAO_REAL_000000';

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); ok++; console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${String(e.message).split('\n')[0]}`); } }

function baseFalsa(resposta) {
  const chamadas = [];
  const f = async (url, init) => { chamadas.push({ url, init }); return resposta ? resposta(url, init) : new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }); };
  f.chamadas = chamadas; return f;
}
const bloqueia = async (fn, motivo) => { await assert.rejects(fn, (e) => e.codigo === 'supabase_bloqueado' && (!motivo || e.motivo === motivo), 'esperava bloqueio ' + (motivo || '')); };
const POST = { method: 'POST', body: '{"query_embedding":[0.1]}', headers: { apikey: 'x' } };

(async () => {
  console.log('== Chamadas permitidas ==');
  await teste('POST exato nas duas RPCs passa, com redirect:error forçado', async () => {
    const b = baseFalsa(); const f = S.criarFetchSupabaseRestrito({ fetchBase: b });
    await f(RPC, POST); await f(RPC2, { ...POST, redirect: 'follow' });
    assert.strictEqual(b.chamadas.length, 2);
    assert.ok(b.chamadas.every((c) => c.init.redirect === 'error' && c.init.method === 'POST'));
    assert.deepStrictEqual(f.estatisticas().permitidas, 2);
  });
  await teste('objeto URL equivalente ao caminho exato é aceito', async () => {
    const b = baseFalsa(); const f = S.criarFetchSupabaseRestrito({ fetchBase: b }); await f(new URL(RPC), POST); assert.strictEqual(b.chamadas.length, 1);
  });

  console.log('== Bloqueios de método ==');
  for (const m of ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'post', undefined]) {
    await teste('método ' + m + ' bloqueado', async () => { const b = baseFalsa(); const f = S.criarFetchSupabaseRestrito({ fetchBase: b }); await bloqueia(() => f(RPC, { ...POST, method: m }), 'metodo_nao_permitido'); assert.strictEqual(b.chamadas.length, 0); });
  }
  await teste('cabeçalhos de override de método bloqueados', async () => {
    const b = baseFalsa(); const f = S.criarFetchSupabaseRestrito({ fetchBase: b });
    await bloqueia(() => f(RPC, { ...POST, headers: { 'X-HTTP-Method-Override': 'DELETE' } }), 'cabecalho_proibido');
    await bloqueia(() => f(RPC, { ...POST, headers: new Headers({ 'x-method-override': 'PUT' }) }), 'cabecalho_proibido');
    await bloqueia(() => f(RPC, { ...POST, headers: [['X-HTTP-Method', 'PATCH']] }), 'cabecalho_proibido');
    assert.strictEqual(b.chamadas.length, 0);
  });

  console.log('== Bloqueios de destino (URLs parecidas, caminhos, portas, credenciais) ==');
  const destinos = {
    'outra RPC': O + '/rest/v1/rpc/outra_funcao', 'tabela documentos': O + '/rest/v1/documentos', 'barra final': RPC + '/', 'query string': RPC + '?select=*', 'fragmento': RPC + '#x',
    'ponto-ponto': O + '/rest/v1/rpc/../rpc/buscar_documentos', 'ponto': O + '/rest/v1/./rpc/buscar_documentos', 'codificação %2f': O + '/rest/v1%2Frpc/buscar_documentos', 'codificação %62': O + '/rest/v1/rpc/%62uscar_documentos',
    'barra dupla': O + '//rest/v1/rpc/buscar_documentos', 'http': 'http://yirxjunmjfnajotcnywc.supabase.co/rest/v1/rpc/buscar_documentos', 'host parecido (sufixo)': O + '.evil.com/rest/v1/rpc/buscar_documentos',
    'host parecido (.com)': 'https://yirxjunmjfnajotcnywc.supabase.com/rest/v1/rpc/buscar_documentos', 'subdomínio extra': 'https://x.yirxjunmjfnajotcnywc.supabase.co/rest/v1/rpc/buscar_documentos', 'prefixo extra': 'https://xyirxjunmjfnajotcnywc.supabase.co/rest/v1/rpc/buscar_documentos',
    'caixa alta no host': 'https://YIRXJUNMJFNAJOTCNYWC.supabase.co/rest/v1/rpc/buscar_documentos', 'caixa alta no caminho': O + '/rest/v1/rpc/Buscar_Documentos', 'userinfo': 'https://user:pw@yirxjunmjfnajotcnywc.supabase.co/rest/v1/rpc/buscar_documentos',
    'userinfo disfarçado': 'https://yirxjunmjfnajotcnywc.supabase.co@evil.com/rest/v1/rpc/buscar_documentos', 'porta 443 explícita': 'https://yirxjunmjfnajotcnywc.supabase.co:443/rest/v1/rpc/buscar_documentos', 'porta inesperada': 'https://yirxjunmjfnajotcnywc.supabase.co:8443/rest/v1/rpc/buscar_documentos',
    'localhost': 'https://localhost/rest/v1/rpc/buscar_documentos', 'IP': 'https://127.0.0.1/rest/v1/rpc/buscar_documentos', 'relativa': '/rest/v1/rpc/buscar_documentos', 'protocolo-relativa': '//yirxjunmjfnajotcnywc.supabase.co/rest/v1/rpc/buscar_documentos',
    'data:': 'data:text/plain,x', 'file:': 'file:///etc/passwd', 'storage': O + '/storage/v1/object/x', 'auth': O + '/auth/v1/token?grant_type=password', 'functions': O + '/functions/v1/x', 'espaço': RPC + ' ', 'vazia': ''
  };
  for (const [nome, url] of Object.entries(destinos)) {
    await teste('destino bloqueado: ' + nome, async () => { const b = baseFalsa(); const f = S.criarFetchSupabaseRestrito({ fetchBase: b }); await bloqueia(() => f(url, POST), 'destino_nao_permitido'); assert.strictEqual(b.chamadas.length, 0); });
  }
  await teste('entradas não aceitas (Request, objeto, null) bloqueadas', async () => {
    const b = baseFalsa(); const f = S.criarFetchSupabaseRestrito({ fetchBase: b });
    await bloqueia(() => f(new Request(RPC, { method: 'POST', body: 'x' })), 'entrada_nao_aceita'); await bloqueia(() => f({ href: RPC }), 'entrada_nao_aceita'); await bloqueia(() => f(null), 'entrada_nao_aceita');
    assert.strictEqual(b.chamadas.length, 0);
  });
  await teste('corpo não-string, grande demais, dispatcher/agent bloqueados', async () => {
    const b = baseFalsa(); const f = S.criarFetchSupabaseRestrito({ fetchBase: b });
    await bloqueia(() => f(RPC, { ...POST, body: Buffer.from('x') }), 'corpo_nao_string'); await bloqueia(() => f(RPC, { ...POST, body: undefined }), 'corpo_nao_string');
    await bloqueia(() => f(RPC, { ...POST, body: 'a'.repeat(S.MAX_CORPO_BYTES + 1) }), 'corpo_grande_demais');
    await bloqueia(() => f(RPC, { ...POST, dispatcher: {} }), 'transporte_alternativo'); await bloqueia(() => f(RPC, { ...POST, agent: {} }), 'transporte_alternativo');
    assert.strictEqual(b.chamadas.length, 0);
  });

  console.log('== Redirecionamentos ==');
  await teste('resposta 3xx ou redirected é bloqueada', async () => {
    const f1 = S.criarFetchSupabaseRestrito({ fetchBase: baseFalsa(() => ({ status: 302, redirected: false })) });
    await bloqueia(() => f1(RPC, POST), 'redirecionamento_inesperado');
    const f2 = S.criarFetchSupabaseRestrito({ fetchBase: baseFalsa(() => ({ status: 200, redirected: true })) });
    await bloqueia(() => f2(RPC, POST), 'redirecionamento_inesperado');
  });
  await teste('erro de redirecionamento do fetch base (redirect:error) propaga sem seguir', async () => {
    const f = S.criarFetchSupabaseRestrito({ fetchBase: async () => { throw new TypeError('redirect mode is set to error'); } });
    await assert.rejects(() => f(RPC, POST), /redirect/);
  });

  console.log('== Origem e cliente ==');
  await teste('origem inválida é recusada ANTES de usar a chave (createClient nem é chamado)', async () => {
    let criado = 0;
    for (const url of [undefined, '', 'http://yirxjunmjfnajotcnywc.supabase.co', O + '.evil.com', 'https://outro.supabase.co', O + '/rest/v1', O + ':443', O + '//']) {
      assert.throws(() => S.criarClienteSupabaseRestrito({ url, key: CHAVE_FALSA, createClient: () => { criado++; return {}; } }), (e) => e.codigo === 'supabase_origem_nao_autorizada');
    }
    assert.strictEqual(criado, 0);
    assert.doesNotThrow(() => S.validarOrigem(O)); assert.doesNotThrow(() => S.validarOrigem(O + '/'));
  });
  await teste('origem autorizada configurada com formato inválido é recusada', async () => {
    assert.throws(() => S.criarFetchSupabaseRestrito({ origemAutorizada: 'https://evil.com', fetchBase: baseFalsa() }), (e) => e.codigo === 'supabase_origem_nao_autorizada');
  });
  await teste('mensagens de erro nunca contêm a chave nem a URL', async () => {
    try { S.criarClienteSupabaseRestrito({ url: 'https://evil.com', key: CHAVE_FALSA }); assert.fail('deveria falhar'); } catch (e) { assert.ok(!String(e.message + e.stack).includes(CHAVE_FALSA) && !String(e.message).includes('evil.com')); }
  });

  console.log('== Cliente real do supabase-js com transporte restrito (rede simulada) ==');
  const mk = () => { const b = baseFalsa(); const bloq = []; const c = S.criarClienteSupabaseRestrito({ url: O, key: CHAVE_FALSA, fetchBase: b, aoBloquear: (m) => bloq.push(m) }); return { b, c, bloq }; };
  await teste('fachada expõe somente rpc e estatisticas; é congelada', async () => {
    const { c } = mk(); assert.deepStrictEqual(Object.keys(c).sort(), ['estatisticas', 'rpc']); assert.ok(Object.isFrozen(c));
    for (const k of ['from', 'auth', 'storage', 'functions', 'channel', 'realtime', 'schema']) assert.strictEqual(c[k], undefined, k);
  });
  await teste('rpc permitida chega à rede simulada via POST; outra RPC é recusada antes', async () => {
    const { b, c } = mk(); await c.rpc('buscar_documentos', { query_embedding: [0.1] });
    assert.strictEqual(b.chamadas.length, 1); assert.strictEqual(b.chamadas[0].init.method, 'POST'); assert.strictEqual(b.chamadas[0].url, RPC);
    assert.throws(() => c.rpc('outra', {}), (e) => e.motivo === 'rpc_nao_permitida'); assert.strictEqual(b.chamadas.length, 1);
  });
  await teste('cliente BRUTO do supabase-js (mesmo transporte) não consegue insert/update/delete/upsert/select/auth/storage/functions', async () => {
    const b = baseFalsa(); const bruto = require(path.join(raiz, 'node_modules/@supabase/supabase-js')).createClient(O, CHAVE_FALSA, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: S.criarFetchSupabaseRestrito({ fetchBase: b }) }, realtime: { transport: S.TransporteRealtimeBloqueado } });
    const alvo = bruto.from('documentos');
    const tentativas = [() => alvo.insert({ a: 1 }), () => alvo.update({ a: 1 }).eq('id', 1), () => alvo.delete().eq('id', 1), () => alvo.upsert({ a: 1 }), () => alvo.select('*'),
      () => bruto.storage.from('x').list(), () => bruto.functions.invoke('f'), () => bruto.auth.signInWithPassword({ email: 'a@x.com', password: 'p' }), () => bruto.rpc('outra', {})];
    for (const t of tentativas) { let r; try { r = await t(); } catch (e) { r = { error: e }; } assert.ok(r && r.error, 'esperava erro'); }
    assert.strictEqual(b.chamadas.length, 0, 'nada pode ter chegado à rede');
  });
  await teste('WebSocket/realtime: transporte substituído lança no construtor', async () => {
    const b = baseFalsa(); const bruto = require(path.join(raiz, 'node_modules/@supabase/supabase-js')).createClient(O, CHAVE_FALSA, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: S.criarFetchSupabaseRestrito({ fetchBase: b }) }, realtime: { transport: S.TransporteRealtimeBloqueado } });
    assert.throws(() => { bruto.channel('x').subscribe(); bruto.realtime.connect(); }, (e) => e.codigo === 'supabase_bloqueado' || /BLOQUEADA/.test(e.message));
  });
  await teste('SupabaseRpcVectorStore funciona com a fachada e continua restrito às RPCs de busca', async () => {
    const R = require(path.join(raiz, 'src/rag3')); const { b, c } = mk();
    const store = new R.SupabaseRpcVectorStore({ client: c }); assert.ok(store);
    await assert.rejects(async () => c.rpc('qualquer_outra', {}));
    assert.strictEqual(b.chamadas.length, 0);
  });

  console.log('== Auditoria estática de desvio (bypass) ==');
  const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
  const cli = ler('scripts/rag3-v1-benchmark.js');
  await teste('CLI da V1 não importa supabase-js nem usa createClient/from/storage/auth/functions/channel', async () => {
    assert.ok(!/supabase-js/.test(cli)); assert.ok(!/\bcreateClient\s*\(/.test(cli));
    assert.ok(!/\.(from|storage|functions|channel|realtime)\s*\(/.test(cli.replace(/Array\.from\(/g, '').replace(/Object\.from/g, '')), 'uso de API do cliente bruto');
    assert.ok(/criarClienteSupabaseRestrito/.test(cli) && /validarOrigem/.test(cli));
  });
  await teste('caminho do benchmark (src/rag3 exceto a contenção + executor) não abre rede/BD por outras vias', async () => {
    const arqs = []; const varre = (d) => { for (const n of fs.readdirSync(path.join(raiz, d))) { const p = d + '/' + n; if (fs.statSync(path.join(raiz, p)).isDirectory()) varre(p); else if (p.endsWith('.js')) arqs.push(p); } }; varre('src/rag3');
    const proibido = /require\(\s*['"](?:@supabase\/supabase-js|pg|postgres|http|https|net|tls|dgram|undici|node-fetch|axios|got|ws|child_process)['"]\s*\)/;
    const ruins = arqs.filter((p) => p !== 'src/rag3/supabaseRestrito.js' && proibido.test(ler(p)));
    assert.deepStrictEqual(ruins, []);
    const so = arqs.filter((p) => /require\([^)]*supabase-js/.test(ler(p)) && !/\/supabaseRestrito\.js$/.test(p)); assert.deepStrictEqual(so, []);
  });
  await teste('origem é validada antes da criação do embedder/cliente nos dois ramos de rede do CLI', async () => {
    const trechos = cli.split("config({ path: path.join(raiz, '.env') });").slice(1);
    assert.strictEqual(trechos.length, 2);
    for (const t of trechos) { const iv = t.indexOf('validarOrigem'), ie = t.indexOf('new R.OpenAIEmbedder'); assert.ok(iv > -1 && ie > iv, 'validarOrigem deve vir antes do embedder'); }
  });
  await teste('módulo de contenção consta na lista de arquivos pré-registrados', async () => { assert.ok(/'src\/rag3\/supabaseRestrito\.js'/.test(cli)); });
  await teste('APIs de embedding/geração não foram bloqueadas pela contenção (fetch próprio, sem passar por ela)', async () => {
    assert.ok(/fetchImpl: fetch/.test(cli)); assert.ok(!/supabaseRestrito/.test(ler('src/rag3/embedder.js') + ler('src/rag3/providers.js')));
  });

  console.log('== Fonte/tema apenas em artefatos internos ==');
  await teste('dry-run: pacote dos avaliadores sem fontes/temas; interno com campos novos; hashes de comportamento idênticos à linha de base', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v1acesso-'));
    try {
      const r = spawnSync(process.execPath, [path.join(raiz, 'scripts/rag3-v1-benchmark.js'), '--dry-run', '--saida', tmp], { encoding: 'utf8', env: { ...process.env, SUPABASE_URL: '', SUPABASE_KEY: '' } });
      assert.strictEqual(r.status, 0, 'dry-run falhou');
      const pac = fs.readdirSync(path.join(tmp, 'PACOTE_AVALIADORES')).map((n) => fs.readFileSync(path.join(tmp, 'PACOTE_AVALIADORES', n), 'utf8').toLowerCase()).join('\n');
      for (const t of ['blocos_finais', '"fonte"', '"tema"', 'source', 'bookid', 'similaridade']) assert.ok(!pac.includes(t), 'vazou no pacote: ' + t);
      const novo = JSON.parse(fs.readFileSync(path.join(tmp, 'INTERNO_NAO_ABRIR', 'hashes_por_caso.json'), 'utf8'));
      assert.ok(novo.every((x) => Array.isArray(x.blocos_finais) && typeof x.blocos_recuperados_total === 'number'));
      const base = 'C:\\Users\\Silvio\\Documents\\ZUNI-C2B\\snapshots\\v1access_antes\\dryrun_base\\INTERNO_NAO_ABRIR\\hashes_por_caso.json';
      if (!fs.existsSync(base)) throw new Error('linha de base ausente');
      const ant = JSON.parse(fs.readFileSync(base, 'utf8')); assert.strictEqual(novo.length, ant.length);
      for (let i = 0; i < ant.length; i++) for (const k of ['politica', 'pack', 'modo', 'orientacao', 'knowledgeMode', 'equivalente', 'status']) assert.strictEqual(novo[i][k], ant[i][k], ant[i].case_id + ':' + k);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
  await teste('casos e critérios congelados não mudaram', async () => {
    const sha = (p) => require('crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    assert.strictEqual(sha('C:\\Users\\Silvio\\Documents\\ZUNI-C2B\\V1_CASOS_INEDITOS.json'), '90930b21a7be75853d8352d9b5c0fd2eefedec0de45f42e34a87ddf05e5d7643');
    assert.strictEqual(sha('C:\\Users\\Silvio\\Documents\\ZUNI-C2B\\V1_CRITERIOS_E_RUBRICA.md'), 'e5d043811cc721c3553a06f6e663e6c9667cff1e143b41d613788da422e41b73');
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join('; ')); process.exit(1); }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1); });
