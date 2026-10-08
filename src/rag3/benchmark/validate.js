'use strict';
// rag3/benchmark/validate.js — valida o dataset: campos obrigatórios, ids de conceito/obra existentes, ZERO PII, sem resposta ideal.
const { POR_ID } = require('../conceptLexicon');
const { CATALOGO } = require('../../lib/catalogoLivros');

const OBRIGATORIOS = ['id', 'title', 'domain_fit', 'turn_index', 'history', 'message', 'concepts_expected', 'knowledge_expected', 'expected_sources', 'safety_notes', 'book_candidate_expected'];
const PROIBIDOS = ['ideal_answer', 'expected_answer', 'resposta_ideal'];
const PADROES_PII = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 'email'], [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, 'cpf'], [/\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/, 'telefone'],
  [/https?:\/\//i, 'url'], [/\b(sr\.|sra\.|dr\.|dra\.)\s+[A-Z]/, 'tratamento+nome'], [/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, 'data']
];

function validarDataset(casos) {
  const erros = []; const ids = new Set();
  if (!Array.isArray(casos) || casos.length < 12) erros.push('dataset com menos de 12 casos');
  for (const c of casos || []) {
    for (const k of OBRIGATORIOS) if (!(k in c)) erros.push(`${c.id || '?'}: falta ${k}`);
    for (const k of PROIBIDOS) if (k in c) erros.push(`${c.id}: campo proibido ${k} (sem resposta ideal nesta fase)`);
    if (ids.has(c.id)) erros.push(`${c.id}: id duplicado`); ids.add(c.id);
    if (!['in', 'partial', 'out'].includes(c.domain_fit)) erros.push(`${c.id}: domain_fit inválido`);
    for (const id of c.concepts_expected || []) if (!POR_ID[id]) erros.push(`${c.id}: conceito inexistente ${id}`);
    if (c.book_candidate_expected !== 'NONE') { if (!Array.isArray(c.book_candidate_expected) || !c.book_candidate_expected.length) erros.push(`${c.id}: book_candidate_expected inválido`); else for (const b of c.book_candidate_expected) if (!CATALOGO[b] || CATALOGO[b].teaser) erros.push(`${c.id}: obra inexistente/teaser ${b}`); }
    const textos = [c.message, c.title, c.safety_notes, ...(c.history || []).map((h) => h.content), ...(c.knowledge_expected || [])].join(' \n ');
    for (const [re, nome] of PADROES_PII) if (re.test(textos)) erros.push(`${c.id}: possível PII (${nome})`);
    for (const h of c.history || []) if (!h || !['user', 'assistant'].includes(h.role) || typeof h.content !== 'string') erros.push(`${c.id}: history inválido`);
  }
  const cobertura = { fora: (casos || []).some((c) => c.domain_fit === 'out'), nenhumaObra: (casos || []).some((c) => c.book_candidate_expected === 'NONE'), comObra: (casos || []).some((c) => c.book_candidate_expected !== 'NONE'), multiTurno: (casos || []).some((c) => (c.history || []).length >= 3), ambigua: (casos || []).some((c) => (c.concepts_expected || []).length === 0 && c.domain_fit !== 'out') };
  for (const [k, v] of Object.entries(cobertura)) if (!v) erros.push(`cobertura ausente: ${k}`);
  return { ok: erros.length === 0, erros, total: (casos || []).length, cobertura };
}

module.exports = { validarDataset };
