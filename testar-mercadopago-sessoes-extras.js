/**
 * Teste: Integração MercadoPago → Sessões Extras
 *
 * Valida:
 * 1. Criação de pedido pendente
 * 2. Busca de pedido pendente
 * 3. Simulação de webhook confirmando pagamento
 * 4. Criação automática de pacote via webhook
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');
const { criarPedidoPendente, buscarPedidoPendente, deletarPedidoPendente } = require('./src/lib/pedidosSessoesExtras');
const { criarPacoteSessoes, buscarPacoteAtivo } = require('./src/lib/creditosSessao');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_KEY não estão configurados');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testarMercadoPago() {
  console.log('\n╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' TESTE: MercadoPago → Sessões Extras '.padEnd(59) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');

  const testData = {
    nome: 'Cliente Teste MercadoPago',
    email: 'cliente-mp@zuni.local',
    cpf: '12345678901',
    paymentId: 'mp-webhook-' + Date.now()
  };

  try {
    // PASSO 1: Criar pedido pendente
    console.log('📦 PASSO 1: Criar pedido pendente (simula início de checkout)');
    console.log('═'.repeat(60));

    const externalReference = await criarPedidoPendente({
      nome: testData.nome,
      email: testData.email,
      cpf: testData.cpf
    });

    console.log(`✅ Pedido pendente criado:`);
    console.log(`   External Reference: ${externalReference}`);
    console.log(`   Nome: ${testData.nome}`);
    console.log(`   Email: ${testData.email}\n`);

    // PASSO 2: Buscar pedido pendente
    console.log('🔍 PASSO 2: Buscar pedido pendente (simula webhook recebido)');
    console.log('═'.repeat(60));

    const pedidoRecuperado = await buscarPedidoPendente(externalReference);

    if (!pedidoRecuperado) {
      throw new Error('Pedido não foi encontrado após criação');
    }

    console.log(`✅ Pedido recuperado:`);
    console.log(`   Nome: ${pedidoRecuperado.nome}`);
    console.log(`   Email: ${pedidoRecuperado.email}`);
    console.log(`   CPF: ${pedidoRecuperado.cpf}\n`);

    // PASSO 3: Simular webhook criando pacote (como o criarPacoteSessoesSeAplicavel faz)
    console.log('💳 PASSO 3: Simular webhook confirmando pagamento');
    console.log('═'.repeat(60));

    const pacote = await criarPacoteSessoes({
      email: pedidoRecuperado.email,
      paymentId: testData.paymentId
    });

    console.log(`✅ Pacote criado via webhook:`);
    console.log(`   Pacote ID: ${pacote.pacoteId}`);
    console.log(`   Email: ${pacote.email}`);
    console.log(`   Créditos: ${pacote.creditos}`);
    console.log(`   Expira em: ${pacote.expiraEm.toLocaleDateString('pt-BR')}\n`);

    // PASSO 4: Verificar que pacote está ativo
    console.log('✅ PASSO 4: Verificar pacote ativo');
    console.log('═'.repeat(60));

    const pacoteAtivo = await buscarPacoteAtivo(testData.email);

    if (!pacoteAtivo) {
      throw new Error('Pacote não foi encontrado como ativo após criação');
    }

    console.log(`✅ Pacote está ativo:`);
    console.log(`   Email: ${pacoteAtivo.email}`);
    console.log(`   Créditos: ${pacoteAtivo.creditos_restantes}/${pacoteAtivo.creditos_iniciais}\n`);

    // PASSO 5: Limpar pedido pendente (simula deleção pós-webhook)
    console.log('🗑️  PASSO 5: Deletar pedido pendente (após confirmação)');
    console.log('═'.repeat(60));

    await deletarPedidoPendente(externalReference);

    const pedidoApposDelete = await buscarPedidoPendente(externalReference);
    if (pedidoApposDelete === null) {
      console.log(`✅ Pedido deletado com sucesso\n`);
    } else {
      throw new Error('Pedido ainda existe após deleção');
    }

    // ─────────────────────────────────────────────────────

    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' ✅ TUDO FUNCIONANDO PERFEITAMENTE '.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝\n');

    console.log('📊 Resumo:');
    console.log('  ✅ Pedido pendente criado com external_reference');
    console.log('  ✅ Pedido recuperado com dados completos');
    console.log('  ✅ Pacote criado via webhook simulado');
    console.log('  ✅ Pacote encontrado como ativo');
    console.log('  ✅ Pedido pendente deletado após confirmação\n');

    console.log('🚀 Fluxo MercadoPago integrado!\n');

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('\n📍 Stack:', error.stack);
    process.exit(1);
  }
}

testarMercadoPago();
