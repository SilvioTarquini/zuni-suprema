const { createClient } = require('@supabase/supabase-js');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

/**
 * Calcula o número pitagórico (número de raiz única)
 * Reduz iterativamente até chegar a um dígito (1-9)
 */
function reduzirAoDigito(num) {
  while (num >= 10) {
    num = Math.floor(num / 10) + (num % 10);
  }
  return num;
}

/**
 * Calcula Caminho de Vida a partir da data de nascimento
 * Formato esperado: "YYYY-MM-DD" (ex: "1990-03-15")
 * Lógica: dia + mês + ano, reduzir até um dígito
 */
function calcularCaminhoDeVida(dataNascimento) {
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);

  const dia_reduzido = reduzirAoDigito(dia);
  const mes_reduzido = reduzirAoDigito(mes);
  const ano_reduzido = reduzirAoDigito(ano);

  const soma = dia_reduzido + mes_reduzido + ano_reduzido;
  const caminhoDeVida = reduzirAoDigito(soma);

  return caminhoDeVida;
}

/**
 * Calcula Número da Essência (método pitagórico simples sobre nome completo)
 * Mapeia cada letra a seu número (A=1, B=2, ..., Z=26), reduz as vogais + consoantes
 * Retorna um número 1-9
 */
function calcularEssencia(nomeCompleto) {
  const tabelaPitagorica = {
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8, 'I': 9,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'O': 6, 'P': 7, 'Q': 8, 'R': 9,
    'S': 1, 'T': 2, 'U': 3, 'V': 4, 'W': 5, 'X': 6, 'Y': 7, 'Z': 8
  };

  const nomeLimpo = nomeCompleto
    .toUpperCase()
    .replace(/[^A-Z]/g, '');

  let soma = 0;
  for (const char of nomeLimpo) {
    soma += tabelaPitagorica[char] || 0;
  }

  const essencia = reduzirAoDigito(soma);
  return essencia;
}

/**
 * Busca interpretação textual da base RAG de numerologia
 * Consulta tabela interpretacoes_numerologia para texto substancial
 */
async function buscarInterpretacaoCaminhoDeVida(numero) {
  if (!supabase) {
    console.warn('Supabase não configurado; retornando genérica');
    return obterInterpretacaoGenerica(numero);
  }

  try {
    const { data, error } = await supabase
      .from('interpretacoes_numerologia')
      .select('caminho_de_vida')
      .eq('numero', numero)
      .single();

    if (error) {
      console.warn(`Erro ao buscar Caminho de Vida ${numero}: ${error.message}`);
      return obterInterpretacaoGenerica(numero);
    }

    return data?.caminho_de_vida || obterInterpretacaoGenerica(numero);
  } catch (err) {
    console.error('Erro ao buscar interpretação Caminho de Vida:', err);
    return obterInterpretacaoGenerica(numero);
  }
}

async function buscarInterpretacaoEssencia(numero) {
  if (!supabase) {
    console.warn('Supabase não configurado; retornando genérica');
    return obterInterpretacaoGenerica(numero);
  }

  try {
    const { data, error } = await supabase
      .from('interpretacoes_numerologia')
      .select('essencia')
      .eq('numero', numero)
      .single();

    if (error) {
      console.warn(`Erro ao buscar Essência ${numero}: ${error.message}`);
      return obterInterpretacaoGenerica(numero);
    }

    return data?.essencia || obterInterpretacaoGenerica(numero);
  } catch (err) {
    console.error('Erro ao buscar interpretação Essência:', err);
    return obterInterpretacaoGenerica(numero);
  }
}

/**
 * Interpretações genéricas para cada número (fallback se RAG não estiver indexada)
 */
function obterInterpretacaoGenerica(numero) {
  const interpretacoes = {
    1: 'Liderança, independência e inovação. Você é pioneiro, ambicioso e segue seu próprio caminho. Criativo e determinado.',
    2: 'Equilíbrio, diplomacia e sensibilidade. Você é cooperativo, intuitivo e busca harmonia nas relações.',
    3: 'Criatividade, expressão e alegria. Você é comunicativo, criativo e traz luz aos ambientes.',
    4: 'Estabilidade, estrutura e dedicação. Você é prático, responsável e constrói bases sólidas.',
    5: 'Liberdade, adaptabilidade e aventura. Você é dinâmico, curioso e ama explorar novos caminhos.',
    6: 'Harmonia, amor e responsabilidade. Você é nurturador, leal e se dedica ao bem-estar dos outros.',
    7: 'Introspecção, sabedoria e espiritualidade. Você é pensador profundo, analítico e busca compreender o mundo.',
    8: 'Sucesso, poder e materialidade. Você é ambicioso, executivo e tem capacidade de manifestar abundância.',
    9: 'Compaixão, generosidade e conclusão de ciclos. Você é humanitário, idealista e vê o quadro geral.'
  };

  return interpretacoes[numero] || 'Número singular com potencial único.';
}

/**
 * Calcula numerologia completa para um visitante
 * Retorna: { caminhoDeVida, caminhoDeVidaTexto, essencia, essenciaTexto, interpretacao, gancho }
 */
async function calcularNumerologia(nomeCompleto, dataNascimento) {
  const caminhoDeVida = calcularCaminhoDeVida(dataNascimento);
  const essencia = calcularEssencia(nomeCompleto);

  // Buscar interpretações substanciais da base RAG
  const caminhoDeVidaTexto = await buscarInterpretacaoCaminhoDeVida(caminhoDeVida);
  const essenciaTexto = await buscarInterpretacaoEssencia(essencia);

  // Gancho inspirador para levar ao Mapa Integrado
  const gancho = `Estes números que você acabou de descobrir são apenas os primeiros passos de uma jornada numerológica muito mais profunda. O Mapa Integrado ZUNI revela 8 camadas adicionais de sua essência numérica — números mestres, ciclos pessoais, desafios e talentos ocultos que definem sua trajetória completa. Cada camada adiciona contexto e significado, transformando um primeiro encontro em um retrato profundo e multidimensional da sua verdadeira essência.`;

  // Interpretação combinada para exibição única
  const interpretacao = `**Seu Caminho de Vida (${caminhoDeVida}):**\n${caminhoDeVidaTexto}\n\n**Seu Número da Essência (${essencia}):**\n${essenciaTexto}\n\n**Próximo Passo:**\n${gancho}`;

  return {
    caminhoDeVida,
    caminhoDeVidaTexto,
    essencia,
    essenciaTexto,
    interpretacao,
    gancho
  };
}

module.exports = {
  calcularNumerologia,
  calcularCaminhoDeVida,
  calcularEssencia,
  buscarInterpretacaoCaminhoDeVida,
  buscarInterpretacaoEssencia,
  reduzirAoDigito
};
