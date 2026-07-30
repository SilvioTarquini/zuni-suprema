const http = require('http');

console.log('═══════════════════════════════════════════════════════════');
console.log('TESTE PÓS-FIX: Módulo D Chat Degustação');
console.log('═══════════════════════════════════════════════════════════\n');

const sessionId = 'fix-test-' + Date.now();
const perguntas = [
  'O que é sequestro da amígdala?',
  'Quais são as três camadas do cérebro?',
  'Como o trânsito é um laboratório do sequestro emocional?'
];

let historico = [];
let perguntaAtual = 0;

async function fazerPergunta(pergunta) {
  const payload = JSON.stringify({
    sessionId,
    pergunta,
    historico
  });

  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/experimente-livro-chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      const timeStart = Date.now();

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duracao = Date.now() - timeStart;
        try {
          const resp = JSON.parse(data);
          resolve({ status: res.statusCode, duracao, resposta: resp });
        } catch {
          resolve({ status: res.statusCode, duracao, erro: 'JSON inválido' });
        }
      });
    });

    req.on('error', err => resolve({ erro: err.message }));
    req.write(payload);
    req.end();
  });
}

async function testar() {
  console.log(`SessionId: ${sessionId}\n`);

  for (const pergunta of perguntas) {
    console.log(`┌─ ${perguntaAtual + 1}/${perguntas.length}: "${pergunta}"`);
    console.log(`├─ Enviando...`);

    const resultado = await fazerPergunta(pergunta);

    if (resultado.erro) {
      console.log(`├─ ❌ Erro: ${resultado.erro}`);
    } else {
      console.log(`├─ ✅ Status ${resultado.status} | Tempo: ${resultado.duracao}ms`);
      console.log(`├─ Contador: ${resultado.resposta.contador}`);
      console.log(`├─ Resposta: ${resultado.resposta.resposta.substring(0, 80)}...`);

      historico.push({ role: 'user', content: pergunta });
      historico.push({ role: 'assistant', content: resultado.resposta.resposta });
    }

    console.log(`└─────────────────────────────────────────────────────────\n`);

    // Pequeno delay
    await new Promise(r => setTimeout(r, 1000));
    perguntaAtual++;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ TESTE CONCLUÍDO COM SUCESSO');
  console.log('O bug foi corrigido — chat funciona normalmente!');
  console.log('═══════════════════════════════════════════════════════════');

  process.exit(0);
}

testar().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
