#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { gerarAudiolivro } = require('../src/lib/audiolivroGenerator');

async function main() {
  console.log('====================================');
  console.log('GERADOR DE AUDIOLIVROS — TESTE PILOTO');
  console.log('====================================\n');

  const caminhoTexto = path.join(
    __dirname,
    '../documentos-zuni/os_bastidores_da_mente_base_mentor.txt'
  );

  if (!fs.existsSync(caminhoTexto)) {
    console.error(`❌ Arquivo não encontrado: ${caminhoTexto}`);
    process.exit(1);
  }

  const texto = fs.readFileSync(caminhoTexto, 'utf-8');
  console.log(`📖 Texto carregado: ${texto.length} caracteres`);

  const tempoInicio = Date.now();

  try {
    const resultado = await gerarAudiolivro(
      texto,
      'os-bastidores-vol1-teste',
      {
        voz: 'pt-BR-Wavenet-A',
        bytesMax: 5000,
      }
    );

    const tempoTotal = (Date.now() - tempoInicio) / 1000;

    console.log('\n====================================');
    console.log('✅ SUCESSO');
    console.log('====================================');
    console.log(`URL Pública: ${resultado.urlPublica}`);
    console.log(`Tamanho: ${resultado.tamanhoMB} MB`);
    console.log(`Chunks: ${resultado.chunks}`);
    console.log(`Voz: ${resultado.voz}`);
    console.log(`Tempo total: ${tempoTotal.toFixed(1)}s`);
    console.log(`Tempo por chunk: ${(tempoTotal / resultado.chunks).toFixed(1)}s`);
    console.log('====================================\n');
  } catch (erro) {
    console.error('\n❌ ERRO NA GERAÇÃO:', erro.message);
    process.exit(1);
  }
}

main();
