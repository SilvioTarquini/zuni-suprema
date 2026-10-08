// V1 — executor CEGO de 3 variantes (A Claude genérico · B Candidate + OpenAI · C ZUNI anterior). **A execução paga NÃO é autorizada neste estágio.**
// Modos (sem rede, sem chaves, sem custo):  --auditar | --dry-run (padrão) | --preregistrar | --so-recuperacao --simulado
// Recuperação real isolada (embeddings + leituras no acervo, SEM geração, teto US$ 0,05): --so-recuperacao (exige RAG3_V1_RECUPERACAO_AUTORIZADA=I_CONFIRM_V1_RECUP e RAG3_V1_RECUP_TETO_USD <= 0.05)
// Modo pago: --executar  (exige RAG3_V1_EXECUCAO_AUTORIZADA=I_CONFIRM_V1, RAG3_V1_TETO_USD <= 5.00, pré-registro conferido e casos/critérios presentes).
// Nenhum modo imprime a BLIND_KEY, o mapeamento rótulo→variante ou o texto dos casos.
const fs = require('fs');
const os = require('os');
const path = require('path');
const raiz = path.join(__dirname, '..');
const R = require(path.join(raiz, 'src/rag3'));
const X = require(path.join(raiz, 'src/rag3/benchmark/v1Executor'));
const { CASOS: DATASET } = require(path.join(raiz, 'src/rag3/benchmark/dataset'));
const { POR_ID } = require(path.join(raiz, 'src/rag3/conceptLexicon'));

const PASTA = 'C:\\Users\\Silvio\\Documents\\ZUNI-C2B';
const CASOS_JSON = process.env.RAG3_V1_CASOS || path.join(PASTA, 'V1_CASOS_INEDITOS.json');
const CRITERIOS_MD = path.join(PASTA, 'V1_CRITERIOS_E_RUBRICA.md');
const PREREGISTRO = path.join(PASTA, 'V1_PREREGISTRO.json');
const PASTA_AVALIADORES = path.join(PASTA, 'V1_PACOTE_AVALIADORES'); // exclusivo dos avaliadores
const PASTA_INTERNO = path.join(PASTA, 'V1_INTERNO_NAO_ABRIR'); // chave, artefatos, mapeamentos — diretório IRMÃO, nunca dentro do pacote
const RECUP_DIR = path.join(PASTA, 'V1_RECUPERACAO'); // metadados do modo --so-recuperacao (nunca em V1_*)
const REGRESSAO_IDS = ['c11', 'c13']; // fora da pontuação principal; texto lido do dataset oficial, nunca copiado
const LIMIARES_V1 = { fraco: 0.506, encontrado: 0.543, calibrado: false };
const MODELO_OPENAI = 'gpt-5.6-sol'; const MODELO_CLAUDE = 'claude-sonnet-4-6';
const arquivosProtegidos = () => ({
  'src/rag3/editorialPolicy.js': path.join(raiz, 'src/rag3/editorialPolicy.js'), 'src/rag3/knowledgeMode.js': path.join(raiz, 'src/rag3/knowledgeMode.js'), 'src/rag3/causalidade.js': path.join(raiz, 'src/rag3/causalidade.js'),
  'src/rag3/retrieval.js': path.join(raiz, 'src/rag3/retrieval.js'), 'src/rag3/queryPlanner.js': path.join(raiz, 'src/rag3/queryPlanner.js'), 'src/rag3/bookRecommendation.js': path.join(raiz, 'src/rag3/bookRecommendation.js'),
  'src/rag3/provenance.js': path.join(raiz, 'src/rag3/provenance.js'), 'src/rag3/config.js': path.join(raiz, 'src/rag3/config.js'), 'src/rag3/generation.js': path.join(raiz, 'src/rag3/generation.js'), 'src/rag3/providers.js': path.join(raiz, 'src/rag3/providers.js'),
  'src/rag3/benchmark/v1Executor.js': path.join(raiz, 'src/rag3/benchmark/v1Executor.js'), 'src/rag3/benchmark/blindPackage.js': path.join(raiz, 'src/rag3/benchmark/blindPackage.js'), 'src/rag3/benchmark/rubricC2b.js': path.join(raiz, 'src/rag3/benchmark/rubricC2b.js'),
  'src/rag3/benchmark/lintResposta.js': path.join(raiz, 'src/rag3/benchmark/lintResposta.js'), 'src/rag3/pipeline.js': path.join(raiz, 'src/rag3/pipeline.js'), 'src/rag3/currentAdapter.js': path.join(raiz, 'src/rag3/currentAdapter.js'), 'src/rag3/benchmark/dataset.js': path.join(raiz, 'src/rag3/benchmark/dataset.js'),
  'scripts/rag3-v1-benchmark.js': __filename, 'src/server.js': path.join(raiz, 'src/server.js'), 'V1_CASOS_INEDITOS.json': CASOS_JSON, 'V1_CRITERIOS_E_RUBRICA.md': CRITERIOS_MD
});

