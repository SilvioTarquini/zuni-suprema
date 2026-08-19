require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const fetch = require('node-fetch');

const DIAS_DE_ACESSO = parseInt(process.env.LIVRO_ACESSO_DIAS || '7', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.zunisuprema.com.br';

async function main() {
  console.log('=== TESTE END-TO-END: AUDIOLIVRO ===\n');

  const livroId = 'os-bastidores-da-mente-1-a-origem-de-todo-bem-e-de-todo-mal';
  const email = 'teste@e2e.com';
  const cpf = '12345678901';

  try {
    console.log('1. Criando token de acesso ao audiolivro (simulando compra aprovada)...');
    const tokenAudiolivro = crypto.randomBytes(24).toString('hex');
    const expiraEm = new Date(Date.now() + DIAS_DE_ACESSO * 24 * 60 * 60 * 1000);

    const { error: insertError } = await supabase
      .from('acessos_livros')
      .insert({
        livro_id: livroId,
        email,
        cpf,
        token: tokenAudiolivro,
        payment_id: `teste-${Date.now()}`,
        data_pagamento: new Date().toISOString(),
        data_expiracao: expiraEm.toISOString(),
        tipo_produto: 'audiolivro'
      });

    if (insertError) {
      console.error('❌ Erro ao inserir token:', insertError.message);
      console.log('   (Coluna tipo_produto pode não existir ainda)');
      return;
    }

    console.log(`✅ Token criado: ${tokenAudiolivro.substring(0, 8)}...`);
    console.log(`   Email: ${email}`);
    console.log(`   Validade: ${expiraEm.toLocaleDateString('pt-BR')}`);

    console.log('\n2. Testando acesso à rota /audiolivros/:livroId com token válido...');
    const url = `http://localhost:3000/audiolivros/${encodeURIComponent(livroId)}?token=${encodeURIComponent(tokenAudiolivro)}`;
    console.log(`   URL: ${url}`);

    const response = await fetch(url, { redirect: 'manual' });
    console.log(`   Status: ${response.status}`);

    if (response.status === 302 || response.status === 301) {
      const redirectUrl = response.headers.get('location');
      console.log('✅ REDIRECIONAMENTO FUNCIONANDO');
      console.log(`   Redirecionado para: ${redirectUrl?.substring(0, 80)}...`);
      if (redirectUrl?.includes('audiolivros') && redirectUrl?.includes('supabase')) {
        console.log('✅ URL DE REDIRECIONAMENTO CORRETA (aponta para Supabase Storage)');
      }
    } else if (response.status === 403) {
      console.log('❌ Acesso negado (403) — token não foi validado');
    } else {
      console.log(`❌ Status inesperado: ${response.status}`);
      const text = await response.text();
      console.log(`   Resposta: ${text.substring(0, 100)}`);
    }

    console.log('\n3. Testando acesso SEM token (deve retornar 403)...');
    const urlSemToken = `http://localhost:3000/audiolivros/${encodeURIComponent(livroId)}`;
    const responseSemToken = await fetch(urlSemToken, { redirect: 'manual' });
    console.log(`   Status: ${responseSemToken.status}`);
    if (responseSemToken.status === 403) {
      console.log('✅ VALIDAÇÃO FUNCIONANDO (token necessário)');
    } else {
      console.log('❌ Erro: deveria retornar 403 sem token');
    }

    console.log('\n4. Testando token INVÁLIDO...');
    const urlTokenInvalido = `http://localhost:3000/audiolivros/${encodeURIComponent(livroId)}?token=token-invalido-123`;
    const responseTokenInvalido = await fetch(urlTokenInvalido, { redirect: 'manual' });
    console.log(`   Status: ${responseTokenInvalido.status}`);
    if (responseTokenInvalido.status === 403) {
      console.log('✅ VALIDAÇÃO FUNCIONANDO (token inválido rejeitado)');
    }

    console.log('\n=== TESTE CONCLUÍDO ===');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.log('\nDica: Verifique se:');
    console.log('- Servidor está rodando em localhost:3000');
    console.log('- Coluna tipo_produto foi criada na tabela acessos_livros');
    console.log('- Variáveis de ambiente estão configuradas');
  }
}

main();
