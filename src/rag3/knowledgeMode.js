'use strict';
// rag3/knowledgeMode.js — TRÊS MODOS INTERNOS DE CONHECIMENTO (C2-B), determinísticos e testáveis. Não chamam modelo.
//   ZUNI_KNOWLEDGE       há conhecimento ZUNI suficientemente relevante → usar o knowledge pack.
//   GENERAL_INTELLIGENCE o RAG é none/insuficiente, mas dá para ajudar com conhecimento geral → continuar ajudando, sem atribuir ao acervo.
//   BOUNDARY             há um limite REAL (crise, diagnóstico/prescrição individual, dado atual ou individual indispensável) → informar o que for
//                        seguro e explicar o próximo passo concreto; nunca resposta seca.
// RAG_NONE != RECUSA AUTOMÁTICA. O mesmo bloco de modo vai a qualquer provider (hash comparável).
const { normalizar, sha256 } = require('./util');

const MODOS = Object.freeze({ ZUNI: 'ZUNI_KNOWLEDGE', GERAL: 'GENERAL_INTELLIGENCE', LIMITE: 'BOUNDARY' });

const cabe = (t, r) => new RegExp(r).test(t);
const algum = (t, lista) => lista.find((r) => cabe(t, r)) || null;

// Sinais de limite REAL (lista curta e conservadora; o texto do usuário nunca é logado).
const SINAIS = Object.freeze({
  crise: ['suicid', 'me matar', 'tirar (a )?(minha )?vida', 'nao quero mais viver', 'acabar com tudo', 'me machuc', 'me cortar', 'autolesao', 'overdose', 'envenen', 'estou apanhando', 'ele me bate', 'ela me bate', 'me ameaca', 'violencia (domestica|em casa)', 'dor forte no peito', 'falta de ar (forte|repentina|subita)', 'desmai', 'sangramento (intenso|forte)'],
  individualizacao: ['qual (a )?dose', 'quantos? (mg|miligramas|comprimidos|gotas)', 'posso (parar|interromper|suspender)( de tomar)?', 'devo (parar|interromper|suspender)', 'trocar (o|meu) (remedio|medicamento)', 'qual remedio (devo|eu devo) tomar', 'me (receite|prescreva)', 'o que eu tenho\\?', 'sera que (eu )?tenho (depressao|diabetes|cancer|transtorno)', 'faca meu diagnostico', 'tenho (depressao|ansiedade|diabetes|cancer)\\?'],
  dadosIndividuais: ['(meu|meus) (exame|exames|resultado|laudo)s? (de|do|da|mostra|deu)', 'interprete (o )?meu (exame|resultado)', 'olha (so )?meu exame'],
  atualidade: ['cotacao', 'preco (de )?hoje', 'noticia', 'resultado do jogo', 'previsao do tempo', 'ultima (lei|decisao)', 'lei nova', 'bolsa de valores']
});
// Estável o bastante para responder em geral, mas dependente de regra vigente/jurisdição: ajuda sem recusar, apontando o que verificar.
const DEPENDE_DE_REGRA_VIGENTE = ['imposto de renda', 'irpf', 'receita federal', 'declaracao de ajuste', 'itcmd', 'inventario', 'aliquota', 'prazo da declaracao'];

const DIRETIVAS = Object.freeze({
  ZUNI_KNOWLEDGE_forte: 'Modo ZUNI_KNOWLEDGE (conhecimento forte): há conhecimento ZUNI relevante no knowledge pack. Use-o ativamente para enriquecer a resposta, integrando-o à situação desta pessoa, sem inventar proveniência nem certeza e sem citar ids ou "documentos".',
  ZUNI_KNOWLEDGE_parcial: 'Modo ZUNI_KNOWLEDGE (conhecimento parcial): o knowledge pack cobre apenas parte da situação. Use o que for realmente pertinente, complemente com seu conhecimento geral onde faltar e diga com naturalidade o que não está coberto; não atribua ao acervo ZUNI aquilo que ele não traz.',
  GENERAL_INTELLIGENCE: 'Modo GENERAL_INTELLIGENCE: o acervo ZUNI não trouxe conteúdo suficiente para esta pergunta. Continue ajudando com o seu conhecimento geral, mantendo a política editorial e a segurança; não finja que a informação vem do acervo ZUNI e NÃO recuse apenas porque o acervo não tem conteúdo. Se a resposta depender de regra vigente, jurisdição ou dado atual, explique o que é estável e indique onde verificar.',
  BOUNDARY: 'Modo BOUNDARY: há um limite real para esta pergunta (motivo abaixo). Não responda de forma seca nem evasiva: informe tudo o que puder ser informado com segurança, explique o limite de modo concreto e descreva o próximo passo prático (quem procurar, o que levar ou observar, sinais de urgência). Não diagnostique, não prescreva individualmente, não defina dose e não oriente interromper tratamento.'
});
const DIRETIVA_CRISE = 'Prioridade de segurança: acolha primeiro, não conduza aprofundamentos, oriente a buscar ajuda imediata (CVV 188, SAMU 192, ou os serviços locais de emergência) e incentive o contato com alguém de confiança agora.';