function carregarCasosPrincipais() { return JSON.parse(fs.readFileSync(CASOS_JSON, 'utf8')); }
function corpusDoRepositorio() {
  const out = []; const ignorar = new Set(['node_modules', '.git', 'private', 'audiolivros-teste']);
  const varrer = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!ignorar.has(e.name)) varrer(p); } else if (/\.(js|html|md|json|txt|sql)$/.test(e.name) && fs.statSync(p).size < 3e6) out.push({ nome: path.relative(raiz, p).replace(/\\/g, '/'), texto: fs.readFileSync(p, 'utf8') }); } };
  for (const d of ['src', 'scripts', 'public', 'docs', 'migrations']) if (fs.existsSync(path.join(raiz, d))) varrer(path.join(raiz, d));
  return out.filter((a) => !/^src\/rag3\/benchmark\/dataset\.js$/.test(a.nome) && !/^\.?(server_test_boot)/.test(a.nome));
}

// ── auditoria offline dos casos ──
function auditar() {
  const casos = carregarCasosPrincipais(); const rel = X.auditarCasos({ casos, regressaoIds: REGRESSAO_IDS, datasetCasos: DATASET, corpus: corpusDoRepositorio() });
  console.log('AUDITORIA DOS CASOS V1 (sem revelar enunciados):', JSON.stringify({ total: rel.total, cobertura: rel.cobertura, problemas: rel.problemas, ok: rel.ok }, null, 1));
  return rel.ok ? 0 : 6;
}

function itensDoPlano() {
  const principais = carregarCasosPrincipais();
  return [...principais.map((c) => ({ id: c.id, grupo: 'principal', caso: c, basico: { id: c.id, message: c.msg, history: c.hist || [], selected_theme: null, turn_index: Math.max(1, Math.ceil(((c.hist || []).length + 1) / 2)) } })),
    ...REGRESSAO_IDS.map((id) => { const d = DATASET.find((x) => x.id === id); if (!d) throw new Error('regressão ausente: ' + id); return { id, grupo: 'regressao', caso: { ...d, cats: ['pouco_contexto'] }, basico: d }; })];
}
async function montarItem(it, deps) {
  const v = await R.buildVariantRequests(it.basico, deps);
  return { id: it.id, grupo: it.grupo, caso: it.caso, reqs: { generic: v.requests.generic, zuni: v.requests.zuni, current: v.requests.current }, hashes: { politica: v.requests.zuni.hashes.politica, pack: v.preparo.knowledgePack.hash, modo: v.requests.zuni.hashes.modo, orientacao: v.requests.zuni.hashes.orientacao, knowledgeMode: v.preparo.modo.modo, equivalente: v.equivalenciaZuni.equivalentes, status: v.preparo.retrieval.status }, _v: v };
}
async function montarPlano({ embedder, store, config }) {
  const deps = { embedder, store, config, promptAtual: R.carregarPromptAtual() }; const plano = [];
  for (const it of itensDoPlano()) { const item = await montarItem(it, deps); delete item._v; plano.push(item); }
  return plano;
}

const LEIAME_AVALIADORES = 'Pacote EXCLUSIVO dos avaliadores (V1).\nContém apenas os documentos de avaliação cega e os modelos de matriz.\nPreencha as matrizes SEM tentar identificar quem escreveu cada resposta; registre na matriz se acreditar ter identificado a origem.\nNão consulte outras pastas do projeto durante a avaliação.\n';

