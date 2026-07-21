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
    resumo: 'Sentimentos, emoções e reações instintivas — um guia para reconhecer as forças ocultas que nos levam à ação.',
    descricao: 'Neste volume inaugural, explore a arquitetura profunda dos sentimentos e emoções que governam nosso comportamento. Entenda como as reações instintivas moldam nossas vidas, quais são as forças que operam por trás dos bastidores da mente, e como reconhecê-las é o primeiro passo para a verdadeira liberdade de escolha.'
  },
  'os-bastidores-da-mente-2-o-antidoto': {
    titulo: 'Os Bastidores da Mente — Volume II: O Antídoto',
    preco: 57.90,
    categoria: 'principal',
    resumo: 'A arte de atravessar embates sem se tornar aquilo que se combate.',
    descricao: 'Descubra como responder às adversidades da vida sem perder sua integridade. Este volume revela as estratégias que permitem ao ser humano manter-se firme em seus princípios enquanto enfrenta conflitos externos e internos, transformando obstáculos em oportunidades de crescimento genuíno.'
  },
  'os-bastidores-da-mente-3-a-bussola-humana': {
    titulo: 'Os Bastidores da Mente — Volume III: A Bússola Humana',
    preco: 57.90,
    categoria: 'principal',
    resumo: 'A arte de navegar a diversidade humana — as correntes que movem as pessoas, os mares que as separam e o norte que guia a travessia entre elas.',
    descricao: 'Compreenda os padrões universais que atravessam a natureza humana. Navegue pela diversidade de temperamentos, motivações e valores que coexistem. Aprenda a encontrar o norte autêntico que orienta a convivência genuína e a comunicação que transforma relacionamentos.'
  },
  'os-bastidores-da-mente-4-a-travessia': {
    titulo: 'Os Bastidores da Mente — Volume IV: A Travessia',
    preco: 57.90,
    categoria: 'principal',
    resumo: 'O propósito maior por trás dos bastidores da mente.',
    descricao: 'Chegue ao cerne da jornada humana. Este volume revela o propósito profundo que move a existência — aquilo que anima cada escolha, cada dilema, cada crescimento. Entenda como a travessia pessoal conecta-se a um designio maior que transcende o individual.'
  },
  'os-bastidores-da-mente-5-a-escada': {
    titulo: 'Os Bastidores da Mente — Volume V: A Escada e o Plano',
    preco: 57.90,
    categoria: 'principal',
    resumo: 'Da ancestralidade da consciência ao Plano Maior — o volume final da série, sobre o sentido por trás da própria existência.',
    descricao: 'Suba os degraus finais da compreensão. Explore a ancestralidade da consciência, os fios invisíveis que conectam gerações, e o Plano Maior que subjaz à existência. Este penúltimo volume prepara o caminho para a verdade derradeira sobre quem somos e por que estamos aqui.'
  },
  'os-bastidores-da-mente-6-o-designio': {
    titulo: 'Os Bastidores da Mente — Volume VI: O Grande Desígnio',
    preco: 57.90,
    categoria: 'principal',
    resumo: 'Paralelos entre o universo vivo e a jornada do peregrino — o desfecho da série, da criação eterna ao despertar da alma.',
    descricao: 'O volume derradeiro une todos os fios. Descubra os paralelos entre a estrutura do universo e a jornada da consciência individual. Compreenda a criação eterna, a progressão do ser humano rumo à iluminação, e o despertar da alma que é, afinal, o verdadeiro destino de toda a travessia.'
  },
  'arquitetura-excelencia-humana-ii': {
    titulo: 'A Arquitetura da Excelência Humana',
    volume: 2,
    preco: 57.90,
    categoria: 'saude-longevidade',
    resumo: 'Uma jornada pela arquitetura biológica que sustenta a energia, a clareza mental e a longevidade — para quem busca entender as causas por trás do cansaço, da mente nebulosa e da perda de vitalidade, e não apenas tratar os sintomas.',
    descricao: 'O corpo nunca funcionou em compartimentos isolados. Em dezenove capítulos, esta obra conecta energia celular, hormônios, metabolismo, inflamação, sono e longevidade em uma única arquitetura biológica — mostrando por que tratar sintomas isolados raramente resolve, e como recuperar clareza mental, energia e propósito compreendendo o sistema como um todo.'
  },
};

function buscarLivro(livroId) {
  return CATALOGO[livroId] || null;
}

module.exports = { CATALOGO, buscarLivro };
