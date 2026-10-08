'use strict';
// rag3/util.js — utilidades puras (sem rede, sem banco, sem log).
const crypto = require('crypto');

function normalizar(texto) {
  return String(texto == null ? '' : texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tokens(texto) {
  return normalizar(texto).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
}

function palavras(texto) {
  return String(texto || '').trim().split(/\s+/).filter(Boolean).length;
}

function sha256(texto) {
  return crypto.createHash('sha256').update(String(texto)).digest('hex');
}

// Estimativa grosseira e conservadora para português (≈3,5 caracteres por token).
function estimarTokens(caracteres) {
  return Math.ceil(Number(caracteres || 0) / 3.5);
}

// Mesma métrica do banco de produção: 1 / (1 + distância L2). Para vetores normalizados é monotônica ao cosseno.
function similaridadeL2(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return 1 / (1 + Math.sqrt(s));
}

function normalizarVetor(v) {
  let n = 0; for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

// "Capítulo 4 — X (parte 1/2)" e "… (parte 2/2)" são a mesma família de título.
function chaveDeTitulo(titulo) {
  return normalizar(titulo).replace(/\(parte\s*\d+\s*\/\s*\d+\)/g, '').replace(/\bp\d\b/g, '').replace(/\s+/g, ' ').trim();
}

function shingles(texto, n = 5, maxChars = 600) {
  const t = tokens(String(texto).slice(0, maxChars));
  const out = new Set();
  for (let i = 0; i + n <= t.length; i++) out.add(t.slice(i, i + n).join(' '));
  return out;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function percentil(valores, p) {
  if (!valores.length) return null;
  const v = [...valores].sort((x, y) => x - y);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))];
}

// Hash determinístico e estável de objetos JSON (ordem de chaves normalizada).
function hashJson(obj) {
  const canon = (x) => (Array.isArray(x) ? x.map(canon) : (x && typeof x === 'object' ? Object.keys(x).sort().reduce((o, k) => { o[k] = canon(x[k]); return o; }, {}) : x));
  return sha256(JSON.stringify(canon(obj)));
}

function mesclarConfig(base, sobre) {
  if (!sobre) return JSON.parse(JSON.stringify(base));
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(sobre)) {
    out[k] = sobre[k] && typeof sobre[k] === 'object' && !Array.isArray(sobre[k]) && base[k] && typeof base[k] === 'object' ? mesclarConfig(base[k], sobre[k]) : sobre[k];
  }
  return out;
}

module.exports = { normalizar, tokens, palavras, sha256, estimarTokens, similaridadeL2, normalizarVetor, chaveDeTitulo, shingles, jaccard, percentil, hashJson, mesclarConfig };
