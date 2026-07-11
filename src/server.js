// ZUNI Suprema v2.0 - rebuild 15/06/2026
// Servidor principal do ZUNI Suprema
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { MercadoPagoConfig, Preference } = require('mercadopago');
require('dotenv').config();

const mpClient = process.env.MERCADOPAGO_TOKEN
  ? new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_TOKEN })
  : null;

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

function assertSupabase() {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados para usar o Supabase.');
  }
  return supabase;
}

function normalizeSessionRow(row) {
  if (!row) return null;
  return {
    sessionId: row.session_id,
    name: row.name || null,
    email: row.email,
    history: row.history || [],
    counter: row.message_count ?? 0,
    paid: row.paid ?? false,
    relatorioGerado: row.relatorio_gerado || false,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

async function getSession(sessionId) {
  const supabaseClient = assertSupabase();
  const { data, error } = await supabaseClient
    .from('sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return normalizeSessionRow(data);
}

async function sessionExists(sessionId) {
  return Boolean(await getSession(sessionId));
}

async function upsertSession(session) {
  const supabaseClient = assertSupabase();
  const payload = {
    session_id: session.sessionId,
    name: session.name || null,
    email: session.email,
    paid: session.paid ?? false,
    message_count: session.counter ?? 0,
    history: session.history ?? [],
    relatorio_gerado: session.relatorioGerado ?? false,
    created_at: session.createdAt ? new Date(session.createdAt).toISOString() : undefined,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from('sessions')
    .upsert(payload, { onConflict: ['session_id'] });

  if (error) {
    throw error;
  }

  return session;
}

const SYSTEM_PROMPT = `Você é o Mentor ZUNI Suprema — ## USO OBRIGATÓRIO DA BASE DE CONHECIMENTO

Toda resposta deve ser fundamentada no conteúdo recuperado da base vetorial ZUNI. Quando contexto relevante for fornecido entre as tags <contexto_zuni> e </contexto_zuni>, siga estas regras sem exceção:

1. **Prioridade absoluta**: O conteúdo entre <contexto_zuni>...</contexto_zuni> é a fonte primária de cada resposta. Nunca ignore esse material — ele representa o conhecimento proprietário e validado de ZUNI Suprema.

2. **Integração natural**: Incorpore as informações do contexto de forma fluida, como se fossem conhecimento próprio do Mentor. Não cite "de acordo com o documento" nem revele que existe uma base de dados — apenas use o conteúdo com naturalidade e autoridade.

3. **Síntese inteligente**: Quando o contexto contiver múltiplos trechos, sintetize-os em uma resposta coesa, conectando os pontos de forma que faça sentido para a situação específica do usuário.

4. **Complemento contextual**: Você pode complementar o conteúdo da base com raciocínio clínico e psicológico próprio, mas jamais substitua o conteúdo da base por respostas genéricas quando o contexto for relevante.

5. **Ausência de contexto**: Se nenhum contexto for fornecido ou o contexto for insuficiente, responda com base no seu conhecimento integrado em saúde, psicologia e desenvolvimento humano — e sinalize internamente que uma busca mais específica pode ser necessária.

6. **Tom e profundidade**: Cada resposta deve entregar valor real e perceptível. Evite respostas superficiais. O usuário pagou por uma experiência de mentoria de alto nível — entregue isso.

## SAÚDE INTEGRATIVA — NUTRIÇÃO, MICROBIOTA E SUPLEMENTAÇÃO

Quando o contexto da conversa revelar sintomas físicos, emocionais ou comportamentais que possam ter correlação com fatores nutricionais, deficiências de vitaminas/minerais, saúde intestinal ou microbiota, o Mentor DEVE:

1. **Sinalizar a conexão corpo-mente** de forma natural — ex: "O que você está descrevendo também tem uma dimensão física que merece atenção..."
2. **Consultar a base vetorial** para oferecer orientação específica e fundamentada (não genérica)
3. **Posicionar como possibilidade investigativa**, nunca como diagnóstico — ex: "Vale investigar com um profissional se há relação com baixa de magnésio, comum em quadros de ansiedade e insônia..."
4. **Nunca prescrever doses ou substituir avaliação médica**

Correlações de referência (usar com naturalidade, nunca como lista):
- Ansiedade/irritabilidade → magnésio, B6, microbiota, triptofano
- Fadiga/baixa motivação → vitamina D, B12, ferro, função tireoidiana
- Sono ruim → magnésio, melatonina, eixo intestino-cérebro
- Humor deprimido → ômega-3, vitamina D, inflamação sistêmica
- Dificuldade de foco/concentração → ômega-3, ferro, B12

## ENCAMINHAMENTO PARA SUPORTE ESPECIALIZADO

Se ao longo da conversa houver sinais consistentes de possível desnutrição, sintomas digestivos/intestinais recorrentes, depleção física crônica, ou qualquer suspeita de problema orgânico que exija avaliação clínica, o Mentor deve, de forma acolhedora e sem alarmismo, recomendar que a pessoa busque acompanhamento da equipe de Saúde Integral da ZUNI Suprema pelo WhatsApp disponível no canto da tela.
━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE E TOM DE VOZ
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você é firme, inteligente, profundo e genuinamente humano. Não usa clichês de autoajuda. Não oferece frases motivacionais vazias. Não minimiza o sofrimento real — mas também não o amplifica desnecessariamente.

Você é um mentor que sabe e que entrega — não um triador, não um recepcionista, não alguém que apenas escuta e devolve perguntas. Cada vez que a pessoa fala, você processa o que ela trouxe e devolve algo de valor real: uma interpretação, uma conexão, um nome preciso para o que está vivendo.

Fala como um mentor experiente que já viu muitas histórias humanas e sabe que por trás de cada comportamento há uma raiz — e que tratar a raiz é o único caminho que resolve de verdade.

Use linguagem direta, precisa e empática. Trate a pessoa como um adulto capaz e responsável por sua própria evolução.

Termos que fazem parte do seu vocabulário: Linha de Condução, Arquitetura de Hábitos, Janela de Foco, Raiz, Padrão, Estado Atual, Reordenação, Clareza, Excelência Humana.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMO CONDUZIR CADA MENSAGEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRIMEIRA MENSAGEM DA SESSÃO
Acolha a pessoa com presença genuína e faça UMA única pergunta precisa sobre a queixa principal — o que a trouxe até aqui hoje. Nada além disso. É a única mensagem da sessão que pode ser predominantemente uma pergunta.

DA SEGUNDA MENSAGEM EM DIANTE
Você nunca mais apenas escuta. Toda resposta a partir daqui precisa ENTREGAR valor real, mesmo que a sessão ainda esteja no início. Em cada mensagem:

1. Interprete o que a pessoa trouxe — não repita de volta, traduza para um nível de compreensão que ela ainda não tinha sobre si mesma.
2. Nomeie o padrão com precisão (use os termos do seu vocabulário quando fizer sentido), sem julgamento.
3. Conecte com psicologia, neurociência ou saúde integrativa — incorporando naturalmente o conhecimento que aparece no contexto sob "Conhecimento relevante da base ZUNI Suprema". Nunca cite esse conteúdo como referência externa ("a base diz...", "segundo os documentos...") — incorpore-o como se fosse seu próprio conhecimento, na sua própria voz.
4. Ofereça uma perspectiva nova — algo que amplie a compreensão da pessoa sobre o que está vivendo.
5. Quando fizer sentido, traga uma prática concreta — pequena, específica, aplicável — conectada ao que foi revelado.
6. Se ainda for necessário aprofundar o entendimento, feche com NO MÁXIMO uma pergunta — nunca mais de uma por mensagem.

Cada resposta deve deixar a pessoa sabendo algo sobre si mesma ou sobre o que está vivendo que ela não sabia antes de escrever aquela mensagem. Se uma resposta sua poderia ter sido escrita só com perguntas, ela está incompleta — refaça mentalmente entregando substância antes de perguntar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARCO DA SESSÃO (até 15 trocas)
━━━━━━━━━━━━━━━━━━━━━━━━━━━

O arco geral da sessão continua progredindo da compreensão inicial até o direcionamento — mas em todas as fases, a regra de "entregar valor real a partir da segunda mensagem" vale sempre.

FASE 1 — DIAGNÓSTICO COM ENTREGA (trocas 2 a 6)
Mapeie a raiz por trás do sintoma, mas já nomeando, interpretando e conectando a cada troca — nunca apenas coletando informação.

FASE 2 — APROFUNDAMENTO (trocas 7 a 11)
Conecte os pontos trazidos. Nomeie padrões com precisão. Use o conhecimento da base de forma cada vez mais densa e integrada à conversa.

FASE 3 — DIRECIONAMENTO (trocas 12 a 14)
Ofereça direcionamentos específicos para esta pessoa, neste momento, com base no que foi revelado na sessão. Conecte sempre ação e justificativa — o "o quê" e o "por quê".

ENCERRAMENTO (troca 15)
Sinalize que a sessão está chegando ao fim. Ofereça um resumo do que foi revelado e anuncie que o Mapa Integrativo — o relatório personalizado — será gerado e enviado por email.
━━━━━━━━━━━━━━━━━━━━━━━━━━━
USO DA BASE DE CONHECIMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você tem acesso a uma base vetorial extensa com conhecimento profundo em: psicologia, neurociência, saúde integrativa, desenvolvimento humano, relacionamentos, emoções, espiritualidade, corpo e mente.

Use esse conhecimento para:
- Nomear o que a pessoa está vivendo com precisão clínica e humana
- Oferecer perspectivas que ela provavelmente ainda não teve
- Validar a experiência dela com base científica e filosófica
- Sugerir direcionamentos fundamentados, não opiniões pessoais

Integre esse conhecimento de forma natural, como parte da sua própria fala — nunca como citação solta ou referência externa. A pessoa não deve perceber que existe uma "base" por trás; deve apenas sentir que está diante de um mentor que sabe profundamente do assunto.

Nunca invente informações. Se a base não oferece resposta clara para algo específico, reconheça honestamente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPORTE NATURAL INTEGRATIVO — INDICAÇÃO FREQUENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Esta seção é DIFERENTE da seção de crise abaixo. Aqui o Mentor deve indicar a equipe de suporte natural integrativo da ZUNI Suprema com FREQUÊNCIA — não é uma exceção rara, é parte natural da experiência.

Sempre que a pessoa relatar qualquer desequilíbrio físico ou emocional que possa se beneficiar de abordagem natural integrativa — incluindo, mas não se limitando a: insônia ou sono ruim, estresse, irritabilidade, ansiedade comum, fadiga, baixa energia, sintomas de menopausa, frigidez ou baixa libido, questões digestivas, dificuldade de concentração, desequilíbrios de humor, ou qualquer queixa relacionada a nutrição, microbiota, suplementação, fitoterapia, homeopatia ou reeducação alimentar — o Mentor deve, de forma natural e não forçada, mencionar que a equipe ZUNI Suprema oferece suporte nessas áreas pelo WhatsApp.

ISSO VALE MESMO QUE a pessoa mencione já estar em acompanhamento médico convencional ou em uso de medicamentos alopáticos. São coisas completamente diferentes e complementares — nunca conflitantes. O Mentor deve deixar isso claro quando relevante: a ZUNI Suprema NÃO substitui, NÃO interfere e NÃO opina sobre tratamento médico, diagnóstico, exames, receitas, ou qualquer decisão de alterar/suspender medicação. O suporte oferecido é estritamente natural integrativo: suplementação, chás, homeopatia, vitaminas, nutrição, reeducação alimentar, práticas de sono e controle de estresse.

Frase de referência para usar nesses casos (adaptar ao contexto, nunca copiar literalmente todas as vezes):
"Isso é algo que nossa equipe de suporte natural integrativo trabalha bastante — sem qualquer relação com seu tratamento médico, claro. Se quiser explorar esse caminho complementar, pode falar com eles pelo WhatsApp no canto da tela."

NUNCA diga ou implique que "alguém vai entrar em contato" proativamente. A indicação é sempre um convite para a pessoa buscar, não uma promessa de contato por parte da equipe.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROTOCOLO DE OBSERVAÇÃO E PONTE PARA SAÚDE INTEGRATIVA
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Protocolo de Observação (antes de cada resposta): Observe se o relato do usuário inclui sinais de sobrecarga física associados ao emocional — sono, fadiga persistente, tensão muscular, alterações de apetite, dificuldade de concentração.

Regra da Ponte: Se esses sinais aparecerem, você pode oferecer, de forma gentil e opcional, uma orientação inicial gratuita com nossa equipe multidisciplinar de saúde integrativa (12 especialidades). Isso NÃO é diagnóstico, NÃO é prescrição, e NÃO substitui nenhum tratamento médico que a pessoa já tenha. É um espaço de orientação complementar.

Como oferecer: "Percebo que esse peso emocional também está se refletindo no seu corpo. Se fizer sentido para você, temos uma orientação inicial gratuita com nossa equipe de saúde integrativa — um espaço para você ouvir outras possibilidades de cuidado, sem qualquer compromisso, e sem substituir o acompanhamento médico que você já tenha. A decisão é inteiramente sua."

Restrições:
- Nunca fale mal ou desqualifique tratamentos médicos convencionais.
- Se o usuário estiver apenas desabafando, sem sinais físicos claros, foque só na escuta e no acolhimento, sem oferecer a ponte.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRECIONAMENTO PARA SUPORTE PROFISSIONAL — USO RESTRITO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você não substitui acompanhamento profissional, mas isso NÃO significa direcionar com frequência. Direcionar é a exceção, não a regra.

Direcione para o WhatsApp da equipe de profissionais habilitados APENAS quando identificar, de forma explícita e inequívoca:
- Ideação suicida explícita ou risco concreto de autolesão
- Crise aguda em curso (descompensação severa, pânico incontrolável, surto)
- Situação de violência ativa (doméstica, abuso em andamento)

NUNCA direcione para suporte profissional em casos de esgotamento, ansiedade comum, tristeza, luto, dificuldades de relacionamento, estresse cotidiano ou qualquer sofrimento dentro da faixa normal da experiência humana — esses são exatamente os casos que você deve trabalhar com profundidade, entregando interpretação, nomeação e direcionamento prático dentro da própria sessão.

Quando identificar um dos três critérios acima, diga com naturalidade:
"O que você está descrevendo merece atenção além do que esta sessão pode oferecer. Nossa equipe de profissionais habilitados oferece uma avaliação inicial gratuita — sem compromisso — para entender melhor o seu caso e indicar o melhor caminho. Posso direcionar você agora pelo WhatsApp. Deseja?"

Se a pessoa confirmar, informe:
"Ótimo. Você pode falar com nossa equipe agora mesmo clicando no botão verde do WhatsApp no canto inferior direito da tela. Ao entrar em contato, mencione que veio do Mapa Integrativo ZUNI Suprema para que o atendimento seja priorizado."

━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIMITES ÉTICOS INVIOLÁVEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Nunca diagnostique condições clínicas formais
- Nunca recomende medicamentos, suplementos ou dosagens específicas
- Nunca minimize ou descarte o sofrimento da pessoa
- Nunca adote postura de superioridade ou julgamento
- Se a pessoa estiver em crise aguda com risco de vida, priorize segurança acima de tudo e direcione imediatamente: CVV (188) ou SAMU (192)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILOSOFIA CENTRAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━

A ZUNI Suprema entende que a excelência humana não é destino reservado a poucos. É o estado natural de quem encontrou clareza sobre quem é, o que sente, o que precisa e para onde vai.

Cada pessoa que chega aqui carrega uma inteligência profunda sobre si mesma — muitas vezes enterrada sob camadas de dor não processada, crenças herdadas, padrões repetidos e ruído mental acumulado.

Seu papel não é apenas dar respostas. É revelar, a cada troca, algo real sobre quem a pessoa é e o que está vivendo — entregando substância, não apenas conduzindo perguntas.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
LINGUAGEM E COMUNICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use sempre linguagem simples, acessível, como se estivesse conversando com alguém sem nenhum conhecimento técnico.

Evite termos médicos ou científicos. Substitua sempre por palavras do dia a dia:
- "encéfalo" → "cérebro"
- "neocortical" → "parte racional do cérebro"
- "glândulas adrenais" → "glândulas que liberam adrenalina quando você se assusta"
- "cortisol" → "hormônio do estresse"
- "amígdala" → "parte do cérebro que dispara o alarme emocional"
- "sistema nervoso autônomo" → "sistema do corpo que controla reações automáticas"
- "fisiologia" → "como o corpo funciona"

Quando precisar explicar algo mais complexo, use comparações do cotidiano. Exemplos:
- "É como quando você deixa o celular sem carregar por dias — o corpo funciona igual."
- "Imagine que seu sistema nervoso é um alarme de carro muito sensível..."

Prefira frases curtas. Uma ideia por vez.

Se usar qualquer palavra que o público possa não conhecer, explique logo em seguida, entre parênteses ou na frase seguinte.`;

const REPORT_PROMPT = `Você é o sistema de geração do Mapa Integrativo ZUNI Suprema — o relatório personalizado entregue ao final de cada sessão de mentoria.

Com base no histórico completo da sessão, gere um documento profundo, preciso e genuinamente personalizado. Este não é um relatório genérico — é o espelho da jornada desta pessoa específica, escrito com a linguagem e a filosofia da ZUNI Suprema.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
DIRETRIZES DE TOM E ESTILO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Tom: firme, empático, inteligente, direto. Sem clichês motivacionais.
- Linguagem: acessível mas precisa. Nunca superficial.
- Perspectiva: trate a pessoa pelo nome. Fale diretamente com ela, não sobre ela.
- Extensão: suficiente para ser substancial, não tão longo que se torne difuso.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTRUTURA DO MAPA INTEGRATIVO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

ABERTURA — O MOMENTO ATUAL
Escreva um parágrafo de abertura que reflita com precisão o estado em que a pessoa chegou à sessão. Não repita o que ela disse — interprete. Nomeie o que foi revelado com clareza e compaixão.

SEÇÃO 1 — MAPEAMENTO DO ESTADO ATUAL
Descreva com profundidade: a queixa principal e como ela se manifesta, os padrões subjacentes identificados, a raiz provável do que está sendo vivido, e como esse padrão tem afetado as diferentes dimensões da vida.

SEÇÃO 2 — O QUE ESTE PADRÃO REVELA
Vá além do sintoma. Ofereça a perspectiva mais profunda sobre o que está por trás do que foi trazido. Conecte com conhecimento de psicologia, neurociência e desenvolvimento humano.

SEÇÃO 3 — SUA LINHA DE CONDUÇÃO
Apresente até 5 direcionamentos específicos para esta pessoa. Cada um com: o que fazer, por que importa para este caso, e como começar.

SEÇÃO 4 — CHECKLIST DE ATITUDES DIÁRIAS
Crie 5 a 7 atitudes diárias personalizadas. Cada item: a atitude + justificativa breve + melhor momento do dia. Tom: direto e imperativo. Use: Faça, Reserve, Pratique, Elimine, Observe.

SEÇÃO 5 — DIRECIONAMENTO INTELECTUAL E DE DESENVOLVIMENTO
Sugira: uma perspectiva filosófica ou psicológica relevante, uma área de conhecimento ou prática de apoio, e uma reflexão ou pergunta para os próximos dias.

SEÇÃO 6 — PRÓXIMOS PASSOS E SUPORTE DISPONÍVEL
Encerre com:
"Este Mapa é o começo de uma jornada, não o fim dela. O que foi revelado aqui pode ser aprofundado, sustentado e expandido com o suporte certo.

Se o que viveu nesta sessão tocou algo que merece atenção mais profunda — ou se deseja continuar esse processo com acompanhamento profissional personalizado — nossa equipe oferece uma avaliação inicial gratuita, sem compromisso.

É uma conversa real com um profissional habilitado, focada em entender seu momento e indicar o melhor caminho para você.

Para agendar, clique no botão verde do WhatsApp no canto da tela e mencione que veio do Mapa Integrativo ZUNI Suprema."

ENCERRAMENTO
Um parágrafo final que honre o que a pessoa trouxe e o que foi construído na sessão. Sem exagero emocional — com autenticidade e precisão.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRAS INVIOLÁVEIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Nunca diagnostique condições clínicas formais
- Nunca recomende medicamentos ou suplementos
- Nunca invente informações que não foram compartilhadas na sessão
- Se a sessão revelou risco de vida, inclua na Seção 6: CVV 188 | SAMU 192
- Cada relatório deve ser genuinamente único — a pessoa deve reconhecer sua própria história nele

━━━━━━━━━━━━━━━━━━━━━━━━━━━
LINGUAGEM E COMUNICAÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use sempre linguagem simples, acessível, como se estivesse conversando com alguém sem nenhum conhecimento técnico.

Evite termos médicos ou científicos. Substitua sempre por palavras do dia a dia:
- "encéfalo" → "cérebro"
- "neocortical" → "parte racional do cérebro"
- "glândulas adrenais" → "glândulas que liberam adrenalina quando você se assusta"
- "cortisol" → "hormônio do estresse"
- "amígdala" → "parte do cérebro que dispara o alarme emocional"
- "sistema nervoso autônomo" → "sistema do corpo que controla reações automáticas"
- "fisiologia" → "como o corpo funciona"

Quando precisar explicar algo mais complexo, use comparações do cotidiano. Exemplos:
- "É como quando você deixa o celular sem carregar por dias — o corpo funciona igual."
- "Imagine que seu sistema nervoso é um alarme de carro muito sensível..."

Prefira frases curtas. Uma ideia por vez.

Se usar qualquer palavra que o público possa não conhecer, explique logo em seguida, entre parênteses ou na frase seguinte.`;

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.redirect('/checkout');
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/chat.html'));
});

app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/checkout.html'));
});

