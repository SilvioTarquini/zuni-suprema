#!/usr/bin/env node

require('dotenv').config();

const { gerarAudiolivro } = require('../src/lib/audiolivroGenerator');

async function main() {
  const textoTeste = `
=== PRESENÇA MASCULINA ===

A presença autêntica é resultado de autoconhecimento profundo.
Um homem que compreende seus valores, medos e aspirações consegue estar
presente de forma genuína e atraente.

A elegância masculina não é visual. É uma qualidade que emerge da segurança
emocional e do domínio de si mesmo. Um homem elegante sabe ouvir, sabe
reconhecer seus erros, sabe ceder sem perder sua integridade.

A verdadeira força não é agressividade. É a capacidade de manter a calma,
de agir com propósito e de enxergar além do conflito imediato.
  `;

  const tempoInicio = Date.now();

  console.log('====================================');
  console.log('TESTE: VOZ MASCULINA (pt-BR-Wavenet-B)');
  console.log('====================================\n');
  console.log('📝 Texto de teste (Universo Masculino):');
  console.log(textoTeste);
  console.log('\n⏳ Gerando áudio com voz masculina (aguarde)...\n');

  try {
    const resultado = await gerarAudiolivro(textoTeste, 'teste-voz-masculina', {
      voz: 'pt-BR-Wavenet-B',
      bytesMax: 5000,
    });

    const tempoTotal = (Date.now() - tempoInicio) / 1000;

    console.log('\n====================================');
    console.log('✅ SUCESSO');
    console.log('====================================');
    console.log(`URL: ${resultado.urlPublica}`);
    console.log(`Tamanho: ${resultado.tamanhoMB} MB`);
    console.log(`Duração: ${Math.round(resultado.tamanhoMB * 4)}s (estimado)`);
    console.log(`Tempo processamento: ${tempoTotal.toFixed(1)}s`);
    console.log(`Voz usada: ${resultado.voz}`);
    console.log('====================================\n');

    console.log('🎧 Verificação esperada:');
    console.log('  ✓ Voz masculina (mais grave/profunda que Wavenet-A)');
    console.log('  ✓ Tom natural e adequado para conteúdo de presença masculina');
    console.log('  ✓ Nenhuma soletração de maiúsculas');
    console.log('  ✓ Pausas substituindo separadores\n');

    console.log('📥 Baixe e ouça:');
    console.log(`node scripts/validar-audiolivro.js "${resultado.urlPublica}"\n`);
  } catch (erro) {
    console.error('\n❌ ERRO:', erro.message);
    process.exit(1);
  }
}

main();
