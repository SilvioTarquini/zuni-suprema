require('dotenv').config();

const { calcularMapaNatal } = require('../src/lib/astro.js');

async function testar() {
  const resultado = await calcularMapaNatal({
    nome: "Silvio Mateus Tarquini",
    dataNascimento: "1966-04-04",
    horaNascimento: "11:20",
    localNascimento: "Caieiras, São Paulo"
  });

  console.log('MAPA NATAL DE SILVIO MATEUS TARQUINI:\n');
  console.log(JSON.stringify(resultado, null, 2));
}

testar();
