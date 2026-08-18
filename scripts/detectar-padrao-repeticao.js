#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const caminhoTexto = path.join(__dirname, '../documentos-zuni/os_bastidores_da_mente_base_mentor.txt');
const texto = fs.readFileSync(caminhoTexto, 'utf-8');

const regex = /([^\w\s])\1{2,}/g;
const matches = [];

let match;
while ((match = regex.exec(texto)) !== null) {
  const inicio = Math.max(0, match.index - 30);
  const fim = Math.min(texto.length, match.index + match[0].length + 30);
  const contexto = texto.substring(inicio, fim);

  matches.push({
    padrao: match[0],
    caractere: match[1],
    repeticoes: match[0].length,
    posicao: match.index,
    contexto: contexto.replace(/\n/g, '\\n'),
  });
}

console.log(`\n✅ Padrões de repetição encontrados: ${matches.length}`);
console.log('================================================\n');

if (matches.length === 0) {
  console.log('Nenhum padrão encontrado.');
} else {
  matches.slice(0, 15).forEach((m, i) => {
    console.log(`${i + 1}. Caractere: "${m.caractere}" (${m.repeticoes}x)`);
    console.log(`   Padrão: ${m.padrao}`);
    console.log(`   Contexto: ...${m.contexto}...`);
    console.log('');
  });

  if (matches.length > 15) {
    console.log(`... e mais ${matches.length - 15} padrões`);
  }
}

console.log('================================================\n');
console.log('📝 Conclusão:');
if (matches.length > 0) {
  console.log('   ⚠️  O texto-fonte CONTÉM sequências repetidas que serão pronunciadas pelo TTS.');
  console.log('   A sanitização vai substituí-las por pausas <break time="500ms"/>.');
} else {
  console.log('   ✅ Nenhum padrão problemático detectado.');
}
