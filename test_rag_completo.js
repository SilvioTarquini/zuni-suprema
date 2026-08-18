/**
 * TESTE RAG COMPLETO — Investigação sistemática de bases RAG
 *
 * Testes end-to-end para cada tema com RAG indexado.
 * Captura logs [RAG_HIBRIDO], valida respostas.
 */

const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yirxjunmjfnajotcnywc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_secret_ccnCiDVYGzdcOc0hPH0ycw_Xkz7tknX';
const API_URL = 'http://localhost:3000';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Temas e perguntas de teste
const TEMAS_TESTE = [
  {
    slug: 'timidez_comunicacao',
    chunks: 2,
    pergunta: 'Como posso vencer a timidez ao falar em público?'
  },
  {
    slug: 'namoro_conquista_romance',
    chunks: 52,
    pergunta: 'Qual é a melhor forma de conquistar a pessoa que gosto?'
  },
  {
    slug: 'administracao_empresarial_inteligente',
    chunks: 40,
    pergunta: 'Como melhorar a gestão da minha empresa?'
  },
  {
    slug: 'obesidade',
    chunks: 410,
    pergunta: 'Como posso perder peso de forma saudável?'
  },
  {
    slug: 'depressao',
    chunks: 79,
    pergunta: 'Estou sentindo vazio e falta de motivação. O que fazer?'
  },
  {
    slug: 'sentimentos_adolescencia',
    chunks: 16,
    pergunta: 'Como lidar com as emoções intensas da adolescência?'
  },
  {
    slug: 'educar_filhos',
    chunks: 14,
    pergunta: 'Qual é a melhor forma de educar crianças?'
  }
];

// Buffer para capturar logs
let logsCapturados = [];
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  const message = args.join(' ');
  if (message.includes('[RAG_HIBRIDO]') || message.includes('[RAG_GENERICO]')) {
    logsCapturados.push(message);
  }
  originalLog.apply(console, args);
};

console.error = function(...args) {
  originalError.apply(console, args);
};

// Fazer requisição HTTP
function fazerRequisicao(metodo, path, body = null) {
  return new Promise((resolve, reject) => {
    const opcoes = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: metodo,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(opcoes, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Criar e configurar sessão de teste
async function criarSessaoTeste(tema) {
  const sessionId = uuidv4();

  // 1. Inserir sessão base no Supabase
  const { error: insertError } = await supabase
    .from('sessions')
    .insert({
      session_id: sessionId,
      email: `teste-${tema}@zuni-teste.local`,
      paid: true,
      tema_questionario: tema,
      product_type: 'mapa-astral',
      history: JSON.stringify([])
    });

  if (insertError) {
    console.error(`Erro ao criar sessão para ${tema}:`, insertError);
    return null;
  }

  return sessionId;
}

// Executar teste para um tema
async function testarTema(tema_info) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TESTANDO: ${tema_info.slug}`);
  console.log(`Chunks esperados: ${tema_info.chunks}`);
  console.log('='.repeat(60));

  logsCapturados = [];

  try {
    // 1. Criar sessão
    const sessionId = await criarSessaoTeste(tema_info.slug);
    if (!sessionId) {
      return { tema: tema_info.slug, status: '❌ FALHOU', erro: 'Erro ao criar sessão' };
    }

    console.log(`✓ Sessão criada: ${sessionId}`);

    // 2. Fazer chamada ao chat
    const resultado = await fazerRequisicao('POST', '/api/chat', {
      sessionId,
      message: tema_info.pergunta
    });

    console.log(`✓ Resposta recebida (status ${resultado.status})`);

    if (resultado.status !== 200) {
      return {
        tema: tema_info.slug,
        status: '❌ FALHOU',
        erro: `Status ${resultado.status}: ${resultado.body?.error || 'Erro desconhecido'}`
      };
    }

    // 3. Verificar log [RAG_HIBRIDO]
    const ragLog = logsCapturados.find(log => log.includes(`Tema: "${tema_info.slug}"`));
    const logEncontrado = !!ragLog;

    // 4. Extrair informações do log se existir
    let chunksRetornados = 'N/A';
    if (ragLog) {
      const match = ragLog.match(/Limite tema: (\d+), Limite geral: (\d+)/);
      if (match) {
        chunksRetornados = `${match[1]} (tema) + ${match[2]} (geral) = ${parseInt(match[1]) + parseInt(match[2])}`;
      }
    }

    // 5. Avaliar resposta
    const resposta = resultado.body?.texto || '';
    const temConteudoEspecifico = resposta.length > 100 && !resposta.includes('genérico') && !resposta.includes('desculpe');

    // 6. Determinar classificação
    let classificacao = '❌ FALHOU';
    if (logEncontrado && temConteudoEspecifico) {
      classificacao = '✅ CONFIRMADO';
    } else if (logEncontrado) {
      classificacao = '⚠️ PARCIAL';
    }

    // 7. Limpar sessão de teste
    await supabase
      .from('sessions')
      .delete()
      .eq('session_id', sessionId)
      .catch(e => console.warn(`Aviso: não pude limpar sessão ${sessionId}`));

    return {
      tema: tema_info.slug,
      chunks_indexados: tema_info.chunks,
      log_rag_encontrado: logEncontrado ? 'Sim' : 'Não',
      chunks_retornados: chunksRetornados,
      classificacao,
      resposta_preview: resposta.substring(0, 120) + '...',
      log_completo: ragLog || 'Nenhum log capturado'
    };

  } catch (erro) {
    console.error(`Erro no teste de ${tema_info.slug}:`, erro.message);
    return {
      tema: tema_info.slug,
      status: '❌ FALHOU',
      erro: erro.message
    };
  }
}

// Executar todos os testes
async function executarTodosTestes() {
  console.log('\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' VARREDURA COMPLETA — BASES RAG EM PRODUÇÃO '.padStart(62).padEnd(79) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');

  const resultados = [];

  for (const tema of TEMAS_TESTE) {
    const resultado = await testarTema(tema);
    resultados.push(resultado);

    // Pequeno delay entre testes para evitar sobrecarga
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Exibir tabela de resultados
  console.log('\n\n');
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' RELATÓRIO FINAL — RESULTADO DOS TESTES '.padStart(62).padEnd(79) + '║');
  console.log('╚' + '═'.repeat(78) + '╝\n');

  console.log('| Tema | Chunks | Log RAG | Chunks Retornados | Status | Preview |');
  console.log('|' + ''.padEnd(78, '-') + '|');

  for (const r of resultados) {
    const tema = r.tema?.padEnd(35) || 'ERRO';
    const chunks = (r.chunks_indexados?.toString() || '?').padEnd(7);
    const logRag = (r.log_rag_encontrado || 'N/A').padEnd(7);
    const chunksRet = (r.chunks_retornados?.substring(0, 18) || 'N/A').padEnd(18);
    const status = r.classificacao || '❌ FALHOU';
    const preview = r.resposta_preview?.substring(0, 20) || r.erro?.substring(0, 20) || '?';

    console.log(`| ${tema} | ${chunks} | ${logRag} | ${chunksRet} | ${status} |`);
  }

  console.log('\n\n' + JSON.stringify(resultados, null, 2));
}

// Executar
executarTodosTestes().catch(console.error);
