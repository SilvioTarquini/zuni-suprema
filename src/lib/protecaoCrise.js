'use strict';
// lib/protecaoCrise.js — Salvaguarda DETERMINÍSTICA de crise para os chats em produção (ZUNI Direciona, demo, Livro-Vivo).
//
// Origem: o detector contextual (autolesão/ideação, possível ingestão excessiva de medicamento, janela de risco recente) foi
// desenvolvido e testado no Candidate RAG 3.0 (src/rag3/knowledgeMode.js, V0.2/V1-P2) e está COPIADO aqui, sem dependência do
// Candidate (que NÃO é implantado). Se um dos dois mudar, os testes de regressão (scripts/testar-protecao-crise.js) comparam
// os veredictos nos mesmos casos.
//
// O que faz (e o que NÃO faz):
//   • Avalia cada fala do usuário ISOLADAMENTE (mensagem atual + até 2 falas anteriores = janela forte; 3ª a 6ª = atenção).
//   • Quando há risco alto: (1) acrescenta uma diretiva de segurança ao prompt do sistema e (2) GARANTE, por código, um rodapé
//     com os serviços de emergência na resposta, mesmo que o modelo não os cite. Risco ambíguo/recente: só diretiva (sem rodapé).
//   • NÃO é triagem clínica, NÃO diagnostica e NÃO substitui avaliação profissional; é um apoio conservador (falso positivo
//     preferível a falso negativo). Nunca registra o texto do usuário.
const normalizar = (texto) => String(texto == null ? '' : texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const FIGURADOS = [
  /\bme mat(?:ar|ando|o|ei|ava)\s+de\s+(?:rir|rindo|trabalhar|trabalho|estudar|estudo|cansaco|fome|vergonha|raiva|tedio|medo|saudade|sono|calor|frio|sede|inveja|curiosidade)\b/g,
  /\b(?:morrendo|morro|morri|morrer|morreria|morreu)\s+de\s+(?:rir|rindo|vergonha|fome|sono|saudade|calor|frio|sede|curiosidade|medo|inveja|tedio|cansaco)\b/g
];
const limparFigurados = (t) => FIGURADOS.reduce((a, re) => a.replace(re, ' '), t);
const prepararParaRisco = (t) => limparFigurados(normalizar(t)).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');

const AUTOLESAO = /\bme (cortando|cortado|corto|cortar|cortei|cortava|automutilando|automutilo|automutilar|automutilei|ferindo|ferir|feri|queimando|queimo|queimar|queimei|arranhando|arranhar|arranhei|enforcar|enforcando|machucando|machuco|machucar|machuquei|machucava)\b/g;
const PRESENTE = new Set(['cortando', 'cortado', 'corto', 'automutilando', 'automutilo', 'ferindo', 'queimando', 'queimo', 'arranhando', 'enforcando', 'machucando', 'machuco']);
const INFINITIVOS = new Set(['cortar', 'automutilar', 'ferir', 'queimar', 'arranhar', 'enforcar', 'machucar']);
// Estes dois padrões legados passam a ser tratados SOMENTE pelo detector contextual (que cobre as mesmas formas e distingue acidente/negação/histórico):
const MIGRADOS_PARA_CONTEXTUAL = new Set(['me cortar', 'me machuc']);
const RE = {
  negacao: /\b(?:nao|nunca|jamais|sem|nem)\s+(?:\w+\s+){0,3}$/,
  insistencia: /\b(?:nao\s+(?:paro|consigo\s+parar|consigo\s+deixar|consigo\s+evitar|consigo\s+me\s+conter)\s+de)\s+$/,
  lutando: /\b(?:parar|deixar|evitar|conter|resistir)\s+de\s+$/,
  parei: /\b(?:parei|deixei|larguei)\s+de\s+$/,
  intencao: /\b(?:quero|queria|vou|vontade\s+de|penso\s+em|pensando\s+em|pensei\s+em|tenho\s+pensado\s+em|impulso\s+de|tentacao\s+de|ideia\s+de|desejo\s+de|preciso)\s+$/,
  historico: /\b(?:quando\s+(?:eu\s+)?(?:era|tinha)|na\s+adolescencia|no\s+passado|faz\s+(?:\w+\s+)?(?:anos|meses)|ha\s+(?:\w+\s+)?(?:anos|meses|muito\s+tempo)|antigamente|antes)\b/,
  atual: /\b(?:estou|to|ando|venho|tenho|voltei|continuo)\b/,
  acidente: /\b(?:sem\s+querer|acidente|acidentalmente|cozinhando|cozinha|picando|barba|barbear|depilando|papel|vidro\s+quebrad\w*|quebrei|tropecei|unha|cabelos?|franja|cutucando|cortando\s+(?:cebola|legumes?|carne|pao)|cai|caiu|cair|queda|escada|futebol|bicicleta|moto|treino|bati|porta)\b/,
  proposito: /\b(?:de\s+proposito|para\s+(?:me\s+)?(?:machucar|aliviar|sentir|punir|castigar)|como\s+castigo|me\s+punir|aliviar\s+a\s+(?:dor|angustia|ansiedade)|para\s+sentir\s+dor)\b/,
  recorrente: /\b(?:de\s+novo|outra\s+vez|mais\s+uma\s+vez|novamente|voltei|volta\s+e\s+meia|toda\s+vez|sempre\s+que|quando\s+fico)\b/
};
const IDEACAO_EXPLICITA = /\b(?:quero|queria|vou|vontade\s+de|penso\s+em|pensando\s+em|tenho\s+pensado\s+em|desejo\s+de|decidi)\s+(?:\w+\s+)?(?:morrer|suicidar|acabar\s+com\s+a?\s*minha\s+vida|me\s+jogar\s+(?:da|do|de|na\s+frente)|sumir\s+para\s+sempre)\b|\bcansei\s+de\s+viver\b|\bnao\s+aguento\s+mais\s+viver\b/;
const IDEACAO_INDIRETA = /\b(?:nao\s+quero\s+mais\s+estar\s+aqui|queria\s+(?:dormir\s+e\s+)?nao\s+acordar|(?:todos|todo\s+mundo|ninguem)\s+(?:estaria|estariam|sentiria|sentiriam)\s+(?:melhor|bem|falta)[^.]{0,20}(?:sem\s+mim|minha\s+falta)|melhor\s+sem\s+mim|queria\s+(?:sumir|desaparecer)(?!\s+de\s+ferias)|tanto\s+faz\s+se\s+eu\s+(?:morrer|estiver\s+aqui)|nao\s+vejo\s+saida|nao\s+faco\s+falta|nao\s+vale\s+(?:mais\s+)?a\s+pena\s+(?:continuar|viver|seguir|insistir)|nao\s+vejo\s+(?:mais\s+)?sentido\s+(?:em|de)\s+(?:continuar|viver|seguir)|queria\s+que\s+tudo\s+(?:acabasse|terminasse)|(?:penso|pensei|pensando|quero|queria|vontade)\s+(?:em\s+|de\s+)?desistir\s+de\s+tudo|ninguem\s+(?:notaria|perceberia|ia\s+notar)\s+se\s+eu\s+(?:sumisse|morresse|desaparecesse|nao\s+estivesse)|ninguem\s+(?:ia\s+)?sentir(?:ia)?\s+(?:a\s+)?minha\s+falta|sou\s+um\s+peso\s+(?:para|pra)\s+(?:todos|todo\s+mundo|minha\s+familia|as\s+pessoas)|nao\s+aguento\s+mais\s+essa\s+vida)\b/;

const PULSOS = /\b(?:cortar|cortei|cortando|corto|cortaram)\s+(?:os|meus|minhas?)\s+(?:pulsos?|bracos?|pernas?|pele)\b/;
const ORDEM_NIVEL = { alto: 2, ambiguo: 1 };
const melhor = (a, b) => ((ORDEM_NIVEL[b] || 0) > (ORDEM_NIVEL[a] || 0) ? b : a);

/** Avalia UMA fala isolada (nunca texto concatenado). @returns {{ nivel: 'alto'|'ambiguo'|null, gatilhos: string[] }} */
function avaliarRiscoAutolesao(textoBruto) {
  const p = prepararParaRisco(String(textoBruto || '')); let nivel = null; const gatilhos = [];
  const marca = (n, id) => { nivel = melhor(nivel, n); if (n) gatilhos.push(id); };
  for (const m of p.matchAll(AUTOLESAO)) {
    const verbo = m[1]; const i = m.index; const esq = p.slice(Math.max(0, i - 32), i); const janela = p.slice(Math.max(0, i - 45), i + 70);
    const negado = RE.negacao.test(esq) && !RE.insistencia.test(esq);
    const intencao = RE.intencao.test(esq); const lutando = RE.lutando.test(esq) || RE.insistencia.test(esq);
    if (negado) { marca(intencao ? 'ambiguo' : null, 'autolesao_negada'); continue; }
    if (RE.acidente.test(janela) && !RE.proposito.test(janela)) { marca(null, 'autolesao_acidente'); continue; }
    if (RE.proposito.test(janela) || intencao || lutando) { marca('alto', 'autolesao_intencao'); continue; }
    if (RE.parei.test(esq) || (RE.historico.test(janela) && !RE.atual.test(esq) && !PRESENTE.has(verbo))) { marca('ambiguo', 'autolesao_historica'); continue; }
    if (PRESENTE.has(verbo)) { marca('alto', 'autolesao_presente'); continue; }
    if (INFINITIVOS.has(verbo)) { marca('alto', 'autolesao_infinitivo'); continue; } // sem negação/acidente/histórico: mantém a prudência do padrão legado
    marca(RE.recorrente.test(janela) ? 'alto' : 'ambiguo', RE.recorrente.test(janela) ? 'autolesao_recorrente' : 'autolesao_ambigua');
  }
  const ide = p.match(IDEACAO_EXPLICITA);
  if (ide) { const esq = p.slice(Math.max(0, ide.index - 24), ide.index); if (!RE.negacao.test(esq)) marca('alto', 'ideacao_explicita'); }
  if (IDEACAO_INDIRETA.test(p)) marca('ambiguo', 'ideacao_indireta');
  const pul = p.match(PULSOS);
  if (pul && !RE.negacao.test(p.slice(Math.max(0, pul.index - 24), pul.index)) && !RE.acidente.test(p.slice(Math.max(0, pul.index - 45), pul.index + 70))) marca('alto', 'autolesao_pulsos');
  return { nivel, gatilhos: [...new Set(gatilhos)] };
}

// ── V1-P2 · Possível ingestão excessiva de medicamento/substância (própria, de terceiro ou de criança; com ou sem intenção suicida) ──
// A emergência é MÉDICA e sensível ao tempo: tem categoria, motivo e diretiva próprios (não depende de intenção). Avalia UMA fala por vez.
//   alto    → modo BOUNDARY, motivo 'possivel_ingestao_excessiva' (orientação urgente imediata, sem esperar resposta);
//   ambiguo → modo inalterado + diretiva curta (perguntar o essencial e já informar quando ligar);
//   null    → uso habitual/prescrito, adesão, esquecimento, negação, pergunta hipotética.
const ING_VERBOS = '(?:tomei|tomou|tomaram|engoli|engoliu|engoliram|ingeri|ingeriu|ingeriram|bebi|bebeu|comi|comeu|mandei\\s+(?:goela\\s+abaixo|pra\\s+dentro)|(?:acabei|acabou|acabaram)\\s+de\\s+(?:tomar|engolir|ingerir|beber))';
const ING_RE = {
  verbo: new RegExp('\\b' + ING_VERBOS + '\\b', 'g'),
  objeto: /\b(?:remedios?|comprimidos?|medicamentos?|capsulas?|pilulas?|cartelas?|frascos?|xarope|ansioliticos?|calmantes?|antidepressivos?|analgesicos?|sedativos?|soniferos?|paracetamol|dipirona|ibuprofeno|clonazepam|rivotril|diazepam|insulina|ferro|melatonina|farmacia|vitaminas?|suplementos?|magnesio|omega|colageno|probioticos?)\b/,
  quimico: /\b(?:produto\s+de\s+limpeza|agua\s+sanitaria|soda\s+caustica|veneno|chumbinho|raticida|inseticida|desinfetante|alvejante|gasolina|querosene|removedor|solvente|thinner|pilha|bateria)\b/,
  forte: /\b(?:(?:d?a|na)\s+cartela|cartela\s+inteira|(?:d?a|na)\s+caixa|(?:d?o|no)\s+frasco|metade\s+d[oe]\s+(?:um\s+)?frasco|o\s+dobro|o\s+triplo|duas\s+vezes\s+a\s+dose|dose\s+(?:a\s+mais|dobrada|maior)|de\s+uma\s+vez|varios|varias|muitos|muitas|diversos|diversas|um\s+monte\s+de|\d{2,}\s+(?:comprimidos|capsulas|pilulas))\b/,
  altoUnid: /\b(?:(?:uns|umas|cerca\s+de|mais\s+de|quase)\s+)?(?:dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|cem)\s+(?:comprimidos|capsulas|pilulas)\b/,
  medioUnid: /\b(?:cinco|seis|sete|oito|nove)\s+(?:comprimidos|capsulas|pilulas)\b/,
  recipientes: /\b(?:\d+|dois|duas|tres|quatro|cinco|varios|varias|muitos|muitas)\s+(?:blisters?|cartelas|caixas|frascos)\b|\b(?:um|uma)\s+(?:blister|cartela|caixa|frasco)\s+(?:inteir[oa]|todo|toda)\b|\bblisters?\s+(?:inteiros?|todos)\b/,
  excesso: /\b(?:demais|alem\s+da\s+dose|acima\s+da\s+dose|alem\s+do\s+prescrito|passei\s+da\s+dose|excedi\s+a\s+dose|a\s+mais\s+do\s+que\s+(?:devia|o\s+indicado|o\s+prescrito|o\s+normal)|grande\s+quantidade|quantidade\s+(?:enorme|absurda|exagerada)|tudo\s+(?:que|o\s+que)\s+(?:tinha|havia|restava|sobrou|achei))\b/,
  pouco: /\b(?:um\s+pouc[oa]|pouquinho)\s+(?:a\s+mais|alem|acima|demais)\b/,
  tudoApos: /^\s*(?:tudo\b|todo\s+o\s+conteudo|o\s+frasco\s+(?:todo|inteiro))/,
  fraco: /\btod[oa]s\s+(?:os|as)\s+(?:remedios|comprimidos|medicamentos|capsulas|pilulas)\b/,
  poucos: /\b[5-9]\s+(?:comprimidos|capsulas|pilulas)\b/,
  suplemento: /\b(?:vitaminas?|suplementos?|magnesio|omega|colageno|probioticos?)\b/,
  crianca: /\b(?:filh[oa]|bebe|crianca|neto|neta|sobrinh[oa]|menin[oa]|pequen[oa]|afilhad[oa])\b/,
  habitual: /\b(?:todos\s+os\s+dias|todo\s+dia|diariamente|de\s+manha|de\s+noite|toda\s+noite|todas\s+as\s+manhas|como\s+de\s+costume|conforme|receita|prescri\w+|(?:medic[oa]|pediatra|dentista|doutor\w*)\s+(?:passou|receitou|indicou|prescreveu)|receitou|prescreveu|direitinho|certinho|no\s+horario|esquec\w+)\b/,
  negado: /\b(?:nao|nunca|jamais)\s+(?:\w+\s+){0,2}$/,
  overdose: /\b(?:tomei|tomou|tive|teve|sofri|sofreu)\s+(?:uma\s+)?overdose\b/
};
/** @returns {{ nivel: 'alto'|'ambiguo'|null, gatilhos: string[] }} */
function avaliarIngestaoMedicamentosa(textoBruto) {
  const p = prepararParaRisco(String(textoBruto || '')); let nivel = null; const gatilhos = [];
  const marca = (n, id) => { nivel = melhor(nivel, n); if (n) gatilhos.push(id); };
  if (ING_RE.overdose.test(p)) marca('alto', 'overdose_relatada');
  for (const m of p.matchAll(ING_RE.verbo)) {
    const i = m.index; const esq = p.slice(Math.max(0, i - 40), i); const dir = p.slice(i, i + 95); const janela = esq + dir;
    if (ING_RE.negado.test(esq)) continue;
    const crianca = ING_RE.crianca.test(esq);
    if (ING_RE.quimico.test(dir.slice(0, 70))) { marca('alto', crianca ? 'quimico_crianca' : 'quimico_ingerido'); continue; }
    const objetoAntes = ING_RE.objeto.test(p.slice(Math.max(0, i - 70), i)) && ING_RE.tudoApos.test(dir.slice(m[0].length)); // “… o frasco de xarope e bebeu tudo”
    if (!ING_RE.objeto.test(dir.slice(0, 80)) && !/\bdose\b/.test(dir.slice(0, 80)) && !objetoAntes) continue;
    const forte = ING_RE.forte.test(dir) || ING_RE.altoUnid.test(dir) || ING_RE.recipientes.test(dir) || ING_RE.excesso.test(dir) || objetoAntes;
    if (forte && ING_RE.pouco.test(dir)) { marca('ambiguo', 'um_pouco_alem_da_dose'); continue; }
    if (forte) { marca(ING_RE.suplemento.test(dir) && !crianca ? 'ambiguo' : 'alto', crianca ? 'excesso_forte_crianca' : 'excesso_forte'); continue; }
    if (ING_RE.pouco.test(dir)) { marca('ambiguo', 'um_pouco_alem_da_dose'); continue; }
    if (ING_RE.fraco.test(dir)) { marca(ING_RE.habitual.test(janela) ? null : 'ambiguo', 'todos_os_remedios'); continue; }
    if (ING_RE.poucos.test(dir) || ING_RE.medioUnid.test(dir)) { marca('ambiguo', 'varios_comprimidos'); continue; }
    if (crianca && !ING_RE.habitual.test(janela)) marca('ambiguo', 'crianca_ingeriu_medicamento');
  }
  return { nivel, gatilhos: [...new Set(gatilhos)] };
}

const MELHORA = /\b(?:estou\s+(?:melhor|bem|mais\s+calm[oa]|segur[oa])(?:\s+agora)?|ja\s+melhorei|ja\s+passou\s+(?:a\s+)?(?:vontade|crise|pior|aquilo|isso)|foi\s+(?:so\s+)?(?:um\s+)?(?:desabafo|susto|exagero)|nao\s+vou\s+mais\s+fazer\s+isso)\b|^\s*ja\s+passou\s*$/;
const AJUDA_DECLARADA = /\bja\s+(?:procurei|conversei\s+com|falei\s+com)\s+(?:ajuda|um\s+psicolog\w*|uma\s+psicolog\w*|meu\s+terapeuta|minha\s+terapeuta|um\s+medico|o\s+meu\s+medico)\b/;
const JANELA_FORTE = 2; // falas anteriores do usuário que mantêm o BOUNDARY (somadas à fala atual)
const JANELA_ATENCAO = 6; // até a 6ª fala anterior do usuário: apenas sinal 'ambíguo' (risco recente não resolvido)
const DIRETIVA_CRISE = 'Prioridade de segurança: acolha primeiro, não conduza aprofundamentos, oriente a buscar ajuda imediata (CVV 188, SAMU 192, ou os serviços locais de emergência) e incentive o contato com alguém de confiança agora.';
const DIRETIVA_RISCO_AMBIGUO = 'Há um sinal ambíguo de possível risco nesta conversa: avalie com cuidado e, se couber, pergunte de forma direta e calma sobre pensamentos de se machucar ou de morrer; não presuma nem dramatize.';
const DIRETIVA_RISCO_RECENTE = 'Há risco mencionado antes nesta conversa que não parece ter sido resolvido: sem interromper o assunto atual, faça uma checagem gentil e breve quando fizer sentido; não presuma, não dramatize e não trate como emergência sem novos sinais.';
const DIRETIVA_RISCO_RECENTE_MELHORA = 'Há risco mencionado antes nesta conversa e a pessoa relatou melhora ou busca de ajuda depois; isso pode suavizar o tom, mas não prova que o risco acabou: sem interromper o assunto atual, mantenha atenção discreta e, se fizer sentido, pergunte de forma breve e natural como ela está em relação ao que foi dito antes; não presuma, não dramatize e não trate como emergência sem novos sinais.';
const DIRETIVA_INGESTAO = 'Prioridade médica urgente: há possível ingestão excessiva de medicamento ou substância (da própria pessoa ou de outra, inclusive criança), com ou sem intenção de se machucar. Na primeira frase, oriente atendimento imediato: ligar agora para o SAMU 192 ou ir ao pronto-socorro mais próximo e, para orientação toxicológica, ligar para o Disque-Intoxicação 0800 722 6001; não esperar sintomas e não deixar a pessoa sozinha. Peça para ter a embalagem em mãos e informar o que foi tomado, quanto e quando, mas sem condicionar a orientação a essas respostas e sem fazer a pessoa aguardar uma resposta antes de agir. Não induza vômito e não recomende remédios, doses ou tratamentos caseiros. Se houver indício de intenção de se machucar, aplique também o protocolo de crise.';
const DIRETIVA_INGESTAO_AMBIGUA = 'Há uma possível ingestão de medicamento em quantidade maior que a habitual: na primeira frase, pergunte de forma curta o que foi tomado, quanto e quando e já informe que, se for mais do que o prescrito ou se não houver certeza, deve ligar agora para o SAMU 192 ou para o Disque-Intoxicação 0800 722 6001; não induza vômito e não sugira remédios caseiros nem doses.';

// Sinais LEGADOS diretos (mesma lista do Candidate, já sem os dois padrões migrados para o detector contextual), por tipo de serviço.
const SINAIS_LEGADO = Object.freeze({
  emocional: ['suicid', 'me matar', 'tirar (a )?(minha )?vida', 'nao quero mais viver', 'acabar com tudo', 'autolesao'],
  medico: ['dor forte no peito', 'falta de ar (forte|repentina|subita)', 'desmai', 'sangramento (intenso|forte)'],
  intoxicacao: ['overdose', 'envenen'], // mesmos gatilhos de antes; só passam a receber o rodapé de intoxicação (e não o de sintomas cardíacos)
  violencia: ['estou apanhando', 'ele me bate', 'ela me bate', 'me ameaca', 'violencia (domestica|em casa)']
});
const casaAlgum = (t, lista) => lista.some((r) => new RegExp(r).test(t));

// Textos aprovados (09/10/2026). Mudar qualquer palavra exige nova aprovação editorial.
const RODAPE = Object.freeze({
  emocional: 'Se você está pensando em se machucar ou sente que não aguenta, não precisa enfrentar isso sozinho(a). Procure alguém de confiança que possa ficar com você. Para apoio emocional, ligue gratuitamente para o CVV, 188 (24 horas). Se houver perigo imediato, ligue para o SAMU, 192, ou procure atendimento de emergência.',
  ingestao: 'Atenção: ingerir medicamentos ou outras substâncias em quantidade excessiva pode ser uma emergência, mesmo sem sintomas. Ligue imediatamente para o SAMU, 192, ou para o Disque-Intoxicação, 0800 722 6001. Não provoque vômito nem tente neutralizar a substância por conta própria. Se possível, tenha a embalagem disponível para informar aos profissionais de saúde.',
  medico: 'Se você está apresentando dor forte no peito, falta de ar súbita, desmaio, sangramento intenso ou outro sinal grave, ligue imediatamente para o SAMU, 192. Procure atendimento de emergência sem demora.',
  violencia: 'Se você está em perigo imediato, procure um local seguro, se isso for possível sem aumentar o risco, e ligue para a Polícia, 190. Mulheres em situação de violência também podem buscar orientação e apoio pela Central de Atendimento à Mulher, 180.'
});

// REGRA DE EXIBIÇÃO (determinística, conservadora): a presença de um número de telefone na resposta do modelo NUNCA dispensa o rodapé.
// O rodapé de um tipo só é omitido se o TEXTO APROVADO daquele tipo já estiver na resposta (comparação literal, sem diferenciar
// caixa, espaços e quebras de linha). Qualquer outra forma de "orientação equivalente" não é verificável com segurança => o rodapé é
// acrescentado (uma eventual repetição de número é preferível a uma orientação incompleta).
const comparavel = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();

// Convites comerciais (usado só na DEMO, em risco alto): frases com estes termos são removidas, nunca substituídas por outra oferta.
const CONVITE_COMERCIAL = /sess[aã]o completa|livros? vivos?|adquir|compr(?:ar|e|a|as|ou)\b|assin(?:e|ar|atura)|pre[cç]o|r\$|checkout|\bloja\b|desconto|cupom|\bplano\b|\bpacote\b|bot[aã]o|bot[oõ]es|conhe[cç]a (?:a|o|os|as)\b|zuni direciona|mentor zuni suprema.{0,40}(?:acesso|sess)/i;

function textosDoUsuario({ message, history }) {
  const anteriores = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'usuario'))
    .map((m) => (typeof m.content === 'string' ? m.content : (typeof m.message === 'string' ? m.message : '')))
    .filter(Boolean)
    .reverse(); // [mais recente, …]
  return { atual: String(message || ''), anteriores };
}

