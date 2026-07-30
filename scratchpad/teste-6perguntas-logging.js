const http = require('http');
const fs = require('fs');

const sessaoId = 'teste-logging-' + Date.now();
const resultados = [];

// Constante para comparação
const LIMITE_TROCAS = 5;

function fazerRequisicao(pergunta, historico = []) {
  return new Promise((resolve) => {
    const dados = JSON.stringify({
      sessionId: sessaoId,
      pergunta,
      historico
    });

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
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (data && data.trim().startsWith('{')) {
            const resp = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: resp, error: null });
          } else {
            resolve({ statusCode: res.statusCode, data: null, error: data });
          }
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: null, error: e.message });
        }
      });
    });

    req.on('error', err => resolve({ statusCode: 0, data: null, error: err.message }));
    req.write(dados);
    req.end();
  });
}

async function executar() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('TESTE COMPLETO: 6 PERGUNTAS COM LOGGING DETALHADO');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`LIMITE_TROCAS configurado: ${LIMITE_TROCAS}`);
  console.log(`Session ID: ${sessaoId}\n`);

  const perguntas = [
    'O que é sequestro da amígdala?',
    'Quais são as três camadas do cérebro?',
    'Qual é a importância do dado dos 6 segundos?',
    'O que o capítulo diz sobre Marina e Carlos?',
    'Como o trânsito é um laboratório do sequestro emocional?',
    'Qual é o significado da vida? (teste de bloqueio)'
  ];

  let historico = [];
  let contadorAntes = 0;

  for (let i = 0; i < perguntas.length; i++) {
    const pergunta = perguntas[i];
    const numeroTroca = i + 1;

    console.log(`┌─ PERGUNTA ${numeroTroca}/6 ─────────────────────────────────────────`);
    console.log(`│ Texto: "${pergunta}"`);

    const resultado = await fazerRequisicao(pergunta, historico);

    if (resultado.data) {
      const { contador, ultimaTroca, bloqueado, restantes, resposta, error } = resultado.data;
      const contadorDisplay = contador || '—';

      console.log(`│ Status HTTP: ${resultado.statusCode}`);
      console.log(`│ Contador retornado: ${contadorDisplay}`);
      console.log(`│ ultimaTroca: ${ultimaTroca ? '✓ TRUE ⭐' : '✗ false'}`);
      console.log(`│ Bloqueado: ${bloqueado ? '✓ TRUE 🚫' : '✗ false'}`);
      console.log(`│ Restantes: ${restantes}`);
      console.log(`│ Resposta tamanho: ${resposta ? resposta.length : 'N/A'} caracteres`);

      if (error) {
        console.log(`│ Erro mensagem: ${error}`);
      }

      // Validação de lógica
      const contadorParts = typeof contador === 'string' ? contador.split('/') : [contadorDisplay, LIMITE_TROCAS];
      const contadorNum = parseInt(contadorParts[0]);

      console.log(`│`);
      console.log(`│ VALIDAÇÃO:`);
      if (numeroTroca <= 5) {
        console.log(`│   - Deveria estar permitida? ${resultado.statusCode === 200 ? '✓ SIM' : '✗ NÃO'}`);
        console.log(`│   - ultimaTroca deveria ser true? ${ultimaTroca === (numeroTroca === 5) ? '✓ CORRETO' : '✗ ERRO'}`);
      } else {
        console.log(`│   - Deveria ser BLOQUEADA? ${bloqueado === true ? '✓ SIM' : '✗ NÃO (ERRO!)'}`);
        console.log(`│   - Status HTTP deveria ser 429? ${resultado.statusCode === 429 ? '✓ SIM' : '✗ NÃO'}`);
      }

      resultados.push({
        numero: numeroTroca,
        pergunta,
        statusCode: resultado.statusCode,
        contador: contadorDisplay,
        ultimaTroca,
        bloqueado,
        restantes,
        validacao: numeroTroca === 5 ? 'ÚLTIMA_TROCA_ESPERADA' : (numeroTroca === 6 ? 'BLOQUEADA_ESPERADA' : 'OK')
      });

      if (resultado.statusCode === 200 && resposta) {
        historico.push({ role: 'user', content: pergunta });
        historico.push({ role: 'assistant', content: resposta });
      }
    } else {
      console.log(`│ ❌ ERRO: ${resultado.error}`);
      resultados.push({
        numero: numeroTroca,
        pergunta,
        statusCode: resultado.statusCode,
        erro: resultado.error
      });
    }

    console.log(`└────────────────────────────────────────────────────────────\n`);

    // Delay entre requisições
    await new Promise(r => setTimeout(r, 1500));
  }

  // Gerar relatório
  const relatorio = `
╔═══════════════════════════════════════════════════════════════╗
║  TESTE COMPLETO: 6 PERGUNTAS COM LOGGING DETALHADO           ║
║  VALIDAÇÃO DE LIMITE E FLAG ultimaTroca                       ║
╚═══════════════════════════════════════════════════════════════╝

DATA/HORA: ${new Date().toLocaleString('pt-BR')}
SESSION ID: ${sessaoId}
LIMITE_TROCAS CONFIGURADO: ${LIMITE_TROCAS}
ENDPOINT: POST /api/experimente-livro-chat

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABELA DE RESULTADOS:

| # | Contador | ultimaTroca | Bloqueado | HTTP | Validação |
|---|----------|-------------|-----------|------|-----------|
${resultados.map(r => `| ${r.numero} | ${r.contador} | ${r.ultimaTroca ? 'SIM ⭐' : 'não'} | ${r.bloqueado ? 'SIM 🚫' : 'não'} | ${r.statusCode} | ${r.validacao} |`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANÁLISE:

1. LIMITE_TROCAS = ${LIMITE_TROCAS} ✓

2. SEQUÊNCIA ESPERADA vs OBSERVADA:
   - Pergunta 1: contador 1/5, ultimaTroca false → ${resultados[0].contador === '1/5' && resultados[0].ultimaTroca === false ? '✓' : '✗'}
   - Pergunta 2: contador 2/5, ultimaTroca false → ${resultados[1].contador === '2/5' && resultados[1].ultimaTroca === false ? '✓' : '✗'}
   - Pergunta 3: contador 3/5, ultimaTroca false → ${resultados[2].contador === '3/5' && resultados[2].ultimaTroca === false ? '✓' : '✗'}
   - Pergunta 4: contador 4/5, ultimaTroca false → ${resultados[3].contador === '4/5' && resultados[3].ultimaTroca === false ? '✓' : '✗'}
   - Pergunta 5: contador 5/5, ultimaTroca TRUE ⭐ → ${resultados[4].contador === '5/5' && resultados[4].ultimaTroca === true ? '✓✓✓ CORRETO!' : '✗ ERRO!'}
   - Pergunta 6: BLOQUEADA 🚫 → ${resultados[5].bloqueado === true ? '✓✓✓ CORRETO!' : '✗ ERRO!'}

3. BUG ANTERIOR:
   - Antes: pergunta 4 tinha ultimaTroca = true (INCORRETO)
   - Depois da correção: pergunta 5 tem ultimaTroca = true (CORRETO)
   - Status: ${resultados[4].ultimaTroca === true ? '✅ BUG CORRIGIDO!' : '❌ BUG AINDA PRESENTE!'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONCLUSÃO: ${resultados[4].ultimaTroca === true && resultados[5].bloqueado === true ? '✅ TUDO CORRETO!' : '⚠️ REVISAR'}

`.trim();

  console.log(relatorio);
  fs.writeFileSync('scratchpad/TESTE-6-PERGUNTAS-COMPLETO.txt', relatorio);
  console.log('\n✅ Relatório salvo em: scratchpad/TESTE-6-PERGUNTAS-COMPLETO.txt');

  process.exit(0);
}

executar().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
