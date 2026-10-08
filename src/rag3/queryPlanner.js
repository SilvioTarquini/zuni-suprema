'use strict';
// rag3/queryPlanner.js — transforma (mensagem atual + histórico recente + resumo + tema) em um PLANO de 2–3 subconsultas conceituais.
// Interface única `QueryPlanner.plan()`: o planner determinístico (local) e o futuro planner assistido por modelo produzem o MESMO formato,
// então o retrieval não precisa ser reescrito. O texto do usuário só aparece no plano como subconsulta "literal" (vai ao embedding,
// nunca a log) e, em último caso, como fallback.
const { normalizar, palavras } = require('./util');
const { CONCEITOS, POR_ID, TEMA_PARA_CONCEITOS, TEMA_PARA_ETIQUETAS } = require('./conceptLexicon');

class QueryPlanner {
  // eslint-disable-next-line no-unused-vars
  async plan(entrada) { throw new Error('RAG3_PLANNER_NAO_IMPLEMENTADO'); }
}

function casar(textoNorm, radical) {
  const r = normalizar(radical);
  // radical com espaço no fim ("cha ") exige fronteira; os demais casam por prefixo de palavra.
  const re = new RegExp(r.endsWith(' ') ? `(^|[^a-z0-9])${r.trim()}([^a-z0-9]|$)` : `(^|[^a-z0-9])${r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  return re.test(textoNorm);
}

function detectar(texto) {
  const t = normalizar(texto); const achados = new Map();
  for (const c of CONCEITOS) {
    let n = 0; for (const r of c.radicais) if (casar(t, r)) n++;
    if (n > 0) achados.set(c.id, n);
  }
  return achados;
}

class DeterministicQueryPlanner extends QueryPlanner {
  constructor(config) { super(); this.cfg = config.planner; }

  async plan({ currentMessage = '', recentHistory = [], sessionSummary = '', selectedTheme = null } = {}) {
    const cfg = this.cfg; const pesos = new Map(); const origem = new Map();
    const somar = (id, p, o) => { pesos.set(id, (pesos.get(id) || 0) + p); if (!origem.has(id)) origem.set(id, o); };

    for (const [id, n] of detectar(currentMessage)) somar(id, 1 + 0.2 * Math.min(n - 1, 3), 'message');

    const falasUsuario = (recentHistory || []).filter((m) => m && m.role === 'user' && typeof m.content === 'string').slice(-cfg.turnosDeHistorico);
    let turnosUsados = 0;
    falasUsuario.forEach((m, i) => { const det = detectar(m.content); if (det.size) turnosUsados++; for (const [id, n] of det) somar(id, cfg.pesoHistorico * (0.6 + 0.4 * ((i + 1) / falasUsuario.length)) * (1 + 0.1 * Math.min(n - 1, 3)), 'history'); });
    if (sessionSummary) for (const [id] of detectar(sessionSummary)) somar(id, cfg.pesoHistorico * 0.6, 'history');
    if (selectedTheme && TEMA_PARA_CONCEITOS[selectedTheme]) for (const id of TEMA_PARA_CONCEITOS[selectedTheme]) somar(id, cfg.pesoTema, 'theme');

    const ordenados = [...pesos.entries()].sort((a, b) => b[1] - a[1]).slice(0, cfg.maxConceitos);
    const conceitos = ordenados.map(([id, peso]) => ({ id, label: POR_ID[id].label, queryText: POR_ID[id].consulta, weight: Number(peso.toFixed(3)), origin: origem.get(id) }));

    const subconsultas = conceitos.map((c) => ({ id: 'c:' + c.id, kind: 'concept', conceptId: c.id, text: c.queryText, weight: c.weight }));
    // continuação: mensagem curta OU que começa com anáfora ("e isso piora…", "mas então…", "nisso…")
    const curta = palavras(currentMessage) < cfg.mensagemCurtaPalavras || /^(e |mas |entao |isso|nisso|esse|essa|aquilo|tambem|e se )/.test(normalizar(currentMessage).trim());
    const ultimaFala = falasUsuario.length ? falasUsuario[falasUsuario.length - 1].content : '';
    let literal = String(currentMessage || '').trim();
    if (curta && ultimaFala) literal = (ultimaFala + ' ' + literal).trim(); // continuação ("e isso piora à noite"): herda a fala anterior
    let fallbackUsado = false;
    if (cfg.incluirSubconsultaLiteral && literal) subconsultas.push({ id: 'literal', kind: 'literal', conceptId: null, text: literal.slice(0, cfg.maxCharsLiteral), weight: 1 });
    if (!subconsultas.length) { fallbackUsado = true; if (literal) subconsultas.push({ id: 'literal', kind: 'literal', conceptId: null, text: literal.slice(0, cfg.maxCharsLiteral), weight: 1 }); }

    const etiquetas = selectedTheme ? (TEMA_PARA_ETIQUETAS[selectedTheme] || [selectedTheme]) : [];
    return { versao: 1, modo: 'deterministic', conceitos, subconsultas, temaSinal: selectedTheme || null, etiquetasDeTema: etiquetas, usouHistorico: turnosUsados > 0, continuacao: curta && Boolean(ultimaFala), fallbackUsado };
  }
}

// Planner assistido por modelo (FUTURO): recebe uma função injetada que devolve conceitos; qualquer falha cai no determinístico.
class ModelAssistedQueryPlanner extends QueryPlanner {
  constructor(config, { reescrever = null, fallback = null } = {}) { super(); this.cfg = config; this.reescrever = reescrever; this.fallback = fallback || new DeterministicQueryPlanner(config); }
  async plan(entrada) {
    if (typeof this.reescrever !== 'function') throw new Error('RAG3_PLANNER_MODELO_NAO_CONFIGURADO');
    try {
      const r = await this.reescrever(entrada);
      const validos = (r && Array.isArray(r.conceitos) ? r.conceitos : []).filter((c) => c && POR_ID[c.id]).slice(0, this.cfg.planner.maxConceitos);
      if (!validos.length) return this.fallback.plan(entrada);
      const base = await this.fallback.plan({ ...entrada, currentMessage: '', recentHistory: [], sessionSummary: '' });
      const conceitos = validos.map((c) => ({ id: c.id, label: POR_ID[c.id].label, queryText: POR_ID[c.id].consulta, weight: Number(c.weight) || 1, origin: 'model' }));
      const subconsultas = conceitos.map((c) => ({ id: 'c:' + c.id, kind: 'concept', conceptId: c.id, text: c.queryText, weight: c.weight }));
      if (this.cfg.planner.incluirSubconsultaLiteral && entrada.currentMessage) subconsultas.push({ id: 'literal', kind: 'literal', conceptId: null, text: String(entrada.currentMessage).slice(0, this.cfg.planner.maxCharsLiteral), weight: 1 });
      return { ...base, modo: 'model-assisted', conceitos, subconsultas, fallbackUsado: false };
    } catch (e) { return this.fallback.plan(entrada); }
  }
}

function criarQueryPlanner(config, deps = {}) {
  return config.planner.modo === 'model-assisted' ? new ModelAssistedQueryPlanner(config, deps) : new DeterministicQueryPlanner(config);
}

module.exports = { QueryPlanner, DeterministicQueryPlanner, ModelAssistedQueryPlanner, criarQueryPlanner, detectar };
