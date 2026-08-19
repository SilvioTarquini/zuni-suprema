#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { gerarAudiolivro } = require('../src/lib/audiolivroGenerator');

async function main() {
  const caminhoTexto = process.argv[2];
  const livroSlug = process.argv[3];

  if (!caminhoTexto || !livroSlug) {
    console.error('❌ Uso: node scripts/gerar-audiolivro.js <CAMINHO_TEXTO> <SLUG>');
    console.error('\nExemplos:');
    console.error('  node scripts/gerar-audiolivro.js documentos-zuni/identidade_autoestima.txt identidade-autoestima');
    console.error('  node scripts/gerar-audiolivro.js documentos-zuni/timidez_inseguranca_autoconfianca.txt timidez');
    process.exit(1);
  }

  if (!fs.existsSync(caminhoTexto)) {
    console.error(`❌ Arquivo não encontrado: ${caminhoTexto}`);
    process.exit(1);
  }

  const texto = fs.readFileSync(caminhoTexto, 'utf-8');
  const tempoInicio = Date.now();

  console.log('====================================');
  console.log('GERADOR DE AUDIOLIVROS');
  console.log('====================================\n');
  console.log(`📖 Arquivo: ${path.basename(caminhoTexto)}`);
  console.log(`📊 Tamanho: ${texto.length} caracteres`);
  console.log(`📌 Slug: ${livroSlug}\n`);

  try {
    const resultado = await gerarAudiolivro(texto, livroSlug, {
      voz: 'pt-BR-Wavenet-A',
      bytesMax: 5000,
    });

    const tempoTotal = (Date.now() - tempoInicio) / 1000;

    console.log('\n====================================');
    console.log('✅ SUCESSO');
    console.log('====================================');
    resultado.partes.forEach((p, i) => {
      console.log(`Parte ${i + 1}/${resultado.partes.length}: ${p.url}`);
      console.log(`  ${p.tamanhoMB} MB, ${Math.floor(p.duracaoSegundos / 60)}m${p.duracaoSegundos % 60}s`);
    });
    console.log(`Chunks: ${resultado.chunks} | Capítulos: ${resultado.capitulos}`);
    console.log(`Voz: ${resultado.voz}`);
    console.log(`Tempo total: ${tempoTotal.toFixed(1)}s`);
    console.log(`Tempo por chunk: ${(tempoTotal / resultado.chunks).toFixed(1)}s`);
    console.log('====================================\n');

    console.log('📝 Próximos passos:');
    console.log('1. Ouça início/meio/fim (e transições entre partes, se houver mais de uma)');
    console.log('2. Se OK, atualize catalogoLivros.js: audiobookUrl (1 parte) ou audiobookPartes (2+)');
  } catch (erro) {
    console.error('\n❌ ERRO NA GERAÇÃO:', erro.message);
    process.exit(1);
  }
}

main();
