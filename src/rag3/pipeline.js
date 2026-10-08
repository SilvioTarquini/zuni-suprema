'use strict';
// rag3/pipeline.js — orquestra UM turno do Candidate até o ponto em que o fornecedor entra:
//   retrieval ZUNI → knowledge pack → recomendação de obra (decisão comercial separada) → logs sem PII.
// Nenhum fornecedor de geração é chamado aqui. Nenhuma rota pública usa este módulo nesta fase.
const { resolverConfig } = require('./config');
const { retrieveZuniKnowledge } = require('./retrieval');
const { buildKnowledgePack } = require('./knowledgePack');
const { politica } = require('./editorialPolicy');
const { buildGenerationRequest, buildBaselineRequest, verificarEquivalencia } = require('./generation');
const { AnthropicProvider, OpenAIProvider, conteudoEditorialDoPayload } = require('./providers');
const { recommendBooks } = require('./bookRecommendation');
const { decidirModoDeConhecimento } = require('./knowledgeMode');
const { construirOrientacaoInvestigativa } = require('./causalidade');
const { criarLogger, camposDeRecuperacao, novoCorrelationId } = require('./privacyLogger');
const { recuperarComoAtual, buildCurrentRequest, carregarPromptAtual } = require('./currentAdapter');

async function prepareCandidateTurn(entrada, deps) {
  const config = deps.config || resolverConfig();
  const logger = deps.logger || criarLogger();
  const correlationId = entrada.correlationId || novoCorrelationId();
  const retrieval = await retrieveZuniKnowledge({ currentMessage: entrada.currentMessage, recentHistory: entrada.history || [], sessionSummary: entrada.sessionSummary || '', selectedTheme: entrada.selectedTheme || null }, { ...deps, config });
  const conceitos = ((retrieval.queryPlan && retrieval.queryPlan.conceitos) || []).map((c) => c.id);
  // C2-B: modo de conhecimento (ZUNI_KNOWLEDGE | GENERAL_INTELLIGENCE | BOUNDARY) e orientação investigativa (hipóteses; causalidade ampliada)
  const modo = decidirModoDeConhecimento({ retrieval, message: entrada.currentMessage, history: entrada.history || [] });
  const orientacao = construirOrientacaoInvestigativa({ message: entrada.currentMessage, history: entrada.history || [], concepts: conceitos });
  // Em GENERAL_INTELLIGENCE o acervo foi insuficiente: o pack vai VAZIO (nada de blocos fracos fingindo ser conhecimento ZUNI).
  const retrievalParaPack = modo.modo === 'GENERAL_INTELLIGENCE' ? { ...retrieval, status: retrieval.status === 'error' ? 'error' : 'none', blocks: [] } : retrieval;
  const knowledgePack = buildKnowledgePack(retrievalParaPack);
  const recommendation = recommendBooks({ blocks: retrieval.blocks, concepts: conceitos, retrievalStatus: retrieval.status, turnIndex: entrada.turnIndex || 0, userAskedForReading: Boolean(entrada.userAskedForReading), parentContext: Boolean(entrada.parentContext), alreadyRecommended: entrada.alreadyRecommended || [] }, { config });
  logger.event('retrieval', camposDeRecuperacao(retrieval, { selectedTheme: entrada.selectedTheme || null, correlationId }));
  logger.event('knowledge_mode', { correlationId, knowledgeMode: modo.modo, proprietaryContribution: modo.contribuicaoProprietaria, modeReasons: modo.motivos });
  if (recommendation.books.length) logger.event('recommendation', { correlationId, bookIds: recommendation.books.map((b) => b.bookId) });
  return { correlationId, retrieval, knowledgePack, modo, orientacao, recommendation, config };
}

// Monta as 4 variantes do benchmark para UM caso (sem chamar nenhum fornecedor).
async function buildVariantRequests(caso, deps) {
  const config = deps.config || resolverConfig();
  const ctx = { history: caso.history || [] };
  const preparo = await prepareCandidateTurn({ currentMessage: caso.message, history: ctx.history, selectedTheme: caso.selected_theme || null, turnIndex: caso.turn_index || 0, userAskedForReading: Boolean(caso.user_asked_for_reading), parentContext: Boolean(caso.parent_context), correlationId: 'case-' + caso.id }, { ...deps, config });
  const zuni = buildGenerationRequest({ editorialPolicy: politica, conversationContext: ctx, knowledgePack: preparo.knowledgePack, userMessage: caso.message, modo: preparo.modo, orientacao: preparo.orientacao });
  const anthropic = new AnthropicProvider(config.provedores.anthropic); const openai = new OpenAIProvider({ ...config.provedores.openai, modelo: config.provedores.openai.modelo || 'MODELO-A-DEFINIR' });
  const generic = buildBaselineRequest({ conversationContext: ctx, userMessage: caso.message, comPolitica: false });
  let atual = null;
  if (deps.store && typeof deps.store.searchCurrent === 'function') {
    const rc = await recuperarComoAtual({ message: caso.message, theme: caso.selected_theme || null, embedder: deps.embedder, store: deps.store });
    atual = { ...rc, request: buildCurrentRequest({ history: ctx.history, message: caso.message, conhecimento: rc.conhecimento, promptAtual: deps.promptAtual || carregarPromptAtual() }) };
  }
  const payloadsZuni = { openai: openai.toPayload(zuni), claude: anthropic.toPayload(zuni) };
  return {
    caso: caso.id, preparo, requests: { generic, zuni: zuni, current: atual && atual.request }, atual,
    payloads: { generic: anthropic.toPayload(generic), zuniOpenAI: payloadsZuni.openai, zuniClaude: payloadsZuni.claude, current: atual ? anthropic.toPayload(atual.request) : null },
    // prova de comparação justa: o conteúdo editorial que cada envelope carrega é idêntico (política + knowledge pack + mensagens)
    equivalenciaZuni: (() => {
      const a = conteudoEditorialDoPayload(payloadsZuni.openai); const b = conteudoEditorialDoPayload(payloadsZuni.claude);
      const problemas = []; if (a.system !== b.system) problemas.push('system_diferente'); if (JSON.stringify(a.messages) !== JSON.stringify(b.messages)) problemas.push('mensagens_diferentes');
      return { equivalentes: problemas.length === 0, problemas, politicaHash: zuni.hashes.politica, knowledgePackHash: zuni.hashes.knowledgePack, modoHash: zuni.hashes.modo, orientacaoHash: zuni.hashes.orientacao, knowledgeMode: zuni.meta.knowledgeMode };
    })(),
    providers: { anthropic, openai }
  };
}

module.exports = { prepareCandidateTurn, buildVariantRequests };
