#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const caminhoTexto = path.join(__dirname, '../documentos-zuni/os_bastidores_da_mente_base_mentor.txt');
const texto = fs.readFileSync(caminhoTexto, 'utf-8');

const DURACAO_AUDIO = 1704;
const TAMANHO_TEXTO = texto.length;

const regex = /([^\w\s])\1{2,}/g;
const sanitizacoes = [];

let match;
while ((match = regex.exec(texto)) !== null) {
  sanitizacoes.push({
    padrao: match[0],
    caractere: match[1],
    posicao: match.index,
  });
}

console.log('\n====================================');
console.log('MAPEAMENTO DE SANITIZAÇÕES');
console.log('====================================\n');

console.log(`Total de sanitizações: ${sanitizacoes.length}`);
console.log(`Tamanho do texto: ${TAMANHO_TEXTO} caracteres`);
console.log(`Duração do áudio: ${Math.floor(DURACAO_AUDIO / 60)}m${DURACAO_AUDIO % 60}s (${DURACAO_AUDIO}s)\n`);

console.log('Timeline de sanitizações (pausa SSML <break time="500ms"/>):');
console.log('-----------------------------------------------------------\n');

sanitizacoes.forEach((s, i) => {
  const proporcao = s.posicao / TAMANHO_TEXTO;
  const tempoSegundos = Math.round(proporcao * DURACAO_AUDIO);
  const minutos = Math.floor(tempoSegundos / 60);
  const segundos = tempoSegundos % 60;
  const formatado = `${minutos}m${String(segundos).padStart(2, '0')}s`;

  console.log(`${String(i + 1).padStart(2, ' ')}. ${formatado} | Caractere "${s.caractere}" (${s.padrao.length}x)`);
});

console.log('\n-----------------------------------------------------------');
console.log('\n💡 INSTRUÇÕES DE AUDITORIA:');
console.log('Procure nestes pontos no arquivo audiolivro-teste.mp3 por:');
console.log('- Pausa/silêncio de ~500ms substituindo o padrão visual');
console.log('- Transição natural entre o áudio antes e depois da pausa');
console.log('- Ausência de pronúncia dos caracteres (ex: "xis", "ponto", "igual")');
console.log('\nSe a pausa parecer natural e o áudio não soletrar caracteres,');
console.log('a sanitização funcionou corretamente.\n');