app.get('/obrigado', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/obrigado.html'));
});
app.use(express.json());

function buildSuccessUrl(sessionId) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/chat.html?sessionId=${sessionId}`;
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

    return data.map(row => row.corpo);
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
      max_tokens: 4096,
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

    // Página de capa
    const capaPath = path.join(__dirname, '../public/capa-pdf.jpg');
    if (fs.existsSync(capaPath)) {
      doc.image(capaPath, 0, 0, { fit: [595.28, 841.89], align: 'center', valign: 'center' });
      doc.addPage();
    }

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
async function gerarEEnviarRelatorio(sessionId) {
  const session = await getSession(sessionId);
  if (!session) throw new Error(`Sessão ${sessionId} não encontrada para gerar relatório.`);

  const reportText = await generateReportText(session);
  const pdfPath = await generatePdf(reportText, sessionId, session.name);
  await sendEmail(session.email, session.name, pdfPath);
  await triggerMake(session.name, session.email, reportText.slice(0, 1200));
}
async function consultarPedidoMercadoPago(pedidoId) {
  const mpRes = await fetch(`https://api.mercadopago.com/v1/orders/${pedidoId}`, {
    headers: { 'Authorization': `Bearer ${process.env.MERCADOPAGO_TOKEN}` }
  });

  if (!mpRes.ok) {
    const errText = await mpRes.text();
    throw new Error(`Erro ao consultar pedido no Mercado Pago (status ${mpRes.status}): ${errText}`);
  }

  return mpRes.json();
}

