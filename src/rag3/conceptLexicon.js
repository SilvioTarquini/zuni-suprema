'use strict';
// rag3/conceptLexicon.js — léxico determinístico de conceitos do acervo ZUNI (planner local, sem LLM).
// Cada conceito tem radicais (casam por prefixo de palavra, sem acento) e um texto de consulta rico para o embedding.
// É deliberadamente simples e auditável: o planner baseado em modelo (futuro) usa a mesma estrutura de saída.

const C = (id, label, radicais, consulta) => Object.freeze({ id, label, radicais: Object.freeze(radicais), consulta });

const CONCEITOS = Object.freeze([
  C('sono', 'sono e recuperação', ['sono', 'dormi', 'insoni', 'acord', 'desperta', 'cochil', 'descans'], 'sono ruim insônia descanso ritmo circadiano recuperação dormir bem higiene do sono'),
  C('cafeina', 'cafeína e estimulantes', ['cafe ', 'cafes ', 'cafezinho', 'cafeina', 'energetico', 'estimulante', 'chimarrao'], 'cafeína café excesso estimulantes efeito no sono, ansiedade e energia'),
  C('estresse', 'estresse e sobrecarga', ['estress', 'sobrecarg', 'pressao', 'tensao', 'esgot', 'exaust', 'burnout', 'cansaco mental'], 'estresse crônico sobrecarga esgotamento burnout tensão pressão no dia a dia'),
  C('ansiedade', 'ansiedade e pânico', ['ansied', 'ansios', 'panico', 'nervos', 'aflicao', 'angusti', 'preocupa'], 'ansiedade preocupação excessiva pânico inquietação corpo em alerta'),
  C('irritabilidade', 'irritabilidade e raiva', ['irrit', 'raiva', 'impacien', 'explod', 'estressad', 'nervos'], 'irritabilidade raiva impaciência explosões reação desproporcional'),
  C('concentracao', 'concentração e foco', ['concentr', 'foco', 'atencao', 'distra', 'memoria', 'nevoa', 'procrastin'], 'dificuldade de concentração foco atenção memória névoa mental produtividade'),
  C('trabalho', 'trabalho e carreira', ['trabalh', 'carreira', 'emprego', 'profission', 'chefe', 'empresa', 'lider', 'reuniao'], 'trabalho carreira vida profissional desempenho liderança pressão no emprego'),
  C('relacionamento', 'relacionamentos e casal', ['relacionament', 'casal', 'parceir', 'namor', 'casament', 'marido', 'esposa', 'conjuge', 'ciume', 'convivencia', 'flert', 'paquera', 'namorad', 'minha mulher', 'meu marido'], 'relacionamento casal convivência comunicação conflito vínculo afetivo'),
  C('traicao_confianca', 'traição e confiança', ['traic', 'infideli', 'confianca', 'desconfi', 'suspeit', 'mentira', 'reconstru'], 'traição infidelidade quebra de confiança reconstrução perdão relacionamento'),
  C('familia', 'família e filhos', ['famil', 'filho', 'filha', 'mae ', 'pai ', 'irmao', 'sogra', 'adolescen', 'crianca'], 'família filhos pais conflitos familiares educação convivência em casa'),
  C('autoestima', 'autoestima e insegurança', ['autoestima', 'inseguran', 'autoconfian', 'inferior', 'valor proprio', 'autocritica', 'me cobro', 'perfeccion'], 'autoestima insegurança autoconfiança autocrítica perfeccionismo valor próprio'),
  C('medo', 'medo e coragem', ['medo', 'receio', 'temor', 'paralis', 'trav', 'coragem'], 'medo receio paralisia coragem zona de conforto'),
  C('decisao', 'decisão e escolhas', ['decis', 'decidi', 'escolh', 'dilema', 'mudar de', 'indecis', 'arrepend'], 'decisão difícil escolhas dilema indecisão arrependimento intuição'),
  C('alimentacao', 'alimentação e nutrição', ['aliment', 'comida', 'dieta', 'nutri', 'refeic', 'comer', 'fome', 'acucar', 'ultraprocess'], 'alimentação nutrição dieta refeições qualidade da comida fome compulsão'),
  C('energia', 'energia e fadiga', ['energia', 'fadiga', 'cansac', 'cansad', 'disposic', 'indisposic', 'sem forcas', 'vitalidade'], 'energia baixa fadiga cansaço vitalidade disposição ao longo do dia'),
  C('habitos', 'hábitos e rotina', ['habito', 'rotina', 'disciplina', 'constancia', 'adiament'], 'hábitos rotina diária constância mudança de comportamento arquitetura de hábitos'),
  C('peso', 'peso e obesidade', ['peso', 'obesid', 'emagre', 'engord', 'sobrepeso', 'barriga', 'metabol'], 'peso obesidade emagrecimento metabolismo regulação do apetite'),
  C('intestino', 'intestino e microbiota', ['intestin', 'microbiota', 'digest', 'prisao de ventre', 'inchac', 'gases', 'refluxo'], 'intestino microbiota digestão inchaço eixo intestino cérebro'),
  C('suplementos', 'vitaminas, minerais e suplementos', ['vitamin', 'magnesi', 'omega', 'suplement', 'mineral', 'ferro', 'zinco', 'b12', 'melatonin', 'triptofan'], 'vitaminas minerais magnésio ômega 3 suplementação evidências riscos e interações'),
  C('chas_fitoterapia', 'chás, fitoterápicos e ervas', ['cha ', 'chas', 'cha de', 'infus', 'fitoter', 'erva', 'camomila', 'valeriana', 'melissa', 'passiflora', 'planta medicinal', 'plantas'], 'chás infusões fitoterapia plantas medicinais efeito, evidência, cuidados e interações'),
  C('praticas_integrativas', 'práticas integrativas', ['integrativ', 'respiracao', 'meditac', 'mindful', 'yoga', 'acupuntura', 'relaxamento', 'natural', 'holistic'], 'práticas integrativas respiração meditação relaxamento medicina natural autocuidado'),
  C('envelhecimento', 'envelhecimento e longevidade', ['envelhec', 'longevid', 'idade', 'idoso', 'madur', 'aposent', 'rejuven'], 'envelhecimento saudável longevidade maturidade idade biológica autonomia'),
  C('movimento', 'movimento e exercício', ['exerc', 'movimento', 'caminhad', 'treino', 'muscul', 'academia', 'sedentar', 'mobilidade', 'equilibrio', 'forca'], 'movimento exercício físico caminhada força mobilidade equilíbrio recuperação'),
  C('recuperacao', 'recuperação e descanso', ['recuper', 'descanso', 'repouso', 'pausa', 'lesao', 'dores musculares'], 'recuperação descanso pausas regeneração do corpo e da mente'),
  C('humor', 'humor e depressão', ['depress', 'humor', 'desanim', 'tristez', 'vazio', 'apatia', 'sem vontade', 'melanc'], 'depressão humor baixo desânimo perda de interesse tristeza persistente'),
  C('luto', 'luto e perdas', ['luto', 'perda', 'perdi', 'perdeu', 'falecimento', 'morreu', 'saudade', 'separac', 'divorci', 'termino'], 'luto perda separação divórcio saudade elaboração da dor'),
  C('solidao', 'solidão e vínculos', ['solidao', 'sozinh', 'isolad', 'isolament', 'vinculo', 'abandono'], 'solidão isolamento vínculos apego conexão com outras pessoas'),
  C('timidez', 'timidez e comunicação', ['timid', 'vergonha', 'falar em publico', 'apresentac', 'comunicac', 'introvert', 'assertiv', 'travo ', 'travar', 'inconveniente', 'rejeicao'], 'timidez vergonha falar em público comunicação assertiva autoconfiança social'),
  C('menopausa', 'menopausa e hormônios', ['menopaus', 'climaterio', 'hormon', 'tpm', 'ciclo menstrual', 'testosteron', 'libido'], 'menopausa climatério hormônios ciclo sono humor libido transição feminina'),
  C('dinheiro', 'dinheiro e finanças', ['dinheiro', 'financ', 'divida', 'gasto', 'salario', 'endivid'], 'dinheiro psicologia financeira dívidas gastos relação emocional com finanças'),
  C('proposito', 'propósito e sentido', ['proposito', 'sentido', 'espirit', 'consciencia', 'vazio existencial', 'autoconhecimento', 'piloto automatico'], 'propósito sentido de vida autoconhecimento consciência espiritualidade piloto automático'),
  C('adolescencia', 'adolescência', ['adolescen', 'filho de 1', 'filha de 1', 'puberdade'], 'adolescência conflitos com filhos adolescentes limites diálogo emoções do adolescente')
]);

