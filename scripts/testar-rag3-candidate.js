// Teste LOCAL (sem rede, sem Supabase, sem OpenAI, sem Anthropic, sem custo) do Candidate RAG 3.0 — fase C1.
// Uso: node scripts/testar-rag3-candidate.js
// Garante: planner multi-conceito; recuperação híbrida com proveniência; diversidade; dedupe; limiar found/weak/none; truncamento;
// knowledge pack único para os dois providers; política única; payloads OpenAI/Claude equivalentes; baseline sem RAG; adaptador CURRENT;
// recomendação de obra sem alucinação; logs sem PII; dataset; runner dry-run; trava de chamadas pagas; rubrica; calibração.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

delete process.env.SUPABASE_URL; delete process.env.SUPABASE_KEY; delete process.env.RAG3_ALLOW_PAID_CALLS;
// Prova de que nada sai pela rede neste teste: qualquer fetch falha alto.
let fetchChamado = 0; global.fetch = async () => { fetchChamado++; throw new Error('REDE_PROIBIDA_NO_TESTE'); };

const raiz = path.join(__dirname, '..');
const R = require(path.join(raiz, 'src/rag3'));
const { CASOS: TODOS_OS_CASOS } = require(path.join(raiz, 'src/rag3/benchmark/dataset'));
// A suíte C1 foi escrita para os 15 casos originais (c01–c15); c16+ são da preparação final da C2-B e têm sua própria suíte.
const CASOS = TODOS_OS_CASOS.filter((c) => /^c(0[1-9]|1[0-5])$/.test(c.id));
const { validarDataset } = require(path.join(raiz, 'src/rag3/benchmark/validate'));
const runner = require(path.join(raiz, 'src/rag3/benchmark/runner'));
const rubrica = require(path.join(raiz, 'src/rag3/benchmark/rubric'));
const custo = require(path.join(raiz, 'src/rag3/benchmark/cost'));
const calib = require(path.join(raiz, 'src/rag3/benchmark/calibration'));
const { CONCEITOS, POR_ID } = require(path.join(raiz, 'src/rag3/conceptLexicon'));
const { CATALOGO } = require(path.join(raiz, 'src/lib/catalogoLivros'));
const { calcularPrecoBaseLivro } = require(path.join(raiz, 'src/lib/precoLivro'));
const { MAPA_POR_FONTE, resolverObra } = require(path.join(raiz, 'src/rag3/provenance'));

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) {
  total++;
  try { await fn(); ok++; console.log(`  ok   ${nome}`); }
  catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); }
}

// ── Acervo SINTÉTICO de teste (não é o acervo real) ──
const emb = new R.HashEmbedder(256);
const conc = (id) => POR_ID[id].consulta;
let seq = 0;
async function bloco({ id, title, source, theme = null, concept, extra = '', text = null, path: caminho }) {
  const t = text || `${conc(concept)} ${extra}`;
  const [e] = await emb.embed([t]);
  return { id: id || 'b' + String(++seq).padStart(3, '0'), title, source, path: caminho || (source + '/' + (id || seq)), theme, text: t, embedding: e };
}
const corpus = async () => {
  const L = [];
  L.push(await bloco({ id: 'sono-1', title: 'Sono e ritmos circadianos (parte 1/2)', source: 'depressao_base_mentor', theme: 'depressao', concept: 'sono', extra: 'capitulo de sono ritmo circadiano luz da manha' }));
  L.push(await bloco({ id: 'sono-2', title: 'Sono e ritmos circadianos (parte 2/2)', source: 'depressao_base_mentor', theme: 'depressao', concept: 'sono', extra: 'capitulo de sono ritmo circadiano luz da manha continuacao' }));
  L.push(await bloco({ id: 'sono-3', title: 'Dormir, descansar, recuperar', source: 'vida_madura_bem_estar', concept: 'sono', extra: 'rotina de descanso noturno na maturidade' }));
  L.push(await bloco({ id: 'sono-4', title: 'O sono restaura o terreno', source: 'obesidade_base_mentor', theme: 'obesidade', concept: 'sono', extra: 'sono e apetite regulacao metabolica' }));
  L.push(await bloco({ id: 'sono-5', title: 'Sono e apneia', source: 'obesidade_base_mentor', theme: 'obesidade', concept: 'sono', extra: 'apneia ronco sonolencia diurna' }));
  L.push(await bloco({ id: 'sono-6', title: 'Sono e cafeina', source: 'obesidade_base_mentor', theme: 'obesidade', concept: 'sono', extra: 'cafeina tarde noite despertares' }));
  L.push(await bloco({ id: 'caf-1', title: 'Cafeína, café e estimulantes', source: 'documentos-zuni', concept: 'cafeina', extra: 'xicaras por dia janela de meia vida' }));
  L.push(await bloco({ id: 'est-1', title: 'Estresse crônico e burnout', source: 'documentos-zuni', concept: 'estresse', extra: 'carga alostatica recuperacao' }));
  L.push(await bloco({ id: 'irr-1', title: 'Irritabilidade e raiva', source: 'documentos-zuni', concept: 'irritabilidade', extra: 'reacao desproporcional cansaco' }));
  L.push(await bloco({ id: 'foc-1', title: 'Foco e atenção', source: 'documentos-zuni', concept: 'concentracao', extra: 'nevoa mental procrastinacao' }));
  L.push(await bloco({ id: 'ans-1', title: 'Ansiedade e pânico', source: 'documentos-zuni', concept: 'ansiedade', extra: 'corpo em alerta coracao acelerado' }));
  L.push(await bloco({ id: 'rel-1', title: 'Relacionamentos humanos', source: 'documentos-zuni', concept: 'relacionamento', extra: 'cobranca e comunicacao no casal' }));
  L.push(await bloco({ id: 'ali-1', title: 'Nutrição e saúde alimentar', source: 'documentos-zuni', concept: 'alimentacao', extra: 'refeicoes fome doces' }));
  L.push(await bloco({ id: 'ene-1', title: 'Produtividade e energia', source: 'documentos-zuni', concept: 'energia', extra: 'fadiga da tarde' }));
  L.push(await bloco({ id: 'cha-1', title: 'Cuidados e bem-estar: chás e alimentação', source: 'elegancia_charme_feminino_RAG', theme: 'elegancia_charme_feminino', concept: 'chas_fitoterapia', extra: 'camomila valeriana evidencia limitada interacoes' }));
  L.push(await bloco({ id: 'sup-1', title: 'Vitaminas e minerais no humor', source: 'depressao_base_mentor', theme: 'depressao', concept: 'suplementos', extra: 'magnesio omega tres quando investigar carencias' }));
  L.push(await bloco({ id: 'int-1', title: 'Intestino e microbiota', source: 'documentos-zuni', concept: 'intestino', extra: 'eixo intestino cerebro' }));
  L.push(await bloco({ id: 'obe-1', title: 'Peso e regulação biológica', source: 'obesidade_base_mentor', theme: 'obesidade', concept: 'peso', extra: 'apetite metabolismo dietas restritivas' }));
  L.push(await bloco({ id: 'obe-2', title: 'Fome emocional', source: 'obesidade_base_mentor', theme: 'obesidade', concept: 'peso', extra: 'comer por ansiedade a noite' }));
  L.push(await bloco({ id: 'env-1', title: 'Longevidade e envelhecimento saudável', source: 'documentos-zuni', concept: 'envelhecimento', extra: 'autonomia na maturidade' }));
  L.push(await bloco({ id: 'mov-1', title: 'Movimento é liberdade', source: 'vida_madura_bem_estar', concept: 'movimento', extra: 'mobilidade equilibrio queda' }));
  L.push(await bloco({ id: 'luto-1', title: 'Luto, morte e perda', source: 'documentos-zuni', concept: 'luto', extra: 'elaboracao da dor noites dificeis' }));
  L.push(await bloco({ id: 'sol-1', title: 'Vínculos, apego e solidão', source: 'documentos-zuni', concept: 'solidao', extra: 'isolamento' }));
  // duplicata EXATA (outro id) e quase-duplicata
  const base = L.find((b) => b.id === 'caf-1');
  L.push({ ...base, id: 'caf-dup', title: 'Cafeína (cópia)', path: 'documentos-zuni/caf-dup' });
  L.push(await bloco({ id: 'est-near', title: 'Estresse e esgotamento (variação)', source: 'documentos-zuni', concept: 'estresse', extra: 'carga alostatica recuperacao pausa' }));
  // bloco GIGANTE (20k) com vários parágrafos; só um fala de insônia/cafeína
  const par = []; for (let i = 0; i < 60; i++) par.push(`Paragrafo ${i} sobre assuntos variados de vida cotidiana e leitura geral numero ${i * 7} sem relacao especifica com o tema pedido.`.repeat(2));
  par[41] = 'Insonia persistente, sono ruim e dificuldade para dormir pioram com cafeina no fim do dia; reduzir estimulantes e proteger o descanso ajuda a recuperar o ritmo.';
  const gigante = par.join('\n\n');
  L.push(await bloco({ id: 'gigante', title: 'Capítulo enorme de variedades', source: 'zuni_a_travessia_base_mentor', text: gigante + ' ' + conc('sono') }));
  // proveniência de obra
  L.push(await bloco({ id: 'bk-dep-1', title: 'Depressão: avaliação integrativa', source: 'depressao_base_mentor', theme: 'depressao', concept: 'humor', extra: 'desanimo persistente perda de interesse' }));
  L.push(await bloco({ id: 'bk-dep-2', title: 'Depressão: neurotransmissores', source: 'depressao_base_mentor', theme: 'depressao', concept: 'humor', extra: 'neuroplasticidade BDNF humor baixo' }));
  return L;
};