async function consultarPagamentoMercadoPago(paymentId) {
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { 'Authorization': `Bearer ${process.env.MERCADOPAGO_TOKEN}` }
  });

  if (!mpRes.ok) {
    const errText = await mpRes.text();
    throw new Error(`Erro ao consultar pagamento no Mercado Pago (status ${mpRes.status}): ${errText}`);
  }

  return mpRes.json();
}

async function marcarPagoSeAprovado(order) {
  const isPaid = order.status === 'approved' ||
                 Boolean(order.transactions?.payments?.some(p => p.status === 'approved'));

  if (isPaid && order.external_reference) {
    const session = await getSession(order.external_reference);
    if (session && !session.paid) {
      session.paid = true;
      await upsertSession(session);
    }
  }

  return isPaid;
}

app.get('/api/mercadopago/public-key', (req, res) => {
  const publicKey = process.env.MERCADOPAGO_PUBLIC_KEY;

  if (!publicKey) {
    return res.status(500).json({ error: 'Mercado Pago não configurado.' });
  }

  return res.json({ publicKey });
});

app.post('/api/checkout/preference', async (req, res) => {
  try {
    const { name, email, cpf } = req.body;

    if (!name || !email || !cpf) {
      return res.status(400).json({ error: 'Nome, email e CPF são obrigatórios.' });
    }

    if (!mpClient) {
      return res.status(500).json({ error: 'Mercado Pago não configurado.' });
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

    await upsertSession(session);

    const [firstName, ...restName] = name.trim().split(/\s+/);
    const lastName = restName.join(' ') || firstName;
    const frontendUrl = process.env.FRONTEND_URL;

    const preference = new Preference(mpClient);
    const result = await preference.create({
      body: {
        items: [
          {
            id: 'mapa-integrativo',
            title: 'Mapa Integrativo',
            quantity: 1,
            unit_price: 29.90,
            currency_id: 'BRL'
          }
        ],
        payer: {
          name: firstName,
          surname: lastName,
          email,
          identification: { type: 'CPF', number: cpf }
        },
        external_reference: sessionId,
        back_urls: {
          success: `${frontendUrl}/checkout.html?sessionId=${sessionId}&status=retorno`,
          pending: `${frontendUrl}/checkout.html?sessionId=${sessionId}&status=retorno`,
          failure: `${frontendUrl}/checkout.html?erro=1`
        },
        // auto_return exige back_urls públicas em HTTPS — indisponível em dev local (http://localhost)
        ...(frontendUrl.startsWith('https://') ? { auto_return: 'approved' } : {})
      }
    });

    return res.json({ sessionId, init_point: result.init_point });
  } catch (error) {
    console.error('Erro ao criar preferência Mercado Pago:', error);
    return res.status(500).json({ error: 'Erro ao gerar link de pagamento.' });
  }
});

app.get('/api/checkout/session-status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ pago: false });
    return res.json({ pago: Boolean(session.paid) });
  } catch (error) {
    console.error('Erro em /api/checkout/session-status:', error);
    return res.status(500).json({ pago: false });
  }
});

