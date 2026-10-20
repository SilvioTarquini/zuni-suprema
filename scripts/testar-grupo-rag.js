// Script de teste descartável — varredura de parâmetros de buscar_documentos_ranqueado
// para o grupo 'adolescentes'. NÃO altera regra de negócio. Usa a mesma função de
// embedding do indexarTema.js (mesmo modelo usado hoje pelo server.js: text-embedding-3-small).
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { gerarEmbeddingsBatch, EMBEDDING_MODEL } = require('../src/indexarTema');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const PERGUNTAS = [
  'Meu filho de 15 anos parou de falar comigo e isso virou motivo de briga entre mim e minha esposa.',
  'Não sei se estou sendo rígido demais ou permissivo demais com minha filha adolescente.',
  'Meu filho passa o dia no celular e eu não sei se isso é normal da idade ou se é sinal de alguma coisa.'
];

const VARIANTES = [
  { nome: 'V1', piso_tema: 1, total: 8, p_tema: 'adolescentes', teto_por_arquivo: 2, piso_por_tema: 0, teto_por_fonte: 0 },
  { nome: 'V2', piso_tema: 1, total: 8, p_tema: 'adolescentes', teto_por_arquivo: 2, piso_por_tema: 1, teto_por_fonte: 0 },
  { nome: 'V3', piso_tema: 1, total: 8, p_tema: 'adolescentes', teto_por_arquivo: 2, piso_por_tema: 1, teto_por_fonte: 4 },
  { nome: 'V4', piso_tema: 1, total: 8, p_tema: 'adolescentes', teto_por_arquivo: 2, piso_por_tema: 2, teto_por_fonte: 4 }
];

function fmt(n, casas = 4) {
  return typeof n === 'number' ? n.toFixed(casas) : String(n);
}

async function rodarVariante(variante, embedding) {
  const { data, error } = await supabase.rpc('buscar_documentos_ranqueado', {
    query_embedding: embedding,
    piso_tema: variante.piso_tema,
    total: variante.total,
    p_tema: variante.p_tema,
    teto_por_arquivo: variante.teto_por_arquivo,
    piso_por_tema: variante.piso_por_tema,
    teto_por_fonte: variante.teto_por_fonte
  });

  if (error) {
    console.error(`Erro em buscar_documentos_ranqueado (${variante.nome}):`, error);
    return [];
  }
  return data || [];
}

async function rodarPergunta(pergunta, idx) {
  console.log('\n' + '='.repeat(100));
  console.log(`PERGUNTA ${idx + 1}: "${pergunta}"`);
  console.log('='.repeat(100));

  const [embedding] = await gerarEmbeddingsBatch([pergunta]);
  console.log(`(embedding gerado com modelo ${EMBEDDING_MODEL}, dimensão ${embedding.length})`);

  for (const variante of VARIANTES) {
    const lista = await rodarVariante(variante, embedding);

    console.log(`\n-- ${variante.nome} (emb, ${variante.piso_tema}, ${variante.total}, '${variante.p_tema}', ${variante.teto_por_arquivo}, ${variante.piso_por_tema}, ${variante.teto_por_fonte}) — ${lista.length} linha(s) --`);
    lista.forEach((row, i) => {
      const caminho = row.caminho || row.titulo || row.arquivo || '(sem caminho)';
      const temaDoc = row.tema_doc ?? row.tema ?? '(n/a)';
      const origem = row.origem ?? '(n/a)';
      const sim = row.similaridade ?? row.similarity ?? row.score;
      const tamanho = (row.corpo || '').length;
      console.log(`  [${i + 1}] caminho=${caminho} | tema_doc=${temaDoc} | origem=${origem} | sim=${fmt(sim)} | chars=${tamanho}`);
    });

    const totalChars = lista.reduce((acc, r) => acc + (r.corpo || '').length, 0);
    const temasDistintos = new Set(lista.map(r => r.tema_doc ?? r.tema ?? '(n/a)'));
    const blocosGeral = lista.filter(r => (r.origem ?? '') === 'geral').length;
    const sims = lista.map(r => r.similaridade ?? r.similarity ?? r.score).filter(s => typeof s === 'number');
    const piorSim = sims.length ? Math.min(...sims) : null;

    console.log(`  Resumo ${variante.nome}: temas distintos=${temasDistintos.size} [${[...temasDistintos].join(', ')}] | origem='geral'=${blocosGeral} | total_chars=${totalChars} | pior_sim=${fmt(piorSim)}`);
  }
}

(async () => {
  for (let i = 0; i < PERGUNTAS.length; i++) {
    await rodarPergunta(PERGUNTAS[i], i);
  }
})().catch(err => {
  console.error('Erro fatal no script:', err);
  process.exit(1);
});
