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
  })
});

function obterAmostra(livroId, registro = AMOSTRAS) {
  if (typeof livroId !== 'string' || !Object.prototype.hasOwnProperty.call(registro, livroId)) return null;
  return registro[livroId];
}

module.exports = { AMOSTRAS, UNIVERSOS, obterAmostra, MAX_TRECHO_CHARS, MARCADOR_PLACEHOLDER };
