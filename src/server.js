// Servidor principal do ZUNI Suprema
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config();

const SYSTEM_PROMPT = 'SUBSTITUIR PELO PROMPT COMPLETO DO BRIEFING';
const REPORT_PROMPT = 'SUBSTITUIR PELO PROMPT COMPLETO DO BRIEFING';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2023-08-16' })
  : null;

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

// Usamos express.json() para todas as rotas, exceto o webhook Stripe.
app.use((req, res, next) => {
  if (req.originalUrl === '/api/pagamento/webhook') {
    return next();
  }
  express.json()(req, res, next);
});

const sessions = new Map();

function buildSuccessUrl(sessionId) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/chat?sessionId=${sessionId}`;
}

function buildCancelUrl() {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/checkout`;
}

async function textToSpeechBase64(text) {
  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!voiceId || !apiKey) {
      console.warn('ElevenLabs não configurado — áudio desativado.');
      return '';
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );

    if (!response.ok) {
      const erro = await response.text();
      console.error('Erro ElevenLabs:', erro);
      return '';
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return base64;

  } catch (error) {
    console.error('Erro em textToSpeechBase64:', error);
    return '';
  }
}

async function generateClaudeResponse(messages, systemPrompt) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Erro em generateClaudeResponse:', error);
    return 'Desculpe, ocorreu um erro ao processar sua mensagem.';
  }
}

async function searchKnowledge(query) {
  try {
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query
      })
    });

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    const { data, error } = await supabase.rpc('buscar_documentos', {
      query_embedding: embedding,
      limite: 5
    });

    if (error) {
      console.error('Erro RAG Supabase:', error);
      return [];
    }

    return data.map(row => row.conteudo);
  } catch (error) {
    console.error('Erro em searchKnowledge:', error);
    return [];
  }
}

async function generateReportText(session) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

    const historico = session.history
      .map(h => `${h.role === 'user' ? 'Usuário' : 'Mentor'}: ${h.message}`)
      .join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: REPORT_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Nome: ${session.name}\nEmail: ${session.email}\n\nHistórico da sessão:\n${historico}`
        }
      ]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Erro em generateReportText:', error);
    return 'Erro ao gerar relatório.';
  }
}

async function generatePdf(reportText, sessionId, userName) {
  return new Promise((resolve, reject) => {
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const outputPath = path.join(os.tmpdir(), `relatorio-${sessionId}.pdf`);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // Cabeçalho
    doc.fontSize(22).font('Helvetica-Bold')
       .text('ZUNI Suprema', { align: 'center' });
    doc.fontSize(14).font('Helvetica')
       .text('Mapa Integrativo — Relatório de Sessão', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(`Participante: ${userName}`, { align: 'center' });
    doc.fontSize(10).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
    doc.moveDown(2);

    // Linha divisória
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    // Conteúdo do relatório
    doc.fontSize(12).font('Helvetica').text(reportText, { align: 'left', lineGap: 4 });

    // Rodapé
    doc.moveDown(2);
    doc.fontSize(9).fillColor('gray')
       .text('ZUNI Suprema — A ciência da excelência humana', { align: 'center' });
    doc.text('www.zunisuprema.com.br', { align: 'center' });

    doc.end();

    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

async function sendEmail(email, name, pdfPath) {
  try {
    const sgMail = require('@sendgrid/mail');
    const fs = require('fs');

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const pdfAttachment = fs.readFileSync(pdfPath).toString('base64');

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: `${name}, seu Mapa Integrativo ZUNI Suprema está pronto`,
      html: `
        
          Olá, ${name}!
          Sua sessão com o Mentor ZUNI Suprema foi concluída.

          Em anexo você encontra o seu **Mapa Integrativo** — um relatório personalizado com os insights da sua jornada.

          

          ZUNI Suprema — A ciência da excelência humana
www.zunisuprema.com.br

        
      `,
      attachments: [
        {
          content: pdfAttachment,
          filename: `mapa-integrativo-${name.toLowerCase().replace(/\s+/g, '-')}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }
      ]
    };

    await sgMail.send(msg);
    console.log(`Email enviado para ${email}`);
    return true;
  } catch (error) {
    console.error('Erro ao enviar email:', error?.response?.body || error.message);
    return false;
  }
}

async function triggerMake(name, email, summary) {
  try {
    const webhookUrl = process.env.MAKE_WEBHOOK_URL;

    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      console.warn('MAKE_WEBHOOK_URL não configurado — trigger ignorado.');
      return false;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: name,
        email,
        resumo: summary,
        timestamp: new Date().toISOString(),
        origem: 'zuni-suprema-mapa-integrativo'
      })
    });

    console.log('Make webhook disparado — status:', response.status);
    return response.ok;
  } catch (error) {
    console.error('Erro ao disparar Make webhook:', error.message);
    return false;
  }
}

