// lib/amostrasExperimente.js
//
// Conteúdo EDITORIAL de degustação do Experimente ZUNI (/experimente/<id>/), separado do catálogo.
// Aqui ficam só os dados da amostra. Preço, capa, título comercial, audiobook e checkout continuam
// vindo EXCLUSIVAMENTE do catálogo (lib/catalogoLivros.js) — nada comercial é duplicado neste arquivo.
//
// FAIL-CLOSED: uma obra só tem página pública se, ao mesmo tempo,
//   1. o catálogo marca `amostraDisponivel: true`, e
//   2. há um registro aqui com `aprovada: true` e um trecho explicitamente aprovado.
// Qualquer outra situação responde 404 (ver lib/experimenteObra.js).
//
// Campos de uma amostra:
//   livroId           id do catálogo (igual à chave)
//   aprovada          true somente depois da aprovação editorial do trecho
//   trecho            texto do trecho aprovado, texto puro; parágrafos separados por linha em branco
//   tituloTrecho      (opcional) título do trecho
//   chamada           (opcional) microcopy editorial curta, exibida sob o título
//   tempoLeitura      (opcional) tempo estimado da amostra, exibido na página
//   outrosCapitulos   (opcional) títulos reais de capítulos que NÃO fazem parte do trecho ("Continue explorando")
//   origemUniverso    slug do universo editorial ('universo-feminino'); define o "Voltar"
//   avisoInformativo  false/ausente: sem aviso; true: aviso padrão de saúde; string: texto próprio da obra
//   ttsDisponivel     true habilita "Ouvir este trecho" (voz do navegador, sem custo)
//   audioAmostra      (opcional) { aprovada, arquivo, duracaoSegundos } — amostra CURTA do audiobook oficial, arquivo
//                     estático em /audio/amostras/<livroId>.mp3 (só o trecho aprovado; nunca o áudio integral).
//                     Só é exibida se aprovada === true, o catálogo marca audiobookDisponivel e o arquivo existe.
//
// NUNCA colocar aqui o texto integral da obra, o módulo de dados do flipbook, URLs de áudio ou de storage.

