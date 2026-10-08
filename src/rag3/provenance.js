'use strict';
// rag3/provenance.js — mapa FONTE do acervo → OBRA do catálogo (proveniência). A tabela `documentos` só tem `livro_id` nos volumes de
// "Os Bastidores da Mente"; para o resto o vínculo é editorial e fica aqui, explícito e auditável.
// confianca: 'alta' (título/fonte inequívocos) | 'media' (forte indício) | null (precisa de confirmação editorial — NÃO recomendar).
// Fontes sem obra própria (base geral, compreensão da vida, cabala/astrologia) ficam null de propósito.
const MAPA_POR_FONTE = Object.freeze({
  depressao_base_mentor: { bookId: 'a-neurobiologia-integrativa-da-depressao', confianca: 'alta' },
  obesidade_base_mentor: { bookId: 'a-visao-integrativa-da-obesidade', confianca: 'alta' },
  a_bussola_humana_base_mentor: { bookId: 'os-bastidores-da-mente-3-a-bussola-humana', confianca: 'alta' },
  o_antidoto_base_mentor: { bookId: 'os-bastidores-da-mente-2-o-antidoto', confianca: 'alta' },
  zuni_a_travessia_base_mentor: { bookId: 'os-bastidores-da-mente-4-a-travessia', confianca: 'alta' },
  os_bastidores_da_mente_base_mentor: { bookId: 'os-bastidores-da-mente-1-a-origem-de-todo-bem-e-de-todo-mal', confianca: 'alta' },
  elegancia_presenca_masculina_RAG: { bookId: 'a-arte-da-presenca-masculina', confianca: 'alta' },
  consequencias_causa_efeito_base_mentor: { bookId: 'consequencias-edicao-essencial', confianca: 'alta' },
  vida_madura_bem_estar: { bookId: 'tempo-para-viver', confianca: 'media' },
  vertical_pais_adolescentes_completo_base_mentor: { bookId: 'alem-do-que-voce-ve', confianca: 'media' },
  sentimentos_adolescencia_base_mentor: { bookId: 'alem-do-que-voce-sente', confianca: 'media' },
  // Precisam de confirmação editorial (a fonte parece misturar obras ou não identifica uma só):
  elegancia_charme_feminino_RAG: { bookId: null, confianca: null },
  administracao_empresarial_inteligente_base_mentor: { bookId: null, confianca: null },
  'documentos-zuni': { bookId: null, confianca: null },
  compreensao_da_vida_base_mentor: { bookId: null, confianca: null },
  cabala_astrologia_integrativa_base_mentor: { bookId: null, confianca: null },
  'cap1-vol1-degustacao': { bookId: null, confianca: null }
});

// Fonte que mistura várias obras: o vínculo sai do prefixo do TÍTULO do bloco.
const MAPA_POR_PREFIXO_DE_TITULO = Object.freeze({
  namoro_conquista_romance_base_mentor: [
    { prefixo: 'feminilidade moderna e relacionamentos inteligentes', bookId: 'a-mulher-que-permanece-inteira', confianca: 'alta' }
  ]
});

function resolverObra({ source, title, bookId } = {}, mapa = MAPA_POR_FONTE, prefixos = MAPA_POR_PREFIXO_DE_TITULO) {
  if (bookId) return { bookId, confianca: 'alta', via: 'livro_id' };
  const lista = prefixos[source];
  if (lista) { const t = String(title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); const achou = lista.find((p) => t.startsWith(p.prefixo)); if (achou) return { bookId: achou.bookId, confianca: achou.confianca, via: 'prefixo_titulo' }; }
  const m = mapa[source];
  if (m && m.bookId) return { bookId: m.bookId, confianca: m.confianca, via: 'fonte' };
  return { bookId: null, confianca: null, via: m ? 'sem_obra' : 'fonte_desconhecida' };
}

module.exports = { MAPA_POR_FONTE, MAPA_POR_PREFIXO_DE_TITULO, resolverObra };
