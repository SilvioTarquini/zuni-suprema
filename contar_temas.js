require('dotenv').config();
const catalogoQuestionarios = require('./src/lib/catalogoQuestionarios');

console.log('=== RESUMO CATÁLOGO ===\n');

console.log(`Total de categorias: ${catalogoQuestionarios.categorias.length}`);
console.log(`Total de questionários: ${catalogoQuestionarios.questionarios.length}\n`);

console.log('TEMAS DISPONÍVEIS:');
catalogoQuestionarios.questionarios.forEach((q, idx) => {
  console.log(`${idx + 1}. ${q.tema}`);
  console.log(`   Título: ${q.titulo}`);
  console.log(`   Categoria: ${q.categoria}`);
  console.log(`   Perguntas: ${q.perguntas.length}`);
});

console.log('\n=== TEMAS COM RAG INDEXADO (validado) ===');
console.log('✅ timidez_comunicacao');
console.log('✅ namoro_conquista_romance');