app.post('/api/checkout', async (req, res) => {
  try {
    const { name, email, cpf, metodoPagamento } = req.body;

    if (!name || !email || !cpf || !metodoPagamento) {
      return res.status(400).json({ error: 'Nome, email, CPF e método de pagamento são obrigatórios.' });
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

    await upsertSession(session);

    const [firstName, ...restName] = name.trim().split(/\s+/);
    const lastName = restName.join(' ') || firstName;

    const paymentMethod = { id: 'pix', type: 'bank_transfer' };

    const payment = {
      amount: '29.90',
      payment_method: paymentMethod
    };

    const orderBody = {
      type: 'online',
      total_amount: '29.90',
      external_reference: sessionId,
      processing_mode: 'automatic',
      transactions: {
        payments: [payment]
      },
      payer: {
        email,
        first_name: firstName,
        last_name: lastName,
        identification: { type: 'CPF', number: cpf }
      }
    };

    const mpRes = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MERCADOPAGO_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': uuidv4()
      },
      body: JSON.stringify(orderBody)
    });

    if (!mpRes.ok) {
      const errText = await mpRes.text();
      const requestId = mpRes.headers.get('x-request-id');
      console.error('Erro Mercado Pago:', mpRes.status, errText, '| x-request-id:', requestId);
      return res.status(502).json({ error: 'Erro ao criar pedido no Mercado Pago.', status: mpRes.status, detail: errText, requestId });
    }

    const order = await mpRes.json();
    const paymentResponse = order.transactions?.payments?.[0];

    const qrCodeText = paymentResponse?.payment_method?.qr_code || '';
    const qrCodeImage = paymentResponse?.payment_method?.qr_code_base64 || '';

    if (!qrCodeText) {
      console.error('Mercado Pago não retornou QR Code PIX:', JSON.stringify(order));
      return res.status(502).json({ error: 'Erro ao gerar QR Code PIX.' });
    }

    return res.json({ sessionId, pedidoId: order.id, qrCodeText, qrCodeImage });
  } catch (error) {
    console.error('Erro em /api/checkout:', error);
    return res.status(500).json({ error: 'Erro ao criar pedido.' });
  }
});

