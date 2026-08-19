// Texto-fonte de manuscritos .docx deve passar por scripts/extrair-texto-docx.js
// antes de chegar aqui — remove Sumário/Índice automaticamente (números de página
// colados ao texto do Sumário são lidos de forma incompreensível pelo TTS). Ver CLAUDE.md.
const fs = require('fs').promises;
const path = require('path');
const textToSpeech = require('@google-cloud/text-to-speech');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const { createClient } = require('@supabase/supabase-js');

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

function obterDuracaoMp3(caminhoArquivo) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(caminhoArquivo, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }
      const duracao = Math.round(metadata.format.duration);
      resolve(duracao);
    });
  });
}

const textToSpeechClient = new textToSpeech.TextToSpeechClient();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PAUSA_PARAGRAFO_PADRAO = '<break strength="medium"/>';
const PAUSA_SEPARADOR_PADRAO = '<break strength="strong"/>';

async function dividirEmChunks(
  texto,
  bytesMax = 5000,
  pausaParagrafo = PAUSA_PARAGRAFO_PADRAO
) {
  const chunks = [];
  let chunkAtual = '';
  const OVERHEAD_SSML = 300;
  const limiteTexto = bytesMax - OVERHEAD_SSML;
  // A quebra dupla de parágrafo (\n{2,}) é convertida por sanitizarTexto() na
  // tag de pausa escolhida (ex.: <break strength="medium"/>), não nos 2 bytes
  // de '\n\n' que ficam armazenados em chunkAtual até a sanitização. Por isso
  // o tamanho do chunk é rastreado numa estimativa própria (estimativaBytes),
  // não relendo Buffer.byteLength(chunkAtual) — senão o custo das quebras já
  // incluídas no chunk é subcontado a cada novo parágrafo, e o SSML final
  // estoura os 5000 bytes da API quando o chunk acumula vários parágrafos. O
  // tamanho em bytes é calculado a partir da tag real passada (pausaParagrafo),
  // não fixo, para não voltar a desalinhar se a tag mudar de formato/tamanho.
  const BREAK_PARAGRAFO_BYTES = Buffer.byteLength(pausaParagrafo, 'utf8');
  let estimativaBytes = 0;

  const paragrafos = texto.split('\n\n').filter(p => p.trim());

  for (const paragrafo of paragrafos) {
    const textoComPausa = paragrafo.trim();
    const bytesTexto = Buffer.byteLength(textoComPausa, 'utf8');

    if (bytesTexto > limiteTexto) {
      if (chunkAtual) {
        chunks.push(chunkAtual.trim());
        chunkAtual = '';
        estimativaBytes = 0;
      }

      const frases = textoComPausa.split(/(?<=[.!?])\s+/);
      for (const frase of frases) {
        const bytesFrase = Buffer.byteLength(frase, 'utf8');

        if (bytesFrase > limiteTexto) {
          if (chunkAtual) {
            chunks.push(chunkAtual.trim());
            chunkAtual = '';
            estimativaBytes = 0;
          }
          chunks.push(frase.trim());
        } else if (
          estimativaBytes + (chunkAtual ? 1 : 0) + bytesFrase > limiteTexto
        ) {
          if (chunkAtual) {
            chunks.push(chunkAtual.trim());
          }
          chunkAtual = frase;
          estimativaBytes = bytesFrase;
        } else {
          estimativaBytes += (chunkAtual ? 1 : 0) + bytesFrase;
          chunkAtual += (chunkAtual ? ' ' : '') + frase;
        }
      }
    } else if (
      estimativaBytes + (chunkAtual ? BREAK_PARAGRAFO_BYTES : 0) + bytesTexto >
      limiteTexto
    ) {
      if (chunkAtual) {
        chunks.push(chunkAtual.trim());
      }
      chunkAtual = textoComPausa;
      estimativaBytes = bytesTexto;
    } else {
      estimativaBytes += (chunkAtual ? BREAK_PARAGRAFO_BYTES : 0) + bytesTexto;
      chunkAtual += (chunkAtual ? '\n\n' : '') + textoComPausa;
    }
  }

  if (chunkAtual) {
    chunks.push(chunkAtual.trim());
  }

  return chunks;
}

