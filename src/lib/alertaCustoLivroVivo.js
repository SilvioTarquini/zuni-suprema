// lib/alertaCustoLivroVivo.js
//
// Alerta de custo MENSAL do Livro-Vivo. Estima o gasto do mês somando as perguntas registradas em
// uso_chat_livro (a mesma tabela do limite diário) × custo médio por pergunta, e avisa quando passa de
// 80% e de 100% do orçamento mensal. Só observa: nunca bloqueia nem altera a resposta ao leitor.
//
// Variáveis (todas opcionais):
//   CHAT_LIVRO_ORCAMENTO_MENSAL_REAIS  orçamento do mês (default 500)
//   CHAT_LIVRO_CUSTO_PERGUNTA_REAIS    custo médio por pergunta (default 0,16 — registro de 01/09/2026)
//   LIVRO_VIVO_ALERTA_EMAIL            se definida, o alerta também vai por e-mail (src/lib/email.js)
//
// O alerta SEMPRE vai para o log do Railway com o prefixo [ALERTA_CUSTO_LIVRO_VIVO] (procurável).
// Cada limiar avisa uma vez por mês por processo; reiniciar o servidor pode repetir o aviso.

const ORCAMENTO = parseFloat(process.env.CHAT_LIVRO_ORCAMENTO_MENSAL_REAIS || '500');
const CUSTO_PERGUNTA = parseFloat(process.env.CHAT_LIVRO_CUSTO_PERGUNTA_REAIS || '0.16');
const LIMIARES = [0.8, 1.0];
const CACHE_MS = 10 * 60 * 1000;

let cache = { mes: null, at: 0, perguntas: 0 };
let avisados = new Set(); // `${mes}:${limiar}`
let consultando = false;

function mesAtual() { return new Date().toISOString().slice(0, 7); }

async function somarPerguntasDoMes(mes) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) return null;
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  let total = 0;
  for (let de = 0; de < 100000; de += 1000) {
    const { data, error } = await supabase
      .from('uso_chat_livro').select('perguntas').gte('data', `${mes}-01`).range(de, de + 999);
    if (error) throw new Error(error.message);
    total += data.reduce((s, r) => s + (r.perguntas || 0), 0);
    if (data.length < 1000) break;
  }
  return total;
}

async function avisar(mes, limiar, perguntas, gasto) {
  const chave = `${mes}:${limiar}`;
  if (avisados.has(chave)) return;
  avisados.add(chave);
  const pct = Math.round(limiar * 100);
  const msg = `Livro-Vivo passou de ${pct}% do orçamento de ${mes}: ${perguntas} perguntas ≈ R$ ${gasto.toFixed(2)} de R$ ${ORCAMENTO.toFixed(2)}.`;
  console.error(`[ALERTA_CUSTO_LIVRO_VIVO] ${msg}`);
  if (process.env.LIVRO_VIVO_ALERTA_EMAIL) {
    try {
      const { enviarEmail } = require('./email');
      await enviarEmail({ to: process.env.LIVRO_VIVO_ALERTA_EMAIL, subject: `Alerta de custo do Livro-Vivo (${pct}%)`, html: `<p>${msg}</p>`, tipo: 'alerta_custo_livro_vivo' });
    } catch (e) {
      console.error('[ALERTA_CUSTO_LIVRO_VIVO] Falha ao enviar e-mail:', e.message);
    }
  }
}

/** Chamar (sem await) depois de uma resposta bem-sucedida. Nunca lança. */
async function verificarCustoMensal() {
  try {
    const mes = mesAtual();
    const agora = Date.now();
    if (cache.mes !== mes || agora - cache.at > CACHE_MS) {
      if (consultando) return;
      consultando = true;
      try {
        const total = await somarPerguntasDoMes(mes);
        if (total === null) return;
        cache = { mes, at: agora, perguntas: total };
      } finally { consultando = false; }
    }
    const gasto = cache.perguntas * CUSTO_PERGUNTA;
    for (const limiar of LIMIARES) {
      if (gasto >= ORCAMENTO * limiar) await avisar(mes, limiar, cache.perguntas, gasto);
    }
  } catch (e) {
    console.error('[ALERTA_CUSTO_LIVRO_VIVO] Falha ao calcular o custo:', e.message);
  }
}

module.exports = { verificarCustoMensal, ORCAMENTO, CUSTO_PERGUNTA };
