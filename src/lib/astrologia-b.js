const { createClient } = require('@supabase/supabase-js');

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

/**
 * Define os 12 signos solares com datas de transição (timezone-agnostic)
 * Formato: [mês, dia] de início até [mês, dia] de fim (inclusive)
 */
const SIGNOS_SOLARES = [
  { nome: 'Áries', emoji: '♈', numero: 1, inicio: [3, 21], fim: [4, 19] },
  { nome: 'Touro', emoji: '♉', numero: 2, inicio: [4, 20], fim: [5, 20] },
  { nome: 'Gêmeos', emoji: '♊', numero: 3, inicio: [5, 21], fim: [6, 20] },
  { nome: 'Câncer', emoji: '♋', numero: 4, inicio: [6, 21], fim: [7, 22] },
  { nome: 'Leão', emoji: '♌', numero: 5, inicio: [7, 23], fim: [8, 22] },
  { nome: 'Virgem', emoji: '♍', numero: 6, inicio: [8, 23], fim: [9, 22] },
  { nome: 'Libra', emoji: '♎', numero: 7, inicio: [9, 23], fim: [10, 22] },
  { nome: 'Escorpião', emoji: '♏', numero: 8, inicio: [10, 23], fim: [11, 21] },
  { nome: 'Sagitário', emoji: '♐', numero: 9, inicio: [11, 22], fim: [12, 21] },
  { nome: 'Capricórnio', emoji: '♑', numero: 10, inicio: [12, 22], fim: [1, 19] },
  { nome: 'Aquário', emoji: '♒', numero: 11, inicio: [1, 20], fim: [2, 18] },
  { nome: 'Peixes', emoji: '♓', numero: 12, inicio: [2, 19], fim: [3, 20] }
];

/**
 * Calcula o signo solar a partir de dia e mês de nascimento
 * Entrada: dia (1-31), mês (1-12)
 * Saída: { nome, emoji, numero, periodo, inicio, fim }
 */
function calcularSignoSolar(dia, mes) {
  // Validar entrada
  if (!dia || !mes || dia < 1 || dia > 31 || mes < 1 || mes > 12) {
    return null;
  }

  // Procurar signo correspondente
  for (const signo of SIGNOS_SOLARES) {
    const [mesInicio, diaInicio] = signo.inicio;
    const [mesFim, diaFim] = signo.fim;

    let corresponde = false;

    // Caso especial: Capricórnio (cruza o ano)
    if (mesInicio > mesFim) {
      corresponde = (mes === mesInicio && dia >= diaInicio) ||
                    (mes === mesFim && dia <= diaFim);
    } else {
      // Signos normais
      if (mes === mesInicio && dia < diaInicio) {
        continue;
      }
      if (mes === mesFim && dia > diaFim) {
        continue;
      }
      if (mes > mesInicio && mes < mesFim) {
        corresponde = true;
      } else if (mes === mesInicio && dia >= diaInicio) {
        corresponde = true;
      } else if (mes === mesFim && dia <= diaFim) {
        corresponde = true;
      }
    }

    if (corresponde) {
      // Formatar período em português
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const inicio = `${signo.inicio[1]} de ${meses[signo.inicio[0] - 1]}`;
      const fim = `${signo.fim[1]} de ${meses[signo.fim[0] - 1]}`;

      return {
        nome: signo.nome,
        emoji: signo.emoji,
        numero: signo.numero,
        periodo: `${inicio} a ${fim}`,
        inicio: signo.inicio,
        fim: signo.fim
      };
    }
  }

  return null;
}

/**
 * Busca interpretação do signo na base RAG
 * A base contém todos os 12 signos em um único documento estruturado
 * Padrão: [SIGNO - TEMPERAMENTO E ENERGIA] ...texto... ==========
 */
