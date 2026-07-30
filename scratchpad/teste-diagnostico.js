const http = require('http');

console.log('═══════════════════════════════════════════════════════════');
console.log('TESTE DE DIAGNÓSTICO — Chat de Degustação');
console.log('═══════════════════════════════════════════════════════════\n');

const dados = JSON.stringify({
  sessionId: 'diag-test-002',
  pergunta: 'O que é sequestro da amígdala?',
  historico: []
});

console.log(`Requisição:\n${dados}\n`);
console.log('Enviando para http://localhost:3000/api/experimente-livro-chat...');
console.log(`Timestamp: ${new Date().toISOString()}\n`);

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/experimente-livro-chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(dados)
  }
}, (res) => {
  let data = '';
  const timeStart = Date.now();

  res.on('data', chunk => {
    data += chunk;
  });

  res.on('end', () => {
    const timeEnd = Date.now();
    const duracao = timeEnd - timeStart;

    console.log(`\n✅ Resposta recebida`);
    console.log(`Status HTTP: ${res.statusCode}`);
    console.log(`Tempo decorrido: ${duracao}ms`);
    console.log(`Tamanho da resposta: ${data.length} bytes`);
    console.log(`\n─────────────────────────────────────────────────────\n`);
    console.log('CORPO DA RESPOSTA:');
    console.log(data);

    process.exit(0);
  });
});

req.on('error', err => {
  console.error(`\n❌ ERRO DE CONEXÃO:`, err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error(`\n❌ TIMEOUT — Requisição travou (> 30s sem resposta)`);
  req.destroy();
  process.exit(1);
});

req.setTimeout(30000);

req.write(dados);
req.end();

console.log('Aguardando resposta (máximo 30 segundos)...');