function colapsarLetrasEspacadas(texto) {
  return texto
    .replace(/(?<![\p{L}])(?:\p{L}[ \t]){3,}\p{L}(?![\p{L}])/gu, (match) =>
      match.replace(/[ \t]/g, '')
    )
    .replace(/ {2,}/g, ' ');
}

function normalizarMaiusculas(texto) {
  return texto.replace(/\b([A-ZÁÉÍÓÚÇÃÕ]{2,})\b/g, (match) => {
    return match.charAt(0) + match.slice(1).toLowerCase();
  });
}

function sanitizarTexto(
  texto,
  pausaParagrafo = PAUSA_PARAGRAFO_PADRAO,
  pausaSeparador = PAUSA_SEPARADOR_PADRAO
) {
  return texto
    .replace(/([^\w\s])\1{2,}/g, pausaSeparador)
    .replace(/[✦✧★☆❖]+/g, pausaSeparador)
    .replace(/\n{2,}/g, pausaParagrafo);
}

function gerarSSML(
  texto,
  pausaParagrafo = PAUSA_PARAGRAFO_PADRAO,
  pausaSeparador = PAUSA_SEPARADOR_PADRAO
) {
  const textoColapsado = colapsarLetrasEspacadas(texto);
  const textoNormalizado = normalizarMaiusculas(textoColapsado);
  const textoSanitizado = sanitizarTexto(textoNormalizado, pausaParagrafo, pausaSeparador);
  let ssml = '<speak>' + textoSanitizado + '</speak>';
  return ssml;
}

async function gerarAudioComAPI(
  texto,
  voz = 'pt-BR-Wavenet-A',
  pausaParagrafo = PAUSA_PARAGRAFO_PADRAO,
  pausaSeparador = PAUSA_SEPARADOR_PADRAO
) {
  const ssml = gerarSSML(texto, pausaParagrafo, pausaSeparador);
  const bytesSsml = Buffer.byteLength(ssml, 'utf8');

  const request = {
    input: { ssml },
    voice: {
      languageCode: 'pt-BR',
      name: voz,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      sampleRateHertz: 22050,
      speakingRate: 1.0,
      pitch: 0.0,
    },
  };

  try {
    console.log(`[Debug] SSML: ${bytesSsml} bytes (${(bytesSsml / 1024).toFixed(2)} KB)`);
    const [response] = await textToSpeechClient.synthesizeSpeech(request);
    return Buffer.from(response.audioContent, 'binary');
  } catch (erro) {
    console.error(
      '[Erro TTS]',
      erro.message,
      `| SSML: ${bytesSsml} bytes`,
      '| Texto puro: ' + texto.length,
      'caracteres'
    );
    throw erro;
  }
}

async function concatenarComFFmpeg(
  caminhosPdf,
  caminhoSaida,
  tempoEspera = 2000
) {
  return new Promise((resolve, reject) => {
    let comando = ffmpeg();

    for (const caminho of caminhosPdf) {
      comando = comando.input(caminho);
    }

    comando
      .on('error', (err) => {
        console.error('[FFmpeg Error]', err);
        reject(err);
      })
      .on('end', () => {
        console.log(
          `[FFmpeg] Concatenação concluída: ${caminhoSaida}`,
          `(${caminhosPdf.length} arquivos)`
        );
        resolve();
      })
      .mergeToFile(caminhoSaida, path.dirname(caminhoSaida));
  });
}

