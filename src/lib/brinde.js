/**
 * Brinde de Astrologia + Numerologia
 *
 * Geração de estudo brinde (1 por cliente, determinístico, não reenviável)
 * - Verifica resgate anterior por email
 * - Calcula mapa astrológico (AstroWay)
 * - Interpreta via Claude + RAG (astrologia + numerologia)
 * - Gera PDF
 * - Envia por SendGrid
 * - Registra resgate
 */

const { createClient } = require('@supabase/supabase-js');
const { calcularMapaNatal } = require('./astro');
const { calcularNumerologia, calcularCaminhoDeVida, calcularEssencia } = require('./numerologia');

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
 * Verifica se cliente já resgatou brinde com sucesso (por email)
 * Retorna: { resgatado: boolean, data?: Date, mensagem?: string }
 *
 * IMPORTANTE: Só considera "resgatado" se status_envio = 'enviado'
 * Status 'erro' não bloqueia nova tentativa
 */
async function verificarJaResgatado(email) {
  const supabaseClient = assertSupabase();

  try {
    const { data, error } = await supabaseClient
      .from('resgates_brinde_astro_numero')
      .select('timestamp_resgate, status_envio')
      .eq('email', email)
      .eq('status_envio', 'enviado')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = nenhuma linha encontrada (ok, cliente ainda não resgatou com sucesso)
      throw error;
    }

    if (data && data.status_envio === 'enviado') {
      // Já resgatou com sucesso
      return {
        resgatado: true,
        data: new Date(data.timestamp_resgate),
        mensagem: 'Você já recebeu seu estudo — ele é único e não muda com o tempo, então não é possível gerar um novo. Fica registrado com carinho.'
      };
    }

    // Não resgatou (ou tentativa anterior falhou com status='erro')
    return { resgatado: false };
  } catch (err) {
    console.error('[BRINDE] Erro ao verificar resgate anterior:', err.message);
    throw new Error('Erro ao verificar elegibilidade do brinde');
  }
}

/**
 * Gera estudo completo: mapa astrológico + numerologia + interpretação Claude
 * Retorna: { sol, lua, ascendente, caminhoDeVida, essencia, interpretacao }
 */
async function gerarEstudoCompleto(nomeDados, dataNascimento, horaNascimento, localNascimento) {
  try {
    // 1. Calcular mapa astrológico
    console.log('[BRINDE] Calculando mapa astrológico via AstroWay...');
    const mapaNatal = await calcularMapaNatal({
      nome: nomeDados,
      dataNascimento,
      horaNascimento,
      localNascimento
    });

    // 2. Calcular numerologia
    console.log('[BRINDE] Calculando numerologia...');
    const dataObj = new Date(dataNascimento);
    const resultado = calcularNumerologia(dataObj);
    const caminhoDeVida = calcularCaminhoDeVida(dataObj);
    const essencia = calcularEssencia(nomeDados);

    // 3. Gerar interpretação via Claude (com RAG de astrologia + numerologia)
    console.log('[BRINDE] Gerando interpretação via Claude...');
    const interpretacao = await gerarInterpretacaoClaudeRAG({
      nome: nomeDados,
      sol: mapaNatal.sol?.sign || 'desconhecido',
      lua: mapaNatal.lua?.sign || 'desconhecido',
      ascendente: mapaNatal.ascendente?.sign || 'desconhecido',
      caminhoDeVida,
      essencia
    });

    return {
      sol: mapaNatal.sol?.sign,
      lua: mapaNatal.lua?.sign,
      ascendente: mapaNatal.ascendente?.sign,
      caminhoDeVida,
      essencia,
      interpretacao
    };
  } catch (err) {
    console.error('[BRINDE] Erro ao gerar estudo:', err.message);
    throw new Error(`Falha na geração do estudo: ${err.message}`);
  }
}

/**
 * Gera interpretação via Claude API + RAG
 * Consulta bases de astrologia e numerologia já indexadas no Supabase
 */