const MAX_TRECHO_CHARS = 6000; // teto de segurança contra colar a obra inteira por engano
const MARCADOR_PLACEHOLDER = /^\s*\[AMOSTRA EDITORIAL/i;

// Universos editoriais conhecidos: rótulo e rota de retorno determinística (não depende de history.back).
// O slug também é o valor de origem comercial (lib/origemCompra.js).
const UNIVERSOS = Object.freeze({
  'universo-feminino': Object.freeze({ rotulo: 'Universo Feminino', rota: '/loja/universo-feminino/' })
});

const AMOSTRAS = Object.freeze({
  // Ela Tem Classe — E3B. Trecho aprovado editorialmente: Introdução + Capítulo 1 (texto idêntico ao da obra,
  // 7 parágrafos, ~11% do livro). Os capítulos listados em outrosCapitulos NÃO fazem parte do trecho.
  'ela-tem-classe': Object.freeze({
    livroId: 'ela-tem-classe',
    aprovada: true,
    trecho: [
      "Existe uma diferença profunda entre simplesmente chamar atenção e tornar-se, de fato, inesquecível. Muitas mulheres alcançam uma beleza estética passageira — mas poucas desenvolvem essa outra coisa, mais rara e mais bonita, que é a presença. Porque presença é justamente aquilo que permanece na memória de alguém mesmo depois que você já saiu da sala.",
      "A verdadeira elegância feminina nunca nasceu só da maquiagem, da roupa ou da aparência física. Ela nasce do encontro entre estética e inteligência emocional, entre postura e serenidade, entre a mulher que você é por dentro e a forma como escolhe se apresentar ao mundo. Uma mulher elegante transforma o ambiente à sua volta sem precisar de esforço — sua energia comunica equilíbrio, sua voz transmite calma, e o simples fato de ela estar ali já inspira um respeito silencioso.",
      "Vivemos num mundo em que o excesso virou hábito. E é exatamente por isso que a sofisticação, hoje, mora na leveza — na discrição de quem não precisa gritar para ser vista, na autenticidade de quem não representa um papel.",
      "Este livro não foi feito apenas para falar de moda ou de aparência. Ele nasceu para te ajudar a compreender como se constrói uma presença sofisticada, como se desenvolve um charme que não precisa de esforço, como se une beleza e inteligência emocional numa única identidade — elegante, madura, genuinamente sua.",
      "Elegância não é perfeição. É harmonia. E a mulher verdadeiramente sofisticada nunca vive tentando provar o próprio valor ao mundo. Ela constrói, dia após dia, uma vida bonita — e essa beleza, naturalmente, transborda para sua imagem, sua postura, sua voz, suas escolhas, sua presença.",
      "Durante muitos anos, a elegância feminina foi associada apenas à aparência externa. Mas o refinamento, quando amadurece, se revela bem mais profundo do que isso. Hoje, as mulheres verdadeiramente sofisticadas entendem que a beleza que fica nasce de um encontro — entre a aparência harmoniosa e a inteligência emocional, entre a postura e a serenidade, entre a feminilidade equilibrada e uma identidade que é só sua.",
      "É possível vestir as roupas mais luxuosas do mundo e, ainda assim, transmitir ansiedade. E é possível, com as peças mais simples, parecer extraordinariamente refinada. Por quê? Porque a elegância de verdade nunca dependeu só da roupa. Ela depende da energia que sustenta a imagem. A mulher sofisticada não precisa competir por atenção, não transforma cada momento num espetáculo, não busca validação a cada esquina. Sua presença já carrega equilíbrio — e o equilíbrio, talvez, seja uma das formas mais elevadas de beleza que existem."
    ].join('\n\n'),
    tituloTrecho: 'Da aparência à presença',
    chamada: 'A diferença entre chamar atenção e permanecer na memória de alguém.',
    outrosCapitulos: Object.freeze([
      'Perfumes e Assinatura Feminina',
      'O Poder das Cores',
      'A Voz Elegante',
      'Rotinas e Hábitos da Mulher Elegante',
      'O Envelhecimento Elegante'
    ]),
    origemUniverso: 'universo-feminino',
    avisoInformativo: false,
    // Ela tem audiobook oficial: a demonstração comercial é a amostra real (candidato aprovado), não a voz do navegador.
    ttsDisponivel: false,
    audioAmostra: Object.freeze({
      aprovada: true,
      arquivo: '/audio/amostras/ela-tem-classe.mp3',
      duracaoSegundos: 65
    })
  }),
  // Código Feminino — Parte IV (Caps. 11 a 13): sexualidade, libido e desejo. A Introdução e o Cap. 1 ficam de fora porque citam suplementação.
  // Trecho idêntico ao da obra, aprovado em 02/11/2026 (revisão do autor); amostra de áudio = corte do audiolivro oficial.
  'codigo-feminino': Object.freeze({
    livroId: 'codigo-feminino',
    aprovada: true,
    trecho: [
      "A sexualidade feminina é uma dimensão complexa e multifacetada, que envolve aspectos físicos, emocionais, psicológicos e sociais ao mesmo tempo. Ela acompanha a mulher ao longo de toda a vida — da infância à adolescência, da vida adulta ao envelhecimento — e nunca se limita ao ato sexual em si. Envolve a percepção do próprio corpo, a expressão de sentimentos e desejos, e a forma como cada mulher se relaciona consigo mesma e com quem escolhe se aproximar.",
      "Ao longo da história, a sexualidade feminina foi cercada de mitos e tabus que ainda hoje influenciam crenças pessoais e culturais. Muitos desses mitos alimentam sentimentos de culpa ou vergonha, e podem prejudicar profundamente a experiência do prazer. Reconhecer essas crenças — e ter a coragem de questioná-las — é um dos primeiros passos para uma vida sexual saudável e plena.",
      "Fatores sociais como educação, religião, mídia e padrões de beleza também exercem uma influência enorme sobre como a mulher percebe seu próprio corpo e seus desejos. Entender essas influências, e a forma como elas moldaram silenciosamente crenças que talvez nunca tenham sido escolhidas conscientemente, é o primeiro passo para que a mulher retome, de fato, o controle sobre sua própria sexualidade.",
      "A libido é o desejo sexual — e pode se manifestar de formas diferentes: de maneira espontânea, quando surge sem qualquer estímulo externo, ou de forma responsiva, quando nasce em resposta a estímulos físicos, emocionais ou de contexto. Essa distinção é fundamental, porque explica por que a experiência do desejo varia tanto de mulher para mulher — e por que nenhuma das duas formas é mais \"normal\" do que a outra.",
      "Os fatores que influenciam a libido são múltiplos. Do lado hormonal, os níveis de estrogênio, progesterona e testosterona têm papel importante na excitação e no interesse sexual. Do lado neurológico e bioquímico, neurotransmissores como dopamina e serotonina modulam o prazer e a motivação. E do lado psicológico, autoestima, estresse, ansiedade e experiências passadas afetam a libido de forma tão significativa quanto qualquer hormônio. O equilíbrio entre corpo e mente é, por isso, essencial para que o desejo se manifeste de forma saudável e constante.",
      "O desejo sexual nunca é só físico — está intimamente ligado à mente e às emoções. Sentimentos de bem-estar, autoestima e autoconfiança impactam diretamente a capacidade de sentir desejo e prazer. O estresse, por outro lado, tende a reduzir a libido: sob tensão, o corpo prioriza a sobrevivência, não o prazer.",
      "A psicologia do desejo envolve reconhecer os próprios limites e vontades, compreender os próprios gatilhos e preferências, e aprender a lidar com frustrações ou expectativas que vêm de fora. A relação com o próprio corpo, a percepção da própria sensualidade e a consciência do próprio prazer são peças fundamentais para o desenvolvimento de uma vida sexual satisfatória. Exercícios de atenção plena e de conexão entre mente e corpo podem ajudar a ampliar essa consciência sexual, permitindo que a mulher explore sua sexualidade de forma mais profunda e integrada — não como algo separado do resto da vida emocional, mas como parte dela."
    ].join('\n\n'),
    tituloTrecho: "Sexualidade, libido e desejo",
    chamada: "O que a medicina integrativa sabe sobre libido, desejo e prazer feminino — sem tabus e sem fórmulas.",
    outrosCapitulos: Object.freeze([
      "Fundamentos do Autocuidado Diário",
      "A Importância dos Hormônios na Saúde Feminina",
      "O Ritual do Sono e Renovação Celular",
      "Higiene Íntima e Microbiota Vaginal",
      "Autoestima e Imagem Corporal"
    ]),
    origemUniverso: 'universo-feminino',
    avisoInformativo: true,
    // Tem audiobook oficial: a demonstração é a amostra real, não a voz do navegador.
    ttsDisponivel: false,
    audioAmostra: Object.freeze({
      aprovada: true,
      arquivo: '/audio/amostras/codigo-feminino.mp3',
      duracaoSegundos: 68
    })
  }),
  // A Inteligência do Corpo Feminino — Capítulo 1 (7 primeiros parágrafos). A Introdução fica de fora porque usa a palavra "protocolo".
  // Trecho idêntico ao da obra, aprovado em 02/11/2026 (revisão do autor); amostra de áudio = corte do audiolivro oficial.
  'a-inteligencia-do-corpo-feminino': Object.freeze({
    livroId: 'a-inteligencia-do-corpo-feminino',
    aprovada: true,
    trecho: [
      "Se existisse um único fio conectando o inchaço abdominal, a dificuldade de emagrecer, a celulite resistente e a sensação de cansaço crônico, esse fio seria a inflamação. Não a inflamação que se vê — aquela de uma torção no tornozelo ou de uma garganta inflamada, com sinais evidentes e resposta rápida do corpo. A inflamação de que tratamos aqui é outra: crônica, discreta, de baixo grau. Ela não avisa com dor. Ela se instala devagar, e o corpo, adaptado à sua presença constante, deixa de reconhecê-la como uma anomalia.",
      "A inflamação de baixo grau é, paradoxalmente, uma resposta de defesa que se tornou permanente. O sistema imunológico reage a agressões contínuas — açúcar em excesso, alimentos ultraprocessados, estresse crônico, sono insuficiente, poluentes ambientais — como se cada uma delas fosse uma pequena ameaça. Isoladamente, o corpo daria conta. Mas quando essas agressões se acumulam, dia após dia, sem pausa para reparo, o estado inflamatório deixa de ser uma resposta pontual e passa a ser o pano de fundo permanente do organismo.",
      "É esse pano de fundo que explica por que duas mulheres com hábitos aparentemente semelhantes podem ter resultados tão diferentes na balança, na pele, na disposição. Não se trata apenas de quantas calorias se consome, mas de quanto o corpo está, nos bastidores, ocupado se defendendo — em vez de metabolizar, digerir e regenerar com eficiência.",
      "Antes de qualquer diagnóstico formal, o corpo já está enviando sinais. Inchaço recorrente, sobretudo ao final do dia. Pele que perde viço mesmo com boa rotina de cuidados. Sensação de peso e lentidão após as refeições. Dificuldade de perder gordura localizada mesmo com dieta e exercício regulares. Alterações de humor que parecem desproporcionais ao que a vida está exigindo. Isoladamente, cada um desses sinais pode ter explicações pontuais. Juntos, e persistentes, eles compõem um padrão — o padrão de um corpo inflamado pedindo atenção.",
      "Ignorar esses sinais não os faz desaparecer; apenas os empurra para adiante, onde tendem a se expressar de forma mais séria. É por isso que aprender a reconhecê-los cedo — não como imperfeições a esconder, mas como informação a decodificar — é o primeiro gesto de cuidado real com o próprio corpo.",
      "Grande parte do processo inflamatório tem origem no que comemos, mas não da forma como o discurso da dieta costuma apresentar — como pecado e penitência. Alimentos ricos em açúcar refinado, farinhas processadas e gorduras de baixa qualidade funcionam como combustível para esse fogo interno: elevam picos de glicose no sangue, favorecem o acúmulo de gordura visceral e alimentam justamente o tipo de resposta imunológica que mantém a inflamação ativa.",
      "Do outro lado, alimentos anti-inflamatórios — vegetais coloridos, boas fontes de gordura, especiarias como cúrcuma e gengibre, fibras de qualidade — não funcionam como restrição, mas como reabastecimento. A diferença entre \"cortar\" e \"nutrir\" é mais do que semântica: é a diferença entre um corpo em estado de escassez e um corpo em estado de reparo."
    ].join('\n\n'),
    tituloTrecho: "O fio que liga o inchaço, a celulite e o cansaço",
    chamada: "A inflamação de baixo grau — o fio silencioso por trás do inchaço, da celulite e do cansaço que o sono não resolve.",
    outrosCapitulos: Object.freeze([
      "Intestino Preso, o Sabotador",
      "Alimentos, Intolerâncias e a Saúde da Mucosa Digestiva",
      "Celulite, Pochete e Gordura Localizada: a Leitura Completa",
      "Exercício, Alongamento e Sistema Linfático",
      "Um Tributo à Mulher que Habita Esse Corpo"
    ]),
    origemUniverso: 'universo-feminino',
    avisoInformativo: true,
    // Tem audiobook oficial: a demonstração é a amostra real, não a voz do navegador.
    ttsDisponivel: false,
    audioAmostra: Object.freeze({
      aprovada: true,
      arquivo: '/audio/amostras/a-inteligencia-do-corpo-feminino.mp3',
      duracaoSegundos: 70
    })
  }),
  // Inesquecível — Introdução + 1º parágrafo do Capítulo 1.
  // Trecho idêntico ao da obra, aprovado em 02/11/2026 (revisão do autor); amostra de áudio = corte do audiolivro oficial.
  'inesquecivel-charme-feminino': Object.freeze({
    livroId: 'inesquecivel-charme-feminino',
    aprovada: true,
    trecho: [
      "Durante muito tempo, fizeram muitas mulheres acreditarem que conquistar alguém dependia, sobretudo, de aparência, de aprovação externa, da capacidade de impressionar sem parar. Mas as conexões que realmente ficam raramente nascem disso. O que torna uma mulher inesquecível quase nunca é exagero ou perfeição estética. É, quase sempre, algo mais sutil — a forma como ela transmite presença. A tranquilidade no olhar. A leveza da energia. A maneira como faz alguém se sentir bem só por estar perto.",
      "Existe um tipo de charme que não precisa disputar atenção — um magnetismo silencioso, que nasce da autoestima em equilíbrio e da segurança emocional. Mulheres emocionalmente maduras não vivem tentando provar valor a cada instante, nem correndo atrás de validação, nem transformando o amor num jogo. Elas entendem algo simples e poderoso: a atração de verdade nunca nasceu da ansiedade de ser escolhida. Nasce da capacidade de construir conexões reais.",
      "Este livro não foi feito para ensinar manipulação, nem técnicas para controlar sentimentos alheios. O propósito aqui é bem mais sofisticado: ajudar você a desenvolver presença refinada, autoestima tranquila, inteligência emocional, um charme que nasce de dentro. Porque o verdadeiro encanto feminino nunca esteve em parecer perfeita. Está em transmitir verdade sem perder a delicadeza.",
      "Ao longo destas páginas, você vai perceber que feminilidade nunca significou submissão. Que delicadeza nunca significou fragilidade. Que receptividade nunca significou carência. Que demonstrar interesse nunca significou perder valor. Existe uma diferença enorme entre buscar aprovação e criar conexão — muitas pessoas entram nos relacionamentos tentando, desesperadamente, ser aceitas. Mas as mulheres emocionalmente inteligentes aprendem outro caminho: não tentam convencer ninguém a gostar delas. Observam reciprocidade, respeito, verdade — e isso muda, por completo, a qualidade do que constroem.",
      "O charme feminino saudável nunca dependeu só da beleza. A aparência pode chamar atenção — mas é a energia emocional que sustenta uma presença. A forma de conversar, de escutar, de sorrir, de acolher marca muito mais fundo do que qualquer frase decorada ou tentativa forçada de sedução. As pessoas raramente esquecem quem as fez se sentir bem consigo mesmas.",
      "Por isso, esta obra não é sobre fazer alguém gostar de você. É sobre se tornar uma mulher emocionalmente forte, naturalmente encantadora, segura sem arrogância, leve sem superficialidade, feminina sem submissão. Porque o verdadeiro magnetismo nunca grita. Ele transmite. Não força — atrai, naturalmente. E quase sempre começa de um jeito simples: um olhar tranquilo, uma conversa leve, um sorriso sincero, e a serenidade silenciosa de uma mulher que já conhece o próprio valor.",
      "Há uma diferença profunda — quase um abismo silencioso — entre querer compartilhar a vida com alguém e precisar desesperadamente de sua aprovação para se sentir inteira. Muitas mulheres passam anos acreditando que o amor se conquista pela beleza, pela aparência impecável, pela capacidade de despertar olhares. Com o tempo, porém, o coração aprende algo que a mente demora a aceitar: atenção não é conexão. Admiração superficial não é ser amada de verdade. E o interesse de um instante não constrói vínculo nenhum."
    ].join('\n\n'),
    tituloTrecho: "O charme que nasce de dentro",
    chamada: "O magnetismo verdadeiro nunca nasceu da competição — nasce de verdade, de presença e de valor próprio.",
    outrosCapitulos: Object.freeze([
      "A Mulher que Não Precisa Implorar por Atenção",
      "O Magnetismo da Presença Tranquila",
      "Conversas Femininas que Encantam",
      "Os Erros Emocionais que Afastam Conexões Saudáveis",
      "O Brilho Silencioso da Mulher Emocionalmente Inteligente"
    ]),
    origemUniverso: 'universo-feminino',
    avisoInformativo: false,
    // Tem audiobook oficial: a demonstração é a amostra real, não a voz do navegador.
    ttsDisponivel: false,
    audioAmostra: Object.freeze({
      aprovada: true,
      arquivo: '/audio/amostras/inesquecivel-charme-feminino.mp3',
      duracaoSegundos: 61
    })
  }),
  // A Mulher que Permanece Inteira — Introdução + 2 primeiros parágrafos do Capítulo 1 (Parte I).
  // Trecho idêntico ao da obra, aprovado em 02/11/2026 (revisão do autor); amostra de áudio = corte do audiolivro oficial.
  'a-mulher-que-permanece-inteira': Object.freeze({
    livroId: 'a-mulher-que-permanece-inteira',
    aprovada: true,
    trecho: [
      "Vivemos em uma época curiosa. Nunca houve tantas formas de comunicação e, ao mesmo tempo, tantas dificuldades de conexão real nos relacionamentos. As pessoas conversam o dia inteiro, mas raramente se conectam de maneira profunda. Recebem atenção constante, mas sentem-se emocionalmente vazias; possuem centenas de contatos virtuais, mas pouca estabilidade afetiva concreta. Em meio a redes sociais, mensagens instantâneas, relações aceleradas e um excesso contínuo de estímulos, muitas mulheres começaram a vivenciar silenciosamente um profundo cansaço emocional. Trata-se do desgaste provocado por conexões superficiais, vínculos instáveis, jogos psicológicos, ansiedade afetiva e uma necessidade ininterrupta de validação.",
      "Paralelamente a esse cenário, a mulher moderna enfrenta um conflito interno silencioso. Ela deseja amar, construir intimidade, viver relacionamentos saudáveis, expressar sua feminilidade e sentir-se verdadeiramente valorizada. No entanto, deseja tudo isso sem precisar abrir mão de sua identidade, abandonar sua autoestima, tornar-se dependente afetiva ou viver em permanente sofrimento. E é exatamente a partir dessa busca por equilíbrio que esta obra se desenvolve.",
      "A Mulher que Permanece Inteira não foi concebido como um manual superficial de sedução, tampouco como um guia baseado em manipulação, jogos de poder ou estratégias para controlar terceiros. O livro nasce de uma proposta consideravelmente mais sofisticada: ajudar a mulher a desenvolver inteligência emocional aplicada à sua vida afetiva. Nesta jornada, a feminilidade não é tratada como vulnerabilidade ou fraqueza, a autoestima não é confundida com arrogância e os relacionamentos deixam de ser vistos como disputas de ego.",
      "O objetivo central desta leitura não é moldar uma personagem perfeita ou ensinar técnicas de atuação social, mas promover uma consciência emocional genuína. Mulheres emocionalmente maduras não vivem tentando parecer extraordinárias o tempo todo; elas aprendem a reconhecer seu valor, proteger sua paz interior, cultivar autenticidade e construir laços saudáveis, amando o outro sem abandonar a si mesmas. Em uma sociedade que pressiona a mulher a performar, competir e sustentar imagens irreais, o verdadeiro luxo e a maior elegância residem no equilíbrio emocional. A presença consciente vale mais do que a performance, e o magnetismo duradouro nasce da mulher que cultiva uma vida interior sólida e coerente.",
      "Existe uma diferença silenciosa, porém profunda, entre a mulher que busca desesperadamente ser valorizada pelo mundo e aquela que já reconheceu o próprio valor interior. A primeira vive emocionalmente refém das reações e do reconhecimento alheio, enquanto a segunda constrói uma presença sólida. Essa mudança de perspectiva transforma de maneira definitiva a qualidade das escolhas, a postura afetiva, a expressão da feminilidade e a preservação da paz interior.",
      "Muitas mulheres foram educadas para mensurar o próprio valor com base em critérios externos, como aprovação estética, validação masculina, comparação social e quantidade de atenção recebida. Ao longo de anos, habituaram-se a tentar provar que eram interessantes, suficientes e dignas de afeto. No entanto, buscar incessantemente o merecimento de aprovação é um processo desgastante. Quando a mulher não reconhece seu valor intrínseco, torna-se vulnerável a qualquer oscilação ou ausência de validação externa."
    ].join('\n\n'),
    tituloTrecho: "Inteira, sem perder a própria essência",
    chamada: "Como amar, construir intimidade e se sentir valorizada sem abrir mão de si mesma.",
    outrosCapitulos: Object.freeze([
      "Como Parar de Buscar Validação Masculina",
      "A Cura da Carência Emocional",
      "Feminilidade sem Dependência Afetiva",
      "O Poder da Presença Feminina",
      "Como Conversar no Whatsapp sem Ansiedade Emocional"
    ]),
    origemUniverso: 'universo-feminino',
    avisoInformativo: false,
    // Tem audiobook oficial: a demonstração é a amostra real, não a voz do navegador.
    ttsDisponivel: false,
    audioAmostra: Object.freeze({
      aprovada: true,
      arquivo: '/audio/amostras/a-mulher-que-permanece-inteira.mp3',
      duracaoSegundos: 65
    })
  }),
  // Trechos originais aprovados para a degustação comercial das novas obras.
  // São amostras editoriais curtas, não capítulos integrais.
  'vender-bem-vender-sempre': Object.freeze({
    livroId: 'vender-bem-vender-sempre',
    aprovada: true,
    trecho: [
      'Este livro é para quem vende ou está começando a vender. Especialmente para a vendedora domiciliar: a mulher que pega o mostruário, sai de casa e vai bater na porta das pessoas para conseguir uma renda, muitas vezes sem nunca ter feito um treinamento. É também para quem atende numa loja, para quem visita empresas, para quem vende pelo celular e para quem lidera, treina ou está montando um grupo de vendedoras.',
      'O método é o mesmo para todas. O que muda são detalhes práticos. Vender bem e ser honesta não são coisas opostas. Existem por aí técnicas que só funcionam enquanto a cliente não percebe. Este manual não ensina truques ou pressões artificiais; ensina método, contas, roteiros e exercícios focados em construir uma carteira de clientes duradoura e lucrativa.'
    ].join('\n\n'),
    tituloTrecho: 'Venda é processo antes de ser resultado',
    chamada: 'Um começo prático para vender com clareza, rotina e respeito.',
    tempoLeitura: '3 min de leitura',
    outrosCapitulos: Object.freeze([
      'Os primeiros 30 dias de organização comercial',
      'WhatsApp sem insistência: conversa que avança',
      'PIX, proposta e confirmação com clareza',
      'Pós-venda que transforma cliente em relacionamento'
    ]),
    avisoInformativo: false,
    ttsDisponivel: true
  }),
  'toda-mesa-tem-dois-lados': Object.freeze({
    livroId: 'toda-mesa-tem-dois-lados',
    aprovada: true,
    trecho: [
      'Este é um livro de histórias comuns. Um fornecedor que anuncia um reajuste por mensagem. Uma vendedora que dá um desconto que ninguém pediu. Dois amigos que abrem uma padaria no aperto de mão. Um pai que não larga o comando da empresa que fundou.',
      'O que este livro faz de diferente é olhar para trás da cortina. Por trás de cada preço, de cada pedido, de cada recusa, há um mecanismo que funciona sozinho, depressa, quase sempre sem que a própria pessoa perceba: uma necessidade real, uma vaidade, um medo antigo ou uma defesa que se ativa antes de qualquer pensamento. O livro propõe aprender a ver no outro o que ele não diz, e em si mesmo o que prefere não admitir, permitindo conduzir acordos que duram.'
    ].join('\n\n'),
    tituloTrecho: 'Antes da proposta, existe a mesa',
    chamada: 'Uma leitura dos interesses que se escondem atrás de preço, prazo e recusa.',
    tempoLeitura: '3 min de leitura',
    outrosCapitulos: Object.freeze([
      'Posições, interesses e concessões',
      'O preço como sinal de valor e risco',
      'Acordos difíceis sem erosão de margem',
      'Sócios, clientes e expectativas desalinhadas'
    ]),
    avisoInformativo: false,
    ttsDisponivel: true
  }),
  'da-terra-ao-resultado': Object.freeze({
    livroId: 'da-terra-ao-resultado',
    aprovada: true,
    trecho: [
      'Quem trabalha na terra precisa fazer a produção render, pagar as contas e guardar forças e recursos para os períodos difíceis. Água, solo, trabalho e dinheiro precisam caminhar juntos. Colher mais pode ajudar, mas também pode aumentar perdas, endividamento e dependência de um comprador. Este manual ajuda a descobrir onde está o problema, escolher uma solução que caiba na propriedade e verificar se ela deu resultado.',
      'O conteúdo atende agricultores e pecuaristas de diferentes portes. O tamanho da terra não conta toda a história: uma pequena estufa pode exigir mais capital e gestão que uma extensa área de pastagem. Por isso, o livro considera quanto se produz, quem pode ajudar, quanta água existe, quem fará a manutenção e como a produção será vendida.',
      'A sequência proposta começa pelo mercado e pela viabilidade, passa pelo solo e pela água, entra no manejo vegetal e animal e termina na conservação, na venda e no financiamento. Os casos internacionais apresentam a tecnologia, a natureza da evidência e as condições para adaptação. Os formulários finais ajudam a transformar leitura em decisões registradas.'
    ].join('\n\n'),
    tituloTrecho: 'Produzir bem começa por observar',
    chamada: 'Uma introdução à gestão que protege a terra, a produção e a margem.',
    tempoLeitura: '3 min de leitura',
    outrosCapitulos: Object.freeze([
      'Solo e água: decisões que atravessam safras',
      'Custos visíveis e desperdícios silenciosos',
      'Manejo seguro e planejamento de propriedade',
      'Comercialização sem entregar toda a margem'
    ]),
    avisoInformativo: 'Conteúdo de caráter informativo. Doses, defensivos, medicamentos veterinários, projetos de irrigação e financiamentos devem ser definidos com um responsável técnico habilitado.',
    ttsDisponivel: true
  }),
  // Toda Reunião Tem Duas Pautas (Volume 2 da Coleção Além das Aparências e dos
  // Sentimentos) — trecho idêntico ao da obra: abertura do Conto 1 ("A Planilha"),
  // versão de Tiago, texto completo até o fim de sua versão. Aprovado em 20/10/2026.
  'toda-reuniao-tem-duas-pautas': Object.freeze({
    livroId: 'toda-reuniao-tem-duas-pautas',
    aprovada: true,
    trecho: [
      'CONTO 1 — A Planilha',
      'A versão de Tiago',
      'Meu pai foi porteiro de um prédio comercial por vinte e dois anos. No dia em que comecei no meu primeiro estágio, ele ajeitou o meu colarinho na porta de casa e disse uma frase que eu carrego até hoje, queira ou não:',
      '— Lá dentro você não pode errar, filho. Eles estão esperando você errar.',
      'Eu sou o primeiro da família com diploma. Naquela época eu era analista havia dois anos, e passei um fim de semana inteiro montando a projeção trimestral. Conferi três vezes. Na terceira, já era domingo à noite e a Isa, minha namorada, tinha desistido de me esperar para o filme.',
      'Segunda-feira, nove da manhã, sala de reunião do terceiro andar. Na tela, a minha planilha. Na cabeceira, o diretor, o Almeida, que ainda não tinha tirado os olhos do celular. Eu estava indo bem. No quarto slide, a Mariana, minha gestora, levantou a caneta.',
      '— Tiago, essa linha 40 não bate. Tá trinta por cento acima do trimestre passado. Vamos rever esses números juntos depois?',
      'Eu sabia por que estava trinta por cento acima. Abri a boca para explicar.',
      '— Está certo. Eu conferi três vezes, é que…',
      'Foi aí que o Almeida ergueu os olhos do celular. Só isso. Não disse nada, não fez cara de nada. Olhou para a tela, depois para mim. E a frase que eu estava dizendo morreu no meio, porque de repente ela me pareceu a frase de quem está se defendendo, e quem se defende é porque errou.',
      '— …tudo bem. A gente revê.',
      'Passei os slides que faltavam sem levantar a voz nem os olhos. A mão que segurava o controle do projetor estava suando. Eu só pensava numa coisa: agora ele sabe. Não sabia dizer o quê, exatamente. Que eu não era dali, talvez. Que o meu pai tinha razão.',
      'Na saída, a Mariana me pediu para passar na sala dela às três. Às três, com a planilha aberta, levou dois minutos. A linha 40 excluía as devoluções, do jeito que a própria diretoria tinha pedido no trimestre anterior. O número estava certo. Ela tinha lido o filtro errado.',
      '— Ah, ok. Então está certo. Ótimo.',
      'E passou para o assunto seguinte.',
      'Eu saí da sala dela com razão e sem nada. Porque a dúvida tinha sido dita na frente do diretor, e a resposta tinha sido dita para mim, numa sala fechada, em meia dúzia de palavras. Mais tarde fui olhar a ata da reunião, que a assistente mandava para todo mundo. Estava lá: "Linha 40 da projeção: rever." Nunca saiu uma ata dizendo que tinha sido revista.',
      'Naquela noite eu briguei com a Isa por causa do volume da televisão. Briguei feio, por uma coisa que nunca tinha me incomodado. Ela me perguntou o que estava acontecendo e eu disse que não era nada.',
      'Depois disso eu mudei o meu jeito de trabalhar, e achei que estava sendo esperto. Parei de deixar rascunho na pasta compartilhada. Passei a entregar tudo no último minuto, pronto, impecável, para ninguém nunca mais encontrar um número meu pela metade. A Mariana começou a pedir atualização todo dia. Eu respondia cada vez com menos palavras. No fim, eram duas: "em andamento".',
      'Um mês depois, atualizei o currículo.'
    ].join('\n\n'),
    tituloTrecho: 'A Planilha',
    chamada: 'A pauta que não está na folha: histórias de trabalho narradas por Davi.',
    tempoLeitura: '3 min de leitura',
    outrosCapitulos: Object.freeze([
      'A versão de Mariana (a Segunda Vez)',
      'O corredor: o que não se diz na sala',
      'A plateia: perder algo diante de todos',
      'A nota de Davi ao final de cada conto'
    ]),
    avisoInformativo: false,
    ttsDisponivel: true
  })
});

function obterAmostra(livroId, registro = AMOSTRAS) {
  if (typeof livroId !== 'string' || !Object.prototype.hasOwnProperty.call(registro, livroId)) return null;
  return registro[livroId];
}

module.exports = { AMOSTRAS, UNIVERSOS, obterAmostra, MAX_TRECHO_CHARS, MARCADOR_PLACEHOLDER };