// ── V0.2 · Detector contextual de autolesão e ideação (apoio à avaliação do modelo; NUNCA a substitui) ──
// Os padrões legados de SINAIS.crise continuam valendo como estão (sensibilidade preservada), exceto "me cortar" e "me machuc", que agora são
// avaliados aqui com contexto (mesmas formas + flexões; acidente/negação/histórico deixam de gerar BOUNDARY automático). Este bloco acrescenta:
//   • flexões de autolesão que o legado não reconhecia ("me cortando", "me corto", "voltei a me cortar"…);
//   • ideação explícita não coberta (desejo de morrer);
//   • três níveis: 'alto' (→ modo BOUNDARY, protocolo de crise), 'ambiguo' (sinal para o modelo: sem forçar BOUNDARY) e null;
//   • filtros conservadores para acidente doméstico, expressões figuradas, negação e relato histórico — somente para ESTES padrões novos.
// Retorna só ids de gatilho (nunca trechos do texto do usuário).
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

// Declarações de MELHORA ou de busca de ajuda depois de um risco relatado: modulam a orientação na JANELA DE ATENÇÃO (falas 3 a 6), mas NUNCA provam resolução
// (uma autodeclaração não encerra o risco; “já passou” isolado só conta quando é a fala inteira) e nunca afetam o BOUNDARY das 3 falas mais recentes.
const MELHORA = /\b(?:estou\s+(?:melhor|bem|mais\s+calm[oa]|segur[oa])(?:\s+agora)?|ja\s+melhorei|ja\s+passou\s+(?:a\s+)?(?:vontade|crise|pior|aquilo|isso)|foi\s+(?:so\s+)?(?:um\s+)?(?:desabafo|susto|exagero)|nao\s+vou\s+mais\s+fazer\s+isso)\b|^\s*ja\s+passou\s*$/;
const AJUDA_DECLARADA = /\bja\s+(?:procurei|conversei\s+com|falei\s+com)\s+(?:ajuda|um\s+psicolog\w*|uma\s+psicolog\w*|meu\s+terapeuta|minha\s+terapeuta|um\s+medico|o\s+meu\s+medico)\b/;
const JANELA_FORTE = 2; // falas anteriores do usuário que mantêm o BOUNDARY (somadas à fala atual)
const JANELA_ATENCAO = 6; // até a 6ª fala anterior do usuário: apenas sinal 'ambíguo' (risco recente não resolvido)

