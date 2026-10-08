'use strict';
// rag3/privacyLogger.js — observabilidade SEM PII. Só campos de uma lista permitida, só valores curtos e estruturados
// (ids, contagens, números, enums). Qualquer outra coisa é DESCARTADA e contada. Nunca recebe pergunta, resposta, nome ou e-mail.
const crypto = require('crypto');

const ID = /^[A-Za-z0-9_.:-]{1,80}$/;
const ENUM_STATUS = new Set(['found', 'weak', 'none', 'error']);
const ENUM_PROVIDER = new Set(['openai', 'anthropic', 'none']);
const ENUM_VARIANTE = new Set(['generic', 'zuni-openai', 'zuni-claude', 'zuni-current', 'baseline-generico', 'baseline-politica']);

const CAMPOS = Object.freeze({
  correlationId: (v) => typeof v === 'string' && ID.test(v),
  status: (v) => ENUM_STATUS.has(v),
  selectedTheme: (v) => v === null || (typeof v === 'string' && ID.test(v)),
  candidateCount: Number.isInteger, finalCount: Number.isInteger, truncatedCount: Number.isInteger, sourceDiversity: Number.isInteger,
  conceptCoverage: (v) => typeof v === 'number' && Number.isFinite(v),
  blockIds: (v) => Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === 'string' && ID.test(x)),
  sourceIds: (v) => Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === 'string' && ID.test(x)),
  conceptIds: (v) => Array.isArray(v) && v.length <= 8 && v.every((x) => typeof x === 'string' && ID.test(x)),
  bookIds: (v) => Array.isArray(v) && v.length <= 4 && v.every((x) => typeof x === 'string' && ID.test(x)),
  similarities: (v) => Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === 'number' && Number.isFinite(x)),
  thresholdCalibrated: (v) => typeof v === 'boolean',
  knowledgeMode: (v) => ['ZUNI_KNOWLEDGE', 'GENERAL_INTELLIGENCE', 'BOUNDARY'].includes(v),
  proprietaryContribution: (v) => ['alta', 'parcial', 'nenhuma'].includes(v),
  modeReasons: (v) => Array.isArray(v) && v.length <= 6 && v.every((x) => typeof x === 'string' && ID.test(x)),
  provider: (v) => ENUM_PROVIDER.has(v), variant: (v) => ENUM_VARIANTE.has(v),
  model: (v) => typeof v === 'string' && ID.test(v), caseId: (v) => typeof v === 'string' && ID.test(v), errorCode: (v) => typeof v === 'string' && ID.test(v),
  latencyMs: Number.isInteger, inputTokens: Number.isInteger, outputTokens: Number.isInteger
});

function sanitizar(campos) {
  const ok = {}; let descartados = 0;
  for (const [k, v] of Object.entries(campos || {})) { const valida = CAMPOS[k]; if (valida && valida(v)) ok[k] = v; else descartados++; }
  return { campos: ok, descartados };
}

function criarLogger({ sink = null } = {}) {
  const emitir = sink || (() => {});
  return {
    event(nome, campos) {
      if (typeof nome !== 'string' || !ID.test(nome)) return { emitido: false, descartados: 0 };
      const { campos: ok, descartados } = sanitizar(campos);
      const linha = JSON.stringify({ evt: 'rag3.' + nome, ts: new Date().toISOString(), ...ok, ...(descartados ? { droppedFields: descartados } : {}) });
      emitir(linha); return { emitido: true, descartados, linha };
    }
  };
}

function novoCorrelationId() { return crypto.randomUUID(); }

// Campos de um resultado de recuperação que PODEM ser logados (nenhum texto de usuário).
function camposDeRecuperacao(retrieval, { selectedTheme = null, correlationId = null } = {}) {
  const b = retrieval.blocks || []; const d = retrieval.diagnostics || {};
  return {
    ...(correlationId ? { correlationId } : {}), status: retrieval.status, selectedTheme, candidateCount: d.candidateCount || 0, finalCount: d.finalCount || 0, sourceDiversity: d.sourceDiversity || 0,
    conceptCoverage: d.conceptCoverage || 0, truncatedCount: d.truncatedCount || 0, thresholdCalibrated: Boolean(d.thresholdCalibrated), blockIds: b.map((x) => x.id), sourceIds: [...new Set(b.map((x) => x.source))].slice(0, 20),
    similarities: b.map((x) => x.similarity), conceptIds: ((retrieval.queryPlan && retrieval.queryPlan.conceitos) || []).map((c) => c.id), ...(Number.isInteger(d.latencyMs) ? { latencyMs: d.latencyMs } : {}), ...(retrieval.erroCodigo ? { errorCode: String(retrieval.erroCodigo).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 40) } : {})
  };
}

// Linhas no formato da tabela `citacoes_rag` (já criada em produção e nunca alimentada). NÃO escreve em banco: só produz objetos.
// sessao_id é o correlation id opaco (não o id real da sessão); blocos_citados fica null até existir medição de citação.
function toCitacoesRagRows({ correlationId, retrieval, modelo = null, selectedTheme = null }) {
  const b = retrieval.blocks || [];
  return b.map((x, i) => ({ sessao_id: correlationId, tema: selectedTheme, caminho: x.path || null, titulo: x.title || null, posicao: i + 1, modelo, blocos_enviados: b.length, blocos_citados: null }));
}

module.exports = { criarLogger, sanitizar, novoCorrelationId, camposDeRecuperacao, toCitacoesRagRows, CAMPOS };
