#!/usr/bin/env node

require('dotenv').config();

const { gerarAudiolivro } = require('../src/lib/audiolivroGenerator');

async function main() {
  const textoTeste = `
=== TESTE DE NORMALIZAÇÃO ===

ZUNI Suprema apresenta uma solução inovadora para autoconhecimento.

O CÉREBRO humano funciona em camadas construídas ao longo da evolução.
A AMÍGDALA dispara medo e raiva. O CÓRTEX pré-frontal é responsável pela razão.

Este é um TESTE de pronúncia: palavras em MAIÚSCULAS devem ser lidas normalmente,
não soletradas letra por letra. ESPERADO: "Teste" e "Maiúsculas", não "T-E-S-T-E" e "M-A-I-Ú".
  `;

  const tempoInicio = Date.now();

  console.log('====================================');
  console.log('TESTE: NORMALIZAÇÃO DE MAIÚSCULAS');
  console.log('====================================\n');
  console.log('📝 Texto de teste com maiúsculas:');
  console.log(textoTeste);
  console.log('\n⏳ Gerando áudio (será lento, aguarde)...\n');

  try {
    const resultado = await gerarAudiolivro(textoTeste, 'teste-normalizacao-maiusculas', {
      voz: 'pt-BR-Wavenet-A',
      bytesMax: 5000,
    });

    const tempoTotal = (Date.now() - tempoInicio) / 1000;

    console.log('\n====================================');
    console.log('✅ SUCESSO');
    console.log('====================================');
    console.log(`URL: ${resultado.urlPublica}`);
    console.log(`Tamanho: ${resultado.tamanhoMB} MB`);
    console.log(`Duração: ~${Math.round(resultado.tamanhoMB * 4)}s (estimado)`);
    console.log(`Tempo processamento: ${tempoTotal.toFixed(1)}s`);
    console.log('====================================\n');

    console.log('📝 Verificação esperada:');
    console.log('  ✓ "ZUNI" pronunciado como "Zuni" (não soletrado)');
    console.log('  ✓ "CÉREBRO" pronunciado como "Cérebro" (não soletrado)');
    console.log('  ✓ "AMÍGDALA" pronunciado como "Amígdala" (não soletrado)');
    console.log('  ✓ Pausas de 500ms substituindo "===" corretamente\n');

    console.log('📥 Baixe e ouça:');
    console.log(`node scripts/validar-audiolivro.js "${resultado.urlPublica}"\n`);
  } catch (erro) {
    console.error('\n❌ ERRO:', erro.message);
    process.exit(1);
  }
}

main();