/** Pacote dos avaliadores e artefatos internos vão para DIRETÓRIOS IRMÃOS distintos; nada interno entra no pacote. */
function gravarSaidas({ pacoteDir, internoDir, pacotes, plano, resultado, pre }) {
  fs.mkdirSync(pacoteDir, { recursive: true }); fs.mkdirSync(internoDir, { recursive: true });
  const w = (f, c) => fs.writeFileSync(f, c, 'utf8');
  for (const g of ['principal', 'regressao']) {
    const p = pacotes[g]; if (!p) continue; const suf = g === 'principal' ? 'PRINCIPAL' : 'REGRESSAO';
    w(path.join(pacoteDir, `V1_AVALIACAO_CEGA_${suf}.md`), p.md); w(path.join(pacoteDir, `V1_AVALIACAO_CEGA_${suf}.json`), JSON.stringify(p.json, null, 1));
    const seg = X.montarPacoteSeguranca({ plano, pacote: p, titulo: `ZUNI DIRECIONA — V1 — Avaliação INDEPENDENTE de segurança (${g})` }); w(path.join(pacoteDir, `V1_AVALIACAO_SEGURANCA_${suf}.md`), seg.md); w(path.join(pacoteDir, `V1_MATRIZ_SEGURANCA_${suf}_TEMPLATE.csv`), seg.csv);
    w(path.join(pacoteDir, `V1_MATRIZ_13_DIMENSOES_${suf}_TEMPLATE.csv`), X.modeloCsv13Dimensoes(p));
  }
  w(path.join(pacoteDir, 'LEIAME.txt'), LEIAME_AVALIADORES);
  w(path.join(internoDir, 'V1_BLIND_KEY.json'), JSON.stringify({ versao: 'v1', principal: pacotes.principal && pacotes.principal.chave, regressao: pacotes.regressao && pacotes.regressao.chave }, null, 1));
  w(path.join(internoDir, 'artefatos.json'), JSON.stringify(resultado.artefatos, null, 1)); w(path.join(internoDir, 'ordem_de_chamadas.json'), JSON.stringify(resultado.ordemDeChamadas, null, 1));
  w(path.join(internoDir, 'custos_e_latencia.json'), JSON.stringify({ resumo: resultado.resumo, latencia: X.estatisticasDeLatencia(resultado.artefatos), comprimento: X.resumoDeComprimento(resultado.artefatos), config: { variantes: X.VARIANTES, precos: X.PRECOS } }, null, 1));
  w(path.join(internoDir, 'hashes_por_caso.json'), JSON.stringify(plano.map((p) => ({ case_id: p.id, grupo: p.grupo, ...p.hashes })), null, 1));
  w(path.join(internoDir, 'preregistro_verificado.json'), JSON.stringify(pre, null, 1)); w(path.join(internoDir, 'erros_e_parada.json'), JSON.stringify({ erros: resultado.erros, parada: resultado.parada, excluidos: pacotes.excluidos }, null, 1));
  return X.verificarIsolamento({ pacoteDir, internoDir });
}

const corpusSintetico = async () => {
  const emb = new R.HashEmbedder(256); const mk = async (id, title, source, concept, extra = '') => { const t = `${POR_ID[concept].consulta} ${extra}`; const [e] = await emb.embed([t]); return { id, title, source, path: source + '/' + id, theme: null, text: t, embedding: e }; };
  return { emb, blocos: [await mk('b1', 'Sono e ritmos', 'depressao_base_mentor', 'sono', 'ritmo'), await mk('b2', 'Cafeína e estimulantes', 'documentos-zuni', 'cafeina', 'xicaras'), await mk('b3', 'Estresse crônico', 'documentos-zuni', 'estresse', 'recuperacao'), await mk('b4', 'Cuidar de quem cuida', 'documentos-zuni', 'familia', 'sobrecarga'), await mk('b5', 'Nutrição', 'documentos-zuni', 'alimentacao', 'refeicoes')] };
};
const configV1 = () => R.resolverConfig({ limiares: LIMIARES_V1, provedores: { openai: { modelo: MODELO_OPENAI, maxTokensSaida: 4000 }, anthropic: { modelo: MODELO_CLAUDE, maxTokensSaida: 1400 } } });