/**
 * @param {{ message: string, history?: Array<{role:string, content?:string, message?:string}> }} p  história SEM o texto de RAG/contexto.
 * @returns {{ critico:boolean, tipos:string[], risco:'alto'|'ambiguo'|null, ingestao:'alto'|'ambiguo'|null, riscoRecente:boolean, melhoraDeclarada:boolean, diretivas:string[] }}
 *   `tipos` ⊂ emocional|ingestao|medico|violencia (os que exigem rodapé determinístico).
 */
function avaliarSeguranca({ message, history } = {}) {
  const { atual, anteriores } = textosDoUsuario({ message, history });
  const forte = [atual, ...anteriores.slice(0, JANELA_FORTE)];
  const atencao = anteriores.slice(JANELA_FORTE, JANELA_ATENCAO);
  const tipos = new Set(); const diretivas = [];

  const avRisco = forte.map(avaliarRiscoAutolesao); const avIng = forte.map(avaliarIngestaoMedicamentosa);
  const prep = forte.map((f) => limparFigurados(normalizar(f)));
  const legadoEmocional = prep.some((t) => casaAlgum(t, SINAIS_LEGADO.emocional));
  const legadoMedico = prep.some((t) => casaAlgum(t, SINAIS_LEGADO.medico));
  const legadoIntoxicacao = prep.some((t) => casaAlgum(t, SINAIS_LEGADO.intoxicacao));
  const legadoViolencia = prep.some((t) => casaAlgum(t, SINAIS_LEGADO.violencia));
  const crise = legadoEmocional || avRisco.some((r) => r.nivel === 'alto');
  const ingestaoAlta = avIng.some((r) => r.nivel === 'alto');
  const ingestao = ingestaoAlta ? 'alto' : (avIng.some((r) => r.nivel === 'ambiguo') ? 'ambiguo' : null);
  const riscoAmbiguo = !crise && avRisco.some((r) => r.nivel === 'ambiguo');

  let riscoRecente = false; let melhoraDeclarada = false;
  if (!crise) {
    const todas = [...forte, ...atencao];
    for (let k = JANELA_FORTE + 1; k < todas.length && !riscoRecente; k++) {
      const f = todas[k];
      const alto = avaliarRiscoAutolesao(f).nivel === 'alto' || casaAlgum(limparFigurados(normalizar(f)), SINAIS_LEGADO.emocional);
      if (!alto) continue;
      riscoRecente = true;
      melhoraDeclarada = todas.slice(0, k).some((posterior) => { const q = prepararParaRisco(posterior); return MELHORA.test(q) || AJUDA_DECLARADA.test(q); });
    }
  }

  if (crise) { tipos.add('emocional'); diretivas.push(DIRETIVA_CRISE); }
  if (ingestaoAlta || legadoIntoxicacao) { tipos.add('ingestao'); diretivas.push(DIRETIVA_INGESTAO); }
  if (legadoMedico) { tipos.add('medico'); diretivas.push('Prioridade de segurança: há sinal de possível emergência médica ou violência. Acolha primeiro, não faça aprofundamentos longos, oriente buscar atendimento imediato (SAMU 192 ou pronto-socorro) e não diagnostique nem oriente tratamento.'); }
  if (legadoViolencia) { tipos.add('violencia'); diretivas.push('Prioridade de segurança: há sinal de violência. Acolha, priorize a segurança imediata da pessoa (190 Polícia; 180 Central de Atendimento à Mulher) e não a pressione a decidir nada agora.'); }
  if (riscoAmbiguo) diretivas.push(DIRETIVA_RISCO_AMBIGUO);
  if (riscoRecente) diretivas.push(melhoraDeclarada ? DIRETIVA_RISCO_RECENTE_MELHORA : DIRETIVA_RISCO_RECENTE);
  if (ingestao === 'ambiguo') diretivas.push(DIRETIVA_INGESTAO_AMBIGUA);

  return { critico: tipos.size > 0, tipos: [...tipos], risco: crise ? 'alto' : (riscoAmbiguo ? 'ambiguo' : null), ingestao, riscoRecente, melhoraDeclarada: riscoRecente && melhoraDeclarada, diretivas };
}

