'use strict';
// rag3/bookRecommendation.js — decisão COMERCIAL separada da geração de texto.
// O LLM nunca escolhe obra, preço nem URL: título, preço e link vêm do catálogo; a escolha vem da PROVENIÊNCIA dos blocos usados
// (obra de onde o conhecimento saiu) reforçada, secundariamente, por correspondência conceitual com "indicado para".
const { CATALOGO } = require('../lib/catalogoLivros');
const { calcularPrecoBaseLivro } = require('../lib/precoLivro');
const { CONCEITOS, POR_ID } = require('./conceptLexicon');
const { normalizar } = require('./util');
const { resolverConfig } = require('./config');

const FATOR_CONFIANCA = { alta: 1, media: 0.7 };
const SO_PARA_PAIS = new Set(['alem-do-que-voce-sente']); // obra do próprio adolescente: indicar só a pai/mãe/responsável

function obraDisponivel(id, catalogo = CATALOGO) {
  const l = catalogo[id];
  if (!l || typeof l !== 'object' || l.teaser) return null;
  let preco; try { preco = calcularPrecoBaseLivro(l, false); } catch (e) { return null; }
  if (!Number.isFinite(preco) || preco <= 0) return null;
  return { id, titulo: l.tituloPublico || l.titulo, preco, indicadoPara: l.indicadoPara || '' };
}

function urlDaObra(id) { return '/checkout-livro.html?livro=' + encodeURIComponent(id); }

function conceitosNoTexto(texto) {
  const t = normalizar(texto); const out = new Set();
  for (const c of CONCEITOS) if (c.radicais.some((r) => t.includes(normalizar(r).trim()))) out.add(c.id);
  return out;
}

/**
 * @param {Object} p { blocks, concepts[], retrievalStatus, turnIndex, userAskedForReading, parentContext, alreadyRecommended:Set|[] }
 * @returns {{ books: Object[], suppressed: Object[], texto: string|null }}
 */
function recommendBooks(p, { catalogo = CATALOGO, config = resolverConfig() } = {}) {
  const cfg = config.recomendacao;
  const ja = new Set(p.alreadyRecommended || []);
  const suprimidos = []; const nada = (codigo) => ({ books: [], suppressed: suprimidos.concat([{ bookId: null, motivo: codigo }]), texto: null });

  if (p.retrievalStatus !== 'found') return nada('conhecimento_nao_encontrado');
  if (!p.userAskedForReading && (p.turnIndex || 0) < cfg.indiceMinimoDeTurno) return nada('cedo_demais');
  const vagas = Math.max(0, cfg.maxObras - ja.size);
  if (vagas === 0) return nada('limite_de_obras_na_sessao');

  const prov = new Map();
  (p.blocks || []).forEach((b, rank) => {
    if (!b.bookId || !FATOR_CONFIANCA[b.bookConfidence]) return;
    const e = prov.get(b.bookId) || { pontos: 0, blocos: [] };
    e.pontos += b.similarity * FATOR_CONFIANCA[b.bookConfidence] * (1 - 0.04 * rank); e.blocos.push(b.id); prov.set(b.bookId, e);
  });

  const conceitos = new Set(p.concepts || []);
  const candidatos = [];
  const ids = new Set([...prov.keys()]);
  for (const [id, l] of Object.entries(catalogo)) { if (ids.has(id)) continue; if (!l || l.teaser || !l.indicadoPara) continue; const c = conceitosNoTexto(l.indicadoPara + ' ' + l.titulo); const comum = [...conceitos].filter((x) => c.has(x)).length; if (comum >= 2) ids.add(id); }

  for (const id of ids) {
    if (ja.has(id)) { suprimidos.push({ bookId: id, motivo: 'ja_recomendada' }); continue; }
    const obra = obraDisponivel(id, catalogo);
    if (!obra) { suprimidos.push({ bookId: id, motivo: 'indisponivel_ou_teaser' }); continue; }
    if (SO_PARA_PAIS.has(id) && !p.parentContext) { suprimidos.push({ bookId: id, motivo: 'obra_do_adolescente_so_para_responsavel' }); continue; }
    const pv = prov.get(id) || { pontos: 0, blocos: [] };
    const cObra = conceitosNoTexto(obra.indicadoPara + ' ' + obra.titulo);
    const lex = Math.min(0.5, 0.25 * [...conceitos].filter((x) => cObra.has(x)).length);
    // Pertinência: a obra de onde o conhecimento saiu só é oferecida se o tema da conversa também é o tema da obra
    // (um livro de obesidade que traz um capítulo sobre sono NÃO é indicação para quem fala de sono e cafeína).
    if (lex < 0.25) { suprimidos.push({ bookId: id, motivo: 'sem_pertinencia_conceitual' }); continue; }
    const exigeBlocos = pv.blocos.length >= cfg.minBlocosComProveniencia;
    const pontos = pv.pontos + lex;
    if (!exigeBlocos && !(pv.blocos.length === 0 && lex >= 0.5)) { suprimidos.push({ bookId: id, motivo: 'proveniencia_insuficiente' }); continue; }
    if (pontos < cfg.pontuacaoMinima) { suprimidos.push({ bookId: id, motivo: 'pontuacao_baixa' }); continue; }
    candidatos.push({ bookId: id, title: obra.titulo, priceBRL: obra.preco, url: urlDaObra(id), reason: pv.blocos.length ? 'provenance' : 'lexical', score: Number(pontos.toFixed(3)), evidenceBlockIds: pv.blocos });
  }
  candidatos.sort((a, b) => b.score - a.score);
  const books = candidatos.slice(0, vagas);
  return { books, suppressed: suprimidos, texto: books.length ? renderizarCartao(books) : null };
}

const BRL = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',');
function renderizarCartao(books) {
  return books.map((b) => `Para aprofundar este ponto: ${b.title} — ${BRL(b.priceBRL)}. Disponível na Loja ZUNI.`).join('\n');
}

module.exports = { recommendBooks, renderizarCartao, obraDisponivel, urlDaObra, SO_PARA_PAIS };
