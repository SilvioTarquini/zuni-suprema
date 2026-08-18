const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const adminKey = process.env.ADMIN_TEST_KEY;
const baseUrl = 'https://www.zunisuprema.com.br';

const supabase = createClient(supabaseUrl, supabaseKey);

const temas = [
  'elegancia_charme_feminino',
  'elegancia_presenca_masculina'
];

const mensagensTestePorTema = {
  elegancia_charme_feminino: 'Como desenvolver mais elegância e charme como mulher? Quais são as principais características que uma mulher elegante deve cultivar?',
  elegancia_presenca_masculina: 'Como desenvolver mais presença e elegância como homem? Quais qualidades um homem elegante deve ter?'
};

const respostasTesteSimples = ['Opção A', 'Opção B', 'Opção A', 'Opção C', 'Opção A'];

async function testarTema(tema) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔬 TESTANDO TEMA: ${tema}`);
  console.log(`${'='.repeat(70)}\n`);

  try {
    // 1. Iniciar sessão
    console.log('1️⃣  Iniciando sessão...');
    const resIniciar = await fetch(`${baseUrl}/api/sessao/iniciar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey
      },
      body: JSON.stringify({
        name: `Teste ${tema}`,
        email: `teste-${tema}-${Date.now()}@test.local`
      })
    });

    if (!resIniciar.ok) {
      console.error('❌ Erro ao iniciar sessão:', await resIniciar.text());
      return false;
    }

    const dataIniciar = await resIniciar.json();
    const sessionId = dataIniciar.sessionId;
    console.log(`✅ Sessão iniciada: ${sessionId}\n`);

    // 2. Salvar respostas do questionário
    console.log('2️⃣  Salvando respostas do questionário...');
    const resRespostas = await fetch(`${baseUrl}/api/questionario/salvar-respostas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        tema,
        respostas: respostasTesteSimples
      })
    });

    if (!resRespostas.ok) {
      console.error('❌ Erro ao salvar respostas:', await resRespostas.text());
      return false;
    }

    console.log(`✅ Respostas salvas para tema: ${tema}\n`);

    // 3. Marcar sessão como paid via Supabase
    console.log('3️⃣  Marcando sessão como paid...');
    const { data: sessionData, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (fetchError) {
      console.error('❌ Erro ao buscar sessão:', fetchError.message);
      return false;
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({ paid: true })
      .eq('session_id', sessionId);

    if (updateError) {
      console.error('❌ Erro ao marcar como paid:', updateError.message);
      return false;
    }

    console.log(`✅ Sessão marcada como paid\n`);

    // 4. Enviar mensagem de chat
    console.log('4️⃣  Enviando mensagem de chat...');
    const mensagem = mensagensTestePorTema[tema];
    const resChat = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        tema_questionario: tema,
        message: mensagem
      })
    });

    if (!resChat.ok) {
      console.error('❌ Erro ao enviar chat:', await resChat.text());
      return false;
    }

    const dataChat = await resChat.json();
    console.log(`✅ Resposta do Mentor recebida\n`);

    // Debug: mostrar toda a resposta JSON
    const respostaTexto = dataChat.texto || dataChat.response || dataChat.resposta || JSON.stringify(dataChat, null, 2);
    console.log(`📝 RESPOSTA COMPLETA DO MENTOR:\n`);
    if (typeof respostaTexto === 'string') {
      console.log(`${respostaTexto}\n`);
    } else {
      console.log(`${JSON.stringify(respostaTexto, null, 2)}\n`);
    }

    // 5. Aguardar logs do Railway
    console.log('⏳ Aguardando 3 segundos para os logs do Railway registrarem...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`\n✅ TESTE CONCLUÍDO PARA: ${tema}`);
    console.log(`   SessionId: ${sessionId}`);
    console.log(`   Mensagem enviada: ${mensagem.substring(0, 60)}...`);
    console.log(`   BUSQUE NOS LOGS DO RAILWAY:`);
    console.log(`   railway logs --service zuni-suprema | grep "${tema}"`);
    console.log(`   ou`);
    console.log(`   railway logs --service zuni-suprema | grep "[RAG_HIBRIDO]"\n`);

    return { tema, sessionId, success: true, resposta: respostaTexto };

  } catch (error) {
    console.error(`❌ ERRO em ${tema}:`, error.message);
    return { tema, success: false, error: error.message };
  }
}

async function rodarTodosTestes() {
  console.log('\n🚀 INICIANDO TESTES DOS NOVOS TEMAS DE ELEGÂNCIA\n');
  console.log('Temas a testar:');
  console.log('  1. elegancia_charme_feminino (174 chunks)');
  console.log('  2. elegancia_presenca_masculina (58 chunks)\n');

  const resultados = [];

  for (const tema of temas) {
    const resultado = await testarTema(tema);
    resultados.push(resultado);

    if (!resultado.success) {
      console.log(`\n⚠️  Teste de ${tema} FALHOU. Parando aqui.`);
      break;
    }

    // Aguardar 2 segundos entre testes para evitar throttling
    console.log(`\n⏳ Aguardando 2 segundos antes do próximo teste...\n`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 RESUMO DOS TESTES:');
  console.log(`${'='.repeat(70)}\n`);

  resultados.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.tema}`);
      console.log(`   SessionId: ${r.sessionId}`);
      const preview = typeof r.resposta === 'string'
        ? r.resposta.substring(0, 100)
        : String(r.resposta).substring(0, 100);
      console.log(`   Resposta: ${preview}...\n`);
    } else {
      console.log(`❌ ${r.tema} — FALHOU: ${r.error}\n`);
    }
  });

  console.log(`${'='.repeat(70)}\n`);
}

rodarTodosTestes();