const SINAIS_CRISE_DIRETOS = SINAIS.crise.filter((r) => !MIGRADOS_PARA_CONTEXTUAL.has(r)); // os demais padrões legados valem exatamente como antes
const DIRETIVA_RISCO_AMBIGUO = 'Há um sinal ambíguo de possível risco nesta conversa: avalie com cuidado e, se couber, pergunte de forma direta e calma sobre pensamentos de se machucar ou de morrer; não presuma nem dramatize.';
const DIRETIVA_RISCO_RECENTE = 'Há risco mencionado antes nesta conversa que não parece ter sido resolvido: sem interromper o assunto atual, faça uma checagem gentil e breve quando fizer sentido; não presuma, não dramatize e não trate como emergência sem novos sinais.';
const DIRETIVA_RISCO_RECENTE_MELHORA = 'Há risco mencionado antes nesta conversa e a pessoa relatou melhora ou busca de ajuda depois; isso pode suavizar o tom, mas não prova que o risco acabou: sem interromper o assunto atual, mantenha atenção discreta e, se fizer sentido, pergunte de forma breve e natural como ela está em relação ao que foi dito antes; não presuma, não dramatize e não trate como emergência sem novos sinais.';
const DIRETIVA_INGESTAO = 'Prioridade médica urgente: há possível ingestão excessiva de medicamento ou substância (da própria pessoa ou de outra, inclusive criança), com ou sem intenção de se machucar. Na primeira frase, oriente atendimento imediato: ligar agora para o SAMU 192 ou ir ao pronto-socorro mais próximo e, para orientação toxicológica, ligar para o Disque-Intoxicação 0800 722 6001; não esperar sintomas e não deixar a pessoa sozinha. Peça para ter a embalagem em mãos e informar o que foi tomado, quanto e quando, mas sem condicionar a orientação a essas respostas e sem fazer a pessoa aguardar uma resposta antes de agir. Não induza vômito e não recomende remédios, doses ou tratamentos caseiros. Se houver indício de intenção de se machucar, aplique também o protocolo de crise.';
const DIRETIVA_INGESTAO_AMBIGUA = 'Há uma possível ingestão de medicamento em quantidade maior que a habitual: na primeira frase, pergunte de forma curta o que foi tomado, quanto e quando e já informe que, se for mais do que o prescrito ou se não houver certeza, deve ligar agora para o SAMU 192 ou para o Disque-Intoxicação 0800 722 6001; não induza vômito e não sugira remédios caseiros nem doses.';

/**
 * @param {Object} p { retrieval:{status,blocks,diagnostics}, message, history[], config? }
 * @returns {{ modo, forca, contribuicaoProprietaria, motivos:string[], flags:{atualidade:boolean,crise:boolean,riscoAmbiguo:boolean,ingestao:string|null,riscoRecente:boolean}, bloco:string, hash:string }}
 */
