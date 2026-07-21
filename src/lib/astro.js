// lib/astro.js
// Camada única de acesso à API AstroWay
// Encapsula cálculos de mapas astrológicos e numerológicos

const API_BASE = 'https://api.astroway.info/v1';
const API_KEY = process.env.ASTROWAY_API_KEY;

// Validações
function validarDadosNascimento(dados) {
  const { nome, dataNascimento, horaNascimento, localNascimento } = dados;

  if (!nome || !nome.trim()) {
    throw new Error('Nome é obrigatório.');
  }

  if (!dataNascimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
    throw new Error('Data de nascimento inválida. Formato esperado: YYYY-MM-DD');
  }

  if (!horaNascimento || !/^\d{2}:\d{2}(:\d{2})?$/.test(horaNascimento)) {
    throw new Error('Hora de nascimento inválida. Formato esperado: HH:MM ou HH:MM:SS');
  }

  if (!localNascimento || !localNascimento.trim()) {
    throw new Error('Local de nascimento é obrigatório.');
  }
}

function validarConfiguracaoAPI() {
  if (!API_KEY) {
    throw new Error('ASTROWAY_API_KEY não configurado. Configure a variável de ambiente.');
  }
}

// Tratamento de erros da API
async function tratarErroAPI(response, endpoint) {
  let details = '';

  try {
    const body = await response.text();
    details = body;
  } catch (e) {
    details = response.statusText;
  }

  if (response.status === 401) {
    throw new Error(`Autenticação falhou: chave API inválida ou expirada. (${endpoint})`);
  }

  if (response.status === 402) {
    throw new Error('Limite de créditos excedido. Atualize seu plano no AstroWay.');
  }

  if (response.status === 400) {
    throw new Error(`Dados de nascimento inválidos: ${details}`);
  }

  if (response.status === 429) {
    throw new Error('Rate limit excedido. Tente novamente em alguns minutos.');
  }

  throw new Error(`Erro na API AstroWay (${response.status}): ${details}`);
}

// Geocodificar local de nascimento para coordenadas
async function geocodificarLocal(localNascimento) {
  // Base de dados local para cidades brasileiras comuns
  const CIDADES_COORDENADAS = {
    'são paulo': { lat: '-23.5505', lon: '-46.6333' },
    'rio de janeiro': { lat: '-22.9068', lon: '-43.1729' },
    'belo horizonte': { lat: '-19.8267', lon: '-43.9516' },
    'brasília': { lat: '-15.8267', lon: '-47.8644' },
    'curitiba': { lat: '-25.4284', lon: '-49.2733' },
    'salvador': { lat: '-13.0044', lon: '-38.9693' },
    'fortaleza': { lat: '-3.7319', lon: '-38.5267' },
    'manaus': { lat: '-3.1190', lon: '-60.0217' },
    'recife': { lat: '-8.0476', lon: '-34.8770' },
    'porto alegre': { lat: '-30.0346', lon: '-51.2177' },
    'caieiras': { lat: '-23.6517', lon: '-46.7522' },
    'campinas': { lat: '-22.9101', lon: '-47.0626' }
  };

  const localNormalized = localNascimento.toLowerCase().trim();

  // Tentar correspondência exata em base local
  for (const [cidade, coords] of Object.entries(CIDADES_COORDENADAS)) {
    if (localNormalized.includes(cidade)) {
      return coords;
    }
  }

  // Se não encontrou, tentar usar OpenStreetMap (geocodificação aberta)
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(localNascimento)}&format=json&limit=1`,
      {
        headers: { 'User-Agent': 'zuni-suprema-app' }
      }
    );

    if (!response.ok) {
      console.warn(`Geocodificação falhou para "${localNascimento}"`);
      return null;
    }

    const data = await response.json();
    if (data.length === 0) {
      console.warn(`Local não encontrado: "${localNascimento}"`);
      return null;
    }

    return {
      lat: data[0].lat,
      lon: data[0].lon
    };
  } catch (error) {
    console.error('Erro ao geocodificar:', error.message);
    return null;
  }
}

// Função principal: calcular mapa natal
async function calcularMapaNatal(dados) {
  try {
    validarConfiguracaoAPI();
    validarDadosNascimento(dados);

    const { nome, dataNascimento, horaNascimento, localNascimento } = dados;

    // Geocodificar local para obter coordenadas
    const coordenadas = await geocodificarLocal(localNascimento);
    if (!coordenadas) {
      throw new Error(
        `Não foi possível geocodificar "${localNascimento}". ` +
        'Tente fornecer uma cidade conhecida ou coordenadas (lat, lon).'
      );
    }

    const { lat, lon } = coordenadas;


    // Normalizar hora para HH:MM:SS (API requer segundos)
    const horaNormalizada = horaNascimento.includes(':') && horaNascimento.split(':').length === 2
      ? `${horaNascimento}:00`
      : horaNascimento;

    // Chamada à API AstroWay
    // timezoneOffset: horas a partir de UTC (Brasil é UTC-3)
    const payload = {
      name: nome,
      date: dataNascimento,
      time: horaNormalizada,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      timezoneOffset: -3 // UTC-3 (horário de Brasília/São Paulo)
    };

    const response = await fetch(`${API_BASE}/chart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      await tratarErroAPI(response, 'natal-chart');
    }

    const mapaNatal = await response.json();

    // Validar resposta
    if (!mapaNatal.ok && mapaNatal.error) {
      throw new Error(
        `Cálculo falhou: ${mapaNatal.error.message || JSON.stringify(mapaNatal.error)}`
      );
    }

    if (!mapaNatal.data) {
      throw new Error(
        `Cálculo falhou: ${mapaNatal.message || 'Erro desconhecido na API AstroWay'}`
      );
    }

    // Estruturar resposta de forma normalizada
    // AstroWay retorna planetas em array: [Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, ...]
    const planetas = mapaNatal.data.planets || [];

    // Helper para converter longitude em signo
    function longitudeParaSigno(longitude) {
      const signos = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
                      'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
      const lon = longitude % 360;
      const signoIdx = Math.floor(lon / 30);
      const grau = lon % 30;
      return {
        sign: signos[signoIdx] || 'Unknown',
        degree: Math.round(grau * 10) / 10,
        fullDegree: Math.round(lon * 10) / 10
      };
    }

    // Extrair posições (índices conhecidos da API AstroWay)
    const mapaPorIndice = {};
    planetas.forEach((p, i) => {
      mapaPorIndice[p.name.toLowerCase()] = longitudeParaSigno(p.longitude);
    });

    return {
      sucesso: true,
      nome,
      dataNascimento,
      horaNascimento,
      localNascimento,
      coordenadas: { latitude: parseFloat(lat), longitude: parseFloat(lon) },
      mapaNatal: {
        sol: mapaPorIndice['sun'] || { sign: 'Unknown', degree: 0 },
        lua: mapaPorIndice['moon'] || { sign: 'Unknown', degree: 0 },
        ascendente: mapaPorIndice['asc'] || mapaPorIndice['ascendant'] || { sign: 'Unknown', degree: 0 },
        mercurio: mapaPorIndice['mercury'] || { sign: 'Unknown', degree: 0 },
        venus: mapaPorIndice['venus'] || { sign: 'Unknown', degree: 0 },
        marte: mapaPorIndice['mars'] || { sign: 'Unknown', degree: 0 },
        jupiter: mapaPorIndice['jupiter'] || { sign: 'Unknown', degree: 0 },
        saturno: mapaPorIndice['saturn'] || { sign: 'Unknown', degree: 0 },
        urano: mapaPorIndice['uranus'] || { sign: 'Unknown', degree: 0 },
        netuno: mapaPorIndice['neptune'] || { sign: 'Unknown', degree: 0 },
        plutao: mapaPorIndice['pluto'] || { sign: 'Unknown', degree: 0 }
      },
      casas: mapaNatal.data.houses || [],
      aspectos: mapaNatal.data.aspects || [],
      creditsUsed: 5, // AstroWay cobra ~5 créditos por mapa
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: error.message,
      dados: {
        nome: dados.nome,
        dataNascimento: dados.dataNascimento
      }
    };
  }
}

