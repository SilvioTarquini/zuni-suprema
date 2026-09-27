// lib/email.js
//
// Ponto único de envio de e-mail transacional do projeto, via Resend
// (substituiu o SendGrid em 27/09/2026 — trial expirado em 13/08/2026,
// nenhum e-mail saía desde então). As 5 funções de e-mail do domínio
// (acesso a livro, síntese/dossiê do Mentor, brinde astro+numerologia,
// resultado da degustação, confirmação de Sessões Extras) chamam
// enviarEmail() em vez de falar com o provedor diretamente — nenhuma delas
// deve mais importar o SDK do Resend por conta própria.
//
// Contrato: nunca lança. Toda chamada devolve { sucesso, id, erro }. Falha
// (config ausente, erro do provedor, exceção de rede) gera um log
// [EMAIL_FALHOU] com o tipo do e-mail e o destinatário — nunca com token ou
// conteúdo sensível — e o erro real é devolvido em `erro` para quem chamou
// decidir o que fazer (nunca é engolido em silêncio).

const { Resend } = require('resend');

let resendClient = null;
function getClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

/**
 * @param {Object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.html
 * @param {Array<{filename: string, content: Buffer}>} [params.attachments]
 * @param {string} params.tipo - slug curto do tipo de e-mail, só para log (ex: 'acesso-livro')
 * @returns {Promise<{sucesso: boolean, id?: string, erro?: string}>}
 */
async function enviarEmail({ to, subject, html, attachments, tipo }) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    const erro = 'Resend não configurado (RESEND_API_KEY/RESEND_FROM_EMAIL ausentes)';
    console.error(`[EMAIL_FALHOU] tipo=${tipo} destinatario=${to} erro=${erro}`);
    return { sucesso: false, erro };
  }

  try {
    const { data, error } = await getClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to,
      subject,
      html,
      ...(attachments ? { attachments } : {}),
      ...(process.env.RESEND_REPLY_TO ? { reply_to: process.env.RESEND_REPLY_TO } : {})
    });

    if (error) {
      const mensagem = error.message || JSON.stringify(error);
      console.error(`[EMAIL_FALHOU] tipo=${tipo} destinatario=${to} erro=${mensagem}`);
      return { sucesso: false, erro: mensagem };
    }

    console.log(`[EMAIL] tipo=${tipo} destinatario=${to} id=${data.id}`);
    return { sucesso: true, id: data.id };
  } catch (err) {
    console.error(`[EMAIL_FALHOU] tipo=${tipo} destinatario=${to} erro=${err.message}`);
    return { sucesso: false, erro: err.message };
  }
}

module.exports = { enviarEmail };
