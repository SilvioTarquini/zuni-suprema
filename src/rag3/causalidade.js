'use strict';
// rag3/causalidade.js — CAUSALIDADE AMPLIADA + FATORES ADJACENTES (C2-B), determinístico e testável, sem LLM.
// Produz uma ORIENTAÇÃO INVESTIGATIVA em forma de HIPÓTESES para o modelo avaliar (nunca fatos): direção causal ambígua, fatores adjacentes
// plausíveis ainda NÃO mencionados e, no máximo, UMA pergunta investigativa de alto valor. O texto é idêntico para qualquer provider.
const { normalizar } = require('./util');

const cabe = (t, r) => new RegExp(`(^|[^a-z0-9])${r}`).test(t);
const algum = (t, lista) => lista.some((r) => cabe(t, r));

// Pares em que a relação mais evidente pode ser, na verdade, consequência (ou ciclo): a→b e b→a.
const PARES_CAUSAIS = Object.freeze([
  { id: 'cafeina_sono', a: 'cafeina', b: 'sono', hipotese: 'A pessoa pode ter passado a usar mais cafeína porque já dormia mal; depois, a cafeína pode manter ou agravar a insônia (ciclo de retroalimentação), sem ter sido necessariamente a origem.', pergunta: 'O sono já estava ruim antes de você aumentar o café, ou piorou depois?' },
  { id: 'estresse_sono', a: 'estresse', b: 'sono', hipotese: 'O estresse pode estar atrapalhando o sono, mas dormir mal também reduz a tolerância ao estresse; vale investigar qual veio primeiro.', pergunta: 'O que mudou na sua vida ou no seu trabalho por volta de quando o sono começou a piorar?' },
  { id: 'comer_ansiedade', a: 'alimentacao', b: 'ansiedade', hipotese: 'Comer pode ser uma estratégia de alívio da ansiedade, e a restrição anterior, a fome acumulada ou o sono ruim podem alimentar o ciclo.', pergunta: 'Esses episódios costumam vir depois de um dia de pouca comida, de muita tensão, ou dos dois?' },
  { id: 'peso_ansiedade', a: 'peso', b: 'ansiedade', hipotese: 'A ansiedade pode alimentar episódios de comer, e a culpa e a restrição posteriores podem reforçar o ciclo; o peso pode ser consequência, não o ponto de partida.', pergunta: 'O que costuma acontecer logo antes de você comer nesses momentos?' },
  { id: 'ansiedade_relacionamento', a: 'ansiedade', b: 'relacionamento', hipotese: 'A ansiedade pode ter raízes em histórias anteriores e ser ativada pela situação atual; vale distinguir o que o comportamento real da outra pessoa justifica do que é interpretação.', pergunta: 'Essa reação aparece também em outras relações ou só nesta?' },
  { id: 'humor_energia', a: 'humor', b: 'energia', hipotese: 'O cansaço pode ser parte do humor baixo, mas também pode vir de sono, alimentação ou de uma causa física; vale investigar sem assumir uma só direção.', pergunta: 'O cansaço veio junto com o desânimo ou apareceu antes dele?' },
  { id: 'sono_ansiedade', a: 'sono', b: 'ansiedade', hipotese: 'A ansiedade pode atrapalhar o sono, e a privação de sono pode aumentar a ansiedade; vale investigar qual veio primeiro.', pergunta: 'A preocupação aparece antes de deitar ou o sono ruim vem primeiro e a ansiedade depois?' }
]);

const MARCADORES_TEMPORAIS = ['antes d', 'desde antes', 'ja (dormia|era|tinha|estava)', 'comecou (depois|antes)', 'depois que', 'desde que', 'logo apos', 'foi depois', 'foi antes', 'piorou depois', 'piorou quando'];

