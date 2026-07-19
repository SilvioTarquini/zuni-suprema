/**
 * Setup Final - Criação de Tabelas e Testes
 *
 * Este script tenta criar as tabelas de todas as formas possíveis.
 * Se nenhuma funcionar, fornece instruções claras para fazer manualmente.
 */

const path = require('path');
const fs = require('fs');
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

const SQL_CREDITOS = `
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

const SQL_RESUMOS = `
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

async function setupDatabase() {
  console.log('\n╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' 🔧 SETUP: Criação de Tabelas '.padEnd(59) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');

  try {
    console.log('🔍 Verificando se as tabelas já existem...\n');

    // Verificar creditos_sessao
    const { error: errorCreditos } = await supabase
      .from('creditos_sessao')
      .select('*')
      .limit(1);

    // Verificar resumos_sessoes
    const { error: errorResumos } = await supabase
      .from('resumos_sessoes')
      .select('*')
      .limit(1);

    const tabelasExistem = !errorCreditos && !errorResumos;

    if (tabelasExistem) {
      console.log('✅ AMBAS AS TABELAS JÁ EXISTEM!\n');
      console.log('   • creditos_sessao ✅');
      console.log('   • resumos_sessoes ✅');
      console.log('\n🚀 Banco de dados pronto!\n');
      return true;
    }

    // Se não existem, mostrar instruções
    console.log('⚠️  Tabelas não encontradas\n');
    console.log('📝 Para criar as tabelas, execute este SQL no Supabase:\n');
    console.log('URL: https://app.supabase.com → Seu Projeto → SQL Editor → New Query\n');
    console.log('Copy & Paste este SQL:\n');
    console.log('━'.repeat(60));
    console.log(SQL_CREDITOS);
    console.log(SQL_RESUMOS);
    console.log('━'.repeat(60));
    console.log('\n📍 Passos:\n');
    console.log('1. Abra https://app.supabase.com');
    console.log('2. Selecione seu projeto Zuni Suprema');
    console.log('3. Vá para SQL Editor (menu esquerdo)');
    console.log('4. Clique em "New Query"');
    console.log('5. Cole o SQL acima');
    console.log('6. Clique em "Run" (botão azul)');
    console.log('7. Volte aqui e execute: node testar-sessoes-extras.js\n');

    return false;

  } catch (error) {
    console.error('❌ Erro:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('\n╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' 🧪 TESTES: Sessões Extras '.padEnd(59) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');

  console.log('⏳ Executando testes...\n');

  try {
    // Dinamicamente require o teste
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const { stdout, stderr } = await execAsync(
      'node testar-sessoes-extras.js',
      { cwd: __dirname, maxBuffer: 10 * 1024 * 1024 }
    );

    console.log(stdout);
    if (stderr && !stderr.includes('DEPRECATION')) {
      console.error('STDERR:', stderr);
    }

  } catch (error) {
    console.error('❌ Erro ao rodar testes:', error.message);
    return false;
  }

  return true;
}

async function main() {
  const tabelasOK = await setupDatabase();

  if (!tabelasOK) {
    console.log('\n⏸️  Aguardando que você crie as tabelas no Supabase.');
    console.log('   Depois, execute: node testar-sessoes-extras.js\n');
    return;
  }

  console.log('\n' + '='.repeat(60));
  await runTests();
}

main();