// Calcular numerologia (nome e data)
async function calcularNumerologia(nome, dataNascimento) {
  try {
    validarConfiguracaoAPI();

    if (!nome || !nome.trim()) {
      throw new Error('Nome é obrigatório para numerologia.');
    }

    if (!dataNascimento || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascimento)) {
      throw new Error('Data de nascimento inválida. Formato: YYYY-MM-DD');
    }

    const response = await fetch(`${API_BASE}/numerology`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        name: nome,
        date: dataNascimento
      })
    });

    if (!response.ok) {
      await tratarErroAPI(response, 'numerology');
    }

    const numerologia = await response.json();

    if (!numerologia.success) {
      throw new Error(
        `Cálculo falhou: ${numerologia.message || 'Erro desconhecido'}`
      );
    }

    return {
      sucesso: true,
      nome,
      dataNascimento,
      numerologia: {
        caminhoDeVida: numerologia.data.life_path,
        destino: numerologia.data.destiny,
        anoPersonal: numerologia.data.personal_year,
        mesPersonal: numerologia.data.personal_month,
        diaPersonal: numerologia.data.personal_day
      },
      creditsUsed: numerologia.credits_used || 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: error.message,
      dados: { nome, dataNascimento }
    };
  }
}

// Status da API e créditos disponíveis
async function verificarStatus() {
  try {
    validarConfiguracaoAPI();

    const response = await fetch(`${API_BASE}/account`, {
      headers: {
        'X-API-Key': API_KEY
      }
    });

    if (!response.ok) {
      await tratarErroAPI(response, 'account');
    }

    const status = await response.json();

    return {
      sucesso: true,
      conta: {
        plano: status.plan || 'free',
        creditosDisponíveis: status.credits_available || status.credits || 0,
        creditosTotais: status.credits_total || status.credits || 0,
        creditosUsados: status.credits_used || 0,
        dataRenovacao: status.renewal_date || new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      sucesso: false,
      erro: error.message
    };
  }
}

module.exports = {
  calcularMapaNatal,
  calcularNumerologia,
  verificarStatus,
  validarDadosNascimento,
  geocodificarLocal
};