// Fatores adjacentes plausíveis por conceito (ordem = prioridade). `mencionado`: termos que indicam que a pessoa já falou do fator.
// `quando`: condição opcional para só entrar se o contexto sustentar (evita lista genérica).
const FATORES = Object.freeze({
  sono: [
    { id: 'estresse_preocupacao', rotulo: 'estresse ou preocupação (trabalho, finanças, conflitos)', mencionado: ['estress', 'preocupa', 'ansied', 'trabalh', 'divida', 'conflit', 'pressao'] },
    { id: 'horarios_rotina', rotulo: 'horários irregulares e rotina de trabalho', mencionado: ['horario', 'turno', 'madrugada', 'rotina', 'noturn'] },
    { id: 'alcool_estimulantes', rotulo: 'álcool, nicotina ou outros estimulantes', mencionado: ['alcool', 'vinho', 'cerveja', 'nicotin', 'cigarro', 'energetic'] },
    { id: 'ambiente', rotulo: 'ambiente do quarto (luz, ruído, temperatura, telas)', mencionado: ['quarto', 'luz', 'barulho', 'ruido', 'temperatura', 'tela', 'celular'] },
    { id: 'dor_saude_fisica', rotulo: 'dor, refluxo ou outra condição física', mencionado: ['dor', 'refluxo', 'coluna'], quando: ['semanas', 'meses', 'sempre', 'acord'] },
    { id: 'respiracao_no_sono', rotulo: 'respiração durante o sono (ronco, pausas respiratórias)', mencionado: ['ronc', 'apneia', 'engasg'], quando: ['acord', 'cansad', 'semanas', 'meses', 'nao descans'] }
  ],
  ansiedade: [
    { id: 'historia_anterior', rotulo: 'experiências anteriores que o corpo reconhece como ameaça', mencionado: ['infancia', 'antes d', 'sempre fui', 'historia'] },
    { id: 'sono_cafeina', rotulo: 'sono ruim e consumo de cafeína', mencionado: ['sono', 'dormi', 'cafe', 'cafeina'] },
    { id: 'sobrecarga_atual', rotulo: 'sobrecarga atual (trabalho, família, finanças)', mencionado: ['trabalh', 'sobrecarg', 'famil', 'divida', 'pressao'] }
  ],
  relacionamento: [
    { id: 'historia_relacional', rotulo: 'a história relacional anterior de cada um', mencionado: ['ex-', 'relacionamentos anteriores', 'infancia', 'sempre repito'] },
    { id: 'interpretacao_vs_fato', rotulo: 'a diferença entre o que aconteceu e a interpretação que a ansiedade faz', mencionado: ['interpret', 'imagin', 'acho que'] },
    { id: 'comportamento_real_do_outro', rotulo: 'o comportamento real e consistente da outra pessoa', mencionado: ['ele sempre', 'ela sempre', 'costuma', 'promete'] }
  ],
  alimentacao: [
    { id: 'emocao', rotulo: 'emoções que antecedem o comer', mencionado: ['ansios', 'estress', 'trist', 'tedio', 'emocion'] },
    { id: 'restricao_previa', rotulo: 'restrição prévia e fome acumulada durante o dia', mencionado: ['dieta', 'jejum', 'pulo refeic', 'restri', 'sem comer'] },
    { id: 'sono_rotina', rotulo: 'sono ruim e rotina irregular', mencionado: ['sono', 'dormi', 'rotina', 'horario'] }
  ],
  peso: [
    { id: 'emocao', rotulo: 'emoções que antecedem o comer', mencionado: ['ansios', 'estress', 'trist', 'tedio', 'emocion'] },
    { id: 'restricao_previa', rotulo: 'restrição prévia e fome acumulada durante o dia', mencionado: ['dieta', 'jejum', 'restri', 'sem comer'] },
    { id: 'sono_rotina', rotulo: 'sono ruim e rotina irregular', mencionado: ['sono', 'dormi', 'rotina'] }
  ],
  estresse: [
    { id: 'sono_recuperacao', rotulo: 'sono e recuperação insuficientes', mencionado: ['sono', 'dormi', 'descans'] },
    { id: 'limites_demanda', rotulo: 'limites e carga de demanda no trabalho ou em casa', mencionado: ['limite', 'demanda', 'sobrecarg', 'delegar'] }
  ],
  energia: [
    { id: 'sono_alimentacao', rotulo: 'sono, alimentação e hidratação', mencionado: ['sono', 'dormi', 'aliment', 'agua'] },
    { id: 'humor_estresse', rotulo: 'humor baixo, estresse ou sobrecarga', mencionado: ['humor', 'desanim', 'estress', 'sobrecarg'] },
    { id: 'saude_fisica', rotulo: 'causas físicas que valem uma avaliação (exames, medicamentos)', mencionado: ['exame', 'medic', 'anemia', 'tireoid'], quando: ['semanas', 'meses', 'sempre'] }
  ],
  humor: [
    { id: 'sono_ritmo', rotulo: 'sono e ritmo do dia', mencionado: ['sono', 'dormi', 'ritmo'] },
    { id: 'isolamento_perdas', rotulo: 'isolamento, perdas ou mudanças recentes', mencionado: ['sozinh', 'perda', 'luto', 'mudanca', 'separac'] }
  ],
  luto: [
    { id: 'sono_isolamento', rotulo: 'sono e isolamento durante o luto', mencionado: ['sono', 'dormi', 'sozinh', 'isolad'] }
  ]
});

