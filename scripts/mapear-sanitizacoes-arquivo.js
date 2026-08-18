#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const caminhoTexto = process.argv[2];
const duracaoAudio = parseInt(process.argv[3]);

if (!caminhoTexto || !duracaoAudio) {
  console.error('❌ Uso: node scripts/mapear-sanitizacoes-arquivo.js <CAMINHO_TEXTO> <DURACAO_SEGUNDOS>');
  console.error('\nExemplo:');
  console.error('  node scripts/mapear-sanitizacoes-arquivo.js documentos-zuni/identidade_autoestima.txt 261');
  process.exit(1);
}

if (!fs.existsSync(caminhoTexto)) {
  console.error(`❌ Arquivo não encontrado: ${caminhoTexto}`);
  process.exit(1);
}

const texto = fs.readFileSync(caminhoTexto, 'utf-8');
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

console.log(`Arquivo: ${path.basename(caminhoTexto)}`);
console.log(`Total de sanitizações: ${sanitizacoes.length}`);
console.log(`Tamanho do texto: ${TAMANHO_TEXTO} caracteres`);
console.log(`Duração do áudio: ${Math.floor(duracaoAudio / 60)}m${String(duracaoAudio % 60).padStart(2, '0')}s (${duracaoAudio}s)\n`);

if (sanitizacoes.length === 0) {
  console.log('Nenhuma sanitização necessária.');
} else {
  console.log('Timeline de sanitizações (pausa SSML <break time="500ms"/>):');
  console.log('-----------------------------------------------------------\n');

  sanitizacoes.forEach((s, i) => {
    const proporcao = s.posicao / TAMANHO_TEXTO;
    const tempoSegundos = Math.round(proporcao * duracaoAudio);
    const minutos = Math.floor(tempoSegundos / 60);
    const segundos = tempoSegundos % 60;
    const formatado = `${minutos}m${String(segundos).padStart(2, '0')}s`;

    console.log(`${String(i + 1).padStart(2, ' ')}. ${formatado} | Caractere "${s.caractere}" (${s.padrao.length}x)`);
  });
}

console.log('\n-----------------------------------------------------------\n');
