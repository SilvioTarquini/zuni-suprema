const sgMail = require('@sendgrid/mail');
const { createClient } = require('@supabase/supabase-js');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Envia e-mail via SendGrid com resultado da numerologia
 * E-mail contém: Caminho de Vida, Essência, Interpretação, links para produtos
 */
async function enviarResultadoNumerologia(email, nomeCompleto, resultado) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY não configurada; e-mail não será enviado');
    return { sucesso: false, mensagem: 'SendGrid não configurado' };
  }

  try {
    const { caminhoDeVida, essencia, interpretacao } = resultado;

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Seu Perfil Numerológico — ZUNI Suprema</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a3e 0%, #3d3d66 100%); color: #d4af37; padding: 30px; text-align: center; border-radius: 8px; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: #f9f9f9; padding: 30px; margin-top: 20px; border-radius: 8px; }
    .numero-box { background: white; border-left: 4px solid #d4af37; padding: 15px; margin: 15px 0; border-radius: 4px; }
    .numero-valor { font-size: 36px; color: #1a1a3e; font-weight: bold; }
    .numero-label { color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .interpretacao { background: white; padding: 20px; margin-top: 20px; border-radius: 4px; line-height: 1.6; }
    .cta-section { margin-top: 30px; text-align: center; }
    .cta-button { display: inline-block; background: #d4af37; color: #1a1a3e; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 10px 5px; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Seu Perfil Numerológico</h1>
      <p>Descubra a energia que flui através de você</p>
    </div>

    <div class="content">
      <p>Olá <strong>${nomeCompleto}</strong>,</p>
      <p>Obrigado por experimentar a ZUNI Suprema! Aqui está sua análise numerológica:</p>

      <div class="numero-box">
        <div class="numero-label">Caminho de Vida</div>
        <div class="numero-valor">${caminhoDeVida}</div>
        <p>Este é o número que define seu propósito e jornada nesta vida.</p>
      </div>

      <div class="numero-box">
        <div class="numero-label">Número da Essência</div>
        <div class="numero-valor">${essencia}</div>
        <p>Representa a sua energia fundamental e características inatas.</p>
      </div>

      <div class="interpretacao">
        <strong>Sua essência numerológica:</strong>
        <p>${interpretacao || 'Número singular com potencial único.'}</p>
      </div>

      <div class="cta-section">
        <p><strong>Gostou? Aprofunde a experiência ZUNI:</strong></p>
        <a href="https://zunisuprema.com.br/mentor" class="cta-button">Chat com Mentor (R$ 29,90)</a>
        <a href="https://zunisuprema.com.br/loja/livros" class="cta-button">Livros Vivos (R$ 57,90)</a>
        <a href="https://zunisuprema.com.br/mapa-integrado" class="cta-button">Mapa Integrado</a>
      </div>
    </div>

    <div class="footer">
      <p>© 2026 ZUNI Suprema. Explorando astrologia, numerologia e autoconhecimento.</p>
      <p><a href="https://zunisuprema.com.br/privacidade" style="color: #999; text-decoration: none;">Política de Privacidade</a></p>
    </div>
  </div>
</body>
</html>
    `;

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@zunisuprema.com.br',
      subject: '✨ Seu Perfil Numerológico — ZUNI Suprema',
      html: htmlContent
    };

    await sgMail.send(msg);

    console.log(`E-mail enviado para ${email}`);
    return { sucesso: true, mensagem: 'E-mail enviado com sucesso' };
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err);
    return { sucesso: false, mensagem: 'Erro ao enviar e-mail' };
  }
}

/**
 * Registra captura de lead na tabela capturasExperimente
 * Armazena: email, nome, data nascimento, resultado numerologia, timestamp
 */
async function registrarCaptura(nomeCompleto, dataNascimento, email, resultado, codigo) {
  if (!supabase) {
    console.warn('Supabase não configurado; captura não será registrada');
    return;
  }

  try {
    const { error } = await supabase
      .from('capturasExperimente')
      .insert({
        nome_completo: nomeCompleto,
        data_nascimento: dataNascimento,
        email,
        caminho_de_vida: resultado.caminhoDeVida,
        essencia: resultado.essencia,
        codigo_usado: codigo,
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('Erro ao registrar captura:', error);
    }
  } catch (err) {
    console.error('Erro ao registrar captura:', err);
    // Não faz throw; é apenas registro, não deve derrubar o fluxo
  }
}

module.exports = {
  enviarResultadoNumerologia,
  registrarCaptura
};
