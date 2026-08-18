const catalogoQuestionarios = require('./src/lib/catalogoQuestionarios');

console.log('=== COMPARAÇÃO: CONTEÚDO DO BANCO vs. CATÁLOGO ===\n');

console.log('CASO 1: "administracao_empresarial_inteligente" (NO BANCO)\n');
console.log('Chunks no banco falam sobre:');
console.log('  1. "CLAREZA ANTES DA VELOCIDADE" — urgência, decisões rápidas, incerteza');
console.log('  2. "O ALARME DO CORPO" — pressão, sinais do corpo, reação emocional');
console.log('  3. "OS TRÊS ESTADOS PRÁTICOS DO EXECUTIVO" — estado reativo vs. contido vs. regulado\n');
console.log('Tema similar no catálogo: NÃO EXISTE com esse slug');
console.log('Possível match: "lideranca" (linha 119) ou "pressao_cobrancas" (linha 131)\n');

const lideranca = catalogoQuestionarios.questionarios.find(q => q.tema === 'lideranca');
const pressao = catalogoQuestionarios.questionarios.find(q => q.tema === 'pressao_cobrancas');

if (lideranca) {
  console.log('Tema "lideranca" no catálogo — Perguntas:');
  lideranca.perguntas.forEach(p => console.log(`  - ${p.texto}`));
}
console.log('');
if (pressao) {
  console.log('Tema "pressao_cobrancas" no catálogo — Perguntas:');
  pressao.perguntas.forEach(p => console.log(`  - ${p.texto}`));
}

console.log('\n' + '='.repeat(80) + '\n');

console.log('CASO 2: "sentimentos_adolescencia" (NO BANCO) vs. "sentimentos_confusos" (CATÁLOGO)\n');
console.log('Chunks no banco falam sobre:');
console.log('  1. "A MONTAGEM" — como sentimentos são construídos a partir de componentes');
console.log('  2. "O SEQUESTRO EMOCIONAL" — alarme rápido vs. piloto lento, reação automática');
console.log('  3. "O RÓTULO" — como estados temporários viram identidades, profecia autorrealizável\n');

const sentimentosConfusos = catalogoQuestionarios.questionarios.find(q => q.tema === 'sentimentos_confusos');
if (sentimentosConfusos) {
  console.log('Tema "sentimentos_confusos" no catálogo — Perguntas:');
  sentimentosConfusos.perguntas.forEach(p => console.log(`  - ${p.texto}`));
}

console.log('\n' + '='.repeat(80) + '\n');

console.log('CASO 3: "educar_filhos" (NO BANCO) vs. "adolescencia_dos_filhos" (CATÁLOGO)\n');
console.log('Chunks no banco falam sobre:');
console.log('  1. "A AMOSTRA" — interpretar comportamento de adolescente, não ver a pessoa inteira');
console.log('  2. "A SENTENÇA" — peso de palavras de adultos na formação de identidade');
console.log('  3. "A CONTA QUE ELE FAZ" — adolescente calculando custo de contar algo importante\n');

const adolescenciaFilhos = catalogoQuestionarios.questionarios.find(q => q.tema === 'adolescencia_dos_filhos');
if (adolescenciaFilhos) {
  console.log('Tema "adolescencia_dos_filhos" no catálogo — Perguntas:');
  adolescenciaFilhos.perguntas.forEach(p => console.log(`  - ${p.texto}`));
}
