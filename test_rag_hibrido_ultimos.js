const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const adminKey = process.env.ADMIN_TEST_KEY;
const baseUrl = 'https://www.zunisuprema.com.br';

const supabase = createClient(supabaseUrl, supabaseKey);

const temas = [
  'sentimentos_adolescencia',
  'educar_filhos'
];

const mensagensTestePorTema = {
  sentimentos_adolescencia: 'Sinto várias coisas ao mesmo tempo e não consigo nomear o que estou sentindo. Tenho mudanças bruscas de humor que não entendo.',
  educar_filhos: 'Sinto que perdi a conexão com meu(minha) filho(a) adolescente. Não sei mais como me aproximar dele(a). O que fazer?'
};

const respostasTesteSimples = ['Opção A', 'Opção B', 'Opção A', 'Opção C', 'Opção A'];

async function testarTema(tema) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔬 TESTANDO TEMA: ${tema}`);
  console.log(`${'='.repeat(60)}\n`);

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
        message: mensagem
      })
    });

    if (!resChat.ok) {
      console.error('❌ Erro ao enviar chat:', await resChat.text());
      return false;
    }

    const dataChat = await resChat.json();
    console.log(`✅ Resposta do Mentor recebida\n`);
    console.log(`📝 Snippet da resposta:\n${dataChat.texto.substring(0, 200)}...\n`);

    // 5. Aguardar logs do Railway
    console.log('⏳ Aguardando 3 segundos para os logs do Railway registrarem...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`\n✅ TESTE CONCLUÍDO PARA: ${tema}`);
    console.log(`   SessionId: ${sessionId}`);
    console.log(`   BUSQUE NOS LOGS DO RAILWAY:`);
    console.log(`   railway logs --service zuni-suprema | grep "${tema}"`);
    console.log(`   ou`);
    console.log(`   railway logs --service zuni-suprema | grep "[RAG_HIBRIDO]"\n`);

    return { tema, sessionId, success: true };

  } catch (error) {
    console.error(`❌ ERRO em ${tema}:`, error.message);
    return { tema, success: false, error: error.message };
  }
}

async function rodarUltimosTestes() {
  console.log('\n🚀 TESTANDO ÚLTIMOS 2 TEMAS\n');

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

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RESUMO DOS TESTES:');
  console.log(`${'='.repeat(60)}\n`);

  resultados.forEach(r => {
    if (r.success) {
      console.log(`✅ ${r.tema} — SessionId: ${r.sessionId}`);
    } else {
      console.log(`❌ ${r.tema} — FALHOU: ${r.error}`);
    }
  });

  console.log(`\n${'='.repeat(60)}\n`);
}

rodarUltimosTestes();
