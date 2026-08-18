const catalogoQuestionarios = require('./src/lib/catalogoQuestionarios');

const sentimentosConfusos = catalogoQuestionarios.questionarios.find(q => q.tema === 'sentimentos_confusos');
const adolescenciaFilhos = catalogoQuestionarios.questionarios.find(q => q.tema === 'adolescencia_dos_filhos');

console.log('=== TEMA: sentimentos_confusos ===\n');
if (sentimentosConfusos) {
  console.log(JSON.stringify(sentimentosConfusos, null, 2));
} else {
  console.log('Tema não encontrado');
}

console.log('\n\n=== TEMA: adolescencia_dos_filhos ===\n');
if (adolescenciaFilhos) {
  console.log(JSON.stringify(adolescenciaFilhos, null, 2));
} else {
  console.log('Tema não encontrado');
}
