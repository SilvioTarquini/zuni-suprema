const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const adminKey = process.env.ADMIN_TEST_KEY;
const baseUrl = 'https://www.zunisuprema.com.br';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  try {
    // 1. Iniciar sessão
    const resIniciar = await fetch(`${baseUrl}/api/sessao/iniciar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': adminKey
      },
      body: JSON.stringify({
        name: `Debug JSON`,
        email: `debug-${Date.now()}@test.local`
      })
    });

    const dataIniciar = await resIniciar.json();
    const sessionId = dataIniciar.sessionId;

    // 2. Marcar como paid
    await supabase
      .from('sessions')
      .update({ paid: true })
      .eq('session_id', sessionId);

    // 3. Enviar chat
    const resChat = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId,
        tema_questionario: 'elegancia_charme_feminino',
        message: 'Teste'
      })
    });

    const dataChat = await resChat.json();

    console.log('\n=== ESTRUTURA JSON DA RESPOSTA /api/chat ===\n');
    console.log(JSON.stringify(dataChat, null, 2));

  } catch (error) {
    console.error('Erro:', error.message);
  }
}

debug();
