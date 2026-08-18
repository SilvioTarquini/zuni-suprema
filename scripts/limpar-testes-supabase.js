#!/usr/bin/env node

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function apagarArquivo(bucket, caminho) {
  const { error } = await supabase.storage.from(bucket).remove([caminho]);
  return !error;
}

async function main() {
  console.log('\n====================================');
  console.log('LIMPEZA DE ARQUIVOS DE TESTE');
  console.log('====================================\n');

  const arquivosParaAparar = [
    'os-bastidores-vol1-teste/os-bastidores-vol1-teste.mp3',
    'identidade-autoestima-teste/identidade-autoestima-teste.mp3',
    'teste-normalizacao-maiusculas/teste-normalizacao-maiusculas.mp3',
    'teste-voz-masculina/teste-voz-masculina.mp3',
  ];

  const bucket = 'audiolivros';
  let apagarados = 0;

  for (const caminho of arquivosParaAparar) {
    try {
      const sucesso = await apagarArquivo(bucket, caminho);
      if (sucesso) {
        console.log(`✅ Apagado: ${caminho}`);
        apagarados++;
      } else {
        console.log(`⚠️  Não encontrado: ${caminho}`);
      }
    } catch (erro) {
      console.error(`❌ Erro ao apagar ${caminho}: ${erro.message}`);
    }
  }

  console.log('\n====================================');
  console.log(`✅ Limpeza concluída: ${apagarados}/${arquivosParaAparar.length} arquivos apagados`);
  console.log('====================================\n');
}

main();
