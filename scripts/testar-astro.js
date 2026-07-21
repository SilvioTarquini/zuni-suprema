#!/usr/bin/env node
// scripts/testar-astro.js
// Script de teste para validar integração com API AstroWay

require('dotenv').config();

const {
  calcularMapaNatal,
  calcularNumerologia,
  verificarStatus
} = require('../src/lib/astro');

// Dados de teste: nascimento conhecido (exemplo célebre)
// Aqui usamos dados fictícios para demonstração
const dadosTeste = {
  nome: 'Leonardo da Vinci',
  dataNascimento: '1452-04-15', // 15 de abril de 1452
  horaNascimento: '14:30', // Hora aproximada
  localNascimento: 'Vinci, Itália'
};

async function testarIntegracao() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   TESTE DE INTEGRAÇÃO COM ASTROWAY        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // Verificar status da conta (opcional, pode falhar)
  console.log('📊 Verificando status da conta...\n');
  const status = await verificarStatus();

  if (status.sucesso) {
    console.log('✅ Conta conectada!');
    console.log(`   Plano: ${status.conta.plano}`);
    console.log(`   Créditos disponíveis: ${status.conta.creditosDisponíveis}/${status.conta.creditosTotais}`);
    console.log(`   Próxima renovação: ${status.conta.dataRenovacao}\n`);
  } else {
    console.warn('⚠️  Não foi possível verificar status (opcional)');
    console.log('   Continuando com teste de mapa...\n');
  }

  // 2. Calcular mapa natal
  console.log('🌍 Calculando mapa natal...\n');
  console.log(`   Nome: ${dadosTeste.nome}`);
  console.log(`   Data: ${dadosTeste.dataNascimento}`);
  console.log(`   Hora: ${dadosTeste.horaNascimento}`);
  console.log(`   Local: ${dadosTeste.localNascimento}\n`);

  const mapaNatal = await calcularMapaNatal(dadosTeste);

  if (!mapaNatal.sucesso) {
    console.error('❌ Erro ao calcular mapa natal:', mapaNatal.erro);
    process.exit(1);
  }

  console.log('✅ Mapa natal calculado com sucesso!\n');
  console.log('   POSIÇÕES PLANETÁRIAS:');
  console.log(`   ☀️  Sol:       ${mapaNatal.mapaNatal.sol.sign} (${mapaNatal.mapaNatal.sol.degree}°)`);
  console.log(`   🌙 Lua:       ${mapaNatal.mapaNatal.lua.sign} (${mapaNatal.mapaNatal.lua.degree}°)`);
  console.log(`   ↑ Ascendente: ${mapaNatal.mapaNatal.ascendente.sign} (${mapaNatal.mapaNatal.ascendente.degree}°)`);
  console.log(`   ☿ Mercúrio:  ${mapaNatal.mapaNatal.mercurio.sign} (${mapaNatal.mapaNatal.mercurio.degree}°)`);
  console.log(`   ♀ Vênus:     ${mapaNatal.mapaNatal.venus.sign} (${mapaNatal.mapaNatal.venus.degree}°)`);
  console.log(`   ♂ Marte:     ${mapaNatal.mapaNatal.marte.sign} (${mapaNatal.mapaNatal.marte.degree}°)`);

  console.log(`\n   Créditos utilizados: ${mapaNatal.creditsUsed}`);
  console.log(`   Timestamp: ${mapaNatal.timestamp}\n`);

  // Numerologia ainda não está disponível na API AstroWay (endpoint /numerology não existe)
  // Será adicionado em breve quando disponibilizado
  console.log('🔢 Numerologia (em desenvolvimento)\n');

  // Resumo
  console.log('╔════════════════════════════════════════════╗');
  console.log('║         ✅ TODOS OS TESTES PASSARAM!       ║');
  console.log('╚════════════════════════════════════════════╝\n');

  console.log('📋 Próximos passos:');
  console.log('   1. Integrar calcularMapaNatal() ao checkout do Mapa Integrado');
  console.log('   2. Armazenar mapa natal no banco de dados (sessões)');
  console.log('   3. Usar dados do mapa no Mentor para contexto astrológico\n');
}

// Executar testes
testarIntegracao().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