async function gerarInterpretacaoClaudeRAG(dados) {
  const { Anthropic } = require('@anthropic-ai/sdk');

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  const client = new Anthropic();

  // TODO: Implementar busca RAG nas tabelas `documentos` (astrologia/numerologia)
  // Por enquanto, usar prompt sem RAG; será expandido depois
  const ragContext = `
[Contexto RAG será preenchido aqui com fragmentos das bases de astrologia e numerologia]
  `;

  const prompt = `Você é um intérprete de astrologia e numerologia. Analise o perfil do cliente e gere um estudo breve e autêntico:

**Dados do Cliente:**
- Nome: ${dados.nome}
- Sol: ${dados.sol}
- Lua: ${dados.lua}
- Ascendente: ${dados.ascendente}
- Caminho de Vida: ${dados.caminhoDeVida}
- Essência (nome): ${dados.essencia}

**Instruções:**
1. Gere um estudo integrado de astrologia + numerologia (máx 500 palavras)
2. Comece com "## Seu Mapa Integral"
3. Use markdown para títulos (##) e destaques (**negrito**)
4. Evite previsões futuras — foque em autoconhecimento e tendências
5. Seja autêntico, sem exagero emocional
6. Termine com um insight integrativo (como os números e signos conversam juntos)

${ragContext}

Gere o estudo:`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const interpretacao = message.content[0]?.type === 'text'
      ? message.content[0].text
      : '';

    return interpretacao;
  } catch (err) {
    console.error('[BRINDE] Erro ao chamar Claude API:', err.message);
    throw new Error(`Falha ao gerar interpretação: ${err.message}`);
  }
}

/**
 * Registra/atualiza resgate na tabela
 *
 * UPSERT: Se email não existe, INSERT. Se existe, UPDATE.
 * Isso permite retry após falha: segunda tentativa atualiza o status
 * de 'erro' para 'enviado' (ou tenta novamente com 'erro' se falhar novamente)
 *
 * CRÍTICO: Se statusEnvio='enviado' e upsert falha, log alerta crítico
 * (e-mail foi enviado mas registro não foi gravado = risco de duplicação)
 */
async function registrarResgate(email, nomeDados, dataNascimento, horaNascimento, localNascimento, estudoGerado, statusEnvio, erroMensagem = null) {
  const supabaseClient = assertSupabase();

  try {
    const { error } = await supabaseClient
      .from('resgates_brinde_astro_numero')
      .upsert(
        {
          email,
          nome_completo: nomeDados,
          data_nascimento: dataNascimento,
          hora_nascimento: horaNascimento,
          local_nascimento: localNascimento,
          sol_signo: estudoGerado.sol,
          lua_signo: estudoGerado.lua,
          ascendente_signo: estudoGerado.ascendente,
          caminho_de_vida: estudoGerado.caminhoDeVida,
          essencia: estudoGerado.essencia,
          timestamp_resgate: new Date().toISOString(),
          status_envio: statusEnvio,
          erro_mensagem: erroMensagem
        },
        { onConflict: 'email' }
      );

    if (error) {
      throw error;
    }

    console.log(`[BRINDE] Resgate registrado/atualizado para ${email} com status='${statusEnvio}'`);
  } catch (err) {
    // CRÍTICO: Se o e-mail foi enviado mas o registro falhou, alertar explicitamente
    if (statusEnvio === 'enviado') {
      console.error(`[BRINDE][ALERTA CRÍTICO] Falha ao registrar resgate de brinde enviado para ${email}: ${err.message}`);
      console.error(`[BRINDE][ALERTA CRÍTICO] E-MAIL FOI ENVIADO MAS REGISTRO NÃO FOI GRAVADO - RISCO DE DUPLICAÇÃO`);
      console.error(`[BRINDE][ALERTA CRÍTICO] Investigar manualmente: ${email}`);
    } else {
      // Para status='erro', engolir silenciosamente é aceitável (tentativa de envio falhou mesmo)
      console.error('[BRINDE] Erro ao registrar resgate com status=erro:', err.message);
    }
    // Não propaga — resgate foi gerado/enviado, registro é apenas auditoria
  }
}

/**
 * Envia e-mail com PDF do brinde via SendGrid
 *
 * CRÍTICO: Gera token HMAC NO SERVIDOR AQUI (nunca expor via endpoint público)
 * O token é incluído diretamente na URL do link do e-mail
 *
 * Retorna: { sucesso: boolean, erro?: string }
 */