app.post('/api/checkout', async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
    }

    const sessionId = uuidv4();
    const session = {
      sessionId,
      name,
      email,
      history: [],
      counter: 0,
      paid: false,
      createdAt: new Date().toISOString()
    };

    sessions.set(sessionId, session);

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe não está configurado.' });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: 'Sessão Mapa Integrativo ZUNI Suprema'
            },
            unit_amount: 2990
          },
          quantity: 1
        }
      ],
      metadata: {
        sessionId
      },
      customer_email: email,
      success_url: buildSuccessUrl(sessionId),
      cancel_url: buildCancelUrl()
    });

    return res.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Erro em /api/checkout:', error);
    return res.status(500).json({ error: 'Erro ao criar sessão de checkout.' });
  }
});

app.post('/api/pagamento/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe não está configurado.' });
    }

    const signature = req.headers['stripe-signature'];
    const payload = req.body;

    if (!signature) {
      return res.status(400).json({ error: 'Cabeçalho Stripe-Signature ausente.' });
    }

    const event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET || '');

    if (event.type === 'checkout.session.completed') {
      const checkoutSession = event.data.object;
      const sessionId = checkoutSession.metadata?.sessionId;

      if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        session.paid = true;
        session.paymentStatus = 'paid';
        sessions.set(sessionId, session);
        console.log('Sessão liberada:', sessionId);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('Erro em /api/pagamento/webhook:', error);
    return res.status(400).send(`Webhook error: ${error.message}`);
  }
});

app.post('/api/sessao/iniciar', async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
    }

    const sessionId = uuidv4();
    const session = {
      sessionId,
      name,
      email,
      history: [],
      counter: 0,
      paid: false,
      createdAt: new Date().toISOString()
    };

    sessions.set(sessionId, session);

    const welcomeMessage = `Olá ${name}, bem-vindo(a) ao Mentor ZUNI Suprema. Sua jornada começa agora.`;

    return res.json({ sessionId, message: welcomeMessage, counter: session.counter });
  } catch (error) {
    console.error('Erro em /api/sessao/iniciar:', error);
    return res.status(500).json({ error: 'Erro ao iniciar a sessão.' });
  }
});

// ROTA TEMPORÁRIA DE TESTE — remover antes de produção
app.post('/api/dev/liberar-sessao', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId obrigatório.' });
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Sessão não encontrada.' });
  session.paid = true;
  sessions.set(sessionId, session);
  return res.json({ ok: true, message: 'Sessão liberada para teste.' });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId e message são obrigatórios.' });
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }

    if (!session.paid) {
      return res.status(403).json({ error: 'Sessão não liberada. Aguarde a confirmação do pagamento.' });
    }

    session.counter += 1;

    const knowledge = await searchKnowledge(message);
    const contextBlock = knowledge.length > 0
      ? `\n\nConhecimento relevante da base ZUNI Suprema:\n${knowledge.join('\n\n')}`
      : '';

    const messagesParaClaude = [
      ...session.history.map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.message
      })),
      { role: 'user', content: `${message}${contextBlock}` }
    ];

    const responseText = await generateClaudeResponse(messagesParaClaude, SYSTEM_PROMPT);
    const audioBase64 = await textToSpeechBase64(responseText);

    session.history.push({ role: 'user', message });
    session.history.push({ role: 'assistant', message: responseText });
    sessions.set(sessionId, session);

    return res.json({ texto: responseText, audio: audioBase64, contador: session.counter });
  } catch (error) {
    console.error('Erro em /api/chat:', error);
    return res.status(500).json({ error: 'Erro ao processar a mensagem de chat.' });
  }
});

app.post('/api/relatorio', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId é obrigatório.' });
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }

    if (!session.paid) {
      return res.status(403).json({ error: 'Sessão não liberada. Aguarde a confirmação do pagamento.' });
    }

    const reportText = await generateReportText(session);
    const pdfPath = await generatePdf(reportText, sessionId, session.name);
    await sendEmail(session.email, session.name, pdfPath);
    await triggerMake(session.name, session.email, reportText.slice(0, 1200));

    return res.json({ relatório: reportText });
  } catch (error) {
    console.error('Erro em /api/relatorio:', error);
    return res.status(500).json({ error: 'Erro ao gerar o relatório.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ZUNI Suprema escutando na porta ${PORT}`);
});
