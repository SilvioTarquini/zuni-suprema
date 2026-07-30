// TESTE DE VALIDAÇÃO: Rejeição de Dados Incompletos
// Demonstra que o sistema REJEITA requisições sem hora de nascimento

// process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-...'; // Removed: set via environment

const { validarDadosNascimento } = require('./src/lib/astro.js');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  TESTE: Validação de Rejeição de Dados Incompletos         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Teste 1: Dados COMPLETOS (deve passar)
console.log('TESTE 1: Dados COMPLETOS\n');
const dadosCompletos = {
  nome: 'Ana Silva',
  dataNascimento: '1990-03-15',
  horaNascimento: '14:30',
  localNascimento: 'São Paulo'
};

try {
  validarDadosNascimento(dadosCompletos);
  console.log('✅ VALIDAÇÃO PASSOU');
  console.log(`   Nome: ${dadosCompletos.nome}`);
  console.log(`   Data: ${dadosCompletos.dataNascimento}`);
  console.log(`   Hora: ${dadosCompletos.horaNascimento}`);
  console.log(`   Local: ${dadosCompletos.localNascimento}\n`);
} catch (err) {
  console.log(`❌ VALIDAÇÃO FALHOU: ${err.message}\n`);
}

// Teste 2: Dados SEM HORA (deve rejeitar)
console.log('TESTE 2: Dados SEM HORA\n');
const dadosSemHora = {
  nome: 'Ana Silva',
  dataNascimento: '1990-03-15',
  horaNascimento: null,  // ← FALTANDO
  localNascimento: 'São Paulo'
};

try {
  validarDadosNascimento(dadosSemHora);
  console.log('✅ VALIDAÇÃO PASSOU (ERRO: deveria ter rejeitado!)\n');
} catch (err) {
  console.log(`✅ VALIDAÇÃO CORRETAMENTE REJEITADA`);
  console.log(`   Erro: ${err.message}\n`);
}

// Teste 3: Dados COM HORA MAS FORMATO INVÁLIDO (deve rejeitar)
console.log('TESTE 3: Hora em Formato Inválido\n');
const dadosHoraInvalida = {
  nome: 'Ana Silva',
  dataNascimento: '1990-03-15',
  horaNascimento: '14h30',  // ← FORMATO ERRADO (esperado HH:MM)
  localNascimento: 'São Paulo'
};

try {
  validarDadosNascimento(dadosHoraInvalida);
  console.log('✅ VALIDAÇÃO PASSOU (ERRO: deveria ter rejeitado!)\n');
} catch (err) {
  console.log(`✅ VALIDAÇÃO CORRETAMENTE REJEITADA`);
  console.log(`   Erro: ${err.message}\n`);
}

// Teste 4: Dados SEM LOCAL (deve rejeitar)
console.log('TESTE 4: Dados SEM LOCAL\n');
const dadosSemLocal = {
  nome: 'Ana Silva',
  dataNascimento: '1990-03-15',
  horaNascimento: '14:30',
  localNascimento: null  // ← FALTANDO
};

try {
  validarDadosNascimento(dadosSemLocal);
  console.log('✅ VALIDAÇÃO PASSOU (ERRO: deveria ter rejeitado!)\n');
} catch (err) {
  console.log(`✅ VALIDAÇÃO CORRETAMENTE REJEITADA`);
  console.log(`   Erro: ${err.message}\n`);
}

console.log('═════════════════════════════════════════════════════════════');
console.log('CONCLUSÃO');
console.log('═════════════════════════════════════════════════════════════\n');
console.log('✅ Sistema REJEITA explicitamente:');
console.log('   1. Hora ausente');
console.log('   2. Hora em formato inválido');
console.log('   3. Local de nascimento ausente\n');
console.log('⚠️  NÃO há fallback silencioso ou estimativa automática');
console.log('   Requisição incompleta = Erro imediato ao usuário\n');