/** Acrescenta as diretivas (se houver) ao prompt do sistema. Sem diretiva => devolve o prompt idêntico. */
function adicionarDiretivaAoSistema(systemPrompt, avaliacao) {
  if (!avaliacao || !avaliacao.diretivas || !avaliacao.diretivas.length) return systemPrompt;
  return `${systemPrompt}\n\n<zuni_seguranca>\n${avaliacao.diretivas.join('\n')}\n</zuni_seguranca>`;
}

/**
 * Garante, por código, a orientação de segurança de CADA tipo de risco alto identificado, ao FINAL da resposta (a resposta principal
 * é preservada). Cada tipo só é omitido se o seu texto aprovado já estiver literalmente na resposta (ver REGRA DE EXIBIÇÃO acima);
 * mencionar apenas um telefone não conta. Vários tipos => vários rodapés, na ordem emocional, intoxicação, médico, violência.
 */
function aplicarRodapeSeguranca(texto, avaliacao) {
  const base = String(texto == null ? '' : texto);
  if (!avaliacao || !avaliacao.critico) return base;
  const corpo = comparavel(base);
  const faltando = avaliacao.tipos.filter((tp) => RODAPE[tp] && !corpo.includes(comparavel(RODAPE[tp])));
  if (!faltando.length) return base;
  return `${base.trimEnd()}\n\n${faltando.map((tp) => RODAPE[tp]).join('\n\n')}`;
}

/**
 * Remove, por frase, convites comerciais da resposta (uso: demo em risco alto). Determinístico, sem IA. Nunca acrescenta oferta
 * nem substitui o texto de emergência. Se nada sobrar, devolve '' (o rodapé de segurança é anexado depois por quem chama).
 */
function removerConviteComercial(texto) {
  const paragrafos = String(texto == null ? '' : texto).split(/\n{2,}/);
  const limpos = paragrafos.map((p) => p.split(/(?<=[.!?…])\s+/).filter((frase) => !CONVITE_COMERCIAL.test(frase)).join(' ').trim()).filter(Boolean);
  return limpos.join('\n\n');
}

module.exports = { avaliarSeguranca, adicionarDiretivaAoSistema, aplicarRodapeSeguranca, removerConviteComercial, avaliarRiscoAutolesao, avaliarIngestaoMedicamentosa, RODAPE, JANELA_FORTE, JANELA_ATENCAO };
