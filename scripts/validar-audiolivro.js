#!/usr/bin/env node

require('dotenv').config();

const https = require('https');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const { createClient } = require('@supabase/supabase-js');

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function validarAudiolivro(urlPublica, nomeLocal = 'audiolivro-teste.mp3') {
  console.log('\n====================================');
  console.log('VALIDAÇÃO DE AUDIOLIVRO');
  console.log('====================================\n');

  console.log(`📥 Baixando: ${urlPublica}`);

  return new Promise((resolve, reject) => {
    https.get(urlPublica, (response) => {
      if (response.statusCode !== 200) {
        reject(
          new Error(
            `Status ${response.statusCode}: ${response.statusMessage}`
          )
        );
        return;
      }

      const caminho = path.join(__dirname, nomeLocal);
      const file = fs.createWriteStream(caminho);

      response.pipe(file);

      file.on('finish', () => {
        file.close();

        const stats = fs.statSync(caminho);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

        ffmpeg.ffprobe(caminho, (err, metadata) => {
          if (err) {
            console.error('⚠️  Não foi possível obter duração (ffprobe): ' + err.message);
            console.log(`✅ Arquivo baixado: ${sizeMB} MB`);
            console.log(`📁 Salvo em: ${caminho}`);
            resolve({ sucesso: true, tamanhoMB: sizeMB, caminho });
            return;
          }

          const duracao = Math.round(metadata.format.duration);
          const minutos = Math.floor(duracao / 60);
          const segundos = duracao % 60;

          console.log(`✅ Arquivo baixado: ${sizeMB} MB`);
          console.log(`⏱️  Duração: ${minutos}m ${segundos}s (${duracao}s)`);
          console.log(`📁 Salvo em: ${caminho}`);
          console.log('\n💡 Próximos passos:');
          console.log('   1. Abra o arquivo em um player de áudio local');
          console.log('   2. Ouça início, meio e fim para validar qualidade');
          console.log('   3. Verifique ausência de cortes abruptos ou erros de pronúncia');
          console.log('   4. Se OK, atualizar catalogoLivros.js com audiobookUrl + audiobookDisponivel');
          console.log('====================================\n');

          resolve({
            sucesso: true,
            tamanhoMB: sizeMB,
            duracao,
            minutos,
            segundos,
            caminho,
          });
        });
      });

      file.on('error', (err) => {
        fs.unlink(caminho, () => {
        });
        reject(err);
      });
    }).on('error', reject);
  });
}

async function main() {
  const urlPublica = process.argv[2];

  if (!urlPublica) {
    console.error('❌ Uso: node scripts/validar-audiolivro.js <URL_PUBLICA>');
    process.exit(1);
  }

  try {
    await validarAudiolivro(urlPublica);
  } catch (erro) {
    console.error('❌ ERRO:', erro.message);
    process.exit(1);
  }
}

main();