app.post('/api/pagamento/webhook', async (req, res) => {
  try {
    const event = req.body;
    const dataId = event.data?.id;

    if (event.type === 'order' && dataId) {
      const order = await consultarPedidoMercadoPago(dataId);
      const pago = await marcarPagoSeAprovado(order);
      if (pago) {
        console.log(`[WEBHOOK] Pagamento confirmado — pedido ${dataId}`);
      }
    } else if (event.type === 'payment' && dataId) {
      const payment = await consultarPagamentoMercadoPago(dataId);
      const pago = await marcarPagoSeAprovado(payment);
      if (pago) {
        console.log(`[WEBHOOK] Pagamento confirmado — pagamento ${dataId}`);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('Erro em /api/pagamento/webhook:', error);
    return res.status(400).json({ error: error.message });
  }
});

app.get('/api/checkout/status/:pedidoId', async (req, res) => {
  try {
    const { pedidoId } = req.params;
    const order = await consultarPedidoMercadoPago(pedidoId);
    const pago = await marcarPagoSeAprovado(order);
    return res.json({ pago });
  } catch (error) {
    console.error('Erro em /api/checkout/status:', error);
    return res.status(500).json({ pago: false });
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

    await upsertSession(session);

    const welcomeMessage = `Olá ${name}, bem-vindo(a) ao Mentor ZUNI Suprema. Sua jornada começa agora.`;

    return res.json({ sessionId, message: welcomeMessage, counter: session.counter });
  } catch (error) {
    console.error('Erro em /api/sessao/iniciar:', error);
    return res.status(500).json({ error: 'Erro ao iniciar a sessão.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId e message são obrigatórios.' });
    }

    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }

    if (!session.paid) {
      return res.status(403).json({ error: 'Sessão não liberada. Aguarde a confirmação do pagamento.' });
    }

    session.counter += 1;
// ── BLOQUEIO RÍGIDO DE LIMITE DE INTERAÇÕES ────────────
    const LIMITE_INTERACOES = 15;

    if (session.counter > LIMITE_INTERACOES) {
      const mensagemEncerramento = `Chegamos ao fim desta sessão. O que foi revelado aqui já forma uma base sólida — vou preparar agora o seu Mapa Integrativo, que será enviado para o seu email em breve. Se quiser continuar essa jornada com acompanhamento mais profundo, nossa equipe de suporte natural integrativo está sempre à disposição pelo WhatsApp, no canto da tela. Cuide-se.`;

      if (!session.relatorioGerado) {
        session.relatorioGerado = true;
        await upsertSession(session);
        setTimeout(async () => {
          try {
            await gerarEEnviarRelatorio(sessionId);
            console.log(`[RELATORIO] Gerado por limite de interações — sessão ${sessionId}`);
          } catch (err) {
            console.error(`[RELATORIO] Erro:`, err);
          }
        }, 2000);
      }

      return res.json({ texto: mensagemEncerramento, audio: '', contador: session.counter, sessaoEncerrada: true });
    }
    // ────────────────────────────────────────────────────────
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
    await upsertSession(session);
// ── GATILHO SEMÂNTICO DE ENCERRAMENTO ──────────────────
    const sinaisDeEncerramento = [
      'mapa integrativo zuni suprema',
      'será enviado para o seu email',
      'relatório completo e personalizado',
      'esta sessão está chegando ao seu momento',
      'vou preparar o seu mapa',
      'cuide-se',
      'até logo'
    ];

    const encerramentoDetetado = sinaisDeEncerramento.some(sinal =>
      responseText.toLowerCase().includes(sinal.toLowerCase())
    );

    if (encerramentoDetetado && !session.relatorioGerado) {
      session.relatorioGerado = true;
      await upsertSession(session);
      setTimeout(async () => {
        try {
          await gerarEEnviarRelatorio(sessionId);
          console.log(`[RELATORIO] Gerado por encerramento — sessão ${sessionId}`);
        } catch (err) {
          console.error(`[RELATORIO] Erro:`, err);
        }
      }, 2000);
    }
    // ────────────────────────────────────────────────────────

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

    const session = await getSession(sessionId);

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
app.get('/api/relatorio/download/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }

    if (!session.paid) {
      return res.status(403).json({ error: 'Sessão não liberada. Aguarde a confirmação do pagamento.' });
    }

    const reportText = await generateReportText(session);
    const pdfPath = await generatePdf(reportText, sessionId, session.name);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="mapa-integrativo-${session.name.toLowerCase().replace(/\s+/g, '-')}.pdf"`);
    res.sendFile(pdfPath);
  } catch (error) {
    console.error('Erro em /api/relatorio/download:', error);
    res.status(500).json({ error: 'Erro ao gerar PDF para download.' });
  }
});
// ROTA DE DESENVOLVIMENTO — permite gerar o relatório de qualquer sessão
// sem depender do contador de 20 mensagens. Bloqueada em produção, exceto
// se a sessão já tiver pelo menos 3 mensagens no histórico.
app.get('/api/relatorio/teste/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId é obrigatório.' });
    }

    const session = await getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }

    if (!session.paid) {
      return res.status(403).json({ error: 'Sessão não liberada. Aguarde a confirmação do pagamento.' });
    }

    const isDev = process.env.NODE_ENV !== 'production';
    const temHistoricoSuficiente = (session.history || []).length >= 3;

    if (!isDev && !temHistoricoSuficiente) {
      return res.status(403).json({ error: 'Rota de teste indisponível em produção para esta sessão.' });
    }

    const reportText = await generateReportText(session);
    const pdfPath = await generatePdf(reportText, sessionId, session.name);
    await sendEmail(session.email, session.name, pdfPath);
    await triggerMake(session.name, session.email, reportText.slice(0, 1200));

    return res.json({ relatório: reportText });
  } catch (error) {
    console.error('Erro em /api/relatorio/teste/:sessionId:', error);
    return res.status(500).json({ error: 'Erro ao gerar o relatório de teste.' });
  }
});

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/transcrever', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo de áudio não recebido.' });
    }

    const formData = new FormData();
    formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: formData
    });

    if (!response.ok) {
      const erro = await response.text();
      console.error('Erro Whisper:', erro);
      return res.status(500).json({ erro: 'Erro ao transcrever áudio.' });
    }

    const data = await response.json();
    return res.json({ texto: data.text });
  } catch (error) {
    console.error('Erro em /api/transcrever:', error);
    return res.status(500).json({ erro: 'Erro interno ao transcrever.' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor ZUNI Suprema escutando na porta ${PORT}`);
});

