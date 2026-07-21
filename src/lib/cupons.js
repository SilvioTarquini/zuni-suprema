// lib/cupons.js
//
// Cupons de desconto para a loja de livros. Dois tipos:
//   'sessao'   — gerado automaticamente ao fim de uma sessão do Mentor,
//                pessoal (ligado a um email), 30% sem teto, válido 7 dias,
//                uso múltiplo permitido dentro do prazo.
//   'campanha' — cadastrado manualmente (ex: ZUNI30), sem dono, 30% sem
//                teto em livros de categoria 'compacta' e 30% com teto de
//                R$15 em livros de categoria 'principal'.
//
// A validação (validarCupom) e o cálculo de desconto (calcularDesconto) são
// usados tanto pelo endpoint GET /api/validar-cupom (pré-visualização no
// checkout) quanto pelos endpoints que de fato criam a cobrança no Mercado
// Pago — o preço final é sempre recalculado no servidor a partir do cupom
// validado, nunca aceito pronto do cliente.

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

function assertSupabase() {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados para usar o Supabase.');
  }
  return supabase;
}

const DIAS_VALIDADE_CUPOM_SESSAO = 7;
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I, evita ambiguidade visual

function gerarSufixoAleatorio(tamanho) {
  const bytes = crypto.randomBytes(tamanho);
  let sufixo = '';
  for (let i = 0; i < tamanho; i++) {
    sufixo += ALFABETO_CODIGO[bytes[i] % ALFABETO_CODIGO.length];
  }
  return sufixo;
}

/**
 * Gera e persiste um cupom pessoal de sessão ("MENTOR-XXXXXX"), 30% sem
 * teto, válido por 7 dias, uso múltiplo permitido dentro do prazo.
 * Deve ser chamado uma vez por sessão encerrada (ver gerarEEnviarRelatorio).
 *
 * @param {Object} params
 * @param {string} params.email - email do comprador da sessão
 * @returns {Promise<{codigo: string, expiraEm: Date}>}
 */
async function criarCupomSessao({ email }) {
  const supabaseClient = assertSupabase();
  const expiraEm = new Date(Date.now() + DIAS_VALIDADE_CUPOM_SESSAO * 24 * 60 * 60 * 1000);

  // Colisão de código é extremamente improvável (33^6 combinações), mas a
  // tabela tem UNIQUE(codigo) — em caso de conflito, tenta de novo.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = `MENTOR-${gerarSufixoAleatorio(6)}`;

    const { error } = await supabaseClient.from('cupons_desconto').insert({
      codigo,
      tipo: 'sessao',
      percentual: 30,
      teto_reais: null,
      email_cliente: email,
      expira_em: expiraEm.toISOString()
    });

    if (!error) {
      return { codigo, expiraEm };
    }

    if (error.code !== '23505') { // unique_violation
      throw new Error(`Falha ao gerar cupom de sessão: ${error.message}`);
    }
  }

  throw new Error('Falha ao gerar cupom de sessão: colisões de código consecutivas.');
}

/**
 * Valida um código de cupom: existe e não expirou (cupons sem expira_em,
 * como campanhas, não expiram). Marca usado_em na primeira validação
 * bem-sucedida, só para fins de auditoria — não bloqueia reuso.
 *
 * @param {string} codigo
 * @returns {Promise<{codigo: string, tipo: string, percentual: number, teto_reais: number|null}|null>}
 */
async function validarCupom(codigo) {
  if (!codigo || typeof codigo !== 'string') return null;
  const supabaseClient = assertSupabase();
  const codigoNormalizado = codigo.trim().toUpperCase();
  if (!codigoNormalizado) return null;

  const { data, error } = await supabaseClient
    .from('cupons_desconto')
    .select('*')
    .eq('codigo', codigoNormalizado)
    .maybeSingle();

  if (error || !data) return null;

  if (data.expira_em && new Date(data.expira_em).getTime() < Date.now()) {
    return null;
  }

  if (!data.usado_em) {
    await supabaseClient
      .from('cupons_desconto')
      .update({ usado_em: new Date().toISOString() })
      .eq('codigo', codigoNormalizado);
  }

  return {
    codigo: data.codigo,
    tipo: data.tipo,
    percentual: Number(data.percentual),
    teto_reais: data.teto_reais === null ? null : Number(data.teto_reais)
  };
}

/**
 * Calcula o preço final de um livro dado um cupom já validado.
 * Regra: 'sessao' = percentual sem teto em qualquer categoria;
 * 'campanha' = percentual sem teto em 'compacta', com teto_reais em
 * 'principal' e 'saude-longevidade'.
 *
 * @param {{preco: number, categoria: string}} livro
 * @param {{tipo: string, percentual: number, teto_reais: number|null}} cupom
 * @returns {{precoOriginal: number, desconto: number, precoFinal: number}}
 */
function calcularDesconto(livro, cupom) {
  const descontoIntegral = livro.preco * (cupom.percentual / 100);

  const semTeto = cupom.tipo === 'sessao' || livro.categoria === 'compacta';
  const desconto = semTeto || cupom.teto_reais === null
    ? descontoIntegral
    : Math.min(descontoIntegral, cupom.teto_reais);

  const precoFinal = Math.max(0, Math.round((livro.preco - desconto) * 100) / 100);

  return {
    precoOriginal: livro.preco,
    desconto: Math.round(desconto * 100) / 100,
    precoFinal
  };
}

module.exports = { criarCupomSessao, validarCupom, calcularDesconto, DIAS_VALIDADE_CUPOM_SESSAO };