async function uploadParaSupabase(caminhoArquivo, nomeObjeto) {
  const buffer = await fs.readFile(caminhoArquivo);
  const bucket = 'audiolivros';

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(nomeObjeto, buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (error) {
    throw new Error(`[Supabase Upload] ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(nomeObjeto);

  return urlData.publicUrl;
}

async function gerarAudiolivro(
  textoFonte,
  livroSlug,
  opcoes = {}
) {
  const {
    voz = 'pt-BR-Wavenet-A',
    bytesMax = 5000,
    pastaTemp = path.join(__dirname, '../../.temp-audio'),
    pausaParagrafo = PAUSA_PARAGRAFO_PADRAO,
    pausaSeparador = PAUSA_SEPARADOR_PADRAO,
  } = opcoes;

  console.log(`\n[Audiolivro] Iniciando geração para: ${livroSlug}`);
  console.log(`[Audiolivro] Tamanho do texto: ${textoFonte.length} caracteres`);

  await fs.mkdir(pastaTemp, { recursive: true });

  try {
    console.log('[Audiolivro] Dividindo em chunks...');
    const chunks = await dividirEmChunks(textoFonte, bytesMax, pausaParagrafo);
    console.log(
      `[Audiolivro] ${chunks.length} chunks gerados (limite ${bytesMax} bytes cada)`
    );

    const caminhosMp3 = [];

    for (let i = 0; i < chunks.length; i++) {
      console.log(
        `[Audiolivro] [${i + 1}/${chunks.length}] Sintetizando audio (${chunks[i].length} caracteres)...`
      );

      const audioBuffer = await gerarAudioComAPI(chunks[i], voz, pausaParagrafo, pausaSeparador);

      const caminhoMp3 = path.join(pastaTemp, `chunk_${i + 1}.mp3`);
      await fs.writeFile(caminhoMp3, audioBuffer);

      caminhosMp3.push(caminhoMp3);

      console.log(
        `[Audiolivro] ✅ Chunk ${i + 1}/${chunks.length} salvo (${audioBuffer.length} bytes)`
      );

      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log('[Audiolivro] Concatenando áudios com FFmpeg...');
    const caminhoFinal = path.join(pastaTemp, `${livroSlug}_completo.mp3`);
    await concatenarComFFmpeg(caminhosMp3, caminhoFinal);

    const stats = await fs.stat(caminhoFinal);
    const duracao = await obterDuracaoMp3(caminhoFinal);
    const minutos = Math.floor(duracao / 60);
    const segundos = duracao % 60;

    console.log(
      `[Audiolivro] ✅ Arquivo concatenado: ${(stats.size / 1024 / 1024).toFixed(2)} MB, ${minutos}m${segundos}s`
    );

    console.log('[Audiolivro] Fazendo upload para Supabase Storage...');
    const nomeObjeto = `${livroSlug}/${livroSlug}.mp3`;
    const urlPublica = await uploadParaSupabase(caminhoFinal, nomeObjeto);

    console.log(`[Audiolivro] ✅ Upload concluído: ${urlPublica}`);

    for (const arquivo of caminhosMp3) {
      try {
        await fs.unlink(arquivo);
      } catch (e) {
      }
    }
    try {
      await fs.unlink(caminhoFinal);
    } catch (e) {
    }

    return {
      sucesso: true,
      urlPublica,
      tamanhoMB: (stats.size / 1024 / 1024).toFixed(2),
      chunks: chunks.length,
      voz,
    };
  } catch (erro) {
    console.error(
      `[Audiolivro] ❌ Erro na geração: ${erro.message}`
    );
    throw erro;
  }
}

module.exports = {
  gerarAudiolivro,
  dividirEmChunks,
  gerarSSML,
  gerarAudioComAPI,
  concatenarComFFmpeg,
  uploadParaSupabase,
  colapsarLetrasEspacadas,
  normalizarMaiusculas,
  sanitizarTexto,
  PAUSA_PARAGRAFO_PADRAO,
  PAUSA_SEPARADOR_PADRAO,
};
