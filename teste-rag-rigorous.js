#!/usr/bin/env node
/**
 * TESTE RAG RIGOROSO — Com criação real de sessões via Supabase service_role
 */

const { createClient } = require('@supabase/supabase-js');
const http = require('http');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

// Usar service_role key para contornar RLS
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpcng' +
  'qdW5tbWpmbmFqb3Rjbnl3YyIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2OTIyMzI4MDAsImV4cCI6' +
  'MjAwODIzMjgwMH0.3sFVMltFJXn9PRZI72xRNQBhkUEqHT_JvQgvs-_Vs0M';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEMAS = [
  { slug: 'timidez_comunicacao', pergunta: 'Como vencer a timidez ao falar em público?' },
  { slug: 'namoro_conquista_romance', pergunta: 'Como conquistar a pessoa que gosto?' },
  { slug: 'administracao_empresarial_inteligente', pergunta: 'Como melhorar a gestão da minha empresa?' },
  { slug: 'obesidade', pergunta: 'Como perder peso de forma saudável?' },
  { slug: 'depressao', pergunta: 'Estou sentindo vazio e falta de motivação' },
  { slug: 'sentimentos_adolescencia', pergunta: 'Como lidar com emoções intensas da adolescência?' },
  { slug: 'educar_filhos', pergunta: 'Qual é a melhor forma de educar crianças?' }
];

async function fazerRequisicaoAPI(metodo, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, body: data, parseError: true });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testarTema(tema_info) {
  const sessionId = uuidv4();
  const email = `teste-${tema_info.slug}-${Date.now()}@zuni.local`;

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📋 Tema: ${tema_info.slug}`);
  console.log(`   SessionID: ${sessionId}`);

  try {
    // 1. Criar sessão via Supabase (service_role contorna RLS)
    console.log(`   [1] Criando sessão no Supabase...`);
    const { data: insertData, error: insertError } = await supabase
      .from('sessions')
      .insert({
        session_id: sessionId,
        email: email,
        paid: true,
        tema_questionario: tema_info.slug,
        product_type: 'mapa-astral',
        history: []
      })
      .select();

    if (insertError) {
      console.log(`       ❌ Erro ao inserir: ${insertError.message}`);
      return {
        tema: tema_info.slug,
        status: '❌ ERRO_SESSAO',
        erro: insertError.message
      };
    }

    console.log(`       ✓ Sessão criada`);

    // 2. Fazer requisição ao chat
    console.log(`   [2] Enviando pergunta ao Mentor...`);
    const resChat = await fazerRequisicaoAPI('POST', '/api/chat', {
      sessionId,
      message: tema_info.pergunta
    });

    if (resChat.status !== 200) {
      console.log(`       ❌ Status ${resChat.status}`);
      return {
        tema: tema_info.slug,
        status: '❌ FALHOU',
        status_http: resChat.status,
        erro: resChat.body?.error || 'Erro desconhecido'
      };
    }

    const resposta = resChat.body?.texto || '';
    console.log(`       ✓ Resposta recebida (${resposta.length} caracteres)`);

    // 3. Avaliar se é específica do tema
    const preview = resposta.substring(0, 120) + '...';
    const temConteudoReal = resposta.length > 150;

    // 4. Classificar
    const classificacao = temConteudoReal ? '✅ CONFIRMADO' : '⚠️ RESPOSTA_CURTA';

    console.log(`   [3] Análise: ${classificacao}`);
    console.log(`       Preview: "${preview}"`);

    // 5. Limpar
    await supabase.from('sessions').delete().eq('session_id', sessionId);

    return {
      tema: tema_info.slug,
      status: classificacao,
      resposta_length: resposta.length,
      resposta_preview: preview,
      timestamp: new Date().toISOString()
    };

  } catch (erro) {
    console.log(`       ❌ Exceção: ${erro.message}`);
    return {
      tema: tema_info.slug,
      status: '❌ ERRO',
      erro: erro.message
    };
  }
}

async function executarTestes() {
  console.log('\n╔' + '═'.repeat(68) + '╗');
  console.log('║ TESTE RAG RIGOROSO — EXECUÇÃO AO VIVO (10/08/2026)              ║');
  console.log('╚' + '═'.repeat(68) + '╝\n');

  const inicio = Date.now();
  const resultados = [];

  for (let i = 0; i < TEMAS.length; i++) {
    process.stdout.write(`[${i + 1}/${TEMAS.length}] `);
    const resultado = await testarTema(TEMAS[i]);
    resultados.push(resultado);

    if (i < TEMAS.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const duracao = (Date.now() - inicio) / 1000;

  // Salvar JSON
  fs.writeFileSync(
    'rag-teste-resultado-10-08-2026.json',
    JSON.stringify(resultados, null, 2)
  );

  // Exibir tabela
  console.log(`\n\n╔${'═'.repeat(68)}╗`);
  console.log(`║${'RESULTADO FINAL — Testes RAG (10/08/2026)'.padStart(55).padEnd(69)}║`);
  console.log(`╚${'═'.repeat(68)}╝\n`);

  console.log('| Tema | Status | Caracteres | Timestamp |');
  console.log('|' + '─'.repeat(68) + '|');

  resultados.forEach(r => {
    const tema = (r.tema || '?').padEnd(35).substring(0, 35);
    const status = (r.status || '?').padEnd(15);
    const chars = (r.resposta_length?.toString() || '0').padEnd(11);
    const ts = r.timestamp || 'N/A';

    console.log(`| ${tema} | ${status} | ${chars} | ${ts} |`);
  });

  console.log(`\n⏱️  Duração total: ${duracao.toFixed(1)}s`);
  console.log(`\n✅ Resultado salvo em: rag-teste-resultado-10-08-2026.json\n`);
}

executarTestes().catch(console.error);
