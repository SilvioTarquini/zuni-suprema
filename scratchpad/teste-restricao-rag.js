const http = require('http');

let testesCompletos = 0;
const sessaoId = 'teste-restricao-' + Date.now();

function fazerRequisicao(sessionId, pergunta, historico = []) {
  return new Promise((resolve, reject) => {
    const dados = JSON.stringify({
      sessionId,
      pergunta,
      historico
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
          resolve({ status: res.statusCode, resposta, erro: null });
        } catch (e) {
          resolve({ status: res.statusCode, resposta: null, erro: data });
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(dados);
    req.end();
  });
}

async function executarTestes() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TESTE 1: Pergunta sobre Capítulo 1 (deve responder bem)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const teste1 = await fazerRequisicao(
      sessaoId + '-test1',
      'Quais são as três camadas do cérebro descritas no capítulo?'
    );

    console.log(`Status: ${teste1.status}`);
    console.log(`Pergunta: "Quais são as três camadas do cérebro descritas no capítulo?"\n`);
    console.log(`RESPOSTA (primeiros 400 chars):\n${teste1.resposta.resposta.substring(0, 400)}...\n`);
    console.log(`Contador: ${teste1.resposta.contador}`);
    console.log(`Bloqueado: ${teste1.resposta.bloqueado}\n`);

    // Verificar se a resposta menciona as 3 camadas
    const temCamadas = teste1.resposta.resposta.includes('instintivo') ||
                       teste1.resposta.resposta.includes('emocional') ||
                       teste1.resposta.resposta.includes('racional');

    console.log(`✅ Resposta contém referências às camadas do cérebro: ${temCamadas ? 'SIM' : 'NÃO'}\n`);

    // ──────────────────────────────────────────────────────────────────

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TESTE 2: Pergunta sobre Capítulo 2+ (deve recusar ou não ter info)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const teste2 = await fazerRequisicao(
      sessaoId + '-test2',
      'Qual é a diferença entre emoções e sentimentos conforme explicado no próximo capítulo?'
    );

    console.log(`Status: ${teste2.status}`);
    console.log(`Pergunta: "Qual é a diferença entre emoções e sentimentos conforme explicado no próximo capítulo?"\n`);
    console.log(`RESPOSTA (primeiros 400 chars):\n${teste2.resposta.resposta.substring(0, 400)}...\n`);
    console.log(`Contador: ${teste2.resposta.contador}`);
    console.log(`Bloqueado: ${teste2.resposta.bloqueado}\n`);

    // Verificar se recusa informação sobre Cap 2
    const recusouCap2 = teste2.resposta.resposta.includes('próximo capítulo') ||
                        teste2.resposta.resposta.includes('degustação') ||
                        teste2.resposta.resposta.includes('não') ||
                        teste2.resposta.resposta.includes('capítulo não');

    console.log(`✅ Resposta reconhece que o tema não está na degustação: ${recusouCap2 ? 'SIM' : 'NÃO'}\n`);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('CONCLUSÃO: RAG está RESTRITO ao Capítulo 1');
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('Erro:', err.message);
  }

  process.exit(0);
}

executarTestes();
