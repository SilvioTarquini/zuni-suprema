// lib/leitorCapaMesa.js
//
// Toda Mesa Tem Dois Lados: o componente "Book Page" do leitor pede a capa por caminho relativo (<img src="capa.png">), e
// esse arquivo nunca esteve no pacote do livro. Em produção o navegador pede /livros/capa.png, que cai na validação de
// id da rota /livros/:livroId e devolve 400: a capa aparece quebrada na leitura no site. O texto do livro não é afetado.
//
// Correção aplicada na hora de servir: a capa pública da loja (public/loja/capas/<id>.jpg) entra no próprio arquivo do
// livro, como data URI, no lugar do caminho relativo. Assim a capa aparece no site, no PDF e em qualquer cópia local.
// A âncora é obrigatória: exatamente um asset de componente com src="capa.png"; senão lança e o patch inteiro é
// abandonado (livro original + [LEITOR_PATCH_FALHOU]).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LIVRO_CAPA_RELATIVA = 'toda-mesa-tem-dois-lados';
const MARCADOR_MANIFESTO = '<script type="__bundler/manifest">';
const ALVO = 'src="capa.png"';

let capaDataUri = null;
function dataUriDaCapa(livroId) {
  if (capaDataUri) return capaDataUri;
  const arq = path.join(__dirname, '..', '..', 'public', 'loja', 'capas', `${livroId}.jpg`);
  capaDataUri = 'data:image/jpeg;base64,' + fs.readFileSync(arq).toString('base64');
  return capaDataUri;
}

function precisaCorrigirCapa(livroId) {
  return livroId === LIVRO_CAPA_RELATIVA;
}

// Devolve o HTML completo do livro com a capa embutida. Lança se a âncora não existir exatamente uma vez.
function corrigirCapaMesa(html, livroId = LIVRO_CAPA_RELATIVA) {
  const i = html.indexOf(MARCADOR_MANIFESTO);
  if (i < 0) throw new Error('capa-mesa: manifesto do pacote não encontrado');
  const ini = i + MARCADOR_MANIFESTO.length;
  const fim = html.indexOf('</script>', ini);
  if (fim < 0) throw new Error('capa-mesa: manifesto truncado');

  const manifesto = JSON.parse(html.slice(ini, fim));
  const alvos = [];
  for (const [id, asset] of Object.entries(manifesto)) {
    if (!asset || !/^text\/html/.test(asset.mime)) continue;
    let buf = Buffer.from(asset.data, 'base64');
    if (asset.compressed) buf = zlib.gunzipSync(buf);
    const texto = buf.toString('utf8');
    const n = texto.split(ALVO).length - 1;
    if (n > 0) alvos.push({ id, asset, texto, n });
  }
  if (alvos.length !== 1 || alvos[0].n !== 1) {
    throw new Error(`capa-mesa: âncora ${ALVO} em ${alvos.length} asset(s), ${alvos.reduce((s, a) => s + a.n, 0)} ocorrência(s)`);
  }

  const { asset, texto } = alvos[0];
  const novo = Buffer.from(texto.replace(ALVO, () => `src="${dataUriDaCapa(livroId)}"`), 'utf8');
  asset.data = (asset.compressed ? zlib.gzipSync(novo) : novo).toString('base64');

  // '</' precisa sair escapado: o manifesto vive dentro de uma <script> do HTML externo.
  const json = JSON.stringify(manifesto).replace(/<\//g, '<\\/');
  return html.slice(0, ini) + json + html.slice(fim);
}

module.exports = { precisaCorrigirCapa, corrigirCapaMesa };
