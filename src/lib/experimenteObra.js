// lib/experimenteObra.js
//
// Página pública do Experimente ZUNI por obra: GET /experimente/<id>/ — UM template para todas as obras
// (templates/experimente-obra.html), renderizado no servidor. Sem API pública de amostra, sem JavaScript
// obrigatório para ler, sem chat, sem IA, sem banco.
//
// Fontes (cada dado vem de um único lugar):
//   catálogo (lib/catalogoLivros.js)      título, preço vigente, capa, existência da obra, flag amostraDisponivel
//   amostras (lib/amostrasExperimente.js) trecho aprovado, título do trecho, chamada, aviso, TTS, universo
//   lib/origemCompra.js                   whitelist da origem comercial
//
// FAIL-CLOSED: obra inexistente, sem flag no catálogo, sem amostra aprovada, com trecho vazio, grande demais
// ou placeholder → 404, sempre com a MESMA resposta (não revela se a obra existe ou está "em preparo").
// Só campos explícitos entram na página: nenhum objeto do catálogo é serializado, então audiobookStorage,
// audiobookUrl, audiobookPartes, descricao, indicadoPara etc. nunca chegam ao HTML.

const fs = require('fs');
const path = require('path');
const { buscarLivro } = require('./catalogoLivros');
const { obterAmostra, UNIVERSOS, MAX_TRECHO_CHARS, MARCADOR_PLACEHOLDER } = require('./amostrasExperimente');
const { normalizarOrigem } = require('./origemCompra');

const LIVRO_ID_VALIDO = /^[a-z0-9-]{1,80}$/;
const CUPOM_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
const CAMINHO_TEMPLATE = path.join(__dirname, '..', '..', 'templates', 'experimente-obra.html');

let templateEmCache = null;
function carregarTemplate() {
  if (templateEmCache === null) templateEmCache = fs.readFileSync(CAMINHO_TEMPLATE, 'utf8');
  return templateEmCache;
}

