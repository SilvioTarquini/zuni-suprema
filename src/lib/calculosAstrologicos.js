const Astronomy = require('astronomy-engine');

/**
 * Calcula posições astronômicas (Sol, Lua, Ascendente, Casas)
 * Entrada: data, hora, latitude, longitude
 * Saída: objeto com posições em graus + signos
 */

function calcularPosicoes(birthDate, birthTime, latitude, longitude) {
  try {
    // Parse da data e hora
    const [ano, mes, dia] = birthDate.split('-').map(Number);
    const [hora, minuto] = birthTime.split(':').map(Number);

    // Criar objeto de data para astronomy-engine
    const date = new Astronomy.DateTime(ano, mes, dia, hora, minuto, 0);

    // 1. CALCULAR SOL
    const sunVector = Astronomy.HelioVector(Astronomy.Body.Sun, date);
    const sunEquator = Astronomy.Equatorial_From_Vector(sunVector);
    const sunEcliptic = Astronomy.Ecliptic_From_Equatorial(sunEquator);

    // 2. CALCULAR LUA
    const moonVector = Astronomy.GeoVector(Astronomy.Body.Moon, date, true);
    const moonEquator = Astronomy.Equatorial_From_Vector(moonVector);
    const moonEcliptic = Astronomy.Ecliptic_From_Equatorial(moonEquator);

    // 3. CALCULAR ASCENDENTE E CASAS (usando latitude/longitude do local)
    const observer = new Astronomy.Observer(latitude, longitude, 0);
    const horizonSun = Astronomy.Horizon(date, observer, sunEcliptic.lon, sunEcliptic.lat, 'normal');
    const horizonMoon = Astronomy.Horizon(date, observer, moonEcliptic.lon, moonEcliptic.lat, 'normal');

    // Para Ascendente, precisamos encontrar o ponto do horizonte (altitude=0) no Leste
    // Calculamos o Midheaven (ponto Sul, altitude máxima) e depois derivamos Ascendente
    const mcVector = Astronomy.Horizon(date, observer, 0, 90, 'normal'); // Meridiano

    // Calcular RAMC (Right Ascension of Midheaven) para casas
    const sidereal = calcularTempoSideral(date, longitude);
    const ramc = sidereal; // Aproximação do RAMC

    // Calcular Ascendente (aproximadamente)
    // Ascendente ≈ signo que está no horizonte leste no momento do nascimento
    const ascendente = calcularAscendente(ramc, latitude);

    // 4. CALCULAR CASAS (sistema Placidus aproximado)
    const casas = calcularCasas(ramc, latitude);

    // Converter para signos
    const solSigno = grausParaSigno(sunEcliptic.lon);
    const luaSigno = grausParaSigno(moonEcliptic.lon);
    const ascSigno = grausParaSigno(ascendente);

    return {
      sol: {
        longitude: Math.round(sunEcliptic.lon * 100) / 100,
        signo: solSigno.signo,
        grau: Math.round(solSigno.grau * 100) / 100,
        minuto: Math.round(solSigno.minuto),
        segundoArco: Math.round(sunEcliptic.lat * 100) / 100
      },
      lua: {
        longitude: Math.round(moonEcliptic.lon * 100) / 100,
        signo: luaSigno.signo,
        grau: Math.round(luaSigno.grau * 100) / 100,
        minuto: Math.round(luaSigno.minuto),
        segundoArco: Math.round(moonEcliptic.lat * 100) / 100
      },
      ascendente: {
        longitude: Math.round(ascendente * 100) / 100,
        signo: ascSigno.signo,
        grau: Math.round(ascSigno.grau * 100) / 100,
        minuto: Math.round(ascSigno.minuto)
      },
      casas: casas,
      timestamp: date,
      ramc: Math.round(ramc * 100) / 100
    };
  } catch (error) {
    console.error('Erro ao calcular posições astronômicas:', error);
    throw new Error(`Erro no cálculo astrológico: ${error.message}`);
  }
}

function calcularTempoSideral(date, longitude) {
  // Calcula o Tempo Sideral no meridiano do local
  const j2000 = Astronomy.MakeTime(2000, 1, 1, 12, 0, 0);
  const t = (date.ut - j2000.ut) / 36525;

  // Aproximação do Tempo Sideral de Greenwich (GMST)
  const gmst0 = 18.697374558 + 24110.54841 * t + 0.093104 * t * t - 6.2e-6 * t * t * t;
  const gmst = (gmst0 % 86400) / 3600 + (date.ut % 1) * 24;

  // Converter para LMST (Local Mean Sidereal Time)
  const lmst = (gmst + longitude / 15) % 24;

  // Converter para graus (1 hora = 15 graus)
  return (lmst * 15) % 360;
}

function calcularAscendente(ramc, latitude) {
  // Cálculo aproximado do Ascendente usando RAMC e latitude
  // Fórmula simplificada: Ascendente ≈ RAMC + atan(tan(latitude) / cos(ramc - RA))
  // Para simplificar: Ascendente está aproximadamente 90° a Leste do MC

  const latRad = latitude * Math.PI / 180;
  const ramcRad = ramc * Math.PI / 180;

  // Aproximação: Ascendente = RAMC + 90 (com correção por latitude)
  let asc = ramc + 90 - (latitude / 2); // Correção simplificada

  return ((asc % 360) + 360) % 360;
}

function calcularCasas(ramc, latitude) {
  // Sistema Placidus simplificado (casas 10-graus)
  // Casa 1 = Ascendente
  // Casa 10 = Midheaven (MC)
  // Casas divididas em 30 graus cada (sistema de casas igual)

  const mc = ramc;
  const asc = calcularAscendente(ramc, latitude);

  // Sistema de casas igual (cada casa = 30 graus)
  const casas = {};
  for (let i = 1; i <= 12; i++) {
    const grau = (asc + (i - 1) * 30) % 360;
    const signo = grausParaSigno(grau);
    casas[`casa${i}`] = {
      longitude: Math.round(grau * 100) / 100,
      signo: signo.signo,
      grau: Math.round(signo.grau * 100) / 100,
      minuto: Math.round(signo.minuto)
    };
  }

  return casas;
}

function grausParaSigno(longitude) {
  // Normalizar para 0-360
  const lon = ((longitude % 360) + 360) % 360;

  const signos = [
    'Áries', 'Touro', 'Gêmeos', 'Câncer', 'Leão', 'Virgem',
    'Libra', 'Escorpião', 'Sagitário', 'Capricórnio', 'Aquário', 'Peixes'
  ];

  const numeroSigno = Math.floor(lon / 30);
  const grauNoSigno = lon % 30;
  const minuto = Math.floor((grauNoSigno % 1) * 60);

  return {
    signo: signos[numeroSigno],
    grau: Math.floor(grauNoSigno),
    minuto: minuto,
    longitude: lon
  };
}

function formatarPosicaoAstrologica(posicao) {
  // Formata uma posição para leitura legível
  // Ex: "10° Áries 25'" (10 graus, Áries, 25 minutos)
  return `${posicao.grau}° ${posicao.signo} ${posicao.minuto}'`;
}

module.exports = {
  calcularPosicoes,
  grausParaSigno,
  formatarPosicaoAstrologica
};
