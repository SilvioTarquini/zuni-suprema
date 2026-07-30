const http = require('http');

function testar() {
  const dados = JSON.stringify({
    sessionId: 'teste-simple',
    pergunta: 'O que é sequestro da amigdala',
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

  console.log('Enviando pergunta sobre sequestro da amígdala...\n');

  const req = http.request(opcoes, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      if (res.statusCode === 200) {
        try {
          const resp = JSON.parse(data);
          console.log('\n✅ Pergunta 1 - Sobre Capítulo 1');
          console.log('─────────────────────────────────────────');
          console.log('Pergunta: "O que é sequestro da amígdala?"');
          console.log('Resposta (primeiros 300 chars):');
          console.log(resp.resposta.substring(0, 300) + '...\n');
          console.log('Contador:', resp.contador);
          console.log('Bloqueado:', resp.bloqueado);
        } catch (e) {
          console.log('Raw:', data);
        }
      } else {
        console.log('Erro:', data);
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
}

testar();