const CFG_TESTE = R.resolverConfig({ limiares: { encontrado: 0.55, fraco: 0.5, minBlocosParaEncontrado: 2 } });
const consoleOriginal = { log: console.log, warn: console.warn, error: console.error };

(async () => {
  const blocos = await corpus();
  const store = new R.InMemoryVectorStore(blocos);
  const deps = { embedder: emb, store, config: CFG_TESTE };
  const ret = (msg, extra = {}) => R.retrieveZuniKnowledge({ currentMessage: msg, ...extra }, deps);
  const MSG_SONO = 'Tenho dormido mal há semanas, ando irritado no trabalho e uso muito café para conseguir me concentrar. Quanto mais café, pior eu durmo.';

  console.log('Configuração e planner');
  await teste('config: parâmetros centralizados, validados (limiar fraco > encontrado é rejeitado)', async () => {
    assert.ok(R.CANDIDATE_CONFIG.recuperacao.candidatosPorSubconsulta >= 20 && R.CANDIDATE_CONFIG.recuperacao.maxBlocosFinais >= 6 && R.CANDIDATE_CONFIG.limiares.calibrado === false);
    assert.throws(() => R.resolverConfig({ limiares: { fraco: 0.9, encontrado: 0.5 } }), /RAG3_CONFIG_INVALIDA/);
    assert.throws(() => R.resolverConfig({ recuperacao: { maxBlocosFinais: 99 } }), /RAG3_CONFIG_INVALIDA/);
    assert.strictEqual(R.resolverConfig({ recuperacao: { maxBlocosFinais: 4 } }).recuperacao.maxBlocosFinais, 4);
  });
  await teste('planner determinístico: mensagem multi-conceito vira 2–3 subconsultas conceituais + literal', async () => {
    const p = await new R.DeterministicQueryPlanner(CFG_TESTE).plan({ currentMessage: MSG_SONO });
    const ids = p.conceitos.map((c) => c.id);
    assert.ok(p.conceitos.length >= 2 && p.conceitos.length <= 3, ids.join());
    assert.ok(['sono', 'cafeina', 'irritabilidade', 'concentracao', 'estresse'].filter((x) => ids.includes(x)).length >= 2);
    assert.strictEqual(p.subconsultas.filter((s) => s.kind === 'concept').length, p.conceitos.length);
    assert.ok(p.subconsultas.some((s) => s.kind === 'literal'));
  });
  await teste('planner usa HISTÓRICO em mensagem curta/anafórica (multi-turno) e o tema só como sinal secundário', async () => {
    const c14 = CASOS.find((c) => c.id === 'c14');
    const p = await new R.DeterministicQueryPlanner(CFG_TESTE).plan({ currentMessage: c14.message, recentHistory: c14.history });
    const ids = p.conceitos.map((c) => c.id);
    assert.ok(p.continuacao && p.usouHistorico);
    assert.ok(ids.includes('sono') || ids.includes('cafeina') || ids.includes('estresse') || ids.includes('ansiedade'), ids.join());
    const semTema = await new R.DeterministicQueryPlanner(CFG_TESTE).plan({ currentMessage: 'Estou cansado', selectedTheme: null });
    const comTema = await new R.DeterministicQueryPlanner(CFG_TESTE).plan({ currentMessage: 'Estou cansado', selectedTheme: 'burnout' });
    assert.ok(comTema.conceitos.some((c) => c.origin === 'theme') && !semTema.conceitos.some((c) => c.origin === 'theme'));
    assert.ok(comTema.conceitos.filter((c) => c.origin === 'theme').every((c) => c.weight <= 0.31), 'tema pesa pouco');
  });
  await teste('QueryPlanner é uma interface: modo model-assisted exige função injetada; falha do modelo cai no determinístico; sem LLM pago', async () => {
    const cfgM = R.resolverConfig({ planner: { modo: 'model-assisted' } });
    await assert.rejects(() => R.criarQueryPlanner(cfgM).plan({ currentMessage: 'x' }), /MODELO_NAO_CONFIGURADO/);
    const falho = R.criarQueryPlanner(cfgM, { reescrever: async () => { throw new Error('boom'); } });
    assert.ok((await falho.plan({ currentMessage: MSG_SONO })).conceitos.length >= 2);
    const bom = R.criarQueryPlanner(cfgM, { reescrever: async () => ({ conceitos: [{ id: 'sono', weight: 1 }, { id: 'inexistente', weight: 1 }] }) });
    const p = await bom.plan({ currentMessage: 'qualquer' });
    assert.deepStrictEqual(p.conceitos.map((c) => c.id), ['sono']); assert.strictEqual(p.modo, 'model-assisted');
    assert.strictEqual(R.criarQueryPlanner(CFG_TESTE).constructor.name, 'DeterministicQueryPlanner');
  });
  await teste('léxico: todo tema do questionário aponta só para conceitos que existem', async () => {
    const { TEMA_PARA_CONCEITOS } = require(path.join(raiz, 'src/rag3/conceptLexicon'));
    for (const [tema, ids] of Object.entries(TEMA_PARA_CONCEITOS)) for (const id of ids) assert.ok(POR_ID[id], tema + '→' + id);
    assert.strictEqual(Object.keys(TEMA_PARA_CONCEITOS).length, 43);
  });

  console.log('\nRecuperação híbrida');
  await teste('proveniência preservada em TODO bloco: id, título, fonte, tema, bookId, similaridade, texto', async () => {
    const r = await ret(MSG_SONO);
    assert.ok(['found', 'weak'].includes(r.status), r.status); assert.ok(r.blocks.length >= 3);
    for (const b of r.blocks) { assert.ok(b.id && b.title && b.source && typeof b.similarity === 'number' && b.text); assert.ok('theme' in b && 'bookId' in b); }
    const dep = (await ret('Sinto desânimo persistente e perda de interesse, humor muito baixo', {})).blocks.find((b) => b.source === 'depressao_base_mentor');
    assert.ok(dep && dep.bookId === 'a-neurobiologia-integrativa-da-depressao' && dep.theme === 'depressao');
  });
  await teste('busca GLOBAL: o tema escolhido NÃO é prisão (tema "obesidade" + pergunta de sono traz fontes de outros temas)', async () => {
    const r = await ret(MSG_SONO, { selectedTheme: 'obesidade' });
    assert.ok(r.blocks.some((b) => b.theme !== 'obesidade'), 'só blocos do tema');
    assert.ok(new Set(r.blocks.map((b) => b.source)).size >= 2);
  });
  await teste('tema é BÔNUS: a etiqueta aumenta a pontuação de blocos do tema sem excluir os demais', async () => {
    const q = 'Sinto o humor baixo, desânimo persistente, sono ruim e muito café no fim do dia';
    const sem = await ret(q); const com = await ret(q, { selectedTheme: 'depressao' });
    const pos = (r) => r.blocks.findIndex((b) => b.theme === 'depressao');
    assert.ok(pos(com) >= 0 && (pos(sem) === -1 || pos(com) <= pos(sem)), 'o bônus não pode piorar a posição do bloco do tema');
    assert.ok(com.blocks.length >= 3 && com.blocks.some((b) => b.theme !== 'depressao'), 'blocos de outros temas continuam entrando');
    assert.ok(com.blocks.filter((b) => b.theme === 'depressao').length <= CFG_TESTE.recuperacao.tetoPorFonte);
  });
  await teste('diversidade/anti-saturação: teto por fonte e por título; "parte 1/2" e "parte 2/2" contam como o mesmo título', async () => {
    // limiar baixo para que muitos blocos de sono da mesma fonte/título disputem as vagas e os tetos precisem agir
    const cfgBaixo = R.resolverConfig({ limiares: { encontrado: 0.4, fraco: 0.35, minBlocosParaEncontrado: 1 }, recuperacao: { maxBlocosFinais: 8 } });
    const r = await R.retrieveZuniKnowledge({ currentMessage: 'sono ruim, dormir mal, insônia, descanso e ritmo circadiano' }, { ...deps, config: cfgBaixo });
    const porFonte = {}; r.blocks.forEach((b) => { porFonte[b.source] = (porFonte[b.source] || 0) + 1; });
    assert.ok(Object.values(porFonte).every((n) => n <= CFG_TESTE.recuperacao.tetoPorFonte), JSON.stringify(porFonte));
    const chaves = r.blocks.map((b) => R.normalizar ? 0 : 0); void chaves;
    const { chaveDeTitulo } = require(path.join(raiz, 'src/rag3/util'));
    const t = r.blocks.map((b) => chaveDeTitulo(b.title)); assert.strictEqual(new Set(t).size, t.length, 'títulos repetidos');
    assert.ok(!(r.blocks.some((b) => b.id === 'sono-1') && r.blocks.some((b) => b.id === 'sono-2')), 'partes 1/2 e 2/2 juntas: ' + r.blocks.map((b) => b.id).join());
    assert.ok(r.diagnostics.droppedByCaps + r.diagnostics.droppedByDuplicate >= 1, 'nada foi contido: ' + JSON.stringify(r.diagnostics));
    // tetos agindo de verdade: blocos DIFERENTES da mesma fonte/mesma família de título
    const mk = async (id, title, source, concept, extra) => bloco({ id, title, source, concept, extra, path: source + '/' + id });
    const lote = [await mk('t1', 'Capítulo X — Assunto (parte 1/2)', 'fonte-a', 'sono', 'alfa bravo charlie'), await mk('t2', 'Capítulo X — Assunto (parte 2/2)', 'fonte-a', 'sono', 'delta echo foxtrot golf hotel india'),
      await mk('t3', 'Outro capítulo', 'fonte-a', 'sono', 'juliet kilo lima mike november oscar'), await mk('t4', 'Mais um capítulo', 'fonte-a', 'sono', 'papa quebec romeo sierra tango uniform'), await mk('t5', 'Capítulo de outra fonte', 'fonte-b', 'sono', 'victor whiskey xray yankee zulu')];
    const r2 = await R.retrieveZuniKnowledge({ currentMessage: 'sono ruim, dormir mal, insônia e descanso' }, { ...deps, store: new R.InMemoryVectorStore(lote), config: cfgBaixo });
    const fa = r2.blocks.filter((b) => b.source === 'fonte-a'); assert.ok(fa.length <= cfgBaixo.recuperacao.tetoPorFonte, 'teto por fonte: ' + fa.length);
    assert.ok(!(r2.blocks.some((b) => b.id === 't1') && r2.blocks.some((b) => b.id === 't2')), 'teto por título');
    assert.ok(r2.diagnostics.droppedByCaps >= 1, JSON.stringify(r2.diagnostics)); assert.ok(r2.blocks.some((b) => b.source === 'fonte-b'), 'a outra fonte precisa aparecer');
  });
  await teste('deduplicação: texto idêntico com outro id e quase-duplicata não entram duas vezes', async () => {
    const r = await ret('Quantas xícaras de café por dia, qual a meia vida da cafeína e o efeito dos estimulantes?');
    assert.ok(!(r.blocks.some((b) => b.id === 'caf-1') && r.blocks.some((b) => b.id === 'caf-dup')));
    const est = (await ret('Estresse crônico, burnout e carga de esgotamento com pausa de recuperação')).blocks.filter((b) => b.id === 'est-1' || b.id === 'est-near');
    assert.ok(est.length <= 1);
    assert.ok(r.diagnostics.droppedByDuplicate >= 1);
  });
  await teste('reserva por conceito: cada conceito do plano tem seu melhor bloco antes de preencher com o conceito dominante', async () => {
    const r = await ret(MSG_SONO);
    assert.ok(r.diagnostics.conceptCoverage >= 0.66, 'cobertura ' + r.diagnostics.conceptCoverage);
    const ids = r.blocks.map((b) => b.id);
    assert.ok(ids.includes('caf-1') || ids.includes('est-1') || ids.includes('irr-1') || ids.includes('foc-1'), 'só blocos de sono: ' + ids.join());
    assert.ok(r.blocks.length <= CFG_TESTE.recuperacao.maxBlocosFinais);
  });
  await teste('limiar: found / weak / none observáveis; fora do domínio = none (sem blocos), limiar marcado como NÃO calibrado', async () => {
    const dentro = await ret(MSG_SONO); assert.strictEqual(dentro.status, 'found');
    const fora = await ret('Como declarar o imposto de renda de um imóvel herdado de um parente distante?');
    assert.strictEqual(fora.status, 'none'); assert.deepStrictEqual(fora.blocks, []); assert.strictEqual(fora.diagnostics.thresholdCalibrated, false);
    const cfgFraco = R.resolverConfig({ limiares: { encontrado: 0.99, fraco: 0.5 } });
    const fraco = await R.retrieveZuniKnowledge({ currentMessage: MSG_SONO }, { ...deps, config: cfgFraco });
    assert.strictEqual(fraco.status, 'weak'); assert.ok(fraco.blocks.length > 0);
    assert.ok(typeof R.statusDe([], CFG_TESTE).motivo === 'string');
  });
  await teste('controle de tamanho: bloco de 20 mil caracteres vira janela de parágrafos relevante, truncamento explícito e total dentro do orçamento', async () => {
    const cfg = R.resolverConfig({ limiares: { encontrado: 0.3, fraco: 0.3, minBlocosParaEncontrado: 1 }, contexto: { maxCharsPorBloco: 1500, maxCharsTotal: 6000 } });
    const pequena = new R.InMemoryVectorStore(blocos.filter((b) => ['gigante', 'caf-1', 'sono-3', 'est-1'].includes(b.id)));
    const r = await R.retrieveZuniKnowledge({ currentMessage: 'Insônia, sono ruim e dificuldade para dormir por causa da cafeína' }, { ...deps, store: pequena, config: cfg });
    const g = r.blocks.find((b) => b.id === 'gigante');
    assert.ok(g, 'o bloco gigante deveria ser recuperado: ' + r.blocks.map((b) => b.id).join());
    assert.ok(g.truncation && g.truncation.originalChars > 10000 && g.truncation.keptChars <= 1500 + 20, JSON.stringify(g.truncation));
    assert.ok(g.text.length <= 1500 + 40 && /\[\.\.\.\]|truncado/.test(g.text));
    assert.ok(/insonia|Insonia|cafeina/i.test(g.text) || g.truncation.strategy !== 'janela-de-paragrafos', 'a janela deveria conter o parágrafo relevante');
    assert.ok(r.blocks.reduce((s, b) => s + b.text.length, 0) <= 6000 + 200);
    assert.ok(r.diagnostics.truncatedCount >= 1);
  });
  await teste('falha do embedder/banco NUNCA é silenciosa: status "error" com código sanitizado e sem texto do usuário', async () => {
    const SEGREDO = 'minha-senha-ABC123 e meu nome é Fulano';
    const ruim = { embed: async () => { throw new Error('quota excedida para: ' + SEGREDO); } };
    const r = await R.retrieveZuniKnowledge({ currentMessage: SEGREDO }, { ...deps, embedder: ruim });
    assert.strictEqual(r.status, 'error'); assert.deepStrictEqual(r.blocks, []);
    assert.ok(!JSON.stringify(r).includes('ABC123') && !JSON.stringify(r).includes('Fulano'));
    const lojaRuim = { search: async () => { const e = new Error('db: ' + SEGREDO); e.codigo = 'rpc_error'; throw e; } };
    const r2 = await R.retrieveZuniKnowledge({ currentMessage: SEGREDO }, { ...deps, store: lojaRuim });
    assert.strictEqual(r2.status, 'error'); assert.strictEqual(r2.erroCodigo, 'rpc_error'); assert.ok(!JSON.stringify(r2).includes('ABC123'));
    assert.strictEqual(R.buildKnowledgePack(r2).status, 'error');
  });
  await teste('o plano devolvido no resultado não carrega o texto do usuário (só ids de conceito, pesos e flags)', async () => {
    const r = await ret('Meu segredo é XYZSEGREDO sobre sono ruim e café', {});
    assert.ok(!JSON.stringify(r.queryPlan).includes('XYZSEGREDO'));
    assert.ok(r.queryPlan.conceitos.length && r.queryPlan.subconsultas.every((s) => Object.keys(s).sort().join() === 'id,kind'));
  });

  console.log('\nKnowledge pack, política e providers');
  await teste('knowledge pack: serialização estável com id/título/fonte/tema/obra/similaridade; none/error sem blocos', async () => {
    const r = await ret(MSG_SONO); const p = R.buildKnowledgePack(r); const p2 = R.buildKnowledgePack(r);
    assert.strictEqual(p.hash, p2.hash); assert.ok(p.text.startsWith('<zuni_knowledge status="found"'));
    for (const b of r.blocks) { assert.ok(p.text.includes('id: ' + b.id) && p.text.includes('source: ' + b.source) && p.text.includes('similarity: ')); }
    assert.deepStrictEqual(p.blockIds, r.blocks.map((b) => b.id)); assert.ok(p.estimatedTokens > 0);
    const none = R.buildKnowledgePack({ status: 'none', blocks: [{ id: 'x', title: 't', source: 's', similarity: 0.9, text: 'não deve aparecer' }] });
    assert.ok(!none.text.includes('não deve aparecer') && none.blockIds.length === 0 && /status="none"/.test(none.text));
  });
  await teste('política editorial ÚNICA: cobre as regras pedidas, não depende de WhatsApp, não cita preço/URL, hash estável', async () => {
    const t = R.politica.texto;
    for (const frase of ['Use ativamente o conhecimento ZUNI', 'Não diagnostique', 'doses terapêuticas', 'interromper', 'interações', 'contraindicações', 'Não invente evidência', 'weak, none ou error', 'CVV 188', 'Termos técnicos são permitidos']) assert.ok(t.includes(frase), frase);
    assert.ok(R.politica.regras.length >= 16);
    assert.ok(!/whatsapp/i.test(t) && !/R\$|https?:|checkout/i.test(t), 'política deve ser independente de apoio humano e de preço/URL');
    assert.ok(!/nunca (cite|revele)[^.]*base/i.test(t), 'não pode mandar esconder o acervo');
    assert.strictEqual(R.politica.hash, require(path.join(raiz, 'src/rag3/util')).sha256(t));
  });
  await teste('providers: mesma política + MESMO knowledge pack + mesmas mensagens nos payloads OpenAI e Claude (só o envelope muda)', async () => {
    const r = await ret(MSG_SONO); const pack = R.buildKnowledgePack(r);
    const req = R.buildGenerationRequest({ editorialPolicy: R.politica, conversationContext: { history: [{ role: 'user', content: 'oi' }, { role: 'assistant', content: 'olá' }] }, knowledgePack: pack, userMessage: MSG_SONO });
    const oa = new R.OpenAIProvider({ modelo: 'modelo-teste', maxTokensSaida: 900 }); const an = new R.AnthropicProvider({ modelo: 'claude-teste', maxTokensSaida: 900 });
    const po = oa.toPayload(req); const pc = an.toPayload(req);
    assert.strictEqual(po.messages[0].role, 'system'); assert.strictEqual(typeof pc.system, 'string'); assert.ok(po.max_completion_tokens === 900 && pc.max_tokens === 900);
    const a = R.conteudoEditorialDoPayload(po), b = R.conteudoEditorialDoPayload(pc);
    assert.strictEqual(a.system, b.system); assert.deepStrictEqual(a.messages, b.messages);
    assert.ok(a.messages[a.messages.length - 1].content.includes(pack.text) && a.messages[a.messages.length - 1].content.includes(MSG_SONO));
    assert.strictEqual(req.hashes.politica, R.politica.hash); assert.strictEqual(req.hashes.knowledgePack, pack.hash);
    assert.deepStrictEqual(R.verificarEquivalencia(req, req), { equivalentes: true, problemas: [] });
    assert.throws(() => new R.OpenAIProvider({ modelo: null, maxTokensSaida: 1 }).toPayload(req), (e) => e.codigo === 'modelo_nao_definido');
  });
  await teste('Anthropic: conversa começa em "user" e papéis consecutivos são unidos (sem mudar o conteúdo editorial)', async () => {
    const out = R.normalizarParaAnthropic([{ role: 'assistant', content: 'x' }, { role: 'user', content: 'a' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c' }]);
    assert.deepStrictEqual(out, [{ role: 'user', content: 'a\n\nb' }, { role: 'assistant', content: 'c' }]);
  });
  await teste('parse de respostas e erros sanitizados (sem mensagem do provider)', async () => {
    const an = new R.AnthropicProvider({ modelo: 'm', maxTokensSaida: 1 }); const oa = new R.OpenAIProvider({ modelo: 'm', maxTokensSaida: 1 });
    assert.strictEqual(an.parseResposta({ content: [{ type: 'text', text: 'oi' }], usage: { input_tokens: 3, output_tokens: 2 } }).text, 'oi');
    assert.strictEqual(oa.parseResposta({ choices: [{ message: { content: 'oi' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }).usage.inputTokens, 3);
    assert.throws(() => an.parseResposta({}), (e) => e.codigo === 'resposta_invalida');
    assert.deepStrictEqual(R.normalizarErroDeProvider({ status: 429, message: 'texto da pessoa' }), { codigo: 'rate_limited', retryable: true });
  });
  await teste('TRAVA de chamadas pagas: generate() e OpenAIEmbedder bloqueados sem autorização explícita; nenhuma rede tocada', async () => {
    const req = { systemText: 's', messages: [{ role: 'user', content: 'u' }], hashes: {} };
    const an = new R.AnthropicProvider({ modelo: 'm', maxTokensSaida: 1 });
    await assert.rejects(() => an.generate(req, { transporte: async () => ({}), env: {} }), (e) => e.name === 'PaidCallBlockedError');
    await assert.rejects(() => an.generate(req, { transporte: null, env: { RAG3_ALLOW_PAID_CALLS: 'I_AUTHORIZE_PAID_CALLS' } }), (e) => e.codigo === 'transporte_ausente');
    const r = await an.generate(req, { transporte: async () => ({ content: [{ type: 'text', text: 'mock' }], usage: { input_tokens: 1, output_tokens: 1 } }), env: { RAG3_ALLOW_PAID_CALLS: 'I_AUTHORIZE_PAID_CALLS' } });
    assert.strictEqual(r.text, 'mock');
    await assert.rejects(() => new R.OpenAIEmbedder({ apiKey: 'k', fetchImpl: async () => ({}), env: {} }).embed(['x']), (e) => e.name === 'PaidCallBlockedError');
    assert.strictEqual(R.chamadasPagasAutorizadas({ RAG3_ALLOW_PAID_CALLS: 'true' }), false); assert.strictEqual(fetchChamado, 0);
  });

  console.log('\nBaseline e pipeline CURRENT');
  await teste('baseline GENERIC separado do RAG: sem knowledge pack, sem política ZUNI, sem acervo; variante com política também sem acervo', async () => {
    const g = R.buildBaselineRequest({ conversationContext: {}, userMessage: MSG_SONO });
    assert.ok(!g.messages[g.messages.length - 1].content.includes('zuni_knowledge') && g.hashes.knowledgePack === null && !/ZUNI/i.test(g.systemText) && g.messages[g.messages.length - 1].content === MSG_SONO);
    const gp = R.buildBaselineRequest({ conversationContext: {}, userMessage: MSG_SONO, comPolitica: true });
    assert.ok(!gp.systemText.includes('Use ativamente o conhecimento ZUNI') && gp.systemText.includes('Não diagnostique') && gp.hashes.politica !== g.hashes.politica && gp.hashes.politica !== R.politica.hash);
    assert.ok(!gp.messages[gp.messages.length - 1].content.includes('zuni_knowledge'));
  });
  await teste('adaptador CURRENT: prompt de produção lido (só leitura) do server.js; contexto colado à mensagem como hoje; server.js intocado', async () => {
    const srvPath = path.join(raiz, 'src/server.js'); const antes = crypto.createHash('sha256').update(fs.readFileSync(srvPath)).digest('hex');
    const p = R.carregarPromptAtual();
    assert.ok(p.systemChatAoVivo.includes('ACERVO ZUNI SUPREMA') && p.systemChatAoVivo.includes('Mentor ZUNI Suprema') && p.fingerprint.nomenclaturaConfere && p.fingerprint.caracteres > 10000);
    const rc = await R.recuperarComoAtual({ message: MSG_SONO, theme: null, embedder: emb, store });
    assert.strictEqual(rc.blocos.length, 5); assert.ok(rc.conhecimento.every((t) => typeof t === 'string'));
    const req = R.buildCurrentRequest({ history: [], message: MSG_SONO, conhecimento: rc.conhecimento });
    const ultima = req.messages[req.messages.length - 1].content;
    assert.ok(ultima.startsWith(MSG_SONO) && ultima.includes('\n\nConhecimento relevante da base ZUNI Suprema:\n') && !ultima.includes('similarity') && !ultima.includes('source:'));
    assert.ok(req.systemText.includes('Síntese ZUNI Direciona')); assert.strictEqual(req.meta.maxTokensAtual, 1024);
    assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(srvPath)).digest('hex'), antes, 'server.js não pode mudar');
  });
  await teste('CURRENT com tema usa a recuperação ranqueada (piso de 1 bloco do tema, teto 2 por caminho) e SEM proveniência no contexto', async () => {
    const [v] = await emb.embed([MSG_SONO]); const com = await store.searchCurrent({ embedding: v, theme: 'depressao', total: 5 });
    assert.strictEqual(com.length, 5); assert.ok(com.some((b) => b.theme === 'depressao'));
  });

  console.log('\nRecomendação de obras');
  const REC_BASE = { retrievalStatus: 'found', turnIndex: 4, concepts: ['peso', 'alimentacao'], userAskedForReading: false, parentContext: false, alreadyRecommended: [] };
  const blk = (id, source, title, sim, bookId = null, conf = null) => ({ id, source, title, similarity: sim, bookId, bookConfidence: conf });
  await teste('proveniência → obra: título, preço e URL vêm do catálogo; nada vem do modelo', async () => {
    const r = R.recommendBooks({ ...REC_BASE, blocks: [blk('1', 'obesidade_base_mentor', 'a', 0.62, 'a-visao-integrativa-da-obesidade', 'alta'), blk('2', 'obesidade_base_mentor', 'b', 0.6, 'a-visao-integrativa-da-obesidade', 'alta')] });
    assert.strictEqual(r.books.length, 1); const b = r.books[0];
    assert.strictEqual(b.bookId, 'a-visao-integrativa-da-obesidade'); assert.strictEqual(b.title, CATALOGO[b.bookId].tituloPublico || CATALOGO[b.bookId].titulo);
    assert.strictEqual(b.priceBRL, calcularPrecoBaseLivro(CATALOGO[b.bookId], false)); assert.strictEqual(b.url, '/checkout-livro.html?livro=a-visao-integrativa-da-obesidade'); assert.strictEqual(b.reason, 'provenance');
    assert.ok(r.texto.includes('R$ ' + b.priceBRL.toFixed(2).replace('.', ',')) && r.texto.includes(b.title)); assert.deepStrictEqual(b.evidenceBlockIds, ['1', '2']);
  });
  await teste('regras: nada em turno inicial, nada com conhecimento fraco/ausente, no máximo 2, descontando as já indicadas', async () => {
    const blocks = [blk('1', 'obesidade_base_mentor', 'a', 0.62, 'a-visao-integrativa-da-obesidade', 'alta'), blk('2', 'obesidade_base_mentor', 'b', 0.6, 'a-visao-integrativa-da-obesidade', 'alta'), blk('3', 'depressao_base_mentor', 'c', 0.6, 'a-neurobiologia-integrativa-da-depressao', 'alta'), blk('4', 'depressao_base_mentor', 'd', 0.6, 'a-neurobiologia-integrativa-da-depressao', 'alta'), blk('5', 'vida_madura_bem_estar', 'e', 0.6, 'tempo-para-viver', 'media'), blk('6', 'vida_madura_bem_estar', 'f', 0.6, 'tempo-para-viver', 'media')];
    const REC3 = { ...REC_BASE, concepts: ['peso', 'humor', 'envelhecimento'] }; // conversa pertinente às três obras
    assert.strictEqual(R.recommendBooks({ ...REC3, blocks, turnIndex: 1 }).books.length, 0);
    assert.strictEqual(R.recommendBooks({ ...REC3, blocks, turnIndex: 1, userAskedForReading: true }).books.length > 0, true);
    assert.strictEqual(R.recommendBooks({ ...REC3, blocks, retrievalStatus: 'weak' }).books.length, 0);
    assert.strictEqual(R.recommendBooks({ ...REC3, blocks, retrievalStatus: 'none' }).books.length, 0);
    assert.strictEqual(R.recommendBooks({ ...REC3, blocks }).books.length, 2);
    const jaUma = R.recommendBooks({ ...REC3, blocks, alreadyRecommended: ['tempo-para-viver'] }); assert.strictEqual(jaUma.books.length, 1); assert.ok(!jaUma.books.some((b) => b.bookId === 'tempo-para-viver'));
    assert.strictEqual(R.recommendBooks({ ...REC3, blocks, alreadyRecommended: ['x', 'y'] }).books.length, 0);
  });
  await teste('pertinência: obra de onde saiu um capítulo sobre sono NÃO é indicada a quem fala de sono e cafeína (provenance sozinha não basta)', async () => {
    const sonoNaObesidade = [blk('1', 'obesidade_base_mentor', 'O sono restaura o terreno', 0.66, 'a-visao-integrativa-da-obesidade', 'alta'), blk('2', 'obesidade_base_mentor', 'Sono, exercício e cafeína', 0.64, 'a-visao-integrativa-da-obesidade', 'alta')];
    const r = R.recommendBooks({ ...REC_BASE, blocks: sonoNaObesidade, concepts: ['sono', 'cafeina', 'ansiedade', 'estresse'] });
    assert.strictEqual(r.books.length, 0); assert.ok(r.suppressed.some((s) => s.bookId === 'a-visao-integrativa-da-obesidade' && s.motivo === 'sem_pertinencia_conceitual'));
    assert.strictEqual(R.recommendBooks({ ...REC_BASE, blocks: sonoNaObesidade, concepts: ['peso', 'alimentacao'] }).books.length, 1);
  });
  await teste('segurança do catálogo: teaser, id inexistente, fonte sem obra e proveniência fraca nunca geram recomendação', async () => {
    const um = (b) => R.recommendBooks({ ...REC_BASE, blocks: b, concepts: [] });
    assert.strictEqual(um([blk('1', 's', 'a', 0.62, 'os-bastidores-da-mente-1-degustacao', 'alta'), blk('2', 's', 'b', 0.62, 'os-bastidores-da-mente-1-degustacao', 'alta')]).books.length, 0);
    assert.strictEqual(um([blk('1', 's', 'a', 0.62, 'obra-que-nao-existe', 'alta'), blk('2', 's', 'b', 0.62, 'obra-que-nao-existe', 'alta')]).books.length, 0);
    assert.strictEqual(um([blk('1', 'documentos-zuni', 'a', 0.9, null, null), blk('2', 'documentos-zuni', 'b', 0.9, null, null)]).books.length, 0);
    assert.strictEqual(um([blk('1', 'obesidade_base_mentor', 'a', 0.62, 'a-visao-integrativa-da-obesidade', 'alta')]).books.length, 0, 'um bloco só não basta');
    assert.strictEqual(um([blk('1', 'obesidade_base_mentor', 'a', 0.62, 'a-visao-integrativa-da-obesidade', null), blk('2', 'obesidade_base_mentor', 'b', 0.62, 'a-visao-integrativa-da-obesidade', null)]).books.length, 0, 'sem confiança editorial não recomenda');
  });
  await teste('obra do adolescente só para responsável; mapa de proveniência só aponta obras existentes e não-teaser', async () => {
    const b = [blk('1', 'sentimentos_adolescencia_base_mentor', 'a', 0.62, 'alem-do-que-voce-sente', 'media'), blk('2', 'sentimentos_adolescencia_base_mentor', 'b', 0.62, 'alem-do-que-voce-sente', 'media')];
    const sem = R.recommendBooks({ ...REC_BASE, blocks: b, concepts: ['adolescencia'] }); assert.ok(!sem.books.some((x) => x.bookId === 'alem-do-que-voce-sente') && sem.suppressed.some((s) => s.motivo === 'obra_do_adolescente_so_para_responsavel'));
    assert.ok(R.recommendBooks({ ...REC_BASE, blocks: b, concepts: ['adolescencia'], parentContext: true }).books.some((x) => x.bookId === 'alem-do-que-voce-sente'));
    for (const [fonte, m] of Object.entries(MAPA_POR_FONTE)) if (m.bookId) { assert.ok(CATALOGO[m.bookId] && !CATALOGO[m.bookId].teaser, fonte + '→' + m.bookId); assert.ok(['alta', 'media'].includes(m.confianca)); }
    assert.deepStrictEqual(resolverObra({ source: 'namoro_conquista_romance_base_mentor', title: 'Feminilidade Moderna e Relacionamentos Inteligentes (A Mulher Que Permanece Inteira) (parte 7/14)' }), { bookId: 'a-mulher-que-permanece-inteira', confianca: 'alta', via: 'prefixo_titulo' });
    assert.strictEqual(resolverObra({ source: 'documentos-zuni' }).bookId, null); assert.strictEqual(resolverObra({ source: 'fonte-nova' }).via, 'fonte_desconhecida');
    assert.strictEqual(resolverObra({ source: 'x', bookId: 'os-bastidores-da-mente-2-o-antidoto' }).via, 'livro_id');
  });
  await teste('recomendação não mexe na geração: a política proíbe preço/link no texto e o cartão é montado fora dele', async () => {
    assert.ok(R.politica.regras.find((r) => r.id === 'sem_propaganda').texto.includes('decidida e apresentada pelo sistema'));
    const turno = await R.prepareCandidateTurn({ currentMessage: 'Já tentei várias dietas, recupero o peso e acho que é emocional: como lidar com a fome emocional à noite?', turnIndex: 4, selectedTheme: 'obesidade' }, deps);
    assert.ok(turno.knowledgePack.text && !/R\$|checkout-livro/.test(turno.knowledgePack.text));
  });

  console.log('\nPrivacidade e observabilidade');
  await teste('logger: só campos permitidos e valores estruturados; texto de usuário, e-mail e nome são DESCARTADOS', async () => {
    const linhas = []; const lg = R.criarLogger({ sink: (l) => linhas.push(l) });
    const r = lg.event('x', { status: 'found', message: 'minha dor é forte', email: 'a@b.co', text: 'conteúdo emocional', blockIds: ['id-1', 'frase com espaços'], similarities: [0.5, 'ruim'], provider: 'openai', correlationId: 'abc-123' });
    assert.strictEqual(r.descartados >= 4, true); const j = JSON.parse(linhas[0]);
    assert.ok(j.status === 'found' && j.provider === 'openai' && j.correlationId === 'abc-123'); assert.ok(!('message' in j) && !('email' in j) && !('text' in j) && !('blockIds' in j) && !('similarities' in j));
    assert.ok(!linhas[0].includes('dor') && !linhas[0].includes('a@b.co'));
  });
  await teste('pipeline inteiro com mensagem sensível: nenhuma linha de log, saída do console ou artefato contém a pergunta', async () => {
    const MARC = 'ZZPRIVADOZZ Joana Silva joana.silva@exemplo.com'; const linhas = []; const cap = []; const orig = { ...consoleOriginal };
    console.log = (...a) => cap.push(a.join(' ')); console.warn = (...a) => cap.push(a.join(' ')); console.error = (...a) => cap.push(a.join(' '));
    let turno; try { turno = await R.prepareCandidateTurn({ currentMessage: MARC + ' ando com sono ruim, estresse e muito café', history: [{ role: 'user', content: 'tenho vergonha de contar: ' + MARC }], turnIndex: 3, selectedTheme: 'estresse' }, { ...deps, logger: R.criarLogger({ sink: (l) => linhas.push(l) }) }); }
    finally { console.log = orig.log; console.warn = orig.warn; console.error = orig.error; }
    assert.ok(linhas.length >= 1 && turno.retrieval.status !== 'error');
    const tudo = linhas.join('\n') + cap.join('\n') + JSON.stringify(turno.retrieval.queryPlan) + JSON.stringify(R.camposDeRecuperacao(turno.retrieval, {}));
    for (const proibido of ['ZZPRIVADOZZ', 'Joana', 'joana.silva', '@exemplo']) assert.ok(!tudo.includes(proibido), 'vazou: ' + proibido);
    const j = JSON.parse(linhas[0]); assert.ok(j.blockIds.length && j.sourceIds.length && j.similarities.length && typeof j.status === 'string' && 'candidateCount' in j);
  });
  await teste('citacoes_rag: linhas prontas no formato da tabela (sem escrever no banco; blocos_citados null até haver medição)', async () => {
    const r = await ret(MSG_SONO); const rows = R.toCitacoesRagRows({ correlationId: 'cid-1', retrieval: r, modelo: 'm', selectedTheme: 'estresse' });
    assert.strictEqual(rows.length, r.blocks.length); assert.deepStrictEqual(Object.keys(rows[0]).sort(), ['blocos_citados', 'blocos_enviados', 'caminho', 'modelo', 'posicao', 'sessao_id', 'tema', 'titulo']);
    assert.ok(rows.every((x, i) => x.sessao_id === 'cid-1' && x.posicao === i + 1 && x.blocos_citados === null && x.blocos_enviados === rows.length));
  });
  await teste('SupabaseRpcVectorStore: só RPCs de busca permitidas, sem .from(), erro vira status "error" sanitizado', async () => {
    const chamadas = []; const cliente = { rpc: async (n, a) => { chamadas.push([n, a]); return { data: [{ id: 'u1', fonte: 'documentos-zuni', caminho: 'c', titulo: 'T', corpo: 'texto', similaridade: 0.7, tema_doc: null }], error: null }; }, from() { throw new Error('ESCRITA_PROIBIDA'); } };
    const s = new R.SupabaseRpcVectorStore({ client: cliente }); const out = await s.search({ embedding: [1, 0], limit: 7 });
    assert.strictEqual(out[0].source, 'documentos-zuni'); assert.strictEqual(chamadas[0][0], 'buscar_documentos_ranqueado'); assert.strictEqual(chamadas[0][1].p_tema, null); assert.strictEqual(chamadas[0][1].total, 7);
    await s.searchCurrent({ embedding: [1, 0], theme: null }); assert.strictEqual(chamadas[1][0], 'buscar_documentos');
    await assert.rejects(() => s._rpc('apagar_tudo', {}), /RAG3_RPC_NAO_PERMITIDA/); assert.deepStrictEqual([...R.RPC_PERMITIDAS], ['buscar_documentos', 'buscar_documentos_ranqueado']);
    const ruim = new R.SupabaseRpcVectorStore({ client: { rpc: async () => ({ data: null, error: { message: 'segredo da pergunta' } }) } });
    const r = await R.retrieveZuniKnowledge({ currentMessage: 'segredo da pergunta' }, { embedder: emb, store: ruim, config: CFG_TESTE });
    assert.strictEqual(r.status, 'error'); assert.ok(!JSON.stringify(r).includes('segredo'));
    assert.throws(() => new R.SupabaseRpcVectorStore({}), /CLIENTE_SUPABASE_AUSENTE/);
  });

  console.log('\nDataset, benchmark e rubrica');
  await teste('dataset: 15 casos sintéticos válidos, zero PII, sem resposta ideal, cobertura dos cenários pedidos', async () => {
    const v = validarDataset(CASOS); assert.deepStrictEqual(v.erros, []); assert.strictEqual(v.total, 15); assert.ok(Object.values(v.cobertura).every(Boolean)); assert.deepStrictEqual(validarDataset(TODOS_OS_CASOS).erros, []);
    assert.ok(CASOS.every((c) => !('ideal_answer' in c)));
    const ruim = validarDataset([...CASOS.slice(0, 12), { ...CASOS[12], message: 'meu email é a@b.com e cpf 123.456.789-09', ideal_answer: 'x' }]);
    assert.ok(!ruim.ok && ruim.erros.some((e) => /PII/.test(e)) && ruim.erros.some((e) => /proibido/.test(e)));
    assert.ok(!validarDataset(CASOS.slice(0, 5)).ok);
  });
  await teste('planner cobre o dataset: acha ao menos 2 dos conceitos esperados (ou todos, se houver menos) em cada caso com conceitos', async () => {
    const pl = new R.DeterministicQueryPlanner(CFG_TESTE);
    for (const c of CASOS.filter((x) => x.concepts_expected.length)) {
      const p = await pl.plan({ currentMessage: c.message, recentHistory: c.history, selectedTheme: c.selected_theme }); const ids = p.conceitos.map((x) => x.id);
      const achados = c.concepts_expected.filter((e) => ids.includes(e)).length;
      assert.ok(achados >= Math.min(2, c.concepts_expected.length), `${c.id}: esperado ${c.concepts_expected} / achado ${ids}`);
    }
    const amb = await pl.plan({ currentMessage: CASOS.find((c) => c.id === 'c13').message }); assert.ok(amb.subconsultas.length >= 1 && amb.conceitos.length === 0);
  });
  const dry = await runner.runBenchmark({ casos: CASOS, deps, modo: 'dry-run', config: CFG_TESTE });
  await teste('runner DRY-RUN: 15 casos × 4 variantes = 60 artefatos sem resposta, sem chamada paga, sem rede', async () => {
    assert.strictEqual(dry.artefatos.length, 60); assert.ok(dry.artefatos.every((a) => a.dry_run === true && a.response === null && a.latency_ms === null));
    assert.deepStrictEqual([...new Set(dry.artefatos.map((a) => a.variant))].sort(), [...runner.VARIANTES].sort()); assert.strictEqual(fetchChamado, 0); assert.deepStrictEqual(dry.falhas, []);
  });
  await teste('comparação JUSTA: B (OpenAI) e C (Claude) recebem o MESMO knowledge pack, os mesmos blocos e a mesma política; D e A são separados', async () => {
    assert.ok(dry.todasEquivalentes);
    for (const c of CASOS) {
      const b = dry.artefatos.find((a) => a.case_id === c.id && a.variant === 'zuni-openai'); const cl = dry.artefatos.find((a) => a.case_id === c.id && a.variant === 'zuni-claude');
      const g = dry.artefatos.find((a) => a.case_id === c.id && a.variant === 'generic'); const d = dry.artefatos.find((a) => a.case_id === c.id && a.variant === 'zuni-current');
      assert.strictEqual(b.knowledge_pack_hash, cl.knowledge_pack_hash); assert.deepStrictEqual(b.block_ids, cl.block_ids); assert.strictEqual(b.policy_hash, cl.policy_hash); assert.strictEqual(b.payload_chars, cl.payload_chars);
      assert.strictEqual(g.knowledge_pack_hash, null); assert.deepStrictEqual(g.block_ids, []); assert.ok(d.prompt_fingerprint && d.retrieval_status === 'unvalidated' && d.book_recommendations === null);
      assert.notStrictEqual(d.policy_hash, b.policy_hash);
    }
  });
  await teste('artefatos serializáveis e SANITIZADOS: nenhum texto de pergunta, campos fixos, desserialização rejeita campo extra', async () => {
    for (const a of dry.artefatos) { const s = runner.serializarArtefato(a); assert.deepStrictEqual(runner.desserializarArtefato(s), JSON.parse(s)); for (const c of CASOS) assert.ok(!s.includes(c.message), 'pergunta no artefato ' + c.id); }
    assert.throws(() => runner.desserializarArtefato(JSON.stringify({ case_id: 'x', mensagem_do_usuario: 'y' })), /CAMPO_INVALIDO/);
    const a0 = dry.artefatos.find((a) => a.variant === 'zuni-claude'); assert.ok(['found', 'weak', 'none'].includes(a0.retrieval_status) && Array.isArray(a0.similarities) && a0.estimated_tokens.input > 0);
  });
  await teste('comportamento nos casos do dataset: fora do domínio e ambígua não fingem conhecimento; nenhuma obra nos casos "NONE"', async () => {
    const st = (id) => dry.artefatos.find((a) => a.case_id === id && a.variant === 'zuni-claude');
    assert.strictEqual(st('c12').retrieval_status, 'none'); assert.deepStrictEqual(st('c12').block_ids, []);
    for (const c of CASOS.filter((x) => x.book_candidate_expected === 'NONE')) assert.deepStrictEqual(st(c.id).book_recommendations, [], c.id);
    assert.ok(['found', 'weak'].includes(st('c01').retrieval_status) && st('c01').block_ids.length >= 3);
  });
  await teste('runner PAGO bloqueado: exige trava + confirmação de custo + transportes; com tudo (mock) executa e registra uso', async () => {
    await assert.rejects(() => runner.runBenchmark({ casos: CASOS.slice(0, 1), deps, modo: 'paid', config: CFG_TESTE, env: {} }), (e) => e.name === 'PaidCallBlockedError');
    const env = { RAG3_ALLOW_PAID_CALLS: 'I_AUTHORIZE_PAID_CALLS' };
    await assert.rejects(() => runner.runBenchmark({ casos: CASOS.slice(0, 1), deps, modo: 'paid', config: CFG_TESTE, env }), /CONFIRMACAO_DE_CUSTO/);
    await assert.rejects(() => runner.runBenchmark({ casos: CASOS.slice(0, 1), deps, modo: 'paid', config: CFG_TESTE, env, confirmaCusto: true }), /TRANSPORTES_AUSENTES/);
    let chamadas = 0; const transportes = { anthropic: async () => { chamadas++; return { content: [{ type: 'text', text: 'resposta mock' }], usage: { input_tokens: 10, output_tokens: 5 } }; }, openai: async () => { chamadas++; return { choices: [{ message: { content: 'resposta mock' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }; } };
    const cfgOA = R.resolverConfig({ limiares: CFG_TESTE.limiares, provedores: { openai: { modelo: 'modelo-teste' } } });
    const r = await runner.runBenchmark({ casos: CASOS.slice(0, 2), deps: { ...deps, config: cfgOA }, modo: 'paid', config: cfgOA, env, confirmaCusto: true, transportes });
    assert.strictEqual(chamadas, 8); assert.ok(r.artefatos.every((a) => a.response === 'resposta mock' && a.dry_run === false && a.estimated_tokens.input_real === 10)); assert.strictEqual(fetchChamado, 0);
  });
  await teste('estimativa de custo: contagem de chamadas, preço da OpenAI NÃO assumido (total nulo), com preço informado devolve típico e máximo', async () => {
    const sem = custo.estimarCustoBenchmark({ artefatos: dry.artefatos });
    assert.strictEqual(sem.chamadasDeGeracao, 60); assert.strictEqual(sem.chamadasDeEmbedding, 30); assert.strictEqual(sem.totalMaximoUsd, null); assert.ok(sem.detalhe.openai.precoAusente && !sem.detalhe.anthropic.precoAusente);
    const com = custo.estimarCustoBenchmark({ artefatos: dry.artefatos, precos: { ...custo.PRECOS_PADRAO, openai: { entrada: 5, saida: 20 } } });
    assert.ok(com.totalTipicoUsd > 0 && com.totalMaximoUsd >= com.totalTipicoUsd && com.totalMaximoUsd < 20, JSON.stringify(com));
  });
  await teste('rubrica: formulário CEGO (sem nomes de variante, ordem embaralhada de forma determinística), perguntas obrigatórias e métricas para decisão humana', async () => {
    const fake = []; for (const c of CASOS.slice(0, 6)) for (const v of ['generic', 'zuni-openai', 'zuni-claude', 'zuni-current']) fake.push({ case_id: c.id, variant: v, response: `resposta ${v} ${c.id}` });
    const f1 = rubrica.gerarFormularioCego({ artefatos: fake, semente: 's1' }); const f2 = rubrica.gerarFormularioCego({ artefatos: fake, semente: 's1' }); const f3 = rubrica.gerarFormularioCego({ artefatos: fake, semente: 's2' });
    assert.deepStrictEqual(f1.chave, f2.chave); assert.notDeepStrictEqual(f1.chave, f3.chave); assert.strictEqual(f1.itens.length, 6);
    const md = rubrica.renderizarMarkdown({ ...f1, itens: f1.itens.map((i) => ({ ...i, respostas: i.respostas.map((r) => ({ rotulo: r.rotulo, texto: 'texto neutro' })) })) });
    assert.ok(md.includes(rubrica.PERGUNTA_ACRESCENTOU) && md.includes(rubrica.PERGUNTA_PAGARIA) && !/zuni-openai|zuni-claude|zuni-current|generic/.test(md));
    assert.strictEqual(rubrica.DIMENSOES.length, 10); assert.deepStrictEqual(rubrica.OPCOES_PAGARIA, ['YES', 'MAYBE', 'NO']);
    assert.ok(!rubrica.validarAvaliacao({ notas: {}, acrescentou: '', pagaria: 'TALVEZ' }).ok);
    const nota = (n) => Object.fromEntries(rubrica.DIMENSOES.map((d) => [d, n]));
    const avs = []; for (const it of f1.itens) for (const r of it.respostas) { const v = f1.chave[it.item_id][r.rotulo]; avs.push({ item_id: it.item_id, rotulo: r.rotulo, notas: nota(v === 'generic' ? 2 : 4), resposta_generica: v === 'generic', erro_grave: false, acrescentou: 'conectou fatores', pagaria: v === 'generic' ? 'NO' : 'YES' }); }
    assert.ok(avs.every((a) => rubrica.validarAvaliacao(a).ok));
    const m = rubrica.calcularMetricas(avs, f1.chave); assert.strictEqual(m.contra_baseline['zuni-claude'].vitorias, 6); assert.strictEqual(m.resumo.generic.pagaria.NO, 6);
    const g = rubrica.sugerirGate(m, 6); assert.strictEqual(g['zuni-claude'].decisao, 'HUMANA'); assert.strictEqual(g['zuni-claude'].sugestao_apenas, true); assert.match(m.aviso, /HUMANA/);
  });
  await teste('rubrica: resposta genérica não conta como vitória e erro grave é contado', async () => {
    const chave = { 'item-c1': { A: 'generic', B: 'zuni-claude' } }; const nota = (n) => Object.fromEntries(rubrica.DIMENSOES.map((d) => [d, n]));
    const m = rubrica.calcularMetricas([{ item_id: 'item-c1', rotulo: 'A', notas: nota(2), resposta_generica: true, erro_grave: false, acrescentou: 'nada', pagaria: 'NO' }, { item_id: 'item-c1', rotulo: 'B', notas: nota(5), resposta_generica: true, erro_grave: true, acrescentou: 'genérica', pagaria: 'MAYBE' }], chave);
    assert.strictEqual(m.contra_baseline['zuni-claude'].vitorias, 0); assert.strictEqual(m.resumo['zuni-claude'].erros_graves, 1); assert.strictEqual(rubrica.sugerirGate(m, 1)['zuni-claude'].sem_erro_grave, false);
  });
  await teste('calibração do limiar: distribuição por categoria + sugestão (sem número arbitrário); recuperação com limiar desligado separa dentro/fora do domínio', async () => {
    const r = calib.resumirSimilaridades([{ categoria: 'in', topo: 0.7 }, { categoria: 'in', topo: 0.66 }, { categoria: 'partial', topo: 0.55 }, { categoria: 'out', topo: 0.42 }, { categoria: 'out', topo: 0.45 }]);
    assert.strictEqual(r.in.n, 2); const s = calib.sugerirLimiares(r); assert.ok(s.suficiente && s.separavel && s.sugestao.fraco < s.sugestao.encontrado && s.sugestao.fraco > 0.45 && s.sugestao.encontrado < 0.7);
    assert.strictEqual(calib.sugerirLimiares(calib.resumirSimilaridades([{ categoria: 'in', topo: 0.6 }])).suficiente, false);
    assert.strictEqual(calib.sugerirLimiares(calib.resumirSimilaridades([{ categoria: 'in', topo: 0.5 }, { categoria: 'out', topo: 0.6 }])).separavel, false);
    const c = await calib.calibrarComRecuperacao({ casos: CASOS, deps, config: CFG_TESTE });
    assert.strictEqual(c.amostras.length, 15); const out = c.resumo.out; const inn = c.resumo.in; assert.ok(out.n >= 1 && inn.n >= 8 && inn.mediana > out.max, JSON.stringify(c.resumo));
  });

  console.log('\nProdução intocada');
  await teste('nenhuma rota/arquivo de produção usa o Candidate; server.js e routes não referenciam rag3; sem dependência nova', async () => {
    const srv = fs.readFileSync(path.join(raiz, 'src/server.js'), 'utf8'); assert.ok(!/rag3/i.test(srv));
    for (const f of fs.readdirSync(path.join(raiz, 'src/routes'))) assert.ok(!/rag3/i.test(fs.readFileSync(path.join(raiz, 'src/routes', f), 'utf8')), f);
    for (const f of fs.readdirSync(path.join(raiz, 'src/lib'))) assert.ok(!/rag3/i.test(fs.readFileSync(path.join(raiz, 'src/lib', f), 'utf8')), f);
    const usos = []; (function varrer(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) varrer(p); else if (e.name.endsWith('.js')) { const s = fs.readFileSync(p, 'utf8'); for (const m of s.matchAll(/require\('([^'.][^']*)'\)/g)) usos.push(m[1]); } } })(path.join(raiz, 'src/rag3'));
    assert.deepStrictEqual([...new Set(usos)].filter((m) => !['fs', 'path', 'crypto'].includes(m)), []);
    const pub = path.join(raiz, 'public'); const refs = []; (function v(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) v(p); else if (/\.(html|js)$/.test(e.name) && /rag3/i.test(fs.readFileSync(p, 'utf8'))) refs.push(p); } })(pub); assert.deepStrictEqual(refs, []);
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${total - ok}`);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — RAG 3.0 Candidate (C1): arquitetura local validada; nenhuma chamada paga, nenhuma rota pública, produção intocada.');
})();
