const { createClient } = require('@supabase/supabase-js');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

function assertSupabase() {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados.');
  }
  return supabase;
}

/**
 * Valida um código-convite
 * Validação case-insensitive: aceita "Experimente", "experimente", "EXPERIMENTE"
 * Retorna: { valido: bool, ativo: bool, mensagem: string, validadeAte?: date }
 */
async function validarCodigo(codigo) {
  try {
    const db = assertSupabase();
    // Buscar todos os códigos e fazer comparação case-insensitive em memória
    // (Supabase RLS pode usar ILIKE, mas direct eq + toLowerCase é mais simples)
    const { data: todosCodigos, error: erroLista } = await db
      .from('codigos_experimente')
      .select('*');

    if (erroLista) {
      throw erroLista;
    }

    // Buscar código correspondente (case-insensitive)
    const codigoNormalizado = codigo.toLowerCase().trim();
    const data = todosCodigos.find(c => c.codigo.toLowerCase() === codigoNormalizado);

    if (error || !data) {
      return {
        valido: false,
        ativo: false,
        mensagem: 'Código não encontrado ou inválido.'
      };
    }

    const agora = new Date();
    const validadeAte = data.validade_ate ? new Date(data.validade_ate) : null;
    const expirado = validadeAte && agora > validadeAte;

    if (expirado) {
      return {
        valido: false,
        ativo: false,
        mensagem: `Código expirou em ${validadeAte.toLocaleDateString('pt-BR')}.`,
        validadeAte
      };
    }

    if (!data.ativo) {
      return {
        valido: false,
        ativo: false,
        mensagem: 'Código desativado.'
      };
    }

    return {
      valido: true,
      ativo: true,
      mensagem: 'Código válido!',
      validadeAte,
      origem: data.origem
    };
  } catch (err) {
    console.error('Erro ao validar código:', err);
    throw err;
  }
}

/**
 * Registra acesso (para métricas de campanha)
 * Opcional: registra em tabela acessos_experimente
 */
async function registrarAcesso(codigo, ipOrigem, emailCapturado = null) {
  try {
    const db = assertSupabase();

    // Buscar código (case-insensitive)
    const { data: todosCodigos } = await db
      .from('codigos_experimente')
      .select('id, total_acessos, emails_capturados, codigo');

    const codigoNormalizado = codigo.toLowerCase().trim();
    const codigoData = todosCodigos?.find(c => c.codigo.toLowerCase() === codigoNormalizado);

    if (!codigoData) {
      console.warn(`Código ${codigo} não encontrado para registrar acesso`);
      return;
    }

    // Atualizar contadores na tabela principal
    const novosTotalAcessos = (codigoData.total_acessos || 0) + 1;
    const novosEmailsCapturados = emailCapturado
      ? (codigoData.emails_capturados || 0) + 1
      : codigoData.emails_capturados || 0;

    await db
      .from('codigos_experimente')
      .update({
        total_acessos: novosTotalAcessos,
        emails_capturados: novosEmailsCapturados,
        atualizado_em: new Date().toISOString()
      })
      .eq('id', codigoData.id);

    // Registrar na tabela acessos_experimente (opcional, para granularidade)
    if (process.env.REGISTRAR_ACESSOS_EXPERIMENTE === 'true') {
      await db
        .from('acessos_experimente')
        .insert({
          codigo_id: codigoData.id,
          ip_origem: ipOrigem,
          timestamp: new Date().toISOString(),
          email_capturado: emailCapturado
        });
    }
  } catch (err) {
    console.error('Erro ao registrar acesso:', err);
    // Não faz throw; é apenas métrica, não deve derrubar o fluxo
  }
}

/**
 * Cria um novo código-convite (admin)
 */
async function criarCodigo(codigo, validadeAte, origem = null) {
  try {
    const db = assertSupabase();
    const { data, error } = await db
      .from('codigos_experimente')
      .insert({
        codigo: codigo.toUpperCase().trim(),
        ativo: true,
        validade_ate: validadeAte,
        origem,
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        total_acessos: 0,
        emails_capturados: 0
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao criar código:', err);
    throw err;
  }
}

/**
 * Desativa um código-convite (admin) - case-insensitive
 */
async function desativarCodigo(codigo) {
  try {
    const db = assertSupabase();

    // Buscar código (case-insensitive)
    const { data: todosCodigos } = await db
      .from('codigos_experimente')
      .select('id, codigo');

    const codigoNormalizado = codigo.toLowerCase().trim();
    const codigoData = todosCodigos?.find(c => c.codigo.toLowerCase() === codigoNormalizado);

    if (!codigoData) {
      throw new Error('Código não encontrado');
    }

    const { data, error } = await db
      .from('codigos_experimente')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', codigoData.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao desativar código:', err);
    throw err;
  }
}

module.exports = {
  validarCodigo,
  registrarAcesso,
  criarCodigo,
  desativarCodigo
};
