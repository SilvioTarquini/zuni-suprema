// scripts/lote/residuos.js
//
// Trava de resíduos de conversa com IA. Procura, SEM diferenciar caixa nem espaços:
//   (1) os trechos literais já removidos de qualquer obra (obras-lote/remocoes/*.json): se um deles voltar, é BLOQUEIO;
//   (2) pistas genéricas de bastidor, em dois níveis:
//         BLOQUEIO — frases que só existem em conversa com assistente ("Aqui está o próximo capítulo", "como modelo de
//                    linguagem", "reescrito integralmente"…). Qualquer ocorrência barra a geração/o envio.
//         AVISO    — pistas que PODEM ser texto legítimo do livro ("Vamos continuar", "Claro,", "Este capítulo
//                    aprofunda…"). Aparecem no relatório com o contexto, para decisão humana, e não barram sozinhas.
// Serve para o texto da loja, o texto-fonte do PDF, o texto extraído do PDF (pdftotext) e o texto do objeto no bucket.

const fs = require('fs');
const path = require('path');

const PASTA_REMOCOES = path.join(__dirname, '..', '..', 'obras-lote', 'remocoes');

const norm = (t) => String(t).normalize('NFKC').replace(/­/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const PISTAS_BLOQUEIO = [
  ['modelo de linguagem', /como (um )?modelo de linguagem|\bmodelo de ia\b|\bsou uma ia\b|como assistente (de ia|virtual)/i],
  ['"Aqui está…" de assistente', /\baqui (est[áa]|vai|segue) (o|a|os|as|um|uma)\s+(pr[oó]xim[oa]s?\s+)?(cap[ií]tulo|bloco|sum[aá]rio|vers[aã]o|texto|trecho|parte|reescrita|rascunho)\b/i],
  ['"reescrito integralmente"', /reescrit[oa]s? integralmente|padr[aã]o editorial de livro impresso/i],
  ['oferta de assistente', /\bquer que eu (continue|escreva|reescreva|ajuste|gere|aprofunde|detalhe|siga|prepare|monte|crie)\b|\bposso (ajustar|reescrever|aprofundar|continuar|gerar) (o|a|os|as|esse|essa|este|esta)\b/i],
  ['"Sumário Oficial/Sanitizado"', /sum[aá]rio oficial|sanitizado/i],
  ['marca de IA', /\bchat ?gpt\b|\bopenai\b|\banthropic\b|\bgpt-?\d\b/i],
  ['marcador de rascunho', /\[(inserir|colocar|completar|a definir|todo|tbd)[^\]]*\]|\bLorem ipsum\b/i],
  ['instrução ao modelo', /^\s*(a )?autora? de uma narrativa ao estilo\b|\bno estilo de machado de assis\b.*\bintercal/i]
];

const PISTAS_AVISO = [
  ['"Este capítulo aprofunda/marca…"', /^\s*(este|neste) cap[ií]tulo (aprofunda|marca|encerra|apresenta|explora|mostra)\b/i],
  ['"Vamos continuar/seguir/aprofundar"', /^\s*vamos (continuar|seguir|aprofundar|avançar)\b/i],
  ['abertura de assistente ("Claro,")', /^\s*(claro|com certeza|perfeito|[óo]timo|certamente)[,.!]\s/i],
  ['oferta passiva ("me avise se…")', /\bme avise se\b|\bfique à vontade para (pedir|ajustar)\b/i],
  ['"Opção N"/"Versão N"', /^\s*(op[cç][aã]o|vers[aã]o)\s+\d+\s*[:.)-]/i],
  ['emoji de assistente', /[\u{1F300}-\u{1FAFF}✅✨]/u],
  ['marcação markdown', /(^|\n)\s*(#{1,4}\s|\*\*[^*\n]{3,}\*\*\s*$)/],
  ['nome de modelo (pode ser nome próprio)', /\b(claude|gemini|copilot)\b/i]
];

function carregarLiterais(pasta = PASTA_REMOCOES) {
  const out = [];
  if (!fs.existsSync(pasta)) return out;
  for (const f of fs.readdirSync(pasta).filter((x) => x.endsWith('.json')).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(pasta, f), 'utf8'));
    for (const r of j.remocoes || []) out.push({ slug: j.slug, trecho: r.trecho, norm: norm(r.trecho) });
  }
  return out;
}

function contexto(texto, i, tam = 90) {
  return texto.slice(Math.max(0, i - 30), i + tam).replace(/\s+/g, ' ').trim();
}

// Varre UM texto. `rotulo` = onde está sendo procurado (ex.: "pdf", "html-loja").
function varrer(texto, { literais = carregarLiterais(), rotulo = '' } = {}) {
  const bloqueios = [];
  const avisos = [];
  const t = String(texto);
  const tn = norm(t);
  for (const l of literais) {
    // trechos muito curtos (títulos como "Elementos Psicológicos:") só valem se forem o parágrafo inteiro — ver abaixo
    if (l.norm.length < 25) continue;
    const i = tn.indexOf(l.norm);
    if (i >= 0) bloqueios.push({ rotulo, regra: `trecho removido de ${l.slug} voltou`, contexto: l.trecho.slice(0, 90) });
  }
  // parágrafos curtos removidos: comparação por parágrafo inteiro
  const curtos = new Set(literais.filter((l) => l.norm.length < 25).map((l) => l.norm));
  if (curtos.size) {
    for (const par of t.split(/\n\s*\n|\n/)) {
      if (curtos.has(norm(par))) bloqueios.push({ rotulo, regra: 'parágrafo removido voltou', contexto: par.trim().slice(0, 90) });
    }
  }
  for (const [nome, re] of PISTAS_BLOQUEIO) {
    const m = re.exec(t);
    if (m) bloqueios.push({ rotulo, regra: nome, contexto: contexto(t, m.index) });
  }
  // pistas de aviso: por parágrafo (a maioria é âncora de início de parágrafo)
  const paragrafos = t.split(/\n/);
  for (const [nome, re] of PISTAS_AVISO) {
    let n = 0; let primeiro = '';
    for (const p of paragrafos) { if (re.test(p)) { n++; if (!primeiro) primeiro = p.replace(/\s+/g, ' ').trim().slice(0, 100); } }
    if (n) avisos.push({ rotulo, regra: nome, ocorrencias: n, contexto: primeiro });
  }
  return { bloqueios, avisos };
}

module.exports = { varrer, carregarLiterais, norm, PISTAS_BLOQUEIO, PISTAS_AVISO, PASTA_REMOCOES };
