require('dotenv').config();
const catalogoQuestionarios = require('./src/lib/catalogoQuestionarios');

console.log('=== CATÁLOGO COMPLETO ===');
console.log(JSON.stringify(catalogoQuestionarios, null, 2));
