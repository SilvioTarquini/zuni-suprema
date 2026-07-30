const http = require('http');

// Teste 2: Pergunta sobre conteúdo do Cap. 1
const dados = JSON.stringify({
  sessionId: 'test-session-456',
  pergunta: 'Quais são as três camadas do cérebro mencionadas no capítulo?',
  historico: []
});

const opcoes = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/experimente-livro-chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': dados.length
  }
};

const req = http.request(opcoes, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const resposta = JSON.parse(data);
      console.log('✅ Status:', res.statusCode);
      console.log('✅ Contador:', resposta.contador);
      console.log('✅ Restantes:', resposta.restantes);
      console.log('✅ Resposta (primeiros 300 chars):', resposta.resposta.substring(0, 300) + '...');
      console.log('\n--- RESPOSTA COMPLETA ---');
      console.log(resposta.resposta);
    } catch (e) {
      console.log('Status:', res.statusCode);
      console.log('Raw:', data);
    }
    process.exit(0);
  });
});

req.on('error', err => {
  console.error('Erro:', err.message);
  process.exit(1);
});

req.write(dados);
req.end();