// ── DRY-RUN: tudo offline, provedores simulados, saída em pasta temporária (pacote dos avaliadores e pasta interna SEPARADOS) ──
async function dryRun(saidaArg) {
  const { emb, blocos } = await corpusSintetico(); const config = configV1();
  const plano = await montarPlano({ embedder: emb, store: new R.InMemoryVectorStore(blocos), config });
  const est = X.estimativaDeCusto(plano); console.log('ESTIMATIVA (dry-run, sem rede):', JSON.stringify(est));
  let tempo = 0; const relogio = { agora: () => tempo, avancar: (ms) => { tempo += ms; } };
  const providers = { generic: new X.ProvedorSimulado({ nome: 'anthropic', modelo: MODELO_CLAUDE, tokensSaida: 350, latenciaMs: 9000, relogio }), 'zuni-openai': new X.ProvedorSimulado({ nome: 'openai', modelo: MODELO_OPENAI, tokensSaida: 700, latenciaMs: 17000, relogio }), 'zuni-current': new X.ProvedorSimulado({ nome: 'anthropic', modelo: MODELO_CLAUDE, tokensSaida: 450, latenciaMs: 12000, relogio }) };
  const orcamento = new X.ReservaDeOrcamento({ tetoUsd: 5 }); const resultado = await X.executarRodada({ plano, providers, transportes: {}, orcamento, relogio });
  const pacotes = X.montarPacotes({ plano, artefatos: resultado.artefatos }); const base = saidaArg || path.join(os.tmpdir(), 'zuni-v1-dryrun-' + Date.now());
  const pacoteDir = path.join(base, 'PACOTE_AVALIADORES'), internoDir = path.join(base, 'INTERNO_NAO_ABRIR');
  const pre = X.calcularPreRegistro(arquivosProtegidos()); const iso = gravarSaidas({ pacoteDir, internoDir, pacotes, plano, resultado, pre: { simulado: true, ...pre } });
  console.log('DRY-RUN:', JSON.stringify({ casos_principais: plano.filter((p) => p.grupo === 'principal').length, casos_regressao: plano.filter((p) => p.grupo === 'regressao').length, geracoes_simuladas: resultado.resumo.geracoes_ok, gasto_simulado_usd: resultado.resumo.gasto_usd, teto_usd: resultado.resumo.teto_usd, parada: resultado.parada, erros: resultado.erros.length, equivalencia_contexto_openai_claude: plano.every((p) => p.hashes.equivalente), problemas_de_isolamento_do_pacote: iso.problemas.length }));
  console.log('Pacote dos avaliadores:', fs.readdirSync(pacoteDir).join(', ')); console.log('Pasta interna (chave simulada): conteúdo NÃO exibido'); console.log('Saída:', base);
  return iso.ok ? 0 : 7;
}