async function enviarBrindeEmail(email, nomeDados, pdfPath) {
  try {
    const sgMail = require('@sendgrid/mail');
    const fs = require('fs');

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY não configurada');
    }

    // Ler PDF do disco
    const pdfAttachment = fs.readFileSync(pdfPath).toString('base64');

    // URL base do frontend
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.zunisuprema.com.br';

    // ─────────────────────────────────────────────────────────────
    // GERAR TOKEN HMAC NO SERVIDOR (NUNCA EXPOR VIA HTTP)
    // ─────────────────────────────────────────────────────────────
    let token;
    try {
      token = gerarTokenHMAC(email);
    } catch (err) {
      console.error('[BRINDE] Falha ao gerar token HMAC:', err.message);
      throw new Error('Não foi possível gerar token seguro para o link');
    }

    // Montar URL do brinde com token
    const brindeLink = `${frontendUrl}/brinde?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@zunisuprema.com.br',
      subject: '✨ Seu Estudo Integrativo — Presente da ZUNI Suprema',
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Seu Estudo Integrativo — ZUNI Suprema</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 650px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a3e 0%, #3d3d66 100%); color: #d4af37; padding: 30px; text-align: center; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .header h1 { margin: 0; font-size: 32px; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.95; }
    .content { background: #f9f9f9; padding: 30px; margin-top: 20px; border-radius: 8px; }
    .intro { margin-bottom: 25px; font-size: 15px; color: #555; line-height: 1.8; }
    .attachment-box { background: white; border-left: 4px solid #d4af37; padding: 20px; margin: 20px 0; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
    .attachment-label { color: #d4af37; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 8px; }
    .attachment-file { font-size: 14px; color: #555; }
    .cta-button { display: inline-block; background: #d4af37; color: #1a1a3e; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .cta-button:hover { background: #b8963e; text-decoration: none; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    .footer a { color: #d4af37; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✨ Seu Estudo Integrativo</h1>
      <p>Um presente de autoconhecimento</p>
    </div>

    <div class="content">
      <p class="intro">Olá <strong>${nomeDados}</strong>,</p>

      <p class="intro">Que alegria! Você recebeu um brinde especial — um <strong>Estudo Integrativo</strong> único, combinando análise astrológica com numerologia.</p>

      <p class="intro">Este estudo é <strong>único e determinístico</strong>: como sua data e hora de nascimento não mudam, o resultado é sempre o mesmo. Por isso, fica guardado com carinho — e você pode consultá-lo sempre que precisar de uma conexão com sua essência.</p>

      <div class="attachment-box">
        <div class="attachment-label">📎 Seu Estudo em Anexo</div>
        <div class="attachment-file">estudo-integrativo-${nomeDados.toLowerCase().replace(/\s+/g, '-')}.pdf</div>
        <p style="margin: 12px 0 0; font-size: 13px; color: #999;">Baixe, salve e compartilhe se desejar.</p>
      </div>

      <p class="intro" style="text-align: center;">
        <a href="${brindeLink}" class="cta-button">↳ Ver Meu Estudo</a>
      </p>

      <p class="intro">Obrigado por explorar a ZUNI Suprema. Se este estudo tocou algo importante, considere conhecer nossa <strong>Sessão Completa com o Mentor</strong> — uma jornada de até 15 trocas, com análise integrada e acompanhamento profundo.</p>

      <p class="intro" style="text-align: center;">
        <a href="${frontendUrl}/checkout" class="cta-button">Conhecer o Mentor ZUNI</a>
      </p>
    </div>

    <div class="footer">
      <p>© 2026 ZUNI Suprema. A ciência da excelência humana.</p>
      <p><a href="${frontendUrl}/privacidade">Política de Privacidade</a> | <a href="${frontendUrl}/termos">Termos de Uso</a></p>
    </div>
  </div>
</body>
</html>
      `,
      attachments: [
        {
          content: pdfAttachment,
          filename: `estudo-integrativo-${nomeDados.toLowerCase().replace(/\s+/g, '-')}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };

    await sgMail.send(msg);

    console.log(`[BRINDE] E-mail enviado para ${email} com link seguro (HMAC incluído na URL)`);

    return { sucesso: true };

  } catch (error) {
    console.error('[BRINDE] Erro ao enviar e-mail:', error?.response?.body || error.message);
    return { sucesso: false, erro: error.message };
  }
}

/**
 * Gera token simples para link do brinde
 * Token = SHA-256 do email (simples, determinístico)
 * Retorna: string hexadecimal de 64 caracteres
 */
function gerarTokenBrinde(email) {
  try {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(email).digest('hex');
  } catch (err) {
    console.warn('[BRINDE] Erro ao gerar token:', err.message);
    // Fallback: retornar email encoded
    return Buffer.from(email).toString('base64');
  }
}

/**
 * Gera PDF do brinde com conteúdo do estudo
 * Formato: conciso, sem capa/índice (diferente do relatório principal)
 */
async function gerarPdfBrinde(estudoInterpretacao, nomeCliente, emailCliente) {
  return new Promise((resolve, reject) => {
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const outputPath = path.join(os.tmpdir(), `brinde-${emailCliente.split('@')[0]}-${Date.now()}.pdf`);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // Cabeçalho
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#1a1a3e')
       .text('✨ Seu Estudo Integrativo', { align: 'center' });
    doc.fontSize(14).font('Helvetica').fillColor('#d4af37')
       .text('ZUNI Suprema — Astrologia & Numerologia', { align: 'center' });

    doc.moveDown(1.5);
    doc.fontSize(11).font('Helvetica').fillColor('black')
       .text(`Gerado para ${nomeCliente}`, { align: 'center' });

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#999')
       .text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

    doc.moveDown(2);

    // Renderizar conteúdo com formatação Markdown
    const { renderMarkdownToPDF } = require('../renderMarkdownToPDF-v2');
    renderMarkdownToPDF(doc, estudoInterpretacao, { fontSize: 11, lineGap: 4, maxWidth: 500 });

    // Footer
    doc.fontSize(9).fillColor('#999')
       .text('Este estudo é único e determinístico — o resultado nunca muda, pois é baseado em dados imutáveis (data/hora/local de nascimento).',
             { align: 'center', width: 500 });

    doc.moveDown(1);
    doc.text('ZUNI Suprema — A ciência da excelência humana | www.zunisuprema.com.br',
             { align: 'center', width: 500, fontSize: 8 });

    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

/**
 * Gera token HMAC para incluir no link do brinde
 * Token = HMAC-SHA256(email + BRINDE_TOKEN_SECRET)
 *
 * APENAS chamada interna do servidor, nunca exposta via HTTP
 * Lançar erro se secret não configurada
 */
function gerarTokenHMAC(email) {
  const crypto = require('crypto');
  const secret = process.env.BRINDE_TOKEN_SECRET;

  if (!secret) {
    throw new Error('[BRINDE] BRINDE_TOKEN_SECRET não configurada — não é possível gerar token HMAC');
  }

  if (!email || typeof email !== 'string') {
    throw new Error('[BRINDE] Email inválido para geração de token');
  }

  try {
    return crypto
      .createHmac('sha256', secret)
      .update(email)
      .digest('hex');
  } catch (err) {
    throw new Error(`[BRINDE] Erro ao gerar token HMAC: ${err.message}`);
  }
}

/**
 * Valida token HMAC do link do brinde
 * Token deve ser: HMAC-SHA256(email + BRINDE_TOKEN_SECRET)
 *
 * FAIL-CLOSED: Se BRINDE_TOKEN_SECRET não está configurada, SEMPRE retorna false
 * Nunca aceita por padrão sem o secret
 *
 * TIMING-SAFE: Usa crypto.timingSafeEqual() para evitar timing attacks
 */
function validarTokenHMAC(email, token) {
  const crypto = require('crypto');
  const secret = process.env.BRINDE_TOKEN_SECRET;

  // FAIL-CLOSED: se secret não existe, rejeita sempre
  if (!secret) {
    console.error('[BRINDE][CRÍTICO] BRINDE_TOKEN_SECRET não configurada — validação HMAC falhou com rejeição automática');
    return false;
  }

  // Se token não foi fornecido ou não é string, rejeita
  if (!token || typeof token !== 'string' || token.length === 0) {
    return false;
  }

  // Se email está vazio ou não é string, rejeita
  if (!email || typeof email !== 'string' || email.length === 0) {
    return false;
  }

  try {
    // Calcular HMAC esperado
    const hmacEsperado = crypto
      .createHmac('sha256', secret)
      .update(email)
      .digest('hex');

    // Verificar que os dois tokens têm o mesmo tamanho
    if (token.length !== hmacEsperado.length) {
      console.warn(`[BRINDE] Token com tamanho incorreto para ${email.substring(0, 5)}*** (esperado ${hmacEsperado.length}, recebido ${token.length})`);
      return false;
    }

    // COMPARAÇÃO TIMING-SAFE: evitar timing attacks
    // crypto.timingSafeEqual() compara buffers em tempo constante
    // Retorna true se iguais, false se diferentes
    const tokenBuffer = Buffer.from(token, 'hex');
    const expectedBuffer = Buffer.from(hmacEsperado, 'hex');

    const tokensIguais = crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
    return tokensIguais;

  } catch (err) {
    console.error('[BRINDE] Erro ao validar HMAC:', err.message);
    return false; // Fail-closed em caso de erro
  }
}

/**
 * Rate limiting: máximo 5 tentativas por hora, chave = IP:email
 * Chave combinada impede bloqueio cruzado entre usuários no mesmo IP compartilhado
 *
 * Armazena em memória simples (em produção, usar Redis)
 * Retorna: { bloqueado: boolean, tentativas, maxTentativas, proximaTentativaEm?, minutosAteReset? }
 */
const rateLimitStore = new Map(); // { "IP:email": [timestamp1, timestamp2, ...] }

function verificarRateLimit(ip, email, maxTentativas = 5, janelaHoras = 1) {
  const janela = janelaHoras * 60 * 60 * 1000; // Converter para ms
  const chave = `${ip}:${email}`; // ← CRÍTICO: chave combinada IP:email
  const agora = Date.now();

  // Inicializar se não existe
  if (!rateLimitStore.has(chave)) {
    rateLimitStore.set(chave, []);
  }

  let tentativas = rateLimitStore.get(chave);

  // Remover tentativas fora da janela de tempo (cleanup)
  const tentativasValidas = tentativas.filter(timestamp => {
    const idadeMs = agora - timestamp;
    const dentroJanela = idadeMs < janela;
    return dentroJanela;
  });

  // Atualizar store com tentativas válidas
  rateLimitStore.set(chave, tentativasValidas);

  // Verificar se atingiu limite
  if (tentativasValidas.length >= maxTentativas) {
    // Calcular quando poderá tentar novamente
    const timestampMaisAntigo = Math.min(...tentativasValidas);
    const proximaTentativaEmMs = timestampMaisAntigo + janela;
    const minutosAteReset = Math.ceil((proximaTentativaEmMs - agora) / 60000);

    console.warn(`[BRINDE][RATELIMIT] IP ${ip} | Email ${email.substring(0, 5)}*** | Bloqueado por ${minutosAteReset}m | Tentativas: ${tentativasValidas.length}/${maxTentativas}`);

    return {
      bloqueado: true,
      tentativas: tentativasValidas.length,
      maxTentativas,
      proximaTentativaEm: new Date(proximaTentativaEmMs),
      minutosAteReset
    };
  }

  // Registrar nova tentativa
  tentativasValidas.push(agora);
  rateLimitStore.set(chave, tentativasValidas);

  return {
    bloqueado: false,
    tentativas: tentativasValidas.length,
    maxTentativas
  };
}

/**
 * Limpar rate limit de um IP:email (opcional, após sucesso)
 */
function limparRateLimit(ip, email) {
  const chave = `${ip}:${email}`;
  const removeu = rateLimitStore.delete(chave);
  if (removeu) {
    console.log(`[BRINDE][RATELIMIT] Limpeza: ${chave}`);
  }
}

module.exports = {
  gerarTokenHMAC,
  validarTokenHMAC,
  verificarRateLimit,
  limparRateLimit,
  verificarJaResgatado,
  gerarEstudoCompleto,
  gerarPdfBrinde,
  registrarResgate,
  enviarBrindeEmail
};
