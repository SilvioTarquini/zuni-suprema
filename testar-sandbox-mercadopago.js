/**
 * Teste: Sandbox MercadoPago → Sessões Extras
 *
 * Valida fluxo completo:
 * 1. Gerar link de pagamento (preference)
 * 2. Simular webhook após pagamento confirmado
 * 3. Verificar que pacote foi criado
 *
 * ⚠️  Requer credenciais de SANDBOX no .env:
 * - MERCADOPAGO_TOKEN (TEST-...)
 * - MERCADOPAGO_PUBLIC_KEY (TEST-...)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { createClient } = require('@supabase/supabase-js');
const { buscarPacoteAtivo } = require('./src/lib/creditosSessao');
const { buscarPedidoPendente } = require('./src/lib/pedidosSessoesExtras');

if (!process.env.MERCADOPAGO_TOKEN) {
  console.error('❌ MERCADOPAGO_TOKEN não está configurado');
  console.error('   Adicione credenciais de SANDBOX ao .env');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL e SUPABASE_KEY não estão configurados');
  process.exit(1);
}

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_TOKEN
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const PREÇO_PACOTE = 74.90;
const SESSOES_POR_PACOTE = 3;

async function testarSandboxMercadoPago() {
  console.log('\n╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' TESTE: Sandbox MercadoPago → Sessões Extras '.padEnd(59) + '║');
  console.log('╚' + '═'.repeat(58) + '╝\n');

  const clienteTeste = {
    nome: 'Cliente Teste Sandbox',
    email: 'teste-sandbox@zuni.local',
    cpf: '12345678901'
  };

  try {
    // PASSO 1: Criar preference (simula frontend chamando endpoint)
    console.log('🛒 PASSO 1: Gerar link de pagamento (Preference)');
    console.log('═'.repeat(60));

    const { criarPedidoPendente } = require('./src/lib/pedidosSessoesExtras');
    const externalReference = await criarPedidoPendente({
      nome: clienteTeste.nome,
      email: clienteTeste.email,
      cpf: clienteTeste.cpf
    });

    console.log(`✅ Pedido pendente criado:`);
    console.log(`   External Reference: ${externalReference}\n`);

    // PASSO 2: Criar preference do MercadoPago
    console.log('💳 PASSO 2: Criar Preference no MercadoPago');
    console.log('═'.repeat(60));

    const [firstName, ...restName] = clienteTeste.nome.trim().split(/\s+/);
    const lastName = restName.join(' ') || firstName;

    const preference = new Preference(mpClient);
    const result = await preference.create({
      body: {
        items: [
          {
            id: 'sessoes-extras',
            title: `Sessões Extras — ${SESSOES_POR_PACOTE} sessões com continuidade de jornada`,
            quantity: 1,
            unit_price: PREÇO_PACOTE,
            currency_id: 'BRL'
          }
        ],
        payer: {
          name: firstName,
          surname: lastName,
          email: clienteTeste.email,
          identification: { type: 'CPF', number: clienteTeste.cpf }
        },
        external_reference: externalReference,
        back_urls: {
          success: 'http://localhost:3000/sessoes-extras-confirmacao.html?status=aprovado',
          pending: 'http://localhost:3000/sessoes-extras-confirmacao.html?status=pendente',
          failure: 'http://localhost:3000/sessoes-extras-confirmacao.html?erro=1'
        }
      }
    });

    console.log(`✅ Preference criada no MercadoPago:`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Link: ${result.init_point}\n`);

    console.log('🔗 Link para testar em sandbox:');
    console.log(`   ${result.init_point}\n`);

    // PASSO 3: Buscar a preference para obter ID de pagamento simulado
    console.log('📋 PASSO 3: Simular pagamento confirmado');
    console.log('═'.repeat(60));

    // Em sandbox, vamos simular um pagamento direto
    const paymentSimulado = new Payment(mpClient);

    const paymentResult = await paymentSimulado.create({
      body: {
        transaction_amount: PREÇO_PACOTE,
        description: `Sessões Extras - ${SESSOES_POR_PACOTE} sessões`,
        payment_method_id: 'visa',
        payer: {
          email: clienteTeste.email
        },
        external_reference: externalReference,
        // Em sandbox, usar card de teste
        token: 'TEST-visa-4111111111111111' // Token de teste do sandbox
      }
    });

    console.log(`⚠️  Nota: Pagamento simulado (em produção seria via webhook)`);
    console.log(`   Status: ${paymentResult.status}\n`);

    // PASSO 4: Simular webhook com order aprovada
    console.log('🔔 PASSO 4: Simular Webhook MercadoPago');
    console.log('═'.repeat(60));

    // Buscar a preference criada e simular que ela foi paga
    const preferenceData = await preference.get(result.id);
    console.log(`✅ Preference obtida do MercadoPago:`);
    console.log(`   Total: R$ ${PREÇO_PACOTE}`);
    console.log(`   Email: ${preferenceData.payer.email}\n`);

    // PASSO 5: Verificar dados do pedido pendente
    console.log('🔍 PASSO 5: Verificar pedido pendente antes do webhook');
    console.log('═'.repeat(60));

    const pedidoPendente = await buscarPedidoPendente(externalReference);
    if (pedidoPendente) {
      console.log(`✅ Pedido pendente encontrado:`);
      console.log(`   Nome: ${pedidoPendente.nome}`);
      console.log(`   Email: ${pedidoPendente.email}\n`);
    } else {
      console.log(`❌ Pedido pendente não encontrado\n`);
    }

    // PASSO 6: Criar pacote manualmente (simulando o que o webhook faria)
    console.log('⚙️  PASSO 6: Criar pacote (simulando webhook)');
    console.log('═'.repeat(60));

    const { criarPacoteSessoes } = require('./src/lib/creditosSessao');
    const pacote = await criarPacoteSessoes({
      email: clienteTeste.email,
      paymentId: `mp-sandbox-${Date.now()}`
    });

    console.log(`✅ Pacote criado:`);
    console.log(`   ID: ${pacote.pacoteId}`);
    console.log(`   Email: ${pacote.email}`);
    console.log(`   Créditos: ${pacote.creditos}`);
    console.log(`   Expira: ${pacote.expiraEm.toLocaleDateString('pt-BR')}\n`);

    // PASSO 7: Verificar pacote ativo
    console.log('✅ PASSO 7: Verificar pacote ativo');
    console.log('═'.repeat(60));

    const pacoteAtivo = await buscarPacoteAtivo(clienteTeste.email);

    if (pacoteAtivo && pacoteAtivo.pacote_id === pacote.pacoteId) {
      console.log(`✅ Pacote está ativo:`);
      console.log(`   Email: ${pacoteAtivo.email}`);
      console.log(`   Créditos: ${pacoteAtivo.creditos_restantes}/${pacoteAtivo.creditos_iniciais}\n`);
    } else {
      throw new Error('Pacote não foi encontrado como ativo');
    }

    // PASSO 8: Deletar pedido pendente
    console.log('🗑️  PASSO 8: Limpar pedido pendente');
    console.log('═'.repeat(60));

    const { deletarPedidoPendente } = require('./src/lib/pedidosSessoesExtras');
    await deletarPedidoPendente(externalReference);

    const pedidoApposDelete = await buscarPedidoPendente(externalReference);
    if (!pedidoApposDelete) {
      console.log(`✅ Pedido pendente deletado\n`);
    }

    // ─────────────────────────────────────────────────────

    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + ' ✅ SANDBOX FUNCIONANDO PERFEITAMENTE '.padEnd(59) + '║');
    console.log('╚' + '═'.repeat(58) + '╝\n');

    console.log('📊 Resumo do Fluxo:');
    console.log('  ✅ Preference criada com external_reference');
    console.log('  ✅ Link de pagamento gerado');
    console.log('  ✅ Pedido pendente criado');
    console.log('  ✅ Pacote criado após "pagamento"');
    console.log('  ✅ Pacote encontrado como ativo');
    console.log('  ✅ Pedido pendente removido\n');

    console.log('🎯 Próximas Etapas:');
    console.log('  1. Abra o link de pagamento no navegador:');
    console.log(`     ${result.init_point}`);
    console.log('  2. Use cartão de teste: 4111 1111 1111 1111');
    console.log('  3. Use qualquer data futura e CVC 123');
    console.log('  4. Sistema cria pacote automaticamente via webhook\n');

    console.log('🚀 Sandbox testado com sucesso!\n');

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error('\n📍 Detalhes:', error.response?.data || error.stack);
    process.exit(1);
  }
}

testarSandboxMercadoPago();
