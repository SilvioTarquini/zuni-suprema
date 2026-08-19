#!/usr/bin/env node
// Gera o audiolivro localmente, sem subir para o Supabase — para validação
// auditiva (início/meio/fim, e transições entre partes se houver mais de
// uma) antes de autorizar a versão de produção.
// Usa o mesmo pipeline consolidado de audiolivroGenerator.js (chunking com
// quebra forçada por capítulo, SSML v5, síntese, agrupamento em partes
// alinhadas por capítulo quando o áudio passa do limite de tamanho), só pula
// uploadParaSupabase().
//
// Uso: node scripts/gerar-audiolivro-local.js <CAMINHO_TEXTO> <SLUG> [voz]

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  dividirEmChunks,
  agruparChunksEmPartes,
  gerarAudioComAPI,
  concatenarComFFmpeg,
  obterDuracaoMp3,
  PAUSA_PARAGRAFO_PADRAO,
  PAUSA_SEPARADOR_PADRAO,
} = require('../src/lib/audiolivroGenerator');

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

  const { chunks, iniciosCapitulo } = await dividirEmChunks(texto, 5000, PAUSA_PARAGRAFO_PADRAO);
  console.log(`[Local] ${chunks.length} chunks gerados, ${iniciosCapitulo.length} capítulos detectados\n`);

  const caminhosMp3 = [];
  const duracoesSegundos = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[Local] [${i + 1}/${chunks.length}] Sintetizando (${chunks[i].length} chars)...`);
    const audioBuffer = await gerarAudioComAPI(chunks[i], voz, PAUSA_PARAGRAFO_PADRAO, PAUSA_SEPARADOR_PADRAO);
    const caminhoMp3 = path.join(pastaSaida, `chunk_${i + 1}.mp3`);
    fs.writeFileSync(caminhoMp3, audioBuffer);
    caminhosMp3.push(caminhoMp3);
    duracoesSegundos.push(await obterDuracaoMp3(caminhoMp3));
    console.log(`[Local] OK chunk ${i + 1}/${chunks.length} (${audioBuffer.length} bytes)`);
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }

  const grupos = agruparChunksEmPartes(duracoesSegundos, iniciosCapitulo);
  console.log(
    grupos.length === 1
      ? '\n[Local] Cabe numa parte única — concatenando...'
      : `\n[Local] Dividido em ${grupos.length} partes (alinhadas por capítulo) — concatenando cada uma...`
  );

  const resultadosPartes = [];

  for (let p = 0; p < grupos.length; p++) {
    const [inicio, fim] = grupos[p];
    const nomeArquivo = grupos.length === 1 ? `${livroSlug}.mp3` : `${livroSlug}-parte${p + 1}.mp3`;
    const caminhoParte = path.join(pastaSaida, nomeArquivo);

    await concatenarComFFmpeg(caminhosMp3.slice(inicio, fim), caminhoParte);

    const stats = fs.statSync(caminhoParte);
    const duracao = await obterDuracaoMp3(caminhoParte);
    const minutos = Math.floor(duracao / 60);
    const segundos = duracao % 60;

    resultadosPartes.push({
      arquivo: nomeArquivo,
      caminho: caminhoParte,
      tamanhoMB: (stats.size / 1024 / 1024).toFixed(2),
      duracao: `${minutos}m${segundos}s`,
      chunks: `${inicio}-${fim - 1}`,
    });
  }

  for (const arquivo of caminhosMp3) {
    try { fs.unlinkSync(arquivo); } catch (e) {}
  }

  const tempoTotal = (Date.now() - tempoInicio) / 1000;

  console.log('\n====================================');
  console.log('SUCESSO — arquivo(s) local(is), NÃO enviado(s) ao Supabase');
  console.log('====================================');
  resultadosPartes.forEach((p) => {
    console.log(`${p.arquivo}: ${p.tamanhoMB} MB, ${p.duracao} (chunks ${p.chunks})`);
    console.log(`  ${p.caminho}`);
  });
  console.log(`Chunks totais: ${chunks.length} | Capítulos: ${iniciosCapitulo.length} | Voz: ${voz}`);
  console.log(`Tempo de geração: ${tempoTotal.toFixed(1)}s`);
  console.log('====================================\n');
}

main().catch((erro) => {
  console.error('\nERRO NA GERAÇÃO:', erro.message);
  process.exit(1);
});
