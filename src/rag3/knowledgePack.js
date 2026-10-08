'use strict';
// rag3/knowledgePack.js — representação do conhecimento recuperado, INDEPENDENTE de fornecedor.
// O MESMO texto é entregue ao candidato OpenAI e ao candidato Claude (comparação justa). Nenhum provider faz retrieval próprio.
const { sha256, estimarTokens } = require('./util');

function escaparAtributo(s) { return String(s == null ? '' : s).replace(/"/g, "'").replace(/[\r\n]+/g, ' ').slice(0, 160); }

function serializarBloco(b) {
  return ['[BLOCK]', `id: ${b.id}`, `title: ${escaparAtributo(b.title)}`, `source: ${escaparAtributo(b.source)}`, `theme: ${b.theme || '-'}`, `book_id: ${b.bookId || '-'}`, `similarity: ${b.similarity.toFixed(3)}`, 'content:', b.text, '[/BLOCK]'].join('\n');
}

function buildKnowledgePack(retrieval) {
  const status = retrieval && retrieval.status ? retrieval.status : 'error';
  const blocos = status === 'found' || status === 'weak' ? (retrieval.blocks || []) : [];
  const nota = { found: 'conhecimento ZUNI pertinente encontrado', weak: 'conhecimento ZUNI apenas parcialmente pertinente; use com cautela e diga o que não está coberto', none: 'nenhum conhecimento ZUNI pertinente foi encontrado para esta pergunta', error: 'a recuperação do conhecimento ZUNI falhou; não finja ter consultado o acervo' }[status];
  const texto = blocos.length
    ? `<zuni_knowledge status="${status}" blocks="${blocos.length}">\n${blocos.map(serializarBloco).join('\n\n')}\n</zuni_knowledge>`
    : `<zuni_knowledge status="${status}" blocks="0"/>`;
  return {
    status, nota, text: texto, hash: sha256(texto), blockIds: blocos.map((b) => b.id), sources: [...new Set(blocos.map((b) => b.source))], similarities: blocos.map((b) => b.similarity),
    truncatedBlocks: blocos.filter((b) => b.truncation).length, estimatedTokens: estimarTokens(texto.length), chars: texto.length
  };
}

module.exports = { buildKnowledgePack, serializarBloco };