function decidirModoDeConhecimento({ retrieval, message = '', history = [], minBlocosParcial = 2, coberturaMinimaParcial = 0.5 } = {}) {
  // Cada fala do usuário é avaliada ISOLADAMENTE (nenhuma janela atravessa a fronteira entre mensagens).
  const anteriores = (Array.isArray(history) ? history : []).filter((m) => m && m.role === 'user' && typeof m.content === 'string').map((m) => m.content).reverse(); // [mais recente, …]
  const forte = [String(message || ''), ...anteriores.slice(0, JANELA_FORTE)];
  const atencao = anteriores.slice(JANELA_FORTE, JANELA_ATENCAO);
  const atual = normalizar(message);
  const motivos = []; let modo; let forca = null; let contribuicao;

  const avRisco = forte.map(avaliarRiscoAutolesao); const avIng = forte.map(avaliarIngestaoMedicamentosa);
  const legado = forte.some((f) => algum(limparFigurados(normalizar(f)), SINAIS_CRISE_DIRETOS));
  const crise = legado || avRisco.some((r) => r.nivel === 'alto');
  const ingestaoAlta = avIng.some((r) => r.nivel === 'alto'); const ingestaoAmbigua = !ingestaoAlta && avIng.some((r) => r.nivel === 'ambiguo');
  const riscoAmbiguo = !crise && avRisco.some((r) => r.nivel === 'ambiguo');
  // janela de atenção: sinal ALTO em fala mais antiga (3ª a 6ª anterior) → apenas sinal de risco recente; melhora/ajuda declarada depois só MODULA a orientação (não apaga)
  let riscoRecente = false; let melhoraDeclarada = false;
  if (!crise) {
    const todas = [...forte, ...atencao]; // índice 0 = mais recente
    for (let k = JANELA_FORTE + 1; k < todas.length && !riscoRecente; k++) {
      const f = todas[k]; const alto = avaliarRiscoAutolesao(f).nivel === 'alto' || algum(limparFigurados(normalizar(f)), SINAIS_CRISE_DIRETOS);
      if (!alto) continue;
      riscoRecente = true; melhoraDeclarada = todas.slice(0, k).some((posterior) => { const q = prepararParaRisco(posterior); return MELHORA.test(q) || AJUDA_DECLARADA.test(q); });
    }
  }
  const indiv = algum(atual, SINAIS.individualizacao);
  const dados = algum(atual, SINAIS.dadosIndividuais);
  const atualidade = algum(atual, SINAIS.atualidade);
  const regra = algum(atual, DEPENDE_DE_REGRA_VIGENTE);

  if (crise || ingestaoAlta) {
    modo = MODOS.LIMITE; contribuicao = 'nenhuma';
    if (ingestaoAlta) motivos.push('possivel_ingestao_excessiva');
    if (crise) motivos.push('crise_ou_risco');
  }
  else if (indiv) { modo = MODOS.LIMITE; motivos.push('diagnostico_ou_prescricao_individual'); }
  else if (dados) { modo = MODOS.LIMITE; motivos.push('dado_individual_indispensavel'); }
  else if (atualidade) { modo = MODOS.LIMITE; motivos.push('informacao_atual_indisponivel'); }

  const status = retrieval && retrieval.status; const blocos = (retrieval && retrieval.blocks) || [];
  const cobertura = retrieval && retrieval.diagnostics ? retrieval.diagnostics.conceptCoverage : 0;
  if (!modo) {
    if (status === 'found' && blocos.length) { modo = MODOS.ZUNI; forca = 'forte'; contribuicao = 'alta'; motivos.push('recuperacao_found'); }
    else if (status === 'weak' && blocos.length >= minBlocosParcial && cobertura >= coberturaMinimaParcial) { modo = MODOS.ZUNI; forca = 'parcial'; contribuicao = 'parcial'; motivos.push('recuperacao_weak_utilizavel'); }
    else { modo = MODOS.GERAL; contribuicao = 'nenhuma'; motivos.push(status === 'error' ? 'recuperacao_com_erro' : (status === 'weak' ? 'recuperacao_weak_insuficiente' : 'recuperacao_none')); }
  } else if (modo === MODOS.LIMITE && status === 'found' && blocos.length && !crise && !ingestaoAlta) { contribuicao = 'parcial'; motivos.push('conhecimento_zuni_disponivel_no_limite'); }
  else if (!contribuicao) contribuicao = 'nenhuma';
  if (regra) motivos.push('depende_de_regra_vigente');

  if (riscoAmbiguo) motivos.push('sinal_ambiguo_de_risco');
  if (riscoRecente) motivos.push('risco_recente_nao_resolvido');
  if (riscoRecente && melhoraDeclarada) motivos.push('melhora_declarada_sem_prova_de_resolucao');
  if (ingestaoAmbigua) motivos.push('possivel_ingestao_a_confirmar');
  const flags = { atualidade: Boolean(atualidade || regra), crise: Boolean(crise), riscoAmbiguo, ingestao: ingestaoAlta ? 'alto' : (ingestaoAmbigua ? 'ambiguo' : null), riscoRecente, melhoraDeclarada: riscoRecente && melhoraDeclarada };
  const diretiva = modo === MODOS.ZUNI ? DIRETIVAS['ZUNI_KNOWLEDGE_' + forca] : DIRETIVAS[modo];
  const extra = modo === MODOS.LIMITE ? ` Motivo do limite: ${motivos[0]}.` + (ingestaoAlta ? ' ' + DIRETIVA_INGESTAO : '') + (crise ? ' ' + DIRETIVA_CRISE : '') : '';
  const sufixos = [riscoAmbiguo ? DIRETIVA_RISCO_AMBIGUO : '', riscoRecente ? (melhoraDeclarada ? DIRETIVA_RISCO_RECENTE_MELHORA : DIRETIVA_RISCO_RECENTE) : '', ingestaoAmbigua ? DIRETIVA_INGESTAO_AMBIGUA : ''].filter(Boolean);
  const bloco = `<zuni_modo mode="${modo}"${forca ? ` strength="${forca}"` : ''}>\n${diretiva}${extra}${sufixos.map((s) => '\n' + s).join('')}\n</zuni_modo>`;
  return { modo, forca, contribuicaoProprietaria: contribuicao, motivos, flags, bloco, hash: sha256(bloco) };
}

module.exports = { MODOS, SINAIS, DIRETIVAS, DEPENDE_DE_REGRA_VIGENTE, decidirModoDeConhecimento, avaliarRiscoAutolesao, avaliarIngestaoMedicamentosa, DIRETIVA_RISCO_AMBIGUO, DIRETIVA_RISCO_RECENTE, DIRETIVA_RISCO_RECENTE_MELHORA, DIRETIVA_INGESTAO, DIRETIVA_INGESTAO_AMBIGUA, JANELA_FORTE, JANELA_ATENCAO };
