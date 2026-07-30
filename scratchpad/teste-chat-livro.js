const http = require('http');

const dados = JSON.stringify({
  sessionId: 'test-session-123',
  pergunta: 'O que é o sequestro da amígdala?',
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
    console.log('Status:', res.statusCode);
    console.log('Raw response:', data);
    try {
      console.log('Parsed:', JSON.stringify(JSON.parse(data), null, 2));
    } catch (e) {
      console.log('Não é JSON válido');
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
