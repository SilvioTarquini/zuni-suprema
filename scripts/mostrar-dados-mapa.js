require('dotenv').config();

const { calcularMapaNatal } = require('../src/lib/astro.js');

async function mostrar() {
  const resultado = await calcularMapaNatal({
    nome: "Leonardo da Vinci",
    dataNascimento: "1452-04-15",
    horaNascimento: "14:30",
    localNascimento: "Vinci, Itália"
  });

  console.log('RESULTADO COMPLETO DO MAPA NATAL:\n');
  console.log(JSON.stringify(resultado, null, 2));
}

mostrar();
