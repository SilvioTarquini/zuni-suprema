#!/usr/bin/env node

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function criarBucket() {
  console.log('Criando bucket "audiolivros" no Supabase Storage...\n');

  try {
    const { data, error } = await supabase.storage.createBucket('audiolivros', {
      public: true,
      allowedMimeTypes: ['audio/mpeg'],
    });

    if (error) {
      if (error.message && error.message.includes('already exists')) {
        console.log('✅ Bucket "audiolivros" já existe no Supabase Storage');
        return;
      }
      throw error;
    }

    console.log('✅ Bucket "audiolivros" criado com sucesso!');
    console.log('   Acesso público: ativado');
    console.log('   MIME types permitidos: audio/mpeg');
  } catch (erro) {
    console.error('❌ Erro ao criar bucket:', erro.message);
    process.exit(1);
  }
}

criarBucket();
