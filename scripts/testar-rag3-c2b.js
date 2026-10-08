// Teste LOCAL (sem rede, sem Supabase, sem OpenAI, sem Anthropic, sem custo) da preparação C2-B do Candidate RAG 3.0.
// Uso: node scripts/testar-rag3-c2b.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

delete process.env.SUPABASE_URL; delete process.env.SUPABASE_KEY; delete process.env.RAG3_ALLOW_PAID_CALLS; delete process.env.RAG3_C2B_EXECUCAO_AUTORIZADA;
let fetchChamado = 0; global.fetch = async () => { fetchChamado++; throw new Error('REDE_PROIBIDA_NO_TESTE'); };

const raiz = path.join(__dirname, '..');
const R = require(path.join(raiz, 'src/rag3'));
const { CASOS } = require(path.join(raiz, 'src/rag3/benchmark/dataset'));
const R2 = require(path.join(raiz, 'src/rag3/benchmark/rubricC2b'));
const { montarPacoteCego, novoSal } = require(path.join(raiz, 'src/rag3/benchmark/blindPackage'));
const { diagnosticar, CONTRAFACTUAIS } = require(path.join(raiz, 'src/rag3/benchmark/diagnosticoLivros'));
const { POR_ID } = require(path.join(raiz, 'src/rag3/conceptLexicon'));
const { sha256 } = require(path.join(raiz, 'src/rag3/util'));

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); ok++; console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${e.message}`); } }
const sh = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(raiz, f))).digest('hex');
const ret = (status, n, cobertura = 1) => ({ status, blocks: Array.from({ length: n }, (_, i) => ({ id: 'b' + i, title: 't' + i, source: 's' })), diagnostics: { conceptCoverage: cobertura } });
const modo = (msg, r, history = []) => R.decidirModoDeConhecimento({ retrieval: r, message: msg, history });
const orient = (message, concepts, history = []) => R.construirOrientacaoInvestigativa({ message, history, concepts });

const emb = new R.HashEmbedder(256); let seq = 0;
async function bloco(id, title, source, concept, extra = '') { const t = `${POR_ID[concept].consulta} ${extra}`; const [e] = await emb.embed([t]); return { id, title, source, path: source + '/' + id, theme: null, text: t, embedding: e }; }

(async () => {
  console.log('Política C2-B');
  await teste('política c2b: nova versão/hash, regras novas, sem WhatsApp/preço/URL, frases C1 preservadas', async () => {
    const t = R.politica.texto; assert.ok(R.politica.versao.includes('c2b'));
    for (const id of ['causalidade_ampliada', 'fatores_adjacentes', 'modos_de_conhecimento', 'sem_evasao', 'evidencia_proporcional', 'naturalidade']) assert.ok(R.politica.regras.find((r) => r.id === id), id);
    assert.ok(!/whatsapp|R\$|https?:\/\//i.test(t)); assert.ok(t.includes('Não diagnostique'));
    assert.strictEqual(R.politica.hash, sha256(t));
  });

  console.log('\nCausalidade ampliada e fatores adjacentes');
  await teste('cafeína↔sono: hipótese de causalidade reversa em linguagem de hipótese, pergunta temporal sugerida', async () => {
    const o = orient('Uso muito café e durmo mal.', ['cafeina', 'sono']);
    assert.ok(o.hipoteses.length >= 1 && o.perguntaSugerida && /pode|vale investigar|possibilidade/.test(o.texto));
    assert.ok(/não apresente como fatos/i.test(o.texto));
  });
  await teste('ordem temporal já informada → pergunta temporal suprimida', async () => {
    const o = orient('Já dormia mal antes de aumentar o café, e uso muito café e durmo mal.', ['cafeina', 'sono']);
    assert.strictEqual(o.perguntaSugerida, null); assert.strictEqual(o.ordemTemporalInformada, true);
  });
  await teste('fatores adjacentes: ≤3, ≤2 hipóteses, no máximo 1 pergunta, sem listas genéricas; fora do domínio → nada', async () => {
    const o = orient('Ando estressado, durmo mal, como mal, irritado e sem energia.', ['sono', 'estresse', 'alimentacao', 'irritabilidade', 'energia', 'ansiedade']);
    assert.ok(o.fatoresAdjacentes.length <= 3 && o.hipoteses.length <= 2 && (o.perguntaSugerida === null || typeof o.perguntaSugerida === 'string'));
    const vazio = orient('Como declarar imposto de renda?', []); assert.strictEqual(vazio.texto, null); assert.strictEqual(vazio.fatoresAdjacentes.length, 0);
  });
  await teste('fator já mencionado pela pessoa não é sugerido de novo', async () => {
    const base = orient('Durmo mal.', ['sono']); const mencionados = base.fatoresAdjacentes.map((f) => f.rotulo);
    if (!mencionados.length) return;
    const msg = 'Durmo mal. ' + base.fatoresAdjacentes.map((f) => f.rotulo).join(' ');
    const depois = orient(msg, ['sono']); assert.ok(depois.fatoresAdjacentes.length <= base.fatoresAdjacentes.length);
  });

  console.log('\nModos de conhecimento');
  await teste('found → ZUNI forte; weak utilizável → ZUNI parcial', async () => {
    const a = modo('Durmo mal e tomo café.', ret('found', 4)); assert.strictEqual(a.modo, 'ZUNI_KNOWLEDGE'); assert.strictEqual(a.forca, 'forte'); assert.strictEqual(a.contribuicaoProprietaria, 'alta');
    const b = modo('Durmo mal e tomo café.', ret('weak', 3, 0.7)); assert.strictEqual(b.modo, 'ZUNI_KNOWLEDGE'); assert.strictEqual(b.forca, 'parcial');
  });
  await teste('weak insuficiente / none / error → GENERAL_INTELLIGENCE (nunca recusa), sem fingir acervo', async () => {
    for (const r of [ret('weak', 1, 0.2), ret('none', 0, 0), ret('error', 0, 0)]) {
      const m = modo('Como funciona a memória de longo prazo?', r); assert.strictEqual(m.modo, 'GENERAL_INTELLIGENCE'); assert.strictEqual(m.contribuicaoProprietaria, 'nenhuma');
      assert.ok(/não finja|nao finja/i.test(m.bloco) && !/recus/i.test(m.bloco.replace(/não\s+recus\w*/gi, '')));
    }
  });
  await teste('BOUNDARY: crise, dose, parar remédio, interpretar exame, informação atual — com diretiva não evasiva', async () => {
    const casos = ['Estou pensando em me matar.', 'Qual a dose de melatonina eu devo tomar?', 'Posso parar de tomar meu remédio de pressão?', 'Interprete meu exame de sangue.', 'Qual a cotação do dólar hoje?'];
    for (const msg of casos) { const m = modo(msg, ret('found', 4)); assert.strictEqual(m.modo, 'BOUNDARY', msg); assert.ok(/seca nem evasiva|próximo passo/i.test(m.bloco), msg); }
    assert.ok(/188|192/.test(modo('Estou pensando em me matar.', ret('none', 0, 0)).bloco));
  });
  await teste('c08 (chá + remédio de pressão) e c01 NÃO são BOUNDARY; c12 (imposto) → GENERAL com flag de atualidade', async () => {
    const c08 = CASOS.find((c) => c.id === 'c08'); const c01 = CASOS.find((c) => c.id === 'c01'); const c12 = CASOS.find((c) => c.id === 'c12');
    assert.notStrictEqual(modo(c08.message, ret('found', 3), c08.history).modo, 'BOUNDARY'); assert.notStrictEqual(modo(c01.message, ret('found', 3), c01.history).modo, 'BOUNDARY');
    const m12 = modo(c12.message, ret('none', 0, 0)); assert.strictEqual(m12.modo, 'GENERAL_INTELLIGENCE'); assert.strictEqual(m12.flags.atualidade, true);
  });
  await teste('determinismo: mesma entrada → mesmo bloco/hash', async () => { assert.strictEqual(modo('Durmo mal.', ret('found', 3)).hash, modo('Durmo mal.', ret('found', 3)).hash); });

  console.log('\nPipeline (provider-neutro)');
  const L = [await bloco('sono-1', 'Sono e ritmos', 'depressao_base_mentor', 'sono', 'ritmo circadiano'), await bloco('sono-2', 'Dormir e descansar', 'vida_madura_bem_estar', 'sono', 'descanso'), await bloco('caf-1', 'Cafeína e estimulantes', 'documentos-zuni', 'cafeina', 'xicaras'), await bloco('est-1', 'Estresse crônico', 'documentos-zuni', 'estresse', 'recuperacao')];
  const store = new R.InMemoryVectorStore(L); const cfg = R.resolverConfig({ limiares: { encontrado: 0.55, fraco: 0.5, minBlocosParaEncontrado: 2 } }); const deps = { embedder: emb, store, config: cfg };
  await teste('B (OpenAI) e C (Claude) recebem modo, orientação, pack e política idênticos', async () => {
    const caso = { id: 'cx', message: 'Uso muito café e durmo mal, estou estressado.', history: [], turn_index: 1 };
    const v = await R.buildVariantRequests(caso, deps); const e = v.equivalenciaZuni;
    assert.ok(e.equivalentes, JSON.stringify(e.problemas)); assert.ok(e.modoHash && e.orientacaoHash && e.politicaHash && e.knowledgePackHash);
    const a = R.conteudoEditorialDoPayload(v.payloads.zuniOpenAI), b = R.conteudoEditorialDoPayload(v.payloads.zuniClaude); assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
    assert.ok(a.messages.some((m) => /<zuni_modo/.test(JSON.stringify(m))) || /<zuni_modo/.test(a.system || ''));
  });
  await teste('GENERAL: pack sem blocos (status none) — nada de acervo fraco disfarçado', async () => {
    const t = await R.prepareCandidateTurn({ currentMessage: 'Como funciona a fotossíntese nas plantas aquáticas?', turnIndex: 1 }, deps);
    if (t.modo.modo === 'GENERAL_INTELLIGENCE') assert.ok(!t.knowledgePack.blocks || t.knowledgePack.blocks.length === 0 || /none|error/.test(t.knowledgePack.text));
    assert.ok(['GENERAL_INTELLIGENCE', 'ZUNI_KNOWLEDGE', 'BOUNDARY'].includes(t.modo.modo));
  });
  await teste('logger: novos campos aceitos; texto do usuário e e-mail não vazam', async () => {
    const linhas = []; const lg = R.criarLogger({ sink: (l) => linhas.push(l) });
    lg.event('knowledge_mode', { knowledgeMode: 'BOUNDARY', proprietaryContribution: 'nenhuma', modeReasons: ['crise_ou_risco'], message: 'ZZPRIV joana@x.com', correlationId: 'c-1' });
    const j = JSON.parse(linhas[0]); assert.strictEqual(j.knowledgeMode, 'BOUNDARY'); assert.ok(!linhas[0].includes('ZZPRIV') && !linhas[0].includes('joana'));
  });

  console.log('\nRubrica C2-B');
  await teste('rubrica: 13 dimensões, penalidades 0 a −2, perguntas obrigatórias, validação e nota ajustada', async () => {
    assert.ok(R2.DIMENSOES_C2B.includes('naturalidade_elegancia_conversacional') && R2.DIMENSOES_C2B.includes('percepcao_de_fatores_nao_explicitados') && R2.DIMENSOES_C2B.includes('adequacao_ao_nivel_do_usuario') && R2.DIMENSOES_C2B.length === 13);
    assert.deepStrictEqual([...R2.PENALIDADES], ['ai_like_style_penalty', 'evasion_penalty']);
    assert.ok(/percebeu algo importante que o usuário não perguntou/.test(R2.PERGUNTAS.nao_explicitado) && /investigou ou percebeu algo/.test(R2.PERGUNTAS.investigou));
    const notas = Object.fromEntries(R2.DIMENSOES_C2B.map((d) => [d, 4]));
    const av = { notas, ai_like_style_penalty: -1, evasion_penalty: -2, acrescentou: 'algo', nao_explicitado: 'não', investigou: 'não', pagaria: 'MAYBE', classificacao: 'BOA', resposta_generica: false, erro_grave: false };
    assert.ok(R2.validarAvaliacaoC2b(av).ok); assert.strictEqual(R2.notaAjustada(av), 1);
    assert.ok(!R2.validarAvaliacaoC2b({ ...av, evasion_penalty: -3 }).ok && !R2.validarAvaliacaoC2b({ ...av, ai_like_style_penalty: 1 }).ok && !R2.validarAvaliacaoC2b({ ...av, notas: { ...notas, naturalidade_elegancia_conversacional: 6 } }).ok);
    assert.ok(!R2.validarAvaliacaoC2b({ ...av, nao_explicitado: '' }).ok);
  });
  await teste('métricas: sem PASS automático; usa a chave para agrupar por variante', async () => {
    const notas = Object.fromEntries(R2.DIMENSOES_C2B.map((d) => [d, 3]));
    const mk = (item, rot, extra = {}) => ({ item_id: item, rotulo: rot, notas, ai_like_style_penalty: 0, evasion_penalty: 0, acrescentou: 'algo', nao_explicitado: 'não', investigou: 'não', pagaria: 'NO', classificacao: 'BOA', resposta_generica: false, erro_grave: false, ...extra });
    const chave = { 'caso-03': { mapa: { 1: { variante: 'generic' }, 2: { variante: 'zuni-claude' } } } };
    const m = R2.calcularMetricasC2b([mk('caso-03', 1), mk('caso-03', 2, { notas: Object.fromEntries(R2.DIMENSOES_C2B.map((d) => [d, 5])) })], chave);
    assert.ok(m.resumo.generic && m.resumo['zuni-claude'] && m.contra_baseline['zuni-claude'].vitorias === 1 && !/PASS/.test(JSON.stringify(m).replace(/nenhum PASS automático/, '')));
  });

  console.log('\nCegamento');
  const arte = (c, v, letra) => ({ case_id: c, variant: v, letra, provider: 'p-' + v, model: 'm-' + v, response: `Texto único ${c}-${Math.abs([...v].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7))} com conteúdo suficiente para o teste de cegamento.` });
  const FINAL = ['c04', 'c09', 'c11', 'c13', 'c14', 'c15', 'c16', 'c17', 'c18', 'c19'];
  const casos9 = FINAL.map((id) => CASOS.find((c) => c.id === id));
  const arts = casos9.flatMap((c) => [arte(c.id, 'generic', 'A'), arte(c.id, 'zuni-openai', 'B'), arte(c.id, 'zuni-claude', 'C'), arte(c.id, 'zuni-current', 'D')]);
  await teste('documento do avaliador sem provider/modelo/variante/letra; chave separada; sal novo muda rótulos', async () => {
    const p1 = montarPacoteCego({ casos: casos9, artefatos: arts }); const p2 = montarPacoteCego({ casos: casos9, artefatos: arts });
    for (const proibido of ['openai', 'claude', 'generic', 'zuni-', 'p-generic', 'm-zuni', 'Anthropic', 'gpt']) assert.ok(!p1.md.toLowerCase().includes(proibido.toLowerCase()) && !JSON.stringify(p1.json).toLowerCase().includes(proibido.toLowerCase()), proibido);
    assert.ok(p1.chave.sal && p1.chave.sal !== p2.chave.sal && Object.keys(p1.chave.itens).length === 10);
    assert.notStrictEqual(JSON.stringify(p1.chave.itens), JSON.stringify(p2.chave.itens)); assert.ok(!JSON.stringify(p1.json).includes(p1.chave.sal));
    assert.ok(novoSal() !== novoSal());
  });
  await teste('rótulos não repetem o sorteio da C2-A (sal diferente por execução, 9 casos)', async () => {
    const fixo = montarPacoteCego({ casos: casos9, artefatos: arts, sal: 'sal-fixo-a' }); const outro = montarPacoteCego({ casos: casos9, artefatos: arts, sal: 'sal-fixo-b' });
    assert.notStrictEqual(JSON.stringify(fixo.chave.itens), JSON.stringify(outro.chave.itens));
  });

  console.log('\nScript C2-B e proteções');
  await teste('rag3-c2b-benchmark: sem autorização imprime plano e NÃO executa; --executar sem env sai ≠ 0; zero rede', async () => {
    const CHAVE = 'C:\\Users\\Silvio\\Documents\\ZUNI-C2B\\_interno-nao-abrir-antes-da-avaliacao\\ZUNI_DIRECIONA_C2B_BLIND_KEY.json'; const mtimeChave = () => (fs.existsSync(CHAVE) ? fs.statSync(CHAVE).mtimeMs : null); const mtimeChaveAntes = mtimeChave();
    const env = { ...process.env }; delete env.RAG3_C2B_EXECUCAO_AUTORIZADA; delete env.OPENAI_API_KEY; delete env.ANTHROPIC_API_KEY;
    const a = spawnSync(process.execPath, [path.join(raiz, 'scripts/rag3-c2b-benchmark.js')], { env, encoding: 'utf8' }); assert.strictEqual(a.status, 0); assert.ok(/NÃO EXECUTADA/.test(a.stdout) && /"geracoes": 40/.test(a.stdout) && /"dentro_do_teto": true/.test(a.stdout));
    const b = spawnSync(process.execPath, [path.join(raiz, 'scripts/rag3-c2b-benchmark.js'), '--executar'], { env, encoding: 'utf8' }); assert.notStrictEqual(b.status, 0); assert.ok(/NÃO EXECUTADA/.test(b.stdout));
    assert.strictEqual(mtimeChave(), mtimeChaveAntes); // o script bloqueado não cria nem altera a chave (a chave real existe desde a execução autorizada de 07/10)
  });
  await teste('dataset: bateria final = 10 casos (6 preservados + 4 novos), sem os casos da C2-A, c03/c05/c06 substituídos', async () => {
    const ids = CASOS.map((c) => c.id); for (const id of FINAL) assert.ok(ids.includes(id), id); assert.strictEqual(FINAL.length, 10);
    for (const id of ['c01', 'c02', 'c07', 'c08', 'c10', 'c12', 'c03', 'c05', 'c06']) assert.ok(!FINAL.includes(id), id);
    const src = fs.readFileSync(path.join(raiz, 'scripts/rag3-c2b-benchmark.js'), 'utf8'); assert.ok(src.includes(JSON.stringify(FINAL).replace(/"/g, "'").replace(/,/g, ', ')));
  });

  console.log('\nDiagnóstico de recomendação de obras');
  await teste('diagnóstico: contrafactuais definidos, não alteram a config e identificam o gate que bloqueou', async () => {
    assert.ok(Object.keys(CONTRAFACTUAIS).length >= 6 && CONTRAFACTUAIS.atual && CONTRAFACTUAIS.aceitar_weak);
    const antes = JSON.stringify(R.resolverConfig().recomendacao);
    const caso = { id: 'cs', turn_index: 1, book_candidate_expected: 'NONE' };
    const d = diagnosticar({ casos: [caso], retrievals: [{ case_id: 'cs', status: 'weak', conceitos: [{ id: 'sono' }], blocos: [{ id: 'b1', titulo: 'Sono', fonte: 'obesidade_base_mentor', similaridade: 0.5 }] }] });
    assert.strictEqual(d.length, 1); assert.ok(d[0].gate_que_bloqueou && d[0].cenarios.atual); assert.strictEqual(JSON.stringify(R.resolverConfig().recomendacao), antes);
  });
  const rj = 'C:/Users/Silvio/Documents/ZUNI-C2A/_interno-nao-abrir-antes-da-avaliacao/retrieval.json';
  await teste('diagnóstico real C2-A (se presente): atual não recomenda c02/c07/c10 e aceitar_weak recupera c10 sem falso positivo', async () => {
    if (!fs.existsSync(rj)) return; const j = JSON.parse(fs.readFileSync(rj, 'utf8')); const d = diagnosticar({ casos: CASOS, retrievals: j.retrieval });
    const por = Object.fromEntries(d.map((x) => [x.case_id, x])); for (const id of ['c02', 'c07', 'c10']) assert.strictEqual(por[id].cenarios.atual.correto, false, id);
    assert.strictEqual(por.c10.cenarios.aceitar_weak.correto, true); assert.ok(d.every((x) => x.esperado !== 'NONE' || x.cenarios.aceitar_weak.livros.length === 0));
  });

  console.log('\nPreparação final: novos desafios, adequação ao usuário, sem gabarito');
  const NOVOS = ['c16', 'c17', 'c18', 'c19'].map((id) => CASOS.find((c) => c.id === id));
  await teste('novos casos c16–c19: sintéticos, válidos, sem PII, sem resposta ideal, nenhum cai em BOUNDARY', async () => {
    const { validarDataset } = require(path.join(raiz, 'src/rag3/benchmark/validate')); assert.deepStrictEqual(validarDataset(CASOS).erros, []);
    for (const c of NOVOS) { assert.ok(c && !('ideal_answer' in c) && c.book_candidate_expected === 'NONE'); for (const st of ['found', 'none']) assert.notStrictEqual(modo(c.message, ret(st, st === 'found' ? 3 : 0)).modo, 'BOUNDARY', c.id); }
    assert.ok(/mulher.*celular/.test(NOVOS[0].message) && /cafeteria/.test(NOVOS[1].message) && /oportunidade/.test(NOVOS[2].message) && /prompt/.test(NOVOS[3].message));
  });
  await teste('planner: "cafeteria" não vira cafeína (bug de prefixo corrigido); relacionamento/timidez reconhecidos por vocabulário geral', async () => {
    const pl = new R.DeterministicQueryPlanner(R.resolverConfig());
    const ids = async (m) => (await pl.plan({ currentMessage: m })).conceitos.map((c) => c.id);
    assert.ok(!(await ids(NOVOS[1].message)).includes('cafeina')); assert.ok((await ids(NOVOS[1].message)).includes('timidez'));
    assert.ok((await ids(NOVOS[0].message)).includes('relacionamento') && (await ids(NOVOS[0].message)).includes('traicao_confianca'));
    assert.ok((await ids('Tomo muito café e não consigo dormir.')).includes('cafeina') && (await ids('Tomo muito café e não consigo dormir.')).includes('sono'));
  });
  await teste('adequação ao usuário: dimensão 0–5 em todos os casos, pergunta obrigatória, guia 0–5, validação rejeita fora da faixa', async () => {
    assert.ok(R2.DIMENSOES_C2B.includes('adequacao_ao_nivel_do_usuario') && /sem infantilizá-lo/.test(R2.PERGUNTAS.adequacao)); assert.deepStrictEqual(Object.keys(R2.GUIA_ADEQUACAO), ['0', '1', '2', '3', '4', '5']);
    const notas = Object.fromEntries(R2.DIMENSOES_C2B.map((d) => [d, 3])); const av = { notas, ai_like_style_penalty: 0, evasion_penalty: 0, acrescentou: 'algo', nao_explicitado: 'não', investigou: 'não', pagaria: 'NO', classificacao: 'BOA', resposta_generica: false, erro_grave: false };
    assert.ok(R2.validarAvaliacaoC2b(av).ok); assert.ok(!R2.validarAvaliacaoC2b({ ...av, notas: { ...notas, adequacao_ao_nivel_do_usuario: 6 } }).ok);
    const { notas: _n, ...semNotas } = av; const faltando = { ...av, notas: Object.fromEntries(Object.entries(notas).filter(([k]) => k !== 'adequacao_ao_nivel_do_usuario')) }; assert.ok(!R2.validarAvaliacaoC2b(faltando).ok);
    const pacote = montarPacoteCego({ casos: casos9, artefatos: arts }); assert.ok(pacote.md.includes('adequacao_ao_nivel_do_usuario') && pacote.md.includes('Uma resposta ZUNI excepcional não é necessariamente') && /respostas mais longas/.test(pacote.md));
    assert.strictEqual(pacote.md.split('adequacao_ao_nivel_do_usuario: __').length - 1, 40);
  });
  await teste('política: regra geral adequacao_ao_usuario, sem termos dos casos novos; critério ZUNI NÃO entra em nenhum prompt', async () => {
    assert.ok(R.politica.regras.find((r) => r.id === 'adequacao_ao_usuario').texto.includes('sem infantilizar'));
    const fontes = [R.politica.texto, fs.readFileSync(path.join(raiz, 'src/rag3/causalidade.js'), 'utf8'), fs.readFileSync(path.join(raiz, 'src/rag3/knowledgeMode.js'), 'utf8')].join('\n').toLowerCase();
    for (const termo of ['cafeteria', 'prova de nada', 'prompt', 'integração', 'programador', 'inconveniente', 'dar conta', 'oportunidade', 'flerte', 'paquera', 'ciclo de evitação', 'ia generativa']) assert.ok(!fontes.includes(termo), 'gabarito no prompt: ' + termo);
    assert.ok(!R.politica.texto.includes('excepcional não é necessariamente') && !fs.readFileSync(path.join(raiz, 'src/rag3/generation.js'), 'utf8').includes('CRITERIO_ZUNI'));
  });
  await teste('requisições dos novos casos: sem campos do dataset (safety_notes, knowledge_expected, concepts_expected) e B==C', async () => {
    for (const c of NOVOS) {
      const v = await R.buildVariantRequests(c, deps); const tudo = JSON.stringify([v.payloads.zuniOpenAI, v.payloads.zuniClaude, v.payloads.generic]);
      for (const frag of [c.safety_notes.slice(0, 40), c.knowledge_expected[0], c.title].filter(Boolean)) assert.ok(!tudo.includes(frag), c.id + ': ' + frag);
      assert.ok(v.equivalenciaZuni.equivalentes, c.id);
    }
  });
  await teste('auditoria da bateria: nenhum par de casos finais repete o mesmo conjunto de conceitos; custo pior caso ≤ US$ 3,00', async () => {
    const assin = FINAL.map((id) => CASOS.find((c) => c.id === id).concepts_expected.slice().sort().join('+')); const comConceito = assin.filter(Boolean); assert.strictEqual(new Set(comConceito).size, comConceito.length);
    const out = spawnSync(process.execPath, [path.join(raiz, 'scripts/rag3-c2b-benchmark.js')], { encoding: 'utf8', env: { ...process.env, RAG3_C2B_EXECUCAO_AUTORIZADA: '' } }); const j = JSON.parse(out.stdout.slice(out.stdout.indexOf('{'), out.stdout.lastIndexOf('}') + 1));
    assert.ok(j.usd_pior_caso <= 3 && j.geracoes === 40 && j.casos.length === 10);
  });

  console.log('\nIsolamento de produção');
  await teste('produção intocada: nenhum arquivo de produção referencia rag3; git não mostra mudanças em server/routes/lib/public', async () => {
    const lista = (d) => fs.readdirSync(path.join(raiz, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? lista(path.join(d, e.name)) : [path.join(d, e.name)]);
    for (const f of ['src/server.js', ...lista('src/routes'), ...lista('src/lib'), ...lista('public')].filter((x) => /\.(js|html)$/.test(x))) assert.ok(!/rag3/i.test(fs.readFileSync(path.join(raiz, f), 'utf8')), f);
    const g = spawnSync('git', ['status', '--porcelain', '--', 'src/server.js', 'src/routes', 'src/lib', 'public', 'migrations', 'package.json'], { cwd: raiz, encoding: 'utf8' }); assert.strictEqual(g.stdout.trim(), '');
  });
  await teste('zero chamadas de rede e trava paga fechada durante todo o teste', async () => { assert.strictEqual(fetchChamado, 0); assert.strictEqual(process.env.RAG3_ALLOW_PAID_CALLS, undefined); });
  await teste('regressão: suíte C1 continua passando (46/46)', async () => {
    const r = spawnSync(process.execPath, [path.join(raiz, 'scripts/testar-rag3-candidate.js')], { encoding: 'utf8', env: { ...process.env } });
    assert.strictEqual(r.status, 0, r.stdout.split('\n').filter((l) => /FAIL/.test(l)).join(' | ')); assert.ok(/Passaram: 46/.test(r.stdout));
  });

  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join('; ')); process.exit(1); }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1); });
