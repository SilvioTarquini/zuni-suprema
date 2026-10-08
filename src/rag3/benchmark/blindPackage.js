'use strict';
// rag3/benchmark/blindPackage.js — monta o pacote de avaliação CEGA (documento do avaliador + BLIND_KEY separada).
// Os rótulos visíveis são sorteados de novo a cada execução: o sorteio usa um SAL aleatório gravado SÓ na chave; nada do que o avaliador vê
// (nome de provider, modelo, letra A/B/C/D, custo, retrieval) aparece no documento. Nada daqui imprime a chave.
const crypto = require('crypto');
const { mulberry32, sementeDeTexto } = require('./rubric');
const R2 = require('./rubricC2b');

function novoSal() { return crypto.randomBytes(16).toString('hex'); }

function embaralhar(lista, sal, caso) {
  const rnd = mulberry32(sementeDeTexto(`zuni-c2b:${sal}:${caso}`)); const o = [...lista];
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}

function montarPacoteCego({ casos, artefatos, sal = novoSal(), titulo = 'ZUNI DIRECIONA — C2-B — Avaliação humana CEGA' }) {
  const itens = []; const chave = { versao: 'c2b', sal, itens: {} };
  for (const c of casos) {
    const lista = artefatos.filter((a) => a.case_id === c.id && a.response); if (!lista.length) continue;
    const ordem = embaralhar(lista, sal, c.id); const id = 'caso-' + c.id.replace('c', '');
    chave.itens[id] = { case_id: c.id, mapa: Object.fromEntries(ordem.map((a, i) => [String(i + 1), { variante: a.variant, letra: a.letra || null, provider: a.provider, modelo: a.model }])) };
    itens.push({ id, contexto: { historico: c.history || [], mensagem: c.message }, respostas: ordem.map((a, i) => ({ rotulo: 'Resposta ' + (i + 1), texto: a.response })) });
  }
  const md = [`# ${titulo}\n`];
  md.push('Cada caso traz a pergunta (sintética) e respostas anônimas. Avalie cada resposta sem tentar descobrir quem a escreveu. A recomendação de livro é avaliada à parte e **não** entra nas notas.\n');
  md.push('> ' + R2.CRITERIO_ZUNI + ' (critério de avaliação — não presuma que respostas mais longas são melhores)\n');
  md.push('**Dimensões (0–5):** ' + R2.DIMENSOES_C2B.join(' · ') + '\n');
  md.push('**adequacao_ao_nivel_do_usuario** — ' + R2.PERGUNTAS.adequacao + ' ' + Object.entries(R2.GUIA_ADEQUACAO).map(([n, t]) => n + ': ' + t).join(' · ') + '\n');
  md.push('**Penalidades (valores inteiros):** `ai_like_style_penalty` (0 a −2) · `evasion_penalty` (0 a −2)\n');
  for (const p of R2.PENALIDADES) md.push(`- **${p}:** ${R2.GUIA_PENALIDADES[p]}`);
  md.push('\n**Perguntas por resposta:**');
  Object.values(R2.PERGUNTAS).forEach((q, i) => md.push(`${i + 1}. ${q}`)); md.push('');
  for (const it of itens) {
    md.push(`\n---\n\n## ${it.id.toUpperCase()}\n`);
    if (it.contexto.historico.length) { md.push('**Conversa anterior (sintética):**\n'); it.contexto.historico.forEach((h) => md.push(`> **${h.role === 'user' ? 'Pessoa' : 'Mentor'}:** ${h.content}`)); md.push(''); }
    md.push(`**Pergunta atual da pessoa:**\n\n> ${it.contexto.mensagem}\n`);
    for (const r of it.respostas) {
      md.push(`\n### ${r.rotulo}\n\n${r.texto}\n`);
      md.push(`**Notas (0–5):** ${R2.DIMENSOES_C2B.map((d) => d + ': __').join(' · ')}\n`);
      md.push('**Penalidades:** ai_like_style_penalty: __ · evasion_penalty: __\n');
      md.push(`**1.** ${R2.PERGUNTAS.acrescentou} __\n\n**2.** ${R2.PERGUNTAS.pagaria}: __\n\n**3.** ${R2.PERGUNTAS.classificacao}: __\n\n**4.** ${R2.PERGUNTAS.nao_explicitado} __\n\n**5.** ${R2.PERGUNTAS.investigou} __\n`);
    }
  }
  const json = { instrucoes: 'avaliação cega', criterio_zuni: R2.CRITERIO_ZUNI, guia_adequacao: R2.GUIA_ADEQUACAO, dimensoes: R2.DIMENSOES_C2B, penalidades: R2.PENALIDADES, guia_penalidades: R2.GUIA_PENALIDADES, perguntas: R2.PERGUNTAS, itens };
  return { md: md.join('\n'), json, chave };
}

module.exports = { montarPacoteCego, novoSal, embaralhar };
