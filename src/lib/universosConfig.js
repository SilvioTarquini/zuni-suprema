// lib/universosConfig.js
//
// Configuração EDITORIAL de cada universo da Loja (texto, cores, seções e apresentação de cada obra). Dados comerciais
// (preço, formatos) continuam vindo do catálogo (/api/livros); nada de preço aqui. Gerado a partir das páginas
// /loja/universo-feminino/ e /loja/empreender-e-crescer/ quando elas passaram a usar o modelo único (templates/universo-loja.html).
//
// Para criar um universo novo: acrescentar uma entrada aqui (slug = endereço /loja/<slug>/) e marcar as obras no catálogo com
// `universo: '<slug>'` (ou uma lista: `universo: ['a', 'b']`). Se `criterio.departamento` existir, as obras desse departamento
// também entram. Obras do universo que não estiverem em nenhuma seção aparecem em `restantes`.

const UNIVERSOS = {
  "universo-feminino": {
    "slug": "universo-feminino",
    "nome": "Universo Feminino",
    "sobretitulo": "Universo Feminino",
    "h1": "Livros para diferentes momentos da vida de uma mulher.",
    "intro": "Conhecimento, reflexão e novas perspectivas para compreender melhor a si mesma, seus vínculos e suas escolhas.",
    "fecho": "Comece pela obra que conversa com o seu momento.",
    "descricao": "Livros para diferentes momentos da vida de uma mulher. Livro digital e audiobook — Loja ZUNI Suprema.",
    "descricaoOg": "Livros para diferentes momentos da vida de uma mulher. Conhecimento, reflexão e novas perspectivas.",
    "themeColor": "#f7f2ea",
    "tema": {
      "fundo": "#f7f2ea",
      "carta": "#fffdf9",
      "tinta": "#231d1a",
      "suave": "#5e544d",
      "borda": "#e6dccd",
      "acento": "#5a2d3f",
      "acentoEscuro": "#44202f",
      "capaFundo": "#efe7da",
      "cartaClara": "#fbf7f0",
      "tintaRgb": "35, 29, 26",
      "acentoRgb": "90, 45, 63"
    },
    "criterio": {
      "departamento": "Universo Feminino"
    },
    "origem": "universo-feminino",
    "direciona": {
      "titulo": "Há uma situação específica acontecendo em sua vida?",
      "texto": "Nem toda questão cabe em um livro. O ZUNI Direciona oferece orientação personalizada para ajudá-la a compreender melhor sua situação antes de decidir.",
      "href": "/checkout?origem=universo-feminino"
    },
    "blocoExtra": null,
    "secoes": [
      {
        "id": "para-comecar",
        "titulo": "Para começar",
        "frase": "Uma porta de entrada para presença, elegância e percepção de si.",
        "ids": [
          "ela-tem-classe"
        ]
      },
      {
        "id": "corpo-autoconhecimento",
        "titulo": "Corpo & Autoconhecimento",
        "frase": "Conhecimento para compreender melhor o corpo, seus ciclos e suas transformações.",
        "ids": [
          "a-inteligencia-do-corpo-feminino",
          "codigo-feminino"
        ]
      },
      {
        "id": "identidade-presenca",
        "titulo": "Identidade & Presença",
        "frase": "Obras sobre presença, autoestima, maturidade e a forma como uma mulher ocupa seu lugar no mundo.",
        "ids": [
          "inesquecivel-charme-feminino"
        ]
      },
      {
        "id": "afeto-relacionamentos",
        "titulo": "Afeto & Relacionamentos",
        "frase": "Para compreender vínculos, limites, escolhas e relações que fazem parte da vida.",
        "ids": [
          "a-mulher-que-permanece-inteira"
        ]
      }
    ],
    "restantes": {
      "id": "mais",
      "titulo": "Mais do Universo Feminino",
      "frase": "Outras obras desta coleção."
    },
    "editorial": {
      "ela-tem-classe": {
        "chamada": "Elegância que começa na presença, e não apenas na aparência.",
        "sobre": [
          "Um guia de elegância em dois volumes: o primeiro dedicado à elegância, ao estilo e ao refinamento moderno; o segundo, à presença, ao magnetismo e à sofisticação avançada.",
          "A obra propõe reflexões sobre como a elegância nasce do encontro entre estética e inteligência emocional — postura serena, discrição e autenticidade, sem depender de excesso ou performance."
        ]
      },
      "a-inteligencia-do-corpo-feminino": {
        "chamada": "Um convite para compreender melhor os sinais do corpo, sem a lógica da culpa.",
        "sobre": [
          "A obra aborda temas como inchaço, celulite e cansaço e percorre, capítulo a capítulo, intestino, fígado, sistema linfático e pele, propondo trocar a lógica da culpa pela escuta do corpo.",
          "Traz ainda anexos práticos de consulta rápida: um checklist diário de rotina e a Escala de Bristol."
        ],
        "aviso": "Conteúdo de caráter informativo, que não substitui o acompanhamento de um profissional de saúde."
      },
      "codigo-feminino": {
        "chamada": "Um mapa de autocuidado para conhecer o corpo e a experiência feminina nas diferentes fases da vida.",
        "sobre": [
          "Reúne, em 12 partes e dois apêndices práticos, temas como pele, hormônios, sono, prevenção, sexualidade e as diferentes fases da vida, incluindo a menopausa, sob uma perspectiva integrativa.",
          "Pensado para ser lido com calma e revisitado aos poucos: um mapa de autocuidado, não uma lista de regras rígidas."
        ],
        "aviso": "Conteúdo de caráter informativo, que não substitui o acompanhamento de um profissional de saúde."
      },
      "inesquecivel-charme-feminino": {
        "chamada": "Presença, autenticidade e autoestima como base para conexões mais leves e saudáveis.",
        "sobre": [
          "Em cinco partes, a obra percorre o verdadeiro charme feminino, presença e comunicação, maturidade afetiva, relacionamentos saudáveis e um bloco final de perguntas para o autoconhecimento.",
          "Sua proposta é que o magnetismo nasce de verdade, e não de competição ou estratégia."
        ]
      },
      "a-mulher-que-permanece-inteira": {
        "chamada": "Reflexões sobre vínculos, escolhas e a preservação de si nas relações.",
        "sobre": [
          "Em seis partes, a obra percorre autoestima, perfis emocionais masculinos, relacionamentos tóxicos e proteção emocional, comunicação moderna e exercícios práticos de desenvolvimento.",
          "Parte da premissa de que o amor saudável não destrói o amor-próprio: fortalece."
        ]
      }
    }
  },
  "empreender-e-crescer": {
    "slug": "empreender-e-crescer",
    "nome": "Empreender e Crescer",
    "sobretitulo": "Empreender e Crescer",
    "h1": "Livros de apoio para quem empreende e administra o que é seu.",
    "intro": "Para administrar melhor o que é seu — da primeira venda à grande empresa, do campo à indústria.",
    "fecho": "Comece pela obra que fala com o momento do seu negócio.",
    "descricao": "Para administrar melhor o que é seu — da primeira venda à grande empresa, do campo à indústria. Livro digital — Loja ZUNI Suprema.",
    "descricaoOg": "Para administrar melhor o que é seu — da primeira venda à grande empresa, do campo à indústria.",
    "themeColor": "#f2f1ea",
    "tema": {
      "fundo": "#f2f1ea",
      "carta": "#fffdf9",
      "tinta": "#1c211d",
      "suave": "#545c50",
      "borda": "#dde0d4",
      "acento": "#2d5a40",
      "acentoEscuro": "#1e3d2b",
      "capaFundo": "#e9e6da",
      "cartaClara": "#f7f6ee",
      "tintaRgb": "28, 33, 29",
      "acentoRgb": "45, 90, 64"
    },
    "criterio": {
      "universo": "empreender-e-crescer"
    },
    "origem": "empreender-e-crescer",
    "direciona": {
      "titulo": "Há uma situação específica acontecendo no seu negócio?",
      "texto": "Nem toda questão cabe em um livro. O ZUNI Direciona oferece orientação personalizada para ajudá-lo a compreender melhor sua situação antes de decidir.",
      "href": "/checkout?origem=empreender-e-crescer"
    },
    "blocoExtra": {
      "selo": "Em breve",
      "titulo": "Diagnóstico Empresarial",
      "texto": "Uma avaliação guiada para identificar os pontos que mais travam o crescimento do seu negócio hoje. Em preparação — o conteúdo final ainda será definido."
    },
    "secoes": [
      {
        "id": "para-empreender",
        "titulo": "Para empreender e crescer",
        "frase": "Guias práticos para decidir, negociar, vender e produzir melhor — da primeira venda à grande empresa, do campo à indústria.",
        "ids": [
          "vender-bem-vender-sempre",
          "toda-mesa-tem-dois-lados",
          "toda-reuniao-tem-duas-pautas",
          "da-terra-ao-resultado"
        ]
      }
    ],
    "restantes": {
      "id": "mais",
      "titulo": "Mais de Empreender e Crescer",
      "frase": "Outras obras deste universo."
    },
    "editorial": {
      "vender-bem-vender-sempre": {
        "chamada": "Método prático para vender com ética, clareza e previsibilidade — da primeira conversa ao pós-venda.",
        "sobre": [
          "Um manual com o passo a passo completo para os primeiros 30 dias, rotina comercial, organização de contatos, proposta de valor, WhatsApp, PIX e acompanhamento de resultados.",
          "Pensado para quem vende em casa, na loja ou pelo celular — vendedoras, revendedoras, consultoras e líderes de equipe que querem método, não truques."
        ]
      },
      "toda-mesa-tem-dois-lados": {
        "chamada": "Os mecanismos ocultos por trás de cada preço, prazo e recusa.",
        "sobre": [
          "Uma leitura sobre os bastidores dos negócios e da negociação humana: interesses, expectativas, preço, prazo, poder de decisão e acordos difíceis.",
          "Ajuda a enxergar as engrenagens que movem margens, parcerias e sociedades antes que o impasse se torne ruptura."
        ]
      },
      "toda-reuniao-tem-duas-pautas": {
        "chamada": "Histórias de trabalho narradas por Davi: poder, plateia e corredor.",
        "sobre": [
          "Volume 2 da Coleção Além das Aparências e dos Sentimentos. Contos sobre os bastidores do ambiente de trabalho — a pauta que está na folha e a que ninguém leu em voz alta.",
          "Cada conto mostra a cena, revisita o que cada lado protegia e termina com uma nota de Davi, mediador de conflitos."
        ]
      },
      "da-terra-ao-resultado": {
        "chamada": "Estratégias verificáveis para fazer a produção render e proteger a margem.",
        "aviso": "Conteúdo de caráter informativo. Doses, defensivos, medicamentos veterinários, projetos de irrigação e financiamentos devem ser definidos com um responsável técnico habilitado.",
        "sobre": [
          "Um manual para pequenos e médios produtores sobre mercado, solo, água, adubação segura, custos, manejo e comercialização.",
          "A proposta é produzir melhor, proteger a margem e cuidar da terra com atenção aos limites e à realidade de cada propriedade."
        ]
      }
    }
  }
};

module.exports = { UNIVERSOS };