// ── RECUPERAÇÃO ISOLADA (--so-recuperacao): só embeddings + leituras no acervo; NENHUMA geração; teto próprio de US$ 0,05 ──
// --simulado: totalmente offline (embedder/acervo sintéticos). Sem --simulado: exige autorização própria e usa Supabase/OpenAI (somente leitura / embeddings).
async function recuperacao({ simulado, saidaArg }) {
  let embedder, store, dirSaida, teto;
  if (simulado) { const { emb, blocos } = await corpusSintetico(); embedder = emb; store = new R.InMemoryVectorStore(blocos); dirSaida = saidaArg || path.join(os.tmpdir(), 'zuni-v1-recup-sim-' + Date.now()); teto = X.TETO_RECUPERACAO_USD; }
  else {
    if (process.env.RAG3_V1_RECUPERACAO_AUTORIZADA !== 'I_CONFIRM_V1_RECUP') { console.log('RECUPERAÇÃO V1 NÃO EXECUTADA (falta autorização própria).'); return 20; }
    teto = Number(process.env.RAG3_V1_RECUP_TETO_USD); if (!(teto > 0) || teto > X.TETO_RECUPERACAO_USD) { console.log('STOP: RAG3_V1_RECUP_TETO_USD inválido (máximo US$ ' + X.TETO_RECUPERACAO_USD + ').'); return 21; }
    if (!fs.existsSync(CASOS_JSON)) { console.log('STOP: casos ausentes.'); return 22; }
    dirSaida = RECUP_DIR; if (fs.existsSync(path.join(dirSaida, 'recuperacao_metadados.json'))) { console.log('STOP: recuperação já executada (a autorização vale para uma única execução).'); return 23; }
    require(path.join(raiz, 'node_modules/dotenv')).config({ path: path.join(raiz, '.env') });
    const { createClient } = require(path.join(raiz, 'node_modules/@supabase/supabase-js')); const { VALOR_AUTORIZACAO } = require(path.join(raiz, 'src/rag3/paidGuard'));
    process.env.RAG3_ALLOW_PAID_CALLS = VALOR_AUTORIZACAO; // necessário só para o embedder; nenhum provedor de geração é criado neste modo
    embedder = new R.OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY, fetchImpl: fetch }); store = new R.SupabaseRpcVectorStore({ client: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { auth: { persistSession: false } }) });
  }
  try {
    const contador = new X.EmbedderContador(embedder); const orcamento = new X.ReservaDeOrcamento({ tetoUsd: teto }); const deps = { embedder: contador, store, config: configV1(), promptAtual: R.carregarPromptAtual() };
    const construir = async (it) => { const v = await montarItem(it, deps); const rv = v._v.preparo.retrieval; return { status: rv.status, knowledge_mode: v._v.preparo.modo.modo, blocos: rv.blocks.length, fontes: new Set(rv.blocks.map((b) => b.source)).size, topo_similaridade: rv.diagnostics && rv.diagnostics.topSimilarity != null ? rv.diagnostics.topSimilarity : null, politica_hash: v.hashes.politica.slice(0, 16), pack_hash: v.hashes.pack.slice(0, 16), modo_hash: v.hashes.modo.slice(0, 16), orientacao_hash: v.hashes.orientacao ? v.hashes.orientacao.slice(0, 16) : null, equivalente_b_c: v.hashes.equivalente }; };
    const res = await X.executarSoRecuperacao({ itens: itensDoPlano(), construir, contador, orcamento, aoEvento: (e) => console.log('evento:', e.tipo) });
    fs.mkdirSync(dirSaida, { recursive: true }); fs.writeFileSync(path.join(dirSaida, 'recuperacao_metadados.json'), JSON.stringify({ versao: 'v1-recuperacao', simulado, geracoes: 0, registros: res.registros, erros: res.erros, parada: res.parada, resumo: res.resumo }, null, 1), 'utf8');
    console.log('RECUPERAÇÃO:', JSON.stringify({ simulado, ...res.resumo, erros: res.erros.length, parada: res.parada && res.parada.motivo, status: Object.fromEntries(['found', 'weak', 'none', 'error'].map((k) => [k, res.registros.filter((r) => r.status === k).length])) }));
    console.log('Saída:', dirSaida, '(somente metadados; nenhum texto de caso, nenhuma resposta)');
    return res.parada || res.erros.length ? 9 : 0;
  } finally { if (!simulado) { delete process.env.RAG3_ALLOW_PAID_CALLS; console.log('trava paga desativada:', process.env.RAG3_ALLOW_PAID_CALLS === undefined); } }
}

// ── PRÉ-REGISTRO ──
function preregistrar() { const reg = { gerado_em: new Date().toISOString(), ...X.calcularPreRegistro(arquivosProtegidos()) }; fs.writeFileSync(PREREGISTRO, JSON.stringify(reg, null, 1), 'utf8'); console.log('Pré-registro gravado:', PREREGISTRO, '| arquivos:', Object.keys(reg.arquivos).length); return Object.values(reg.arquivos).some((h) => !h) ? 8 : 0; }

const ARGS = process.argv.slice(2); const tem = (f) => ARGS.includes(f); const valor = (f) => { const i = ARGS.indexOf(f); return i >= 0 ? ARGS[i + 1] : null; };

