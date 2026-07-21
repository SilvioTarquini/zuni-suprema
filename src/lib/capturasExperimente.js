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

    // Processar interpretação para HTML (quebras de linha e negrito)
    const interpretacaoHTML = interpretacao
      ? interpretacao
          .split('\n\n')
          .map(paragrafo => {
            return `<p style="margin: 16px 0; line-height: 1.7;">${paragrafo
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/\n/g, '<br/>')}</p>`;
          })
          .join('')
      : '<p>Número singular com potencial único.</p>';

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Seu Perfil Numerológico — ZUNI Suprema</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 650px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a3e 0%, #3d3d66 100%); color: #d4af37; padding: 30px; text-align: center; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .header h1 { margin: 0; font-size: 32px; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.95; }
    .content { background: #f9f9f9; padding: 30px; margin-top: 20px; border-radius: 8px; }
    .intro { margin-bottom: 25px; font-size: 15px; color: #555; }
    .numero-box { background: white; border-left: 4px solid #d4af37; padding: 20px; margin: 20px 0; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
    .numero-label { color: #d4af37; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 8px; }
    .numero-valor { font-size: 42px; color: #1a1a3e; font-weight: bold; margin-bottom: 12px; }
    .numero-texto { color: #555; font-size: 14px; line-height: 1.8; }
    .proximo-passo { background: linear-gradient(135deg, #f5f9ff 0%, #f0f7ff 100%); border-left: 4px solid #d4af37; padding: 20px; margin-top: 25px; border-radius: 6px; }
    .proximo-passo-label { color: #d4af37; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 10px; }
    .proximo-passo-texto { color: #555; font-size: 14px; line-height: 1.8; font-style: italic; }
    .cta-section { margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    .cta-section p { color: #1a1a3e; font-weight: 600; margin-bottom: 15px; }
    .cta-button { display: inline-block; background: #d4af37; color: #1a1a3e; padding: 12px 28px; text-decoration: none; border-radius: 4px; font-weight: 600; margin: 8px 5px; font-size: 14px; transition: background 0.3s; }
    .cta-button:hover { background: #c9a02a; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    .footer a { color: #d4af37; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Seu Perfil Numerológico</h1>
      <p>Descubra a energia que flui através de você</p>
    </div>

    <div class="content">
      <p class="intro">Olá <strong>${nomeCompleto}</strong>,</p>
      <p class="intro">Obrigado por experimentar a ZUNI Suprema! Aqui está sua análise numerológica completa:</p>

      <div class="numero-box">
        <div class="numero-label">Seu Caminho de Vida</div>
        <div class="numero-valor">${caminhoDeVida}</div>
        <div class="numero-texto">${interpretacao ? interpretacao.split('\n\n')[0] : 'Seu caminho de vida e propósito.'}</div>
      </div>

      <div class="numero-box">
        <div class="numero-label">Seu Número da Essência</div>
        <div class="numero-valor">${essencia}</div>
        <div class="numero-texto">${interpretacao ? interpretacao.split('\n\n')[1] : 'Sua energia fundamental.'}</div>
      </div>

      <div class="proximo-passo">
        <div class="proximo-passo-label">Próximo Passo</div>
        <div class="proximo-passo-texto">${interpretacao ? interpretacao.split('\n\n')[2] : 'Descubra as camadas adicionais de sua essência no Mapa Integrado ZUNI.'}</div>
      </div>

      <div class="cta-section">
        <p>Pronto para aprofundar a experiência?</p>
        <a href="https://zunisuprema.com.br/mentor" class="cta-button">💬 Chat com Mentor (R$ 29,90)</a>
        <a href="https://zunisuprema.com.br/loja/livros" class="cta-button">📚 Livros Vivos (R$ 57,90)</a>
        <a href="https://zunisuprema.com.br/mapa-integrado" class="cta-button">🌟 Mapa Integrado</a>
      </div>
    </div>

    <div class="footer">
      <p>© 2026 ZUNI Suprema. Explorando astrologia, numerologia e autoconhecimento.</p>
      <p><a href="https://zunisuprema.com.br/privacidade">Política de Privacidade</a> | <a href="https://zunisuprema.com.br/termos">Termos de Uso</a></p>
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
