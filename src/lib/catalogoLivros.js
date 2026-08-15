// lib/catalogoLivros.js
//
// Catálogo dos livros vendidos avulsos na loja (public/loja/index.html).
// Cada chave precisa bater com o :livroId usado no link do card
// ("/checkout-livro.html?livro=<livroId>") e com a pasta correspondente
// em private/livros/<livroId>/index.html.
//
// O preço fica só aqui — o checkout nunca aceita preço vindo do cliente,
// exatamente para impedir que alguém manipule o valor pago.

const CATALOGO = {
  'os-bastidores-da-mente-1-a-origem-de-todo-bem-e-de-todo-mal': {
    titulo: 'Os Bastidores da Mente — Volume I: A Origem de Todo Bem e de Todo Mal',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'Sentimentos, emoções e reações instintivas — um guia para reconhecer as forças ocultas que nos levam à ação.',
    descricao: 'Neste volume inaugural, explore a arquitetura profunda dos sentimentos e emoções que governam nosso comportamento. Entenda como as reações instintivas moldam nossas vidas, quais são as forças que operam por trás dos bastidores da mente, e como reconhecê-las é o primeiro passo para a verdadeira liberdade de escolha.'
  },
  'os-bastidores-da-mente-2-o-antidoto': {
    titulo: 'Os Bastidores da Mente — Volume II: O Antídoto',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'A arte de atravessar embates sem se tornar aquilo que se combate.',
    descricao: 'Descubra como responder às adversidades da vida sem perder sua integridade. Este volume revela as estratégias que permitem ao ser humano manter-se firme em seus princípios enquanto enfrenta conflitos externos e internos, transformando obstáculos em oportunidades de crescimento genuíno.'
  },
  'os-bastidores-da-mente-3-a-bussola-humana': {
    titulo: 'Os Bastidores da Mente — Volume III: A Bússola Humana',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'A arte de navegar a diversidade humana — as correntes que movem as pessoas, os mares que as separam e o norte que guia a travessia entre elas.',
    descricao: 'Compreenda os padrões universais que atravessam a natureza humana. Navegue pela diversidade de temperamentos, motivações e valores que coexistem. Aprenda a encontrar o norte autêntico que orienta a convivência genuína e a comunicação que transforma relacionamentos.'
  },
  'os-bastidores-da-mente-4-a-travessia': {
    titulo: 'Os Bastidores da Mente — Volume IV: A Travessia',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'O propósito maior por trás dos bastidores da mente.',
    descricao: 'Chegue ao cerne da jornada humana. Este volume revela o propósito profundo que move a existência — aquilo que anima cada escolha, cada dilema, cada crescimento. Entenda como a travessia pessoal conecta-se a um designio maior que transcende o individual.'
  },
  'os-bastidores-da-mente-5-a-escada': {
    titulo: 'Os Bastidores da Mente — Volume V: A Escada e o Plano',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'Da ancestralidade da consciência ao Plano Maior — o volume final da série, sobre o sentido por trás da própria existência.',
    descricao: 'Suba os degraus finais da compreensão. Explore a ancestralidade da consciência, os fios invisíveis que conectam gerações, e o Plano Maior que subjaz à existência. Este penúltimo volume prepara o caminho para a verdade derradeira sobre quem somos e por que estamos aqui.'
  },
  'os-bastidores-da-mente-6-o-designio': {
    titulo: 'Os Bastidores da Mente — Volume VI: O Grande Desígnio',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'Paralelos entre o universo vivo e a jornada do peregrino — o desfecho da série, da criação eterna ao despertar da alma.',
    descricao: 'O volume derradeiro une todos os fios. Descubra os paralelos entre a estrutura do universo e a jornada da consciência individual. Compreenda a criação eterna, a progressão do ser humano rumo à iluminação, e o despertar da alma que é, afinal, o verdadeiro destino de toda a travessia.'
  },
  'arquitetura-excelencia-humana-ii': {
    titulo: 'A Arquitetura da Excelência Humana',
    volume: 2,
    preco: 57.90,
    categoria: 'saude-longevidade',
    departamento: 'Saúde & Longevidade',
    capa: '/loja/capas/arquitetura-excelencia-humana-ii.png',
    resumo: 'Uma jornada pela arquitetura biológica que sustenta a energia, a clareza mental e a longevidade — para quem busca entender as causas por trás do cansaço, da mente nebulosa e da perda de vitalidade, e não apenas tratar os sintomas.',
    descricao: 'O corpo nunca funcionou em compartimentos isolados. Em dezenove capítulos, esta obra conecta energia celular, hormônios, metabolismo, inflamação, sono e longevidade em uma única arquitetura biológica — mostrando por que tratar sintomas isolados raramente resolve, e como recuperar clareza mental, energia e propósito compreendendo o sistema como um todo.'
  },
  'os-bastidores-da-mente-1-degustacao': {
    titulo: 'Os Bastidores da Mente — Volume I: A Origem de Todo Bem e de Todo Mal (Capítulo 1 - Degustação)',
    preco: 0,
    teaser: true,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'Leia gratuitamente o primeiro capítulo: "O cérebro que reage antes de pensar". Converse com a obra e descubra os mecanismos ocultos por trás de nossas reações automáticas.',
    descricao: 'Degustação gratuita do Volume I. Explore o primeiro capítulo e converse com a obra via chat baseado em IA. Acesse a versão completa para mergulhar em todos os doze capítulos e quatro partes que revelam os bastidores da mente humana.'
  },
  'ela-tem-classe': {
    titulo: 'Ela Tem Classe',
    preco: 37.90,
    departamento: 'Universo Feminino',
    resumo: 'Um guia de elegância que vai além da aparência — como cultivar presença, magnetismo e sofisticação genuína no dia a dia, sem depender de excesso ou performance.',
    descricao: 'Existe uma diferença profunda entre chamar atenção e ser, de fato, inesquecível. "Ela Tem Classe" explora essa diferença em dois volumes: o primeiro dedicado à elegância, ao estilo e ao refinamento moderno; o segundo, à presença, ao magnetismo e à sofisticação avançada. Ao longo da obra, a leitora encontra reflexões práticas sobre como a verdadeira elegância nasce do encontro entre estética e inteligência emocional — a postura que comunica serenidade, a discrição que se torna mistério, a autenticidade que dispensa qualquer papel a representar. Um convite a redescobrir que sofisticação, hoje, mora na leveza.'
  },
  'codigo-feminino': {
    titulo: 'Código Feminino',
    preco: 57.00,
    departamento: 'Universo Feminino',
    resumo: 'Um guia completo de saúde integrativa feminina — do autocuidado diário ao equilíbrio hormonal, da sexualidade em todas as fases da vida à segurança e autonomia sobre o próprio corpo.',
    descricao: '"Código Feminino" reúne, em 12 partes e dois apêndices práticos, o que a medicina integrativa sabe sobre a saúde da mulher — da pele aos hormônios, do sono ao prazer, da prevenção às fases mais delicadas da vida, como a menopausa. A obra dedica atenção especial à sexualidade feminina em suas várias etapas: desejo, anatomia do prazer, ciclo menstrual, puerpério, maturidade, disfunções e terapia sexual — sempre em diálogo com temas de comunicação, autoestima, espiritualidade e segurança nos relacionamentos. Pensado para ser lido com calma e revisitado aos poucos, é um mapa de autocuidado real, não uma lista de regras rígidas.'
  },
  'a-inteligencia-do-corpo-feminino': {
    titulo: 'A Inteligência do Corpo Feminino',
    preco: 57.00,
    departamento: 'Universo Feminino',
    resumo: 'Um mergulho no que o corpo tenta comunicar através de inchaço, celulite e cansaço — e os caminhos reais (alimentação, intestino, movimento, descanso) para restaurar o equilíbrio metabólico.',
    descricao: 'Por trás do inchaço abdominal, da celulite que resiste mesmo em corpos magros e do cansaço que o sono não resolve, existe quase sempre a mesma origem silenciosa: a inflamação de baixo grau. "A Inteligência do Corpo Feminino" decifra esse processo capítulo a capítulo — intestino, fígado, sistema linfático, pele — sempre trocando a lógica da culpa ("falta de disciplina") pela lógica da escuta do corpo. Traz ainda anexos práticos de consulta rápida: checklist diário de rotina e a Escala de Bristol para observar a própria saúde intestinal sem constrangimento. Um livro que ensina a interpretar sinais, não a se punir por eles.'
  },
  'inesquecivel-charme-feminino': {
    titulo: 'Inesquecível',
    preco: 67.00,
    departamento: 'Universo Feminino',
    resumo: 'Como criar conexões memoráveis e saudáveis sem perder autenticidade — charme feminino construído sobre autoestima, presença e inteligência emocional, não sobre estratégia ou performance.',
    descricao: '"Inesquecível" parte de uma constatação simples: o magnetismo verdadeiro nunca nasce de competição — nasce de verdade. Ao longo de cinco partes (o verdadeiro charme feminino, presença e comunicação, maturidade afetiva, feminilidade e relacionamentos saudáveis, e um bloco final de perguntas para o autoconhecimento), a obra guia a leitora por uma jornada que começa na autoestima e termina na capacidade de se conectar com leveza e valor próprio. É o volume mais extenso e estruturado do lote — uma edição cuidadosamente diagramada, pensada para ser lida como uma experiência completa, não apenas consultada por partes.'
  },
  'a-mulher-que-permanece-inteira': {
    titulo: 'A Mulher que Permanece Inteira',
    preco: 67.00,
    departamento: 'Universo Feminino',
    resumo: 'Mais do que um livro sobre relacionamentos: uma jornada de reconstrução emocional feminina — incluindo um raro capítulo sobre como reconhecer perfis emocionais masculinos.',
    descricao: '"O amor saudável não destrói o amor-próprio; pelo contrário, o fortalece." É a partir dessa premissa que a obra percorre seis partes: autoestima feminina profunda, perfis emocionais masculinos (um bloco raro e especialmente valioso, que ajuda a leitora a reconhecer padrões antes de se envolver), relacionamentos tóxicos e proteção emocional, sedução emocional refinada, comunicação moderna e elegância digital, e exercícios práticos de desenvolvimento. É a obra mais extensa e psicologicamente densa do lote — pensada não apenas para inspirar, mas para equipar a leitora com discernimento real diante de vínculos afetivos.'
  },
};

function buscarLivro(livroId) {
  return CATALOGO[livroId] || null;
}

module.exports = { CATALOGO, buscarLivro };
