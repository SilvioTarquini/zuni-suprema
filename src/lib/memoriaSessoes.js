/**
 * Memória de Jornada do Mentor
 *
 * Salva resumos curtos de cada sessão (não a transcrição completa) vinculados ao email.
 * Quando um cliente retorna, os resumos anteriores podem ser injetados no prompt
 * para continuidade de jornada — mas apenas se MEMORIA_JORNADA_ATIVA=true.
 */

const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

const ATIVA = process.env.MEMORIA_JORNADA_ATIVA === 'true';

function assertSupabase() {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados.');
  }
  return supabase;
}

/**
 * Gera um resumo curto de uma sessão (poucas frases: temas, pontos-chave, encaminhamentos).
 * Chamado ao final de cada sessão do Mentor.
 *
 * @param {Object} session - Objeto da sessão com { history, email, name, sessionId }
 * @returns {Promise<string>} - Resumo curto da sessão
 */
async function gerarResumoSessao(session) {
  try {
    const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

    if (!session.history || session.history.length === 0) {
      return 'Sessão sem histórico.';
    }

    // Construir transcrição formatada
    const transcricao = session.history
      .map(h => `${h.role === 'user' ? 'CLIENTE' : 'MENTOR'}: ${h.message}`)
      .join('\n\n');

    // Pedir resumo ao Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: `Você é um resumidor de sessões de mentoria. Gere um resumo MUITO CURTO (2-3 frases) da sessão:
- Temas/questões principais tratadas
- Pontos-chave revelados ou padrões identificados
- Qualquer encaminhamento ou ação sugerida

Seja objetivo e preciso. Não escreva mais de 3 frases.`,
      messages: [
        {
          role: 'user',
          content: `Resuma esta sessão de mentoria:\n\n${transcricao}`
        }
      ]
    });

    const resumo = response.content[0].text;
    return resumo;
  } catch (error) {
    console.error('[MEMORIA] Erro ao gerar resumo:', error.message);
    return null;
  }
}

/**
 * Salva o resumo de uma sessão no banco de dados.
 * Executado em background após o final da sessão.
 *
 * @param {string} email - Email do cliente
 * @param {string} sessionId - ID da sessão
 * @param {string} resumo - Texto do resumo
 * @param {Object} session - Objeto com dados da sessão (para metadados)
 * @returns {Promise<void>}
 */
async function salvarResumoSessao({ email, sessionId, resumo, session }) {
  if (!ATIVA) {
    console.log('[MEMORIA] Desativada — resumo não será salvo');
    return;
  }

  if (!resumo) {
    console.log('[MEMORIA] Resumo vazio — não salvando');
    return;
  }

  try {
    const supabaseClient = assertSupabase();

    const { error } = await supabaseClient.from('resumos_sessoes').insert({
      email,
      session_id: sessionId,
      resumo,
      temas: session?.name || null, // Metadado opcional
      data_sessao: new Date().toISOString(),
      ativo: true
    });

    if (error) throw error;

    console.log(`[MEMORIA] Resumo salvo para ${email} (sessão ${sessionId})`);
  } catch (error) {
    console.error('[MEMORIA] Erro ao salvar resumo:', error.message);
    // Não falha a sessão — apenas loga
  }
}

/**
 * Busca resumos anteriores de um cliente (por email).
 * Retorna os N resumos mais recentes.
 *
 * @param {string} email - Email do cliente
 * @param {number} limite - Quantos resumos trazer (padrão: 3)
 * @returns {Promise<Array>} - Lista de resumos, ou array vazio se nenhum
 */
async function buscarResumosAnteriores(email, limite = 3) {
  if (!ATIVA) {
    return [];
  }

  if (!email) {
    return [];
  }

  try {
    const supabaseClient = assertSupabase();

    const { data, error } = await supabaseClient
      .from('resumos_sessoes')
      .select('*')
      .eq('email', email)
      .eq('ativo', true)
      .order('data_sessao', { ascending: false })
      .limit(limite);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('[MEMORIA] Erro ao buscar resumos:', error.message);
    return [];
  }
}

/**
 * Busca resumos apenas do pacote específico de "Sessões Extras"
 * Usado para memória de jornada DENTRO do pacote
 *
 * @param {Array} resumosDoPacote - Array retornado por buscarResumosDoPacko
 * @returns {Promise<string>} - System prompt com contexto do pacote
 */
function injetarContextoPacko(systemPromptBase, resumosDoPacote) {
  if (!resumosDoPacote || resumosDoPacote.length === 0) {
    return systemPromptBase;
  }

  const contextoBlocos = resumosDoPacote
    .map((r, i) => `**Sessão ${i + 1}** (${new Date(r.data_sessao).toLocaleDateString('pt-BR')}): ${r.resumo}`)
    .join('\n\n');

  const blocoContexto = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTO DE JORNADA — SESSÕES EXTRAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este é o pacote de Sessões Extras. Aqui está o contexto das sessões anteriores neste pacote:

${contextoBlocos}

Ao responder, reconheça implicitamente essa continuidade de jornada. Conecte os pontos entre o que foi revelado antes e o que está sendo trazido agora. Não cite explicitamente as sessões ("Na última sessão você...") — apenas use essas informações para aprofundar e evitar repetição.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return `${systemPromptBase}\n${blocoContexto}`;
}

/**
 * Injeta resumos anteriores no system prompt para continuidade de jornada.
 * Chamado ANTES de processar cada mensagem do cliente (se ele não é novo).
 *
 * @param {string} systemPromptBase - O SYSTEM_PROMPT padrão
 * @param {string} email - Email do cliente
 * @param {string} name - Nome do cliente (para personalização)
 * @returns {Promise<string>} - System prompt modificado ou original se flag desativada
 */
async function injetarContextoJornada(systemPromptBase, email, name) {
  if (!ATIVA) {
    return systemPromptBase;
  }

  const resumos = await buscarResumosAnteriores(email, 3);

  if (resumos.length === 0) {
    return systemPromptBase;
  }

  // Construir bloco de contexto de jornada
  const contextoBlocos = resumos
    .map((r, i) => `**Sessão ${i + 1}** (${new Date(r.data_sessao).toLocaleDateString('pt-BR')}): ${r.resumo}`)
    .join('\n\n');

  const blocoContexto = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTINUIDADE DE JORNADA — CONTEXTO DE SESSÕES ANTERIORES
━━━━━━━━━━━━━━━━━━━━━━━━━━━

${name} já passou por ${resumos.length} sessão(ões) com você. Aqui está o contexto de sua jornada:

${contextoBlocos}

Ao responder nesta sessão, reconheça implicitamente essa continuidade. Conecte os pontos entre o que foi revelado antes e o que está sendo trazido agora. Não cite explicitamente as sessões anteriores ("Na última sessão você...") — apenas use essas informações para aprofundar, fazer novas conexões e evitar repetir terreno já coberto.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return `${systemPromptBase}\n${blocoContexto}`;
}

module.exports = {
  gerarResumoSessao,
  salvarResumoSessao,
  buscarResumosAnteriores,
  injetarContextoJornada,
  injetarContextoPacko,
  MEMORIA_ATIVA: ATIVA
};
