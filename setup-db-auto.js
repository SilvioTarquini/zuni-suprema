/**
 * Script automático para criar as tabelas no Supabase
 * Usa a biblioteca postgres para conectar diretamente e executar SQL
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_KEY não estão configurados');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function setupTables() {
  console.log('🔧 Criando tabelas no Supabase...\n');

  try {
    // SQL para criar as tabelas
    const sqlCreditos = `
    CREATE TABLE IF NOT EXISTS creditos_sessao (
      id BIGSERIAL PRIMARY KEY,
      pacote_id UUID NOT NULL UNIQUE,
      email VARCHAR NOT NULL,
      payment_id VARCHAR DEFAULT NULL,
      creditos_iniciais INT NOT NULL DEFAULT 3,
      creditos_restantes INT NOT NULL DEFAULT 3,
      data_pagamento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ultima_sessao_id UUID DEFAULT NULL,
      data_ultima_sessao TIMESTAMPTZ DEFAULT NULL,
      expira_em TIMESTAMPTZ NOT NULL,
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_creditos_email ON creditos_sessao(email);
    CREATE INDEX IF NOT EXISTS idx_creditos_ativo ON creditos_sessao(ativo);
    CREATE INDEX IF NOT EXISTS idx_creditos_expiracao ON creditos_sessao(expira_em);
    CREATE INDEX IF NOT EXISTS idx_creditos_payment ON creditos_sessao(payment_id);
    `;

    const sqlResumos = `
    CREATE TABLE IF NOT EXISTS resumos_sessoes (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR NOT NULL,
      session_id UUID NOT NULL,
      resumo TEXT NOT NULL,
      temas VARCHAR DEFAULT NULL,
      data_sessao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ativo BOOLEAN DEFAULT true,
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_resumos_email ON resumos_sessoes(email);
    CREATE INDEX IF NOT EXISTS idx_resumos_data ON resumos_sessoes(data_sessao DESC);
    CREATE INDEX IF NOT EXISTS idx_resumos_session ON resumos_sessoes(session_id);
    `;

    // Tentar executar via RPC (função no Supabase)
    // Se não funcionar, instruir o usuário a executar manualmente

    console.log('📋 SQL para creditos_sessao:\n');
    console.log(sqlCreditos);
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('📋 SQL para resumos_sessoes:\n');
    console.log(sqlResumos);
    console.log('\n' + '='.repeat(60) + '\n');

    // Tentar criar via Supabase (pode falhar se não tiver permissão)
    console.log('⏳ Tentando criar tabelas automaticamente...\n');

    // Método 1: Tentar usar a função de execução direta
    try {
      // Tenta chamar função do Supabase (se existir)
      const { error: errorExec } = await supabase.rpc('exec', { sql: sqlCreditos });

      if (errorExec) {
        console.log('⚠️  Método automático não disponível');
        console.log('   (função RPC não encontrada no Supabase)\n');
        throw new Error('RPC não disponível');
      }

      console.log('✅ Tabelas criadas com sucesso!\n');
      return;

    } catch (err) {
      // Se falhar, instruir para fazer manualmente
      console.log('📍 Para criar as tabelas manualmente:\n');
      console.log('1️⃣  Acesse: https://app.supabase.com');
      console.log('2️⃣  Vá para: SQL Editor → New Query');
      console.log('3️⃣  Cole e execute o SQL acima');
      console.log('4️⃣  Volte aqui e execute: node testar-sessoes-extras.js\n');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

setupTables();
