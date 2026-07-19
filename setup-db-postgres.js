/**
 * Conecta direto ao PostgreSQL do Supabase e cria as tabelas
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Tentar usar a biblioteca postgres se disponível
let sql;
try {
  sql = require('postgres');
} catch (e) {
  console.log('⚠️  postgres não está instalado');
  console.log('   Instale com: npm install postgres');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_KEY não estão configurados');
  process.exit(1);
}

// Extrair URL de conexão do SUPABASE_URL
// Formato: https://[project-id].supabase.co
const projectUrl = process.env.SUPABASE_URL;
const projectId = projectUrl.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];

if (!projectId) {
  console.error('❌ Não foi possível extrair project ID do SUPABASE_URL');
  process.exit(1);
}

// URL de conexão PostgreSQL
const dbUrl = `postgresql://postgres:[SUPABASE_KEY]@db.${projectId}.supabase.co:5432/postgres`;

async function setupTables() {
  console.log('🔧 Criando tabelas via PostgreSQL...\n');

  const client = sql(dbUrl);

  try {
    console.log('⏳ Conectando ao Supabase PostgreSQL...\n');

    // Criar tabela creditos_sessao
    console.log('📦 Criando tabela creditos_sessao...');
    await client`
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
      )
    `;

    console.log('✅ Tabela creditos_sessao criada');

    // Criar índices
    console.log('📇 Criando índices para creditos_sessao...');
    await client`CREATE INDEX IF NOT EXISTS idx_creditos_email ON creditos_sessao(email)`;
    await client`CREATE INDEX IF NOT EXISTS idx_creditos_ativo ON creditos_sessao(ativo)`;
    await client`CREATE INDEX IF NOT EXISTS idx_creditos_expiracao ON creditos_sessao(expira_em)`;
    await client`CREATE INDEX IF NOT EXISTS idx_creditos_payment ON creditos_sessao(payment_id)`;
    console.log('✅ Índices criados');

    // Criar tabela resumos_sessoes
    console.log('\n📝 Criando tabela resumos_sessoes...');
    await client`
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
      )
    `;

    console.log('✅ Tabela resumos_sessoes criada');

    // Criar índices
    console.log('📇 Criando índices para resumos_sessoes...');
    await client`CREATE INDEX IF NOT EXISTS idx_resumos_email ON resumos_sessoes(email)`;
    await client`CREATE INDEX IF NOT EXISTS idx_resumos_data ON resumos_sessoes(data_sessao DESC)`;
    await client`CREATE INDEX IF NOT EXISTS idx_resumos_session ON resumos_sessoes(session_id)`;
    console.log('✅ Índices criados');

    console.log('\n╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' ✅ TABELAS CRIADAS COM SUCESSO '.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝\n');

    console.log('📊 Resumo:');
    console.log('  • creditos_sessao — com 4 índices');
    console.log('  • resumos_sessoes — com 3 índices');
    console.log('\n🚀 Próximo passo: node testar-sessoes-extras.js\n');

  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupTables();