// Tema do questionário (43 slugs do catálogo) → conceitos aproximados (sinal SECUNDÁRIO, nunca filtro).
const TEMA_PARA_CONCEITOS = Object.freeze({
  timidez_comunicacao: ['timidez'], bullying: ['autoestima', 'adolescencia'], vestibular_pressao_escolar: ['estresse', 'adolescencia'], primeiro_amor: ['relacionamento', 'adolescencia'],
  redes_sociais: ['autoestima', 'adolescencia'], autoestima: ['autoestima'], amizades: ['solidao', 'relacionamento'], burnout: ['estresse', 'trabalho'],
  administracao_empresarial_inteligente: ['trabalho', 'concentracao'], lideranca: ['trabalho'], pressao_cobrancas: ['estresse', 'trabalho'], decisoes_dificeis: ['decisao', 'medo'],
  crise_financeira: ['dinheiro', 'ansiedade'], crescimento_escala: ['trabalho'], ciumes: ['relacionamento', 'autoestima'], distanciamento: ['relacionamento'],
  separacao_divorcio: ['luto', 'relacionamento'], reconciliacao: ['relacionamento', 'traicao_confianca'], incompatibilidade: ['relacionamento'], recomeco_amoroso: ['relacionamento', 'luto'],
  namoro_conquista_romance: ['relacionamento'], maternidade: ['familia', 'estresse'], paternidade: ['familia'], educar_filhos: ['familia', 'adolescencia'],
  pais_idosos: ['familia', 'envelhecimento'], conflitos_familiares: ['familia', 'estresse'], perdao_familiar: ['familia', 'traicao_confianca'], ansiedade: ['ansiedade'],
  estresse: ['estresse'], luto: ['luto'], solidao: ['solidao'], panico: ['ansiedade'], depressao: ['humor'], nutricao: ['alimentacao'], obesidade: ['peso', 'alimentacao'],
  longevidade: ['envelhecimento', 'movimento'], menopausa: ['menopausa', 'sono'], desempenho_fisico: ['movimento', 'recuperacao'], saude_mental_cognitiva: ['concentracao'],
  sentimentos_adolescencia: ['adolescencia', 'autoestima'], desenvolvimento_humano: ['proposito'], psicologia_financeira: ['dinheiro'], produtividade: ['concentracao', 'habitos']
});

// Tema do questionário → etiquetas de `documentos.tema` que recebem BÔNUS (não filtro) na recuperação.
const TEMA_PARA_ETIQUETAS = Object.freeze({
  timidez_comunicacao: ['timidez_comunicacao'], administracao_empresarial_inteligente: ['administracao_empresarial_inteligente'], namoro_conquista_romance: ['namoro_conquista_romance'],
  educar_filhos: ['educar_filhos', 'sentimentos_adolescencia', 'compreensao_da_vida_base_mentor'], depressao: ['depressao'], obesidade: ['obesidade'], sentimentos_adolescencia: ['sentimentos_adolescencia']
});

const POR_ID = Object.freeze(Object.fromEntries(CONCEITOS.map((c) => [c.id, c])));

module.exports = { CONCEITOS, POR_ID, TEMA_PARA_CONCEITOS, TEMA_PARA_ETIQUETAS };
