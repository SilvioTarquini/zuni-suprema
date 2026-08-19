// lib/catalogoLivros.js
//
// Catálogo dos livros vendidos avulsos na loja (public/loja/index.html).
// Cada chave precisa bater com o :livroId usado no link do card
// ("/checkout-livro.html?livro=<livroId>") e com a pasta correspondente
// em private/livros/<livroId>/index.html.
//
// O preço fica só aqui — o checkout nunca aceita preço vindo do cliente,
// exatamente para impedir que alguém manipule o valor pago.

const MAPEAMENTO_VOZ_POR_DEPARTAMENTO = {
  'Universo Masculino': 'pt-BR-Wavenet-B',
  'Universo Feminino': 'pt-BR-Wavenet-A',
  'Desenvolvimento Humano': 'pt-BR-Wavenet-A',
  'Desenvolvimento & Comportamento': 'pt-BR-Wavenet-A',
  'Saúde & Longevidade': 'pt-BR-Wavenet-A',
  'Saúde Integrativa': 'pt-BR-Wavenet-A',
  'Executive': 'pt-BR-Wavenet-A',
  'Negócios & Tecnologia': 'pt-BR-Wavenet-A',
};

function obterVozPadraoParaDepartamento(departamento) {
  return MAPEAMENTO_VOZ_POR_DEPARTAMENTO[departamento] || 'pt-BR-Wavenet-A';
}