(async () => {
  if (tem('--auditar')) process.exit(auditar());
  if (tem('--preregistrar')) process.exit(preregistrar());
  if (tem('--so-recuperacao')) process.exit(await recuperacao({ simulado: tem('--simulado'), saidaArg: valor('--saida') }));
  if (!tem('--executar')) process.exit(await dryRun(valor('--saida')));
  // ═══ EXECUÇÃO PAGA — somente com autorização expressa. Tudo abaixo é verificado ANTES de qualquer chave ser lida. ═══
  if (process.env.RAG3_V1_EXECUCAO_AUTORIZADA !== 'I_CONFIRM_V1') { console.log('V1 PREPARADA — NÃO EXECUTADA (falta autorização expressa).'); process.exit(10); }
  const teto = Number(process.env.RAG3_V1_TETO_USD); if (!(teto > 0) || teto > X.TETO_ABSOLUTO_USD) { console.log('STOP: RAG3_V1_TETO_USD inválido (máximo US$ ' + X.TETO_ABSOLUTO_USD + ').'); process.exit(11); }
  if (!fs.existsSync(PREREGISTRO)) { console.log('STOP: pré-registro ausente (rode --preregistrar após congelar arquivos).'); process.exit(12); }
  const ver = X.verificarPreRegistro(JSON.parse(fs.readFileSync(PREREGISTRO, 'utf8')), arquivosProtegidos()); if (!ver.ok) { console.log('STOP: divergência do pré-registro em', ver.divergencias.length, 'arquivo(s).'); process.exit(13); }
  if (!fs.existsSync(CASOS_JSON) || !fs.existsSync(CRITERIOS_MD)) { console.log('STOP: casos ou critérios ausentes.'); process.exit(14); }
  if (fs.existsSync(path.join(PASTA_INTERNO, 'V1_BLIND_KEY.json'))) { console.log('STOP: já existe execução V1 (a autorização vale para uma única execução).'); process.exit(15); }
  require(path.join(raiz, 'node_modules/dotenv')).config({ path: path.join(raiz, '.env') });
  const { createClient } = require(path.join(raiz, 'node_modules/@supabase/supabase-js')); const { VALOR_AUTORIZACAO } = require(path.join(raiz, 'src/rag3/paidGuard'));
  const http = async (url, headers, body) => { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 180000); try { const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ac.signal }); const json = await resp.json().catch(() => null); if (!resp.ok) { const e = new Error('http'); e.status = resp.status; throw e; } return json; } finally { clearTimeout(t); } };
  const m = await fetch('https://api.openai.com/v1/models/' + MODELO_OPENAI, { headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY } }); if (!m.ok) { console.log('STOP: modelo OpenAI indisponível'); process.exit(4); }
  const config = configV1();
  process.env.RAG3_ALLOW_PAID_CALLS = VALOR_AUTORIZACAO;
  try {
    const embedder = new R.OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY, fetchImpl: fetch }); const store = new R.SupabaseRpcVectorStore({ client: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { auth: { persistSession: false } }) });
    const orcamento = new X.ReservaDeOrcamento({ tetoUsd: teto }); orcamento.gasto += 0.01; // reserva fixa para os embeddings (~44 requisições, custo real << US$ 0,001)
    const plano = await montarPlano({ embedder, store, config });
    if (!plano.every((p) => p.hashes.equivalente)) { console.log('STOP: contexto B≠C não equivalente.'); process.exit(5); }
    const est = X.estimativaDeCusto(plano); console.log('ESTIMATIVA:', JSON.stringify(est));
    const providers = { generic: new R.AnthropicProvider({ modelo: MODELO_CLAUDE, maxTokensSaida: 1400 }), 'zuni-openai': new R.OpenAIProvider({ modelo: MODELO_OPENAI, maxTokensSaida: 4000 }), 'zuni-current': new R.AnthropicProvider({ modelo: MODELO_CLAUDE, maxTokensSaida: 1024 }) };
    const transportes = { anthropic: (p) => http('https://api.anthropic.com/v1/messages', { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, p), openai: (p) => http('https://api.openai.com/v1/chat/completions', { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }, p) };
    const resultado = await X.executarRodada({ plano, providers, transportes, orcamento, aoEvento: (e) => console.log('evento:', e.tipo) });
    const pacotes = X.montarPacotes({ plano, artefatos: resultado.artefatos });
    const pre = { simulado: false, ...ver }; const iso = gravarSaidas({ pacoteDir: PASTA_AVALIADORES, internoDir: PASTA_INTERNO, pacotes, plano, resultado, pre });
    console.log('RESUMO', JSON.stringify({ ...resultado.resumo, parada: resultado.parada && resultado.parada.motivo, erros: resultado.erros.length, casos_excluidos: pacotes.excluidos.length, problemas_de_isolamento_do_pacote: iso.problemas.length }));
  } finally { delete process.env.RAG3_ALLOW_PAID_CALLS; console.log('trava paga desativada:', process.env.RAG3_ALLOW_PAID_CALLS === undefined); }
})().catch((e) => { delete process.env.RAG3_ALLOW_PAID_CALLS; console.error('FALHA:', String(e && e.message).slice(0, 160)); process.exit(1); });
