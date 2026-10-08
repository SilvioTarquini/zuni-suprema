// FASE C2-B — rodada cega PREPARADA (bateria final de 10 casos × 4 variantes). **NÃO EXECUTAR sem autorização humana explícita nova.**
//   A generic · B ZUNI Candidate + OpenAI · C ZUNI Candidate + Claude · D ZUNI Current
// Padrão: imprime o PLANO e a estimativa de custo, SEM rede, SEM chaves, SEM chamadas pagas.
// A execução real exige, ao mesmo tempo: --executar, RAG3_C2B_EXECUCAO_AUTORIZADA=I_CONFIRM_C2B e RAG3_C2B_TETO_USD (teto autorizado).
// Banco: somente RPCs de busca (leitura). O rótulo visível de cada resposta é sorteado de novo (sal aleatório gravado só na BLIND_KEY).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const raiz = path.join(__dirname, '..');
const R = require(path.join(raiz, 'src/rag3'));
const { CASOS } = require(path.join(raiz, 'src/rag3/benchmark/dataset'));
const { montarPacoteCego } = require(path.join(raiz, 'src/rag3/benchmark/blindPackage'));
const { sha256 } = require(path.join(raiz, 'src/rag3/util'));

// Bateria FINAL (auditoria na preparação final): preserva c04, c09, c11, c13, c14, c15 e acrescenta c16–c19 (crise conjugal, aproximação amorosa,
// autoestima/evitação, baixa familiaridade técnica). c03, c05 e c06 foram substituídos por redundância (ver relatório). Casos da C2-A (c01,c02,c07,c08,c10,c12) ficam fora.
const IDS_C2B = ['c04', 'c09', 'c11', 'c13', 'c14', 'c15', 'c16', 'c17', 'c18', 'c19'];
const TETO_PRETENDIDO_USD = 3.0;
const PRECOS = { openai: { entrada: 4, saida: 20 }, anthropic: { entrada: 3, saida: 15 }, embedding: 0.02 };
const MODELO_OPENAI = 'gpt-5.6-sol'; const MODELO_CLAUDE = 'claude-sonnet-4-6';
const MAX_SAIDA = { openai: 4000, anthropic: 1400, current: 1024 };
// Mesmos limiares usados na C2-A (comparabilidade). NÃO calibrados; qualquer mudança é decisão humana.
const LIMIARES_C2B = { fraco: 0.506, encontrado: 0.543, calibrado: false };
const SAIDA = 'C:\\Users\\Silvio\\Documents\\ZUNI-C2B';
const INTERNO = path.join(SAIDA, '_interno-nao-abrir-antes-da-avaliacao');
const usd = (tin, tout, p) => (tin / 1e6) * p.entrada + (tout / 1e6) * p.saida;

function plano() {
  const cfg = R.resolverConfig({ limiares: LIMIARES_C2B });
  const atual = R.carregarPromptAtual(); const casos = IDS_C2B.map((id) => CASOS.find((c) => c.id === id));
  let total = 0; const linhas = [];
  for (const c of casos) {
    const base = c.message.length + (c.history || []).reduce((s, h) => s + h.content.length, 0);
    const est = (chars, saida, p) => usd(Math.ceil((chars / 3.5) * 1.3), saida, p);
    const a = est(600 + base, MAX_SAIDA.anthropic, PRECOS.anthropic);
    const b = est(R.politica.texto.length + cfg.contexto.maxCharsTotal + 3200 + base, MAX_SAIDA.openai, PRECOS.openai);
    const cc = est(R.politica.texto.length + cfg.contexto.maxCharsTotal + 3200 + base, MAX_SAIDA.anthropic, PRECOS.anthropic);
    const d = est(atual.systemChatAoVivo.length + 52000 + base, MAX_SAIDA.current, PRECOS.anthropic);
    total += a + b + cc + d; linhas.push({ caso: c.id, usd_max: Number((a + b + cc + d).toFixed(3)) });
  }
  return { casos: IDS_C2B, geracoes: casos.length * 4, embeddings_requisicoes: casos.length * 2, usd_pior_caso: Number(total.toFixed(3)), usd_tipico_heuristico_55pct: Number((total * 0.55).toFixed(3)), teto_pretendido_usd: TETO_PRETENDIDO_USD, dentro_do_teto: total <= TETO_PRETENDIDO_USD, por_caso: linhas, politica: R.politica.versao + ':' + R.politica.hash.slice(0, 12), prompt_current: atual.fingerprint.hash.slice(0, 12), limiares: LIMIARES_C2B };
}

const EXECUTAR = process.argv.includes('--executar');
if (!EXECUTAR || process.env.RAG3_C2B_EXECUCAO_AUTORIZADA !== 'I_CONFIRM_C2B') {
  console.log('C2-B PREPARADA — NÃO EXECUTADA (aguardando autorização humana explícita).');
  console.log('Plano e estimativa (sem rede, sem chaves, sem chamadas pagas):');
  console.log(JSON.stringify(plano(), null, 1));
  console.log('Para executar: --executar + RAG3_C2B_EXECUCAO_AUTORIZADA=I_CONFIRM_C2B + RAG3_C2B_TETO_USD=<teto autorizado>.');
  process.exit(EXECUTAR ? 10 : 0);
}