function escapar(valor) {
  return String(valor).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatarPreco(n) {
  return 'R$ ' + Number(n).toFixed(2).replace('.', ',');
}

const PAGINA_INDISPONIVEL = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Trecho indisponível — ZUNI Suprema</title>
<style>body{margin:0;background:#f7f2ea;color:#231d1a;font-family:Georgia,serif;line-height:1.5}main{max-width:32rem;margin:0 auto;padding:48px 16px;text-align:center}
a{display:inline-flex;align-items:center;min-height:48px;padding:0 20px;border:1px solid #5a2d3f;border-radius:8px;color:#5a2d3f;text-decoration:none;font-family:system-ui,sans-serif;font-weight:600}</style></head>
<body><main><h1 style="font-weight:normal;font-size:1.5rem">Este trecho não está disponível.</h1>
<p>Conheça as obras da Loja ZUNI.</p><p><a href="/loja/">Ver a Loja ZUNI</a></p></main></body></html>`;

function indisponivel() {
  return { status: 404, html: PAGINA_INDISPONIVEL };
}

// Títulos de capítulos que NÃO fazem parte do trecho: só os títulos (nada de descrição), em texto puro.
function capitulosHtml(titulos) {
  if (!Array.isArray(titulos)) return '';
  const itens = titulos
    .filter((t) => typeof t === 'string' && t.trim() && t.trim().length <= 80)
    .slice(0, 8)
    .map((t) => '<li>' + escapar(t.trim()) + '</li>');
  if (!itens.length) return '';
  return '<section class="explorar" aria-labelledby="explorar-titulo"><h2 id="explorar-titulo">Continue explorando na obra</h2><ul class="capitulos">' + itens.join('') + '</ul></section>';
}

function paragrafosHtml(trecho) {
  return trecho
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => '        <p>' + escapar(p).replace(/\n/g, ' ') + '</p>')
    .join('\n');
}

// params: { livroId, origem, cupom } (valores crus da requisição)
// deps (injetáveis nos testes): { buscar, amostra, template, permitirPlaceholder }
function renderizarExperimenteObra({ livroId, origem, cupom } = {}, deps = {}) {
  const buscar = deps.buscar || buscarLivro;
  const amostraDe = deps.amostra || obterAmostra;

  if (typeof livroId !== 'string' || !LIVRO_ID_VALIDO.test(livroId)) return indisponivel();

  const livro = buscar(livroId);
  // typeof titulo: ids como "constructor" resolvem para funções do protótipo em objetos simples.
  if (!livro || typeof livro !== 'object' || typeof livro.titulo !== 'string' || livro.teaser) return indisponivel();
  if (livro.amostraDisponivel !== true) return indisponivel();

  const amostra = amostraDe(livroId);
  if (!amostra || amostra.aprovada !== true || amostra.livroId !== livroId) return indisponivel();

  const trecho = typeof amostra.trecho === 'string' ? amostra.trecho.trim() : '';
  if (!trecho || trecho.length > MAX_TRECHO_CHARS) return indisponivel();
  if (MARCADOR_PLACEHOLDER.test(trecho) && !deps.permitirPlaceholder) return indisponivel();

  const preco = livro.precoPromocional || livro.preco;
  if (!Number.isFinite(preco) || preco <= 0) return indisponivel();

  const titulo = livro.tituloPublico || livro.titulo;
  const universo = Object.prototype.hasOwnProperty.call(UNIVERSOS, amostra.origemUniverso) ? UNIVERSOS[amostra.origemUniverso] : null;
  const cupomValido = typeof cupom === 'string' && CUPOM_VALIDO.test(cupom) ? cupom : null;

  // Origem comercial: só se a visita já trouxe uma origem permitida (nunca inventada pelo servidor).
  const origemValida = normalizarOrigem(origem);
  const checkout = new URLSearchParams({ livro: livroId });
  if (origemValida) checkout.set('origem', origemValida);
  if (cupomValido) checkout.set('cupom', cupomValido);
  const checkoutUrl = '/checkout-livro.html?' + checkout.toString();

  // Voltar: rota determinística do universo da obra (não depende do histórico do navegador).
  const voltarBase = universo ? universo.rota : '/loja/';
  const voltarUrl = voltarBase + (cupomValido ? '?cupom=' + encodeURIComponent(cupomValido) : '');
  const voltarRotulo = universo ? 'Voltar ao ' + universo.rotulo : 'Ver a Loja ZUNI';

  const capa = typeof livro.capa === 'string' && livro.capa.startsWith('/loja/capas/') ? livro.capa : '/loja/capas/' + livroId + '.jpg';
  const descricao = typeof amostra.chamada === 'string' && amostra.chamada.trim() ? amostra.chamada.trim() : 'Leia um trecho de ' + titulo + '.';

  const trocas = {
    TITLE: escapar(titulo + ' — Experimente ZUNI Suprema'),
    DESCRIPTION: escapar(descricao),
    CAPA_URL: escapar(capa),
    TITULO: escapar(titulo),
    CHAMADA_BLOCK: typeof amostra.chamada === 'string' && amostra.chamada.trim() ? '<p class="chamada">' + escapar(amostra.chamada.trim()) + '</p>' : '',
    TITULO_TRECHO_BLOCK: typeof amostra.tituloTrecho === 'string' && amostra.tituloTrecho.trim() ? '<h3>' + escapar(amostra.tituloTrecho.trim()) + '</h3>' : '',
    TRECHO_HTML: paragrafosHtml(trecho),
    CONTINUE_BLOCK: capitulosHtml(amostra.outrosCapitulos),
    AVISO_BLOCK: amostra.avisoInformativo === true
      ? '<p class="aviso">Conteúdo de caráter informativo, que não substitui o acompanhamento de um profissional de saúde.</p>'
      : '',
    TTS: amostra.ttsDisponivel === true ? '1' : '0',
    CHECKOUT_URL: escapar(checkoutUrl),
    PRECO: escapar(formatarPreco(preco)),
    VOLTAR_URL: escapar(voltarUrl),
    VOLTAR_ROTULO: escapar(voltarRotulo)
  };

  let html = deps.template || carregarTemplate();
  html = html.replace(/\{\{([A-Z_]+)\}\}/g, (m, chave) => (Object.prototype.hasOwnProperty.call(trocas, chave) ? trocas[chave] : ''));
  return { status: 200, html };
}

module.exports = { renderizarExperimenteObra, escapar, formatarPreco, PAGINA_INDISPONIVEL };
