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
//   avisoInformativo  true exibe o aviso de conteúdo informativo (obras de saúde)
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
      'Quem trabalha na terra precisa fazer a produção render, pagar as contas e guardar forças e recursos para os períodos difíceis. Água, solo, trabalho e dinheiro precisam caminhar juntos. Colher mais pode ajudar, mas também pode aumentar perdas, endividamento e dependência de um comprador.',
      'Este manual ajuda a descobrir onde está o problema, escolher uma solução que caiba na propriedade e verificar se ela deu resultado. A sequência proposta começa pelo mercado e pela viabilidade, passa pelo solo e pela água, entra no manejo vegetal e animal e termina na conservação, na venda e no financiamento, combinando a experiência diária do produtor com informações confiáveis para decidir com segurança.'
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
    avisoInformativo: true,
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