async function buscarInterpretacaoSigno(nomeSigno) {
  if (!supabase) {
    console.warn('Supabase não configurado; retornando interpretação genérica');
    return obterInterpretacaoGenericaSigno(nomeSigno);
  }

  try {
    // Buscar documentos que contenham a base de signos (padrão [SIGNO - TEMPERAMENTO E ENERGIA])
    const { data, error } = await supabase
      .from('documentos')
      .select('corpo')
      .ilike('corpo', `%[${nomeSigno.toUpperCase()}%`)
      .limit(1);

    if (error || !data || data.length === 0) {
      console.warn(`Signo ${nomeSigno} não encontrado; usando genérico`);
      return obterInterpretacaoGenericaSigno(nomeSigno);
    }

    // Extrair bloco do signo (entre [SIGNO - ...] e próximo ==========)
    const corpo = data[0].corpo;
    const padraoInicio = `[${nomeSigno.toUpperCase()}`;
    const indiceInicio = corpo.indexOf(padraoInicio);

    if (indiceInicio === -1) {
      return obterInterpretacaoGenericaSigno(nomeSigno);
    }

    // Encontrar fim do bloco (próximo ========== ou fim do documento)
    const blocosApos = corpo.substring(indiceInicio);
    const indiceFim = blocosApos.indexOf('==========');

    let textoBloco;
    if (indiceFim !== -1) {
      textoBloco = blocosApos.substring(0, indiceFim);
    } else {
      textoBloco = blocosApos;
    }

    // Limpar padrão [SIGNO - ...] do início
    const textoLimpo = textoBloco
      .replace(/^\[.*?\]\s*/, '') // Remove [SIGNO - TEMPERAMENTO E ENERGIA]
      .trim();

    return textoLimpo || obterInterpretacaoGenericaSigno(nomeSigno);
  } catch (err) {
    console.error(`Erro ao buscar interpretação de ${nomeSigno}:`, err);
    return obterInterpretacaoGenericaSigno(nomeSigno);
  }
}

/**
 * Interpretações genéricas por signo (fallback)
 * Mantém registro simbólico, sem vocabulário clínico
 */
function obterInterpretacaoGenericaSigno(signo) {
  const interpretacoes = {
    'Áries': 'Iniciativa, coragem e movimento. Você é um pioneiro que age primeiro e reflete depois, com energia vital radiante. Seu impulso é uma força, quando equilibrado com a reflexão.',
    'Touro': 'Estabilidade, paciência e enraizamento. Você constrói com solidez, valorizando o tangível e o duradouro. Sua constância é uma âncora para si e para os outros.',
    'Gêmeos': 'Comunicação, curiosidade e versatilidade. Você navega entre ideias e conexões, trazendo leveza e diversidade. Sua mente é ágil e sua curiosidade, um tesouro.',
    'Câncer': 'Sensibilidade, proteção e intuição. Você sente profundamente e cuida com devoção. Sua empatia é um dom que requer também cuidado com seus próprios limites.',
    'Leão': 'Criatividade, expressão e presença. Você brilha naturalmente e traz alegria. Seu coração generoso é tão importante quanto o reconhecimento que busca.',
    'Virgem': 'Discernimento, dedicação e atenção aos detalhes. Você enxerga o que outros não veem e trabalha com precisão. Sua crítica é valiosa quando dirigida ao mundo, não a si.',
    'Libra': 'Harmonia, ponderação e conexão. Você busca equilíbrio e reflete sobre múltiplas perspectivas. Sua capacidade de mediação é um dom que também requer decisão própria.',
    'Escorpião': 'Intensidade, transformação e profundidade. Você sente e compreende os abismos. Sua capacidade de regeneração é extraordinária quando você permite que emoções fluam.',
    'Sagitário': 'Expansão, busca de sentido e otimismo. Você enxerga horizontes e inspira visões amplas. Seu entusiasmo é contagiante quando enraizado em propósito real.',
    'Capricórnio': 'Responsabilidade, persistência e construção. Você sobe montanhas com paciência estratégica. Sua força reside na resistência, e também no descanso que se permite.',
    'Aquário': 'Inovação, independência e pensamento liberto. Você traz ideias inusitadas e desafia o convencional. Sua liberdade mental é seu superpoder e sua âncora.',
    'Peixes': 'Intuição, criatividade e sensibilidade ao todo. Você absorve e traduz sentimentos em arte. Sua compaixão é profunda e requer proteção clara de seus próprios limites.'
  };

  return interpretacoes[signo] || 'Signo com energia única e potencial extraordinário.';
}

/**
 * Calcula astrologia completa para o Módulo B
 * Retorna: { signo: { nome, emoji, periodo }, interpretacao, gancho }
 */
async function calcularAstrologiaB(dataNascimento) {
  // Parse data: "YYYY-MM-DD"
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);

  // Calcular signo solar
  const signo = calcularSignoSolar(dia, mes);

  if (!signo) {
    throw new Error('Data de nascimento inválida para cálculo de signo solar');
  }

  // Buscar interpretação da base RAG
  const interpretacao = await buscarInterpretacaoSigno(signo.nome);

  // Gancho para próximo passo
  const gancho = `O Signo Solar que você descobriu é apenas uma camada de seu mapa astrológico. O Mapa Integrado ZUNI revela seu Ascendente, Lua, casas e aspectos planetários — um retrato completo e preciso de sua essência cósmica. Cada detalhe adiciona profundidade e nuance, transformando uma amostra em uma verdadeira radiografia de sua jornada.`;

  return {
    signo,
    interpretacao,
    gancho
  };
}

module.exports = {
  calcularSignoSolar,
  buscarInterpretacaoSigno,
  calcularAstrologiaB
};