function mencionou(texto, f) { return f.mencionado.some((m) => texto.includes(normalizar(m).trim())); }

/**
 * @param {Object} p { message, history[{role,content}], concepts: string[] (ids do léxico) }
 * @returns {{ hipoteses: {id:string,texto:string}[], fatoresAdjacentes: {id:string,rotulo:string}[], perguntaSugerida: string|null, ordemTemporalInformada: boolean, texto: string|null }}
 */
function construirOrientacaoInvestigativa({ message = '', history = [], concepts = [] } = {}) {
  const falasUsuario = (history || []).filter((m) => m && m.role === 'user' && typeof m.content === 'string').map((m) => m.content);
  const todo = normalizar([message, ...falasUsuario].join(' \n '));
  const ids = new Set(concepts);
  const ordemTemporalInformada = algum(todo, MARCADORES_TEMPORAIS);

  const hipoteses = []; let pergunta = null;
  for (const par of PARES_CAUSAIS) {
    if (ids.has(par.a) && ids.has(par.b)) {
      hipoteses.push({ id: par.id, texto: par.hipotese });
      if (!pergunta && !ordemTemporalInformada) pergunta = par.pergunta;
    }
  }

  const fatores = []; const vistos = new Set();
  for (const c of concepts) {
    for (const f of FATORES[c] || []) {
      if (vistos.has(f.id)) continue;
      if (mencionou(todo, f)) { vistos.add(f.id); continue; }
      if (f.quando && !f.quando.some((q) => todo.includes(normalizar(q)))) continue;
      vistos.add(f.id); fatores.push({ id: f.id, rotulo: f.rotulo });
    }
  }
  const adjacentes = fatores.slice(0, 3);
  if (!pergunta && adjacentes.length && !ordemTemporalInformada && hipoteses.length === 0 && concepts.length) pergunta = null; // sem pergunta forçada: o modelo decide se vale perguntar

  const limitadas = hipoteses.slice(0, 2);
  if (!limitadas.length && !adjacentes.length) return { hipoteses: [], fatoresAdjacentes: [], perguntaSugerida: null, ordemTemporalInformada, texto: null };

  const linhas = ['ORIENTAÇÃO INVESTIGATIVA (hipóteses para você avaliar — não apresente como fatos; use linguagem como "pode", "vale investigar", "uma possibilidade"; escolha só o que for plausível e NÃO despeje listas):'];
  limitadas.forEach((h) => linhas.push(`- Direção causal possível: ${h.texto}`));
  if (adjacentes.length) linhas.push(`- Fatores adjacentes ainda não mencionados que podem importar (cite no máximo um ou dois, só se fizer sentido): ${adjacentes.map((f) => f.rotulo).join('; ')}.`);
  if (pergunta) linhas.push(`- Pergunta investigativa sugerida (no máximo UMA, se ajudar a compreender melhor): ${pergunta}`);
  return { hipoteses: limitadas, fatoresAdjacentes: adjacentes, perguntaSugerida: pergunta, ordemTemporalInformada, texto: linhas.join('\n') };
}

module.exports = { construirOrientacaoInvestigativa, PARES_CAUSAIS, FATORES, MARCADORES_TEMPORAIS };
