// lib/estornoStripe.js
//
// Revoga o acesso quando um pagamento do Stripe é estornado
// (charge.refunded) ou contestado (charge.dispute.created). O Stripe não
// manda o id da Checkout Session nesses eventos — só o payment_intent —, então
// a sessão é localizada por checkout.sessions.list({ payment_intent }).
//
// Revogar NÃO apaga nada:
//  - livro/audiolivro: acessos_livros.revogado_em + motivo_revogacao
//    (linhas payment_id = <cs_...> e <cs_...>-audiolivro);
//  - ZUNI Direciona: sessions.paid = false + sessions.estornado_em
//    (o histórico do chat e o relatório ficam).
//
// Idempotente: reentrega do evento (ou estorno + disputa do mesmo
// pagamento) só atualiza linhas ainda não revogadas, e o e-mail de aviso só sai
// quando alguma linha foi de fato revogada.
//
// Marcadores de log: [ESTORNO_ACESSO_REVOGADO] (revogou), [ESTORNO_PARCIAL]
// (estorno parcial — nada revogado, só aviso), [ESTORNO_SEM_PEDIDO] (não achou
// pedido), [ESTORNO_SEM_EFEITO] (já estava revogado). Nunca loga e-mail nem
// token; o e-mail de aviso interno (zunisuprema@gmail.com) pode citar o
// comprador porque é uma caixa nossa.

const EMAIL_AVISO_INTERNO = process.env.AVISO_ESTORNO_EMAIL || 'zunisuprema@gmail.com';

function reais(centavos) {
  return `R$ ${(Number(centavos || 0) / 100).toFixed(2).replace('.', ',')}`;
}

function curto(id) {
  return String(id || '').slice(0, 14);
}

async function localizarCheckoutSession(stripeClient, paymentIntentId) {
  const lista = await stripeClient.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
  return lista.data[0] || null;
}

async function revogarLivro(supabase, checkoutSessionId, motivo) {
  const { data, error } = await supabase
    .from('acessos_livros')
    .update({ revogado_em: new Date().toISOString(), motivo_revogacao: motivo })
    .in('payment_id', [checkoutSessionId, `${checkoutSessionId}-audiolivro`])
    .is('revogado_em', null)
    .select('id, tipo_produto, livro_id');
  if (error) throw new Error(`falha ao revogar acessos_livros: ${error.message}`);
  return data || [];
}

async function revogarSessaoChat(supabase, checkoutSessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .update({ paid: false, estornado_em: new Date().toISOString() })
    .eq('stripe_session_id', checkoutSessionId)
    .is('estornado_em', null)
    .select('session_id');
  if (error) throw new Error(`falha ao revogar sessions: ${error.message}`);
  return data || [];
}

function montarEmail({ titulo, linhas }) {
  const itens = linhas.map(l => `<li>${l}</li>`).join('');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#222"><h3>${titulo}</h3><ul>${itens}</ul></div>`;
}

/**
 * @param {Object} event - evento do Stripe (charge.refunded | charge.dispute.created)
 * @param {Object} deps - { stripeClient, supabase, enviarEmail }
 * @returns {Promise<{acao: string, linhas?: number}>}
 */
async function processarEstorno(event, { stripeClient, supabase, enviarEmail }) {
  const objeto = event.data.object;
  const ehDisputa = event.type === 'charge.dispute.created';
  const motivo = ehDisputa ? 'disputa' : 'estorno';
  const paymentIntentId = objeto.payment_intent;
  const valor = ehDisputa ? objeto.amount : objeto.amount_refunded;
  const chargeId = ehDisputa ? objeto.charge : objeto.id;

  // Estorno parcial: o cliente ainda pagou parte do produto — não revoga.
  if (!ehDisputa && !objeto.refunded) {
    console.log(`[ESTORNO_PARCIAL] charge=${curto(chargeId)} estornado=${reais(valor)} de ${reais(objeto.amount)} — acesso mantido.`);
    await enviarEmail({
      to: EMAIL_AVISO_INTERNO,
      subject: '[ZUNI] Estorno PARCIAL no Stripe — acesso mantido',
      html: montarEmail({
        titulo: 'Estorno parcial — nenhum acesso foi revogado',
        linhas: [`Charge: ${chargeId}`, `Estornado: ${reais(valor)} de ${reais(objeto.amount)}`, 'Se for para revogar, faça manualmente.']
      }),
      tipo: 'estorno-parcial'
    });
    return { acao: 'parcial' };
  }

  if (!paymentIntentId) {
    console.error(`[ESTORNO_SEM_PEDIDO] evento ${event.type} sem payment_intent (charge=${curto(chargeId)}).`);
    return { acao: 'sem-payment-intent' };
  }

  const cs = await localizarCheckoutSession(stripeClient, paymentIntentId);
  if (!cs) {
    console.error(`[ESTORNO_SEM_PEDIDO] nenhuma Checkout Session para payment_intent=${curto(paymentIntentId)} (charge=${curto(chargeId)}).`);
    await enviarEmail({
      to: EMAIL_AVISO_INTERNO,
      subject: `[ZUNI] ${ehDisputa ? 'Disputa' : 'Estorno'} no Stripe sem pedido localizado`,
      html: montarEmail({
        titulo: 'Nenhum pedido foi localizado — nenhum acesso revogado',
        linhas: [`Charge: ${chargeId}`, `Payment intent: ${paymentIntentId}`, `Valor: ${reais(valor)}`]
      }),
      tipo: 'estorno-sem-pedido'
    });
    return { acao: 'sem-pedido' };
  }

  const tipo = cs.metadata?.fulfillment_type;
  let revogadas;
  if (tipo === 'livro') {
    revogadas = await revogarLivro(supabase, cs.id, motivo);
  } else if (tipo === 'chat-mentor') {
    revogadas = await revogarSessaoChat(supabase, cs.id);
  } else {
    console.error(`[ESTORNO_SEM_PEDIDO] fulfillment_type "${tipo}" não tratado (sessao=${curto(cs.id)}).`);
    return { acao: 'tipo-desconhecido' };
  }

  if (revogadas.length === 0) {
    console.log(`[ESTORNO_SEM_EFEITO] tipo=${tipo} motivo=${motivo} sessao=${curto(cs.id)} — nada novo a revogar (já revogado ou sem linha).`);
    return { acao: 'sem-efeito', linhas: 0 };
  }

  console.log(`[ESTORNO_ACESSO_REVOGADO] tipo=${tipo} motivo=${motivo} sessao=${curto(cs.id)} linhas=${revogadas.length}`);
  await enviarEmail({
    to: EMAIL_AVISO_INTERNO,
    subject: `[ZUNI] Acesso revogado por ${motivo} — ${tipo === 'livro' ? 'livro' : 'ZUNI Direciona'}`,
    html: montarEmail({
      titulo: `Acesso revogado por ${motivo}`,
      linhas: [
        `Produto: ${tipo === 'livro' ? 'livro (acesso e audiolivro, se houver)' : 'ZUNI Direciona (sessão)'}`,
        `Comprador: ${cs.customer_details?.email || cs.customer_email || '(não informado)'}`,
        `Valor: ${reais(valor)}`,
        `Checkout Session: ${cs.id}`,
        `Charge: ${chargeId}`,
        `Linhas revogadas: ${revogadas.length}`,
        'Nada foi apagado — os registros ficam, só o acesso foi bloqueado.'
      ]
    }),
    tipo: 'estorno-acesso'
  });
  return { acao: 'revogado', linhas: revogadas.length };
}

module.exports = { processarEstorno };