// ═══ A PARTIR DAQUI: execução real (somente após autorização) ═══
require(path.join(raiz, 'node_modules/dotenv')).config({ path: path.join(raiz, '.env') });
const { createClient } = require(path.join(raiz, 'node_modules/@supabase/supabase-js'));
const { VALOR_AUTORIZACAO } = require(path.join(raiz, 'src/rag3/paidGuard'));
const TETO_USD = Number(process.env.RAG3_C2B_TETO_USD);
if (!Number.isFinite(TETO_USD) || TETO_USD <= 0) { console.error('STOP: defina RAG3_C2B_TETO_USD com o teto autorizado.'); process.exit(11); }
fs.mkdirSync(INTERNO, { recursive: true });

async function http(url, headers, body) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 180000);
  try { const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ac.signal }); const json = await resp.json().catch(() => null); if (!resp.ok) { const e = new Error('http'); e.status = resp.status; throw e; } return json; } finally { clearTimeout(t); }
}

(async () => {
  const est = plano(); if (est.usd_pior_caso > TETO_USD) { console.log('STOP: estimativa acima do teto', JSON.stringify({ estimativa: est.usd_pior_caso, teto: TETO_USD })); process.exit(3); }
  const m = await fetch('https://api.openai.com/v1/models/' + MODELO_OPENAI, { headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY } }); if (!m.ok) { console.log('STOP: modelo OpenAI indisponível'); process.exit(4); }
  const cfg = R.resolverConfig({ limiares: LIMIARES_C2B, provedores: { openai: { modelo: MODELO_OPENAI, maxTokensSaida: MAX_SAIDA.openai }, anthropic: { modelo: MODELO_CLAUDE, maxTokensSaida: MAX_SAIDA.anthropic } } });
  const casos = IDS_C2B.map((id) => CASOS.find((c) => c.id === id)); const atual = R.carregarPromptAtual();
  let gasto = 0; const erros = []; const extras = { openai: null }; const inicio = Date.now();
  process.env.RAG3_ALLOW_PAID_CALLS = VALOR_AUTORIZACAO; // aberta só neste processo
  try {
    const embedder = new R.OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY, fetchImpl: fetch });
    const store = new R.SupabaseRpcVectorStore({ client: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { auth: { persistSession: false } }) });
    const deps = { embedder, store, config: cfg, promptAtual: atual };
    const prep = new Map(); const retrieval = [];
    for (const c of casos) {
      const v = await R.buildVariantRequests(c, deps); prep.set(c.id, v); const r = v.preparo.retrieval;
      retrieval.push({ case_id: c.id, status: r.status, knowledge_mode: v.preparo.modo.modo, contribuicao: v.preparo.modo.contribuicaoProprietaria, motivos_modo: v.preparo.modo.motivos, diagnostico: r.diagnostics, blocos: r.blocks.map((b) => ({ id: b.id, titulo: b.title, fonte: b.source, obra: b.bookId, similaridade: b.similarity })), pack_hash: v.preparo.knowledgePack.hash, modo_hash: v.preparo.modo.hash, orientacao_hash: v.requests.zuni.hashes.orientacao, topicos_investigativos: { hipoteses: v.preparo.orientacao.hipoteses.map((h) => h.id), fatores: v.preparo.orientacao.fatoresAdjacentes.map((f) => f.id), pergunta: Boolean(v.preparo.orientacao.perguntaSugerida) } });
    }
    fs.writeFileSync(path.join(INTERNO, 'retrieval.json'), JSON.stringify(retrieval, null, 1));
    const fairness = casos.map((c) => { const v = prep.get(c.id); const ed = (p) => R.conteudoEditorialDoPayload(p); return { case_id: c.id, equivalentes: v.equivalenciaZuni.equivalentes, politica: v.equivalenciaZuni.politicaHash, pack: v.equivalenciaZuni.knowledgePackHash, modo: v.equivalenciaZuni.modoHash, orientacao: v.equivalenciaZuni.orientacaoHash, editorial_openai: sha256(JSON.stringify(ed(v.payloads.zuniOpenAI))), editorial_claude: sha256(JSON.stringify(ed(v.payloads.zuniClaude))) }; });
    if (!fairness.every((f) => f.equivalentes && f.editorial_openai === f.editorial_claude)) { console.log('STOP: B e C não equivalentes.'); process.exit(5); }
    fs.writeFileSync(path.join(INTERNO, 'fairness.json'), JSON.stringify(fairness, null, 1));

    const transportes = { anthropic: (p) => http('https://api.anthropic.com/v1/messages', { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, p), openai: async (p) => { const j = await http('https://api.openai.com/v1/chat/completions', { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }, p); extras.openai = { finish: j.choices && j.choices[0] && j.choices[0].finish_reason, reasoning: j.usage && j.usage.completion_tokens_details ? j.usage.completion_tokens_details.reasoning_tokens : null }; return j; } };
    const provA = new R.AnthropicProvider({ modelo: MODELO_CLAUDE, maxTokensSaida: MAX_SAIDA.anthropic }); const provD = new R.AnthropicProvider({ modelo: MODELO_CLAUDE, maxTokensSaida: MAX_SAIDA.current }); const provB = new R.OpenAIProvider({ modelo: MODELO_OPENAI, maxTokensSaida: MAX_SAIDA.openai });
    const variantes = [['A', 'generic', provA, 'generic'], ['B', 'zuni-openai', provB, 'zuni'], ['C', 'zuni-claude', provA, 'zuni'], ['D', 'zuni-current', provD, 'current']];
    const arq = path.join(INTERNO, 'artefatos.json'); const artefatos = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : []; let parou = null;
    for (const c of casos) {
      const v = prep.get(c.id);
      for (const [letra, nome, prov, tipo] of variantes) {
        if (artefatos.some((a) => a.case_id === c.id && a.variant === nome && a.response)) continue;
        const req = tipo === 'generic' ? v.requests.generic : (tipo === 'zuni' ? v.requests.zuni : v.requests.current);
        const inTok = Math.ceil((req.systemText.length + req.messages.reduce((s, x) => s + x.content.length, 0)) / 3.5); const precos = prov.nome === 'openai' ? PRECOS.openai : PRECOS.anthropic;
        const saidaMax = nome === 'zuni-openai' ? MAX_SAIDA.openai : (nome === 'zuni-current' ? MAX_SAIDA.current : MAX_SAIDA.anthropic);
        if (gasto + usd(inTok * 1.3, saidaMax, precos) > TETO_USD * 0.97) { parou = { motivo: 'teto_de_custo' }; break; }
        extras.openai = null;
        try {
          const r = await prov.generate(req, { transporte: prov.nome === 'openai' ? transportes.openai : transportes.anthropic }); const texto = String(r.text || '').trim(); const custo = usd(r.usage.inputTokens || 0, r.usage.outputTokens || 0, precos); gasto += custo;
          artefatos.push({ case_id: c.id, variant: nome, letra, provider: prov.nome, model: prov.cfg.modelo, response: texto.length >= 40 ? texto : null, finish_reason: extras.openai ? extras.openai.finish : null, reasoning_tokens: extras.openai ? extras.openai.reasoning : null, usage: r.usage, custo_usd: Number(custo.toFixed(5)), latency_ms: r.latencyMs, knowledge_mode: tipo === 'zuni' ? v.preparo.modo.modo : null });
          console.log(`geração ${artefatos.length} concluída | acumulado≈$${gasto.toFixed(3)}`);
        } catch (e) { erros.push({ case_id: c.id, variant: nome, codigo: e.codigo || 'erro', retryable: Boolean(e.retryable) }); console.log('ERRO em ' + c.id + ': ' + (e.codigo || 'erro')); }
        fs.writeFileSync(arq, JSON.stringify(artefatos, null, 1));
      }
      if (parou) break;
    }
    const vazias = artefatos.filter((a) => !a.response).map((a) => a.case_id + ':' + a.variant); if (vazias.length) erros.push({ codigo: 'resposta_vazia_ou_truncada', itens: vazias });
    const pacote = montarPacoteCego({ casos, artefatos }); // sal ALEATÓRIO novo: rótulos independentes da C2-A
    fs.mkdirSync(SAIDA, { recursive: true });
    fs.writeFileSync(path.join(SAIDA, 'ZUNI_DIRECIONA_C2B_BLIND_EVALUATION.md'), pacote.md);
    fs.writeFileSync(path.join(SAIDA, 'ZUNI_DIRECIONA_C2B_BLIND_EVALUATION.json'), JSON.stringify(pacote.json, null, 1));
    fs.writeFileSync(path.join(INTERNO, 'ZUNI_DIRECIONA_C2B_BLIND_KEY.json'), JSON.stringify(pacote.chave, null, 1));
    fs.writeFileSync(path.join(INTERNO, 'resumo_execucao.json'), JSON.stringify({ gasto_estimado_usd: Number(gasto.toFixed(4)), teto: TETO_USD, geracoes_ok: artefatos.filter((a) => a.response).length, geracoes_registradas: artefatos.length, erros, parou, duracao_s: Math.round((Date.now() - inicio) / 1000) }, null, 1));
    console.log('RESUMO', JSON.stringify({ gasto_estimado_usd: Number(gasto.toFixed(4)), geracoes_ok: artefatos.filter((a) => a.response).length, erros: erros.length, parou: parou && parou.motivo }));
  } finally { delete process.env.RAG3_ALLOW_PAID_CALLS; console.log('trava paga desativada:', process.env.RAG3_ALLOW_PAID_CALLS === undefined); }
})().catch((e) => { delete process.env.RAG3_ALLOW_PAID_CALLS; console.error('FALHA:', String(e && e.message).slice(0, 160)); process.exit(1); });
