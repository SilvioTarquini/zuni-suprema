#!/usr/bin/env node
// Gera o audiolivro localmente, sem subir para o Supabase — para validação
// auditiva (início/meio/fim) antes de autorizar a versão de produção.
// Usa o mesmo pipeline consolidado de audiolivroGenerator.js (chunking,
// SSML v5, síntese, concatenação), só pula uploadParaSupabase().
//
// Uso: node scripts/gerar-audiolivro-local.js <CAMINHO_TEXTO> <SLUG> [voz]

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  dividirEmChunks,
  gerarAudioComAPI,
  concatenarComFFmpeg,
  PAUSA_PARAGRAFO_PADRAO,
  PAUSA_SEPARADOR_PADRAO,
} = require('../src/lib/audiolivroGenerator');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

function obterDuracaoMp3(caminhoArquivo) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(caminhoArquivo, (err, metadata) => {
      if (err) return reject(err);
      resolve(Math.round(metadata.format.duration));
    });
  });
}

async function main() {
  const caminhoTexto = process.argv[2];
  const livroSlug = process.argv[3];
  const voz = process.argv[4] || 'pt-BR-Wavenet-A';

  if (!caminhoTexto || !livroSlug) {
    console.error('Uso: node scripts/gerar-audiolivro-local.js <CAMINHO_TEXTO> <SLUG> [voz]');
    process.exit(1);
  }

  const texto = fs.readFileSync(caminhoTexto, 'utf-8');
  const pastaSaida = path.join(__dirname, '..', '.temp-audio', livroSlug);
  fs.mkdirSync(pastaSaida, { recursive: true });

  console.log('====================================');
  console.log('GERADOR DE AUDIOLIVROS — TESTE LOCAL (sem upload)');
  console.log('====================================\n');
  console.log(`Slug: ${livroSlug}`);
  console.log(`Voz: ${voz}`);
  console.log(`Tamanho do texto: ${texto.length} caracteres\n`);

  const tempoInicio = Date.now();

  const chunks = await dividirEmChunks(texto, 5000, PAUSA_PARAGRAFO_PADRAO);
  console.log(`[Local] ${chunks.length} chunks gerados\n`);

  const caminhosMp3 = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[Local] [${i + 1}/${chunks.length}] Sintetizando (${chunks[i].length} chars)...`);
    const audioBuffer = await gerarAudioComAPI(chunks[i], voz, PAUSA_PARAGRAFO_PADRAO, PAUSA_SEPARADOR_PADRAO);
    const caminhoMp3 = path.join(pastaSaida, `chunk_${i + 1}.mp3`);
    fs.writeFileSync(caminhoMp3, audioBuffer);
    caminhosMp3.push(caminhoMp3);
    console.log(`[Local] OK chunk ${i + 1}/${chunks.length} (${audioBuffer.length} bytes)`);
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('\n[Local] Concatenando com FFmpeg...');
  const caminhoFinal = path.join(pastaSaida, `${livroSlug}.mp3`);
  await concatenarComFFmpeg(caminhosMp3, caminhoFinal);

  for (const arquivo of caminhosMp3) {
    try { fs.unlinkSync(arquivo); } catch (e) {}
  }

  const stats = fs.statSync(caminhoFinal);
  const duracao = await obterDuracaoMp3(caminhoFinal);
  const minutos = Math.floor(duracao / 60);
  const segundos = duracao % 60;
  const tempoTotal = (Date.now() - tempoInicio) / 1000;

  console.log('\n====================================');
  console.log('SUCESSO — arquivo local, NÃO enviado ao Supabase');
  console.log('====================================');
  console.log(`Arquivo: ${caminhoFinal}`);
  console.log(`Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Duração: ${minutos}m${segundos}s`);
  console.log(`Chunks: ${chunks.length}`);
  console.log(`Voz: ${voz}`);
  console.log(`Tempo de geração: ${tempoTotal.toFixed(1)}s`);
  console.log('====================================\n');
}

main().catch((erro) => {
  console.error('\nERRO NA GERAÇÃO:', erro.message);
  process.exit(1);
});