const CATALOGO = {
  'os-bastidores-da-mente-1-a-origem-de-todo-bem-e-de-todo-mal': {
    titulo: 'Os Bastidores da Mente — Volume I: A Origem de Todo Bem e de Todo Mal',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'Sentimentos, emoções e reações instintivas — um guia para reconhecer as forças ocultas que nos levam à ação.',
    descricao: 'Neste volume inaugural, explore a arquitetura profunda dos sentimentos e emoções que governam nosso comportamento. Entenda como as reações instintivas moldam nossas vidas, quais são as forças que operam por trás dos bastidores da mente, e como reconhecê-las é o primeiro passo para a verdadeira liberdade de escolha.',
    textoFonteParaLeitura: '/documentos-zuni/os_bastidores_da_mente_base_mentor.txt',
    audiobookUrl: 'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/os-bastidores-vol1/os-bastidores-vol1.mp3',
    audiobookDisponivel: true,
    precoAudiobook: 14.90
  },
  'os-bastidores-da-mente-2-o-antidoto': {
    titulo: 'Os Bastidores da Mente — Volume II: O Antídoto',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'A arte de atravessar embates sem se tornar aquilo que se combate.',
    descricao: 'Descubra como responder às adversidades da vida sem perder sua integridade. Este volume revela as estratégias que permitem ao ser humano manter-se firme em seus princípios enquanto enfrenta conflitos externos e internos, transformando obstáculos em oportunidades de crescimento genuíno.',
    textoFonteParaLeitura: '/documentos-zuni/os_bastidores_da_mente_base_mentor.txt'
  },
  'os-bastidores-da-mente-3-a-bussola-humana': {
    titulo: 'Os Bastidores da Mente — Volume III: A Bússola Humana',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'A arte de navegar a diversidade humana — as correntes que movem as pessoas, os mares que as separam e o norte que guia a travessia entre elas.',
    descricao: 'Compreenda os padrões universais que atravessam a natureza humana. Navegue pela diversidade de temperamentos, motivações e valores que coexistem. Aprenda a encontrar o norte autêntico que orienta a convivência genuína e a comunicação que transforma relacionamentos.',
    textoFonteParaLeitura: '/documentos-zuni/os_bastidores_da_mente_base_mentor.txt'
  },
  'os-bastidores-da-mente-4-a-travessia': {
    titulo: 'Os Bastidores da Mente — Volume IV: A Travessia',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'O propósito maior por trás dos bastidores da mente.',
    descricao: 'Chegue ao cerne da jornada humana. Este volume revela o propósito profundo que move a existência — aquilo que anima cada escolha, cada dilema, cada crescimento. Entenda como a travessia pessoal conecta-se a um designio maior que transcende o individual.',
    textoFonteParaLeitura: '/documentos-zuni/os_bastidores_da_mente_base_mentor.txt'
  },
  'os-bastidores-da-mente-5-a-escada': {
    titulo: 'Os Bastidores da Mente — Volume V: A Escada e o Plano',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'Da ancestralidade da consciência ao Plano Maior — o volume final da série, sobre o sentido por trás da própria existência.',
    descricao: 'Suba os degraus finais da compreensão. Explore a ancestralidade da consciência, os fios invisíveis que conectam gerações, e o Plano Maior que subjaz à existência. Este penúltimo volume prepara o caminho para a verdade derradeira sobre quem somos e por que estamos aqui.',
    textoFonteParaLeitura: '/documentos-zuni/os_bastidores_da_mente_base_mentor.txt'
  },
  'os-bastidores-da-mente-6-o-designio': {
    titulo: 'Os Bastidores da Mente — Volume VI: O Grande Desígnio',
    preco: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento Humano',
    resumo: 'Paralelos entre o universo vivo e a jornada do peregrino — o desfecho da série, da criação eterna ao despertar da alma.',
    descricao: 'O volume derradeiro une todos os fios. Descubra os paralelos entre a estrutura do universo e a jornada da consciência individual. Compreenda a criação eterna, a progressão do ser humano rumo à iluminação, e o despertar da alma que é, afinal, o verdadeiro destino de toda a travessia.',
    textoFonteParaLeitura: '/documentos-zuni/os_bastidores_da_mente_base_mentor.txt'
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
    categoria: 'principal',
    departamento: 'Universo Feminino',
    resumo: 'Um guia de elegância que vai além da aparência — como cultivar presença, magnetismo e sofisticação genuína no dia a dia, sem depender de excesso ou performance.',
    descricao: 'Existe uma diferença profunda entre chamar atenção e ser, de fato, inesquecível. "Ela Tem Classe" explora essa diferença em dois volumes: o primeiro dedicado à elegância, ao estilo e ao refinamento moderno; o segundo, à presença, ao magnetismo e à sofisticação avançada. Ao longo da obra, a leitora encontra reflexões práticas sobre como a verdadeira elegância nasce do encontro entre estética e inteligência emocional — a postura que comunica serenidade, a discrição que se torna mistério, a autenticidade que dispensa qualquer papel a representar. Um convite a redescobrir que sofisticação, hoje, mora na leveza.',
    audiobookUrl: 'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/ela-tem-classe/ela-tem-classe.mp3',
    audiobookDisponivel: true,
    precoAudiobook: 14.90
  },
  'codigo-feminino': {
    titulo: 'Código Feminino',
    preco: 57.00,
    categoria: 'principal',
    departamento: 'Universo Feminino',
    resumo: 'Um guia completo de saúde integrativa feminina — do autocuidado diário ao equilíbrio hormonal, da sexualidade em todas as fases da vida à segurança e autonomia sobre o próprio corpo.',
    descricao: '"Código Feminino" reúne, em 12 partes e dois apêndices práticos, o que a medicina integrativa sabe sobre a saúde da mulher — da pele aos hormônios, do sono ao prazer, da prevenção às fases mais delicadas da vida, como a menopausa. A obra dedica atenção especial à sexualidade feminina em suas várias etapas: desejo, anatomia do prazer, ciclo menstrual, puerpério, maturidade, disfunções e terapia sexual — sempre em diálogo com temas de comunicação, autoestima, espiritualidade e segurança nos relacionamentos. Pensado para ser lido com calma e revisitado aos poucos, é um mapa de autocuidado real, não uma lista de regras rígidas.',
    audiobookUrl: 'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/codigo-feminino/codigo-feminino.mp3',
    audiobookDisponivel: true,
    precoAudiobook: 14.90
  },
  'a-inteligencia-do-corpo-feminino': {
    titulo: 'A Inteligência do Corpo Feminino',
    preco: 57.00,
    categoria: 'principal',
    departamento: 'Universo Feminino',
    resumo: 'Um mergulho no que o corpo tenta comunicar através de inchaço, celulite e cansaço — e os caminhos reais (alimentação, intestino, movimento, descanso) para restaurar o equilíbrio metabólico.',
    descricao: 'Por trás do inchaço abdominal, da celulite que resiste mesmo em corpos magros e do cansaço que o sono não resolve, existe quase sempre a mesma origem silenciosa: a inflamação de baixo grau. "A Inteligência do Corpo Feminino" decifra esse processo capítulo a capítulo — intestino, fígado, sistema linfático, pele — sempre trocando a lógica da culpa ("falta de disciplina") pela lógica da escuta do corpo. Traz ainda anexos práticos de consulta rápida: checklist diário de rotina e a Escala de Bristol para observar a própria saúde intestinal sem constrangimento. Um livro que ensina a interpretar sinais, não a se punir por eles.',
    audiobookUrl: 'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/inteligencia-corpo-feminino/inteligencia-corpo-feminino.mp3',
    audiobookDisponivel: true,
    precoAudiobook: 14.90
  },
  'inesquecivel-charme-feminino': {
    titulo: 'Inesquecível',
    preco: 67.00,
    categoria: 'principal',
    departamento: 'Universo Feminino',
    resumo: 'Como criar conexões memoráveis e saudáveis sem perder autenticidade — charme feminino construído sobre autoestima, presença e inteligência emocional, não sobre estratégia ou performance.',
    descricao: '"Inesquecível" parte de uma constatação simples: o magnetismo verdadeiro nunca nasce de competição — nasce de verdade. Ao longo de cinco partes (o verdadeiro charme feminino, presença e comunicação, maturidade afetiva, feminilidade e relacionamentos saudáveis, e um bloco final de perguntas para o autoconhecimento), a obra guia a leitora por uma jornada que começa na autoestima e termina na capacidade de se conectar com leveza e valor próprio. É o volume mais extenso e estruturado do lote — uma edição cuidadosamente diagramada, pensada para ser lida como uma experiência completa, não apenas consultada por partes.',
    audiobookUrl: 'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/inesquecivel/inesquecivel.mp3',
    audiobookDisponivel: true,
    precoAudiobook: 14.90
  },
  'a-mulher-que-permanece-inteira': {
    titulo: 'A Mulher que Permanece Inteira',
    preco: 67.00,
    categoria: 'principal',
    departamento: 'Universo Feminino',
    resumo: 'Mais do que um livro sobre relacionamentos: uma jornada de reconstrução emocional feminina — incluindo um raro capítulo sobre como reconhecer perfis emocionais masculinos.',
    descricao: '"O amor saudável não destrói o amor-próprio; pelo contrário, o fortalece." É a partir dessa premissa que a obra percorre seis partes: autoestima feminina profunda, perfis emocionais masculinos (um bloco raro e especialmente valioso, que ajuda a leitora a reconhecer padrões antes de se envolver), relacionamentos tóxicos e proteção emocional, sedução emocional refinada, comunicação moderna e elegância digital, e exercícios práticos de desenvolvimento. É a obra mais extensa e psicologicamente densa do lote — pensada não apenas para inspirar, mas para equipar a leitora com discernimento real diante de vínculos afetivos.',
    audiobookUrl: 'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/a-mulher-que-permanece-inteira/a-mulher-que-permanece-inteira.mp3',
    audiobookDisponivel: true,
    precoAudiobook: 14.90
  },
  'a-arte-da-presenca-masculina': {
    titulo: 'A Arte da Presença Masculina',
    preco: 67.00,
    precoOriginal: 97.00,
    precoPromocional: 67.00,
    categoria: 'principal',
    departamento: 'Universo Masculino',
    resumo: 'Presença vale mais que performance. Um guia sobre como desenvolver magnetismo, segurança emocional e elegância masculina genuína — sem personagens, sem manipulação, sem teatralidade.',
    descricao: 'Esta obra nasce de uma percepção simples e profundamente humana: muitos homens perderam a naturalidade da presença, não por falta de valor, mas por excesso de ruído — social, emocional, cultural. Ao longo de 21 capítulos, o livro percorre o que realmente sustenta o magnetismo masculino: a calma, a segurança sem arrogância, a comunicação elegante, a capacidade de gerar conforto emocional em quem está por perto. Trata também de temas práticos — imagem, voz, postura, o primeiro encontro, o poder da discrição — sempre a partir de um princípio central: presença não se atua, se constrói. Não é um manual de conquista nem de estratégia; é um convite à maturidade emocional como forma real de magnetismo.'
  },
  'a-presenca-em-acao-apendice': {
    titulo: 'A Presença em Ação — Apêndice Prático',
    preco: 37.90,
    precoOriginal: 57.00,
    precoPromocional: 37.90,
    categoria: 'principal',
    departamento: 'Universo Masculino',
    resumo: 'O complemento prático de "A Arte da Presença Masculina" — 12 exercícios objetivos, um por capítulo, para transformar princípio em hábito no dia a dia.',
    descricao: '"A Arte da Presença Masculina" apresentou princípios. Este apêndice apresenta prática. Cada capítulo corresponde a uma dimensão da presença masculina refinada — confiança, controle emocional, comunicação, linguagem corporal, charme, aproximação, flerte saudável e relacionamentos — e traz um exercício objetivo para aplicar no cotidiano, seguido de uma reflexão para fechar com clareza. Inclui ainda um desafio estruturado de 21 dias, dividido em três semanas de progressão gradual. Não são fórmulas nem scripts — são convites à prática consciente e repetida, porque presença não se decora, se constrói.'
  },
  'a-arte-invisivel-elegancia-masculina': {
    titulo: 'A Arte Invisível da Elegância Masculina',
    preco: 57.00,
    precoOriginal: 87.00,
    precoPromocional: 57.00,
    categoria: 'principal',
    departamento: 'Universo Masculino',
    resumo: 'Roupas impressionam por alguns minutos — presença permanece na memória. Um guia sobre o refinamento invisível masculino: o que não se compra, não se veste, mas se percebe.',
    descricao: 'Existe um nível de sofisticação masculina que vai muito além da roupa, da aparência física ou do status — é o refinamento invisível, aquele que se manifesta na postura, na serenidade, na voz, no olhar, na forma de tratar as pessoas. Em 12 capítulos, esta obra aprofunda os aspectos mais sofisticados da presença masculina contemporânea: da psicologia da presença ao magnetismo moderno, da elegância emocional à linguagem corporal, passando por voz refinada, estética contemporânea, perfumes e estilo por ocasião. Um guia para o homem que entende que valor real não precisa ser anunciado constantemente — ele já se comunica antes de qualquer palavra.'
  },
  'guia-integral-saude-beleza-masculina': {
    titulo: 'Guia Integral de Saúde e Beleza Masculina',
    preco: 97.00,
    precoOriginal: 147.00,
    precoPromocional: 97.00,
    categoria: 'principal',
    departamento: 'Universo Masculino',
    resumo: 'O guia definitivo de saúde masculina integrativa — corpo, hormônios, nootrópicos, longevidade e presença, com protocolos práticos e fórmulas de referência para acompanhamento com profissional de saúde.',
    descricao: 'Reunindo 23 capítulos em 4 partes, este é o guia mais completo do Universo Masculino: cuidados essenciais (pele, cabelo, barba, higiene), saúde interna e desempenho (testosterona, libido, próstata, cardiovascular, cerebral), presença e estilo, e uma seção de ferramentas — checklists, exames preventivos, receitas funcionais, nootrópicos e um guia de referência hormonal completo, incluindo fórmulas magistrais. As formulações e sugestões de suplementação que aparecem ao longo da obra foram avaliadas por uma equipe multidisciplinar de saúde integrativa — mas nada aqui substitui o acompanhamento de um profissional que conhece a história e os exames de cada leitor. Um mapa completo do corpo masculino, não um substituto do cuidado clínico individual.'
  },
  'protocolo-90s-executive-black': {
    titulo: 'Protocolo 90\'s Executive Black',
    precoOriginal: 147.90,
    precoPromocional: 97.90,
    categoria: 'principal',
    departamento: 'Executive',
    capa: '/loja/capas/protocolo-90s-executive-black.jpg',
    resumo: 'Sistema de alta performance sob pressão — para líderes que querem governança pessoal, não apenas técnicas isoladas.',
    descricao: 'Existe uma forma de sucesso que parece admirável por fora e cobra juros silenciosos por dentro. Esta edição completa constrói um sistema real de governança pessoal para quem lidera sob pressão: do preço invisível do comando à arquitetura do executivo integral (presença, energia, atenção, inteligência emocional), passando por um sistema sustentável de trabalho, decisão sob incerteza, os Protocolos de Reequilíbrio em 90 Segundos, negociação e influência, cultura e sucessão de liderança, até questões mais profundas de identidade, poder e legado.'
  },
  'executive-black-standalone': {
    titulo: 'Executive Black — Standalone',
    precoOriginal: 77.90,
    precoPromocional: 47.90,
    categoria: 'principal',
    departamento: 'Executive',
    capa: '/loja/capas/executive-black-standalone.jpg',
    resumo: 'Edição compacta com protocolos neurobiológicos, suplementação avançada e psicologia de elite — para executivos que querem aplicação imediata.',
    descricao: 'Uma edição enxuta e direta ao ponto, com fundamentação científica e protocolos de aplicação imediata — sem o percurso mais longo sobre liderança, cultura e legado. Reúne protocolos neurobiológicos, suplementação avançada e psicologia de elite para sustentar performance sob pressão extrema — sem pagar o preço biológico e existencial que o alto desempenho costuma cobrar em silêncio.'
  },
  'a-arquitetura-da-decisao-humana': {
    titulo: 'A Arquitetura da Decisão Humana',
    precoOriginal: 87.90,
    precoPromocional: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento & Comportamento',
    capa: '/loja/capas/a-arquitetura-da-decisao-humana.jpg',
    resumo: 'Neurociência, psicologia e inteligência artificial na tomada de decisões — um mapa para navegar as escolhas com mais lucidez.',
    descricao: 'Por que decidi isso? Este compêndio percorre o caminho que vai do interior do crânio humano — córtex pré-frontal, amígdala, dopamina, oxitocina, vieses cognitivos — até as fronteiras da inteligência artificial. Um mapa construído com neurociência, psicologia cognitiva, economia comportamental e filosofia para navegar as decisões — individuais, cotidianas e coletivas — com mais lucidez.'
  },
  'a-arte-e-a-ciencia-de-viver': {
    titulo: 'A Arte e a Ciência de Viver',
    precoOriginal: 87.90,
    precoPromocional: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento & Comportamento',
    capa: '/loja/capas/a-arte-e-a-ciencia-de-viver.jpg',
    resumo: 'Um chamado urgente ao despertar humano — neurociência, psicologia, filosofia e espiritualidade em um só percurso.',
    descricao: 'Um chamado urgente ao despertar humano em meio a um sistema que lucra com a doença, o consumo compulsivo e a desconexão. A obra une neurociência, psicologia, filosofia e espiritualidade em um único percurso: dos fundamentos biológicos do ser humano até as relações, o trabalho e a sociedade, passando pela sabedoria e transformação pessoal.'
  },
  'a-inteligencia-da-vida': {
    titulo: 'A Inteligência da Vida',
    precoOriginal: 97.90,
    precoPromocional: 67.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento & Comportamento',
    capa: '/loja/capas/a-inteligencia-da-vida.jpg',
    resumo: 'Como compreender seu organismo para viver com mais saúde, equilíbrio e plenitude — 38 capítulos sobre a vida integrada.',
    descricao: 'Cada vez mais pessoas procuram atendimento médico não por uma doença claramente definida, mas porque deixaram de se sentir verdadeiramente saudáveis. Esta obra apresenta o organismo humano como um sistema profundamente integrado — cérebro, sistema nervoso, hormônios, metabolismo, imunidade, intestino, emoções e comportamento em diálogo permanente.'
  },
  'a-jornada-interior': {
    titulo: 'A Jornada Interior',
    precoOriginal: 87.90,
    precoPromocional: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento & Comportamento',
    capa: '/loja/capas/a-jornada-interior.jpg',
    resumo: 'Rebelião contra a fragmentação da saúde — bioquímica, nutrição, movimento, sono e alquimia interior em um único mapa.',
    descricao: 'Este livro nasce como um ato de rebelião contra a fragmentação da saúde — o corpo para o médico, a mente para o psicólogo, o espírito para o domingo. Propõe reunir bioquímica da nutrição, linguagem das emoções, movimento, sono e sinfonia hormonal em um único mapa de autoconhecimento.'
  },
  'excelencia-humana': {
    titulo: 'Excelência Humana',
    precoOriginal: 97.90,
    precoPromocional: 67.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento & Comportamento',
    capa: '/loja/capas/excelencia-humana.jpg',
    resumo: 'Saúde, inteligência, equilíbrio emocional e propósito — seis pilares integrados de uma vida de verdadeira excelência.',
    descricao: 'Saúde, inteligência, equilíbrio emocional, produtividade e propósito sempre foram tratados como áreas distintas — mas a vida nunca funcionou por departamentos. Esta obra reúne essas dimensões em um único modelo integrado, mostrando como energia celular, sistema nervoso, equilíbrio hormonal formam uma rede dinâmica e interdependente.'
  },
  'o-retorno-da-clareza': {
    titulo: 'O Retorno da Clareza',
    precoOriginal: 77.90,
    precoPromocional: 47.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento & Comportamento',
    capa: '/loja/capas/o-retorno-da-clareza.jpg',
    resumo: 'Investigação profunda sobre a atenção roubada — da captura de atenção à reconstrução deliberada de clareza.',
    descricao: 'Este não é um livro de respostas rápidas nem de soluções simplificadas. É uma investigação profunda sobre como a atenção — antes um eixo silencioso a partir do qual o pensamento se desenvolvia — passou a ser um recurso constantemente disputado, transformando a mente em superfície de passagem para estímulos fragmentados.'
  },
  'a-neurobiologia-integrativa-da-depressao': {
    titulo: 'A Neurobiologia Integrativa da Depressão',
    precoOriginal: 97.90,
    precoPromocional: 67.90,
    categoria: 'principal',
    departamento: 'Saúde Integrativa',
    capa: '/loja/capas/a-neurobiologia-integrativa-da-depressao.jpg',
    resumo: 'Uma visão sistêmica que rompe com o mito do "desequilíbrio químico" — neurotransmissores, inflamação, intestino-cérebro e vínculos.',
    descricao: 'A depressão raramente tem uma única causa. Esta obra rompe com a ideia simplista do "desequilíbrio químico" e apresenta uma visão sistêmica: neurotransmissores, neuroplasticidade, inflamação, eixo intestino-cérebro, sono, hormônios, trauma, vínculos e ambiente social interagindo entre si.'
  },
  'a-visao-integrativa-da-obesidade': {
    titulo: 'A Visão Integrativa da Obesidade',
    precoOriginal: 97.90,
    precoPromocional: 67.90,
    categoria: 'principal',
    departamento: 'Saúde Integrativa',
    capa: '/loja/capas/a-visao-integrativa-da-obesidade.jpg',
    resumo: 'Emagrecer não é apenas "comer menos" — uma visão sistêmica que desmonta mitos e revela o caminho real da transformação.',
    descricao: 'Emagrecer não é apenas "comer menos e se mover mais" — e este livro explica, com profundidade científica, por que essa equação simplista falha. A obra revela o organismo obeso como um sistema em modo de proteção: tecido adiposo como órgão endócrino, metainflamação, resistência à insulina e à leptina.'
  },
  'medicina-natural-integrativa': {
    titulo: 'Medicina Natural Integrativa',
    precoOriginal: 87.90,
    precoPromocional: 57.90,
    categoria: 'principal',
    departamento: 'Saúde Integrativa',
    capa: '/loja/capas/medicina-natural-integrativa.jpg',
    resumo: 'Os pilares reais de que o organismo precisa para funcionar bem — água, luz, sono, movimento, nutrição e regulação do estresse.',
    descricao: 'Vivemos na era com mais recursos médicos da história — e, paradoxalmente, com mais fadiga crônica, inflamação e adoecimento precoce. Este livro parte de uma convicção central: o corpo humano carrega uma inteligência biológica extraordinária, e a maior parte do adoecimento moderno é resultado de pequenas desordens repetidas ao longo do tempo.'
  },
  'mentes-esgotadas': {
    titulo: 'Mentes Esgotadas',
    precoOriginal: 87.90,
    precoPromocional: 57.90,
    categoria: 'principal',
    departamento: 'Saúde Integrativa',
    capa: '/loja/capas/mentes-esgotadas.jpg',
    resumo: 'Nunca houve tantos recursos — e tantos casos de burnout, ansiedade e vazio existencial. Um protocolo real de reconstrução mental.',
    descricao: 'Este livro nasce para explicar, de forma acessível e científica, como o cérebro funciona, como as emoções afetam o corpo e como os hábitos modernos adoecem silenciosamente a mente. Da neurociência até um protocolo diário de proteção mental, oferecendo caminhos reais para recuperar clareza, energia e sentido.'
  },
  'o-elo-invisivel': {
    titulo: 'O Elo Invisível',
    precoOriginal: 77.90,
    precoPromocional: 47.90,
    categoria: 'principal',
    departamento: 'Saúde Integrativa',
    capa: '/loja/capas/o-elo-invisivel.jpg',
    resumo: 'Cansaço, névoa mental e tristeza — a teia invisível que conecta resistência insulínica, inflamação e estresse emocional.',
    descricao: 'Este livro chega como uma verdade libertadora para quem já ouviu "só precisa se esforçar mais". Explica a "teia invisível" que conecta resistência insulínica, inflamação, desequilíbrio intestinal e estresse emocional em um único redemoinho metabólico que se autoalimenta.'
  },
  'rejuvenesca': {
    titulo: 'Rejuvenesça',
    precoOriginal: 87.90,
    precoPromocional: 57.90,
    categoria: 'principal',
    departamento: 'Saúde Integrativa',
    capa: '/loja/capas/rejuvenesca.jpg',
    resumo: 'Vigor, beleza, vitalidade e realização — o método integral para renovar corpo, mente e propósito em qualquer idade.',
    descricao: 'O envelhecimento não é o declínio linear e inevitável que a narrativa tradicional descreve. Este livro apresenta a diferença entre idade cronológica e idade biológica — mostrando que a genética responde por apenas 7% a 25% do processo de envelhecer, enquanto o restante é moldado por estilo de vida, hábitos e ambiente.'
  },
  'transforma-te-protocolos-90s': {
    titulo: 'TRANSFORMA-TE — Protocolos 90s',
    precoOriginal: 77.90,
    precoPromocional: 47.90,
    categoria: 'principal',
    departamento: 'Saúde Integrativa',
    capa: '/loja/capas/transforma-te-protocolos-90s.jpg',
    resumo: 'O método dos 90 segundos — como criar espaço interno antes de reagir, com protocolos para 12 situações do dia a dia.',
    descricao: 'A vida moderna exige respostas rápidas, mas raramente ensina a criar espaço interno antes de reagir. Este método é construído em torno do intervalo de 90 segundos — tempo suficiente para impedir que um momento de desorganização escreva sozinho o próximo capítulo. Inclui protocolos para pânico, raiva, conflitos e situações reais.'
  },
  'consequencias-edicao-essencial': {
    titulo: 'CONSEQUÊNCIAS — Edição Essencial',
    subtitulo: 'Causa, Efeito e Escolhas de Vida',
    preco: 37.90,
    categoria: 'principal',
    departamento: 'Saúde Integrativa',
    capa: '/loja/capas/consequencias-edicao-essencial.jpg',
    resumo: 'O intervalo entre a decisão de hoje e a consequência de amanhã — como reconhecer, a tempo, os pontos onde ainda é possível interromper a cascata que silenciosamente constrói a trajetória.',
    descricao: 'Poucas pessoas decidem conscientemente prejudicar a própria saúde — as trajetórias desfavoráveis começam de forma muito menos dramática: permanecer sentado porque é confortável, repetir alimentação pobre porque é prática, dormir menos porque sempre existe algo para terminar. Este livro percorre os 40 capítulos que conectam esses pequenos hábitos (sedentarismo, alimentação, sono, estresse, tabaco, álcool) ao momento em que o corpo começa a cobrar. Não é uma obra de proibições, mas sobre reconhecer os pontos de interrupção da cascata — antes que a próxima consequência se instale e transforme hábitos em limitações reais.'
  },
  'alem-do-que-voce-ve': {
    titulo: 'Além do Que Você Vê',
    precoOriginal: 77.90,
    precoPromocional: 47.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento & Comportamento',
    capa: '/loja/capas/alem-do-que-voce-ve.jpg',
    resumo: 'Guia para pais e responsáveis de adolescentes — sobre portas batidas, silêncios, namoro e as conversas que ninguém ensinou a ter.',
    descricao: 'Para quem tem em casa alguém entre catorze e vinte e poucos anos e sente que está lidando com uma pessoa que não conhece mais. Este não é um manual de disciplina — é algo mais básico: o que está acontecendo do outro lado. Cada capítulo mostra o que se passou nas horas anteriores, às quais o adulto não teve acesso, para que cada lado entenda o que o outro está atravessando.',
    audiobookPartes: [
      'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/alem-do-que-voce-ve/alem-do-que-voce-ve-parte1.mp3',
      'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/alem-do-que-voce-ve/alem-do-que-voce-ve-parte2.mp3'
    ],
    audiobookDisponivel: true,
    precoAudiobook: 24.90
  },
  'alem-do-que-voce-sente': {
    titulo: 'Além do Que Você Sente',
    precoOriginal: 77.90,
    precoPromocional: 47.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento & Comportamento',
    capa: '/loja/capas/alem-do-que-voce-sente.jpg',
    resumo: 'Um mapa para adolescentes atravessarem os anos em que tudo ferve — sobre emoções, amizades, namoro, limites e situações que ninguém explicou.',
    descricao: 'Para quem tem entre catorze e vinte e poucos anos e está atravessando a fase em que tudo é mais intenso. Um manual de instruções da própria mente, o tipo de coisa que deveria vir junto com essa idade e nunca vem. Trata com seriedade temas como cuidado vs. controle num namoro, ciúme, pressão por fotos íntimas e o direito de dizer não.',
    audiobookPartes: [
      'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/alem-do-que-voce-sente/alem-do-que-voce-sente-parte1.mp3',
      'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/alem-do-que-voce-sente/alem-do-que-voce-sente-parte2.mp3',
      'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/alem-do-que-voce-sente/alem-do-que-voce-sente-parte3.mp3'
    ],
    audiobookDisponivel: true,
    precoAudiobook: 19.90
  },
  'o-caminho-da-consciencia': {
    titulo: 'O Caminho da Consciência',
    precoOriginal: 87.90,
    precoPromocional: 57.90,
    categoria: 'principal',
    departamento: 'Desenvolvimento & Comportamento',
    capa: '/loja/capas/o-caminho-da-consciencia.jpg',
    resumo: 'Um convite a uma pausa no automatismo — para compreender a si mesmo, os outros e a vida através da perspectiva esotérica.',
    descricao: 'Esta obra percorre o indivíduo como ser cósmico em evolução, o despertar da consciência, os obstáculos comuns do caráter (egoísmo, timidez, inveja), as escolhas e o planejamento pessoal, sempre com o objetivo de transformar dor em reflexão, não apenas em reação automática.'
  },
  'inteligencia-artificial-volume-1': {
    titulo: 'Inteligência Artificial — Volume 1',
    precoOriginal: 87.90,
    precoPromocional: 57.90,
    categoria: 'principal',
    departamento: 'Negócios & Tecnologia',
    capa: '/loja/capas/inteligencia-artificial-volume-1.jpg',
    resumo: 'Fundamentos da revolução da IA — como inteligência artificial e novas tecnologias estão transformando negócios, profissões e produtividade.',
    descricao: 'Traduz o futuro para o presente de forma prática e acessível: dos fundamentos da revolução da IA ao futuro do trabalho, passando por aplicações para atendimento, marketing, gestão e profissões específicas, até um plano de transformação real e uma reflexão sobre a humanidade nessa nova era.'
  },
  'empresas-inteligentes-volume-2': {
    titulo: 'Empresas Inteligentes — Volume 2',
    precoOriginal: 87.90,
    precoPromocional: 57.90,
    categoria: 'principal',
    departamento: 'Negócios & Tecnologia',
    capa: '/loja/capas/empresas-inteligentes-volume-2.jpg',
    resumo: 'Guia prático de implementação com diagnósticos, exercícios, checklists e planos de automação e IA para empresas e profissionais.',
    descricao: 'Oferece um caminho estruturado e progressivo para incorporar IA de forma consciente e verdadeiramente útil — identificando gargalos, organizando processos, automatizando tarefas e ampliando capacidades humanas. Reúne diagnósticos, exercícios, checklists e centenas de aplicações práticas.'
  },
};

function buscarLivro(livroId) {
  return CATALOGO[livroId] || null;
}

module.exports = { CATALOGO, buscarLivro, obterVozPadraoParaDepartamento };
