// lib/astro.js
// Camada única de acesso à API AstroWay
// Encapsula cálculos de mapas astrológicos e numerológicos

const API_BASE = 'https://api.astroway.info/api';
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

  if (!horaNascimento || !/^\d{2}:\d{2}$/.test(horaNascimento)) {
    throw new Error('Hora de nascimento inválida. Formato esperado: HH:MM');
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

    // Parsear data e hora
    const [year, month, day] = dataNascimento.split('-').map(Number);
    const [hour, minute] = horaNascimento.split(':').map(Number);

    // Chamada à API AstroWay
    const payload = {
      name: nome,
      date: dataNascimento,
      time: horaNascimento,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      timezone: 'America/Sao_Paulo' // Padrão para Brasil
    };

    const response = await fetch(`${API_BASE}/natal-chart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      await tratarErroAPI(response, 'natal-chart');
    }

    const mapaNatal = await response.json();

    // Validar resposta
    if (!mapaNatal.success) {
      throw new Error(
        `Cálculo falhou: ${mapaNatal.message || 'Erro desconhecido na API AstroWay'}`
      );
    }

    // Estruturar resposta de forma normalizada
    return {
      sucesso: true,
      nome,
      dataNascimento,
      horaNascimento,
      localNascimento,
      coordenadas: { latitude: lat, longitude: lon },
      mapaNatal: {
        sol: mapaNatal.data.sun,
        lua: mapaNatal.data.moon,
        ascendente: mapaNatal.data.asc,
        mercurio: mapaNatal.data.mercury,
        venus: mapaNatal.data.venus,
        marte: mapaNatal.data.mars,
        jupiter: mapaNatal.data.jupiter,
        saturno: mapaNatal.data.saturn,
        urano: mapaNatal.data.uranus,
        netuno: mapaNatal.data.neptune,
        plutao: mapaNatal.data.pluto
      },
      casas: mapaNatal.data.houses || [],
      aspectos: mapaNatal.data.aspects || [],
      creditsUsed: mapaNatal.credits_used || 0,
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
        'Authorization': `Bearer ${API_KEY}`
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

    const response = await fetch(`${API_BASE}/account/status`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    if (!response.ok) {
      await tratarErroAPI(response, 'account/status');
    }

    const status = await response.json();

    return {
      sucesso: true,
      conta: {
        plano: status.plan,
        creditosDisponíveis: status.credits_available,
        creditosTotais: status.credits_total,
        creditosUsados: status.credits_used,
        dataRenovacao: status.renewal_date
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
