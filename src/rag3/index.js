'use strict';
// rag3 — Candidate RAG 3.0 (fase C1, LOCAL-ONLY). Nenhuma rota pública usa este módulo; o pipeline de produção não foi alterado.
module.exports = {
  ...require('./config'),
  ...require('./queryPlanner'),
  ...require('./retrieval'),
  ...require('./knowledgePack'),
  ...require('./editorialPolicy'),
  ...require('./generation'),
  ...require('./providers'),
  ...require('./bookRecommendation'),
  ...require('./privacyLogger'),
  ...require('./pipeline'),
  ...require('./knowledgeMode'),
  ...require('./causalidade'),
  ...require('./paidGuard'),
  ...require('./embedder'),
  ...require('./vectorStore'),
  ...require('./currentAdapter')
};
