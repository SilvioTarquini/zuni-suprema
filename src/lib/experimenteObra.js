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

// Temas/capítulos da obra que NÃO fazem parte do trecho: só os títulos, em lista editorial (nada de link, botão ou descrição).
function temasHtml(titulos, tituloObra) {
  if (!Array.isArray(titulos)) return '';
  const itens = titulos
    .filter((t) => typeof t === 'string' && t.trim() && t.trim().length <= 80)
    .slice(0, 8)
    .map((t) => '<li>' + escapar(t.trim()) + '</li>');
  if (!itens.length) return '';
  return '<section class="temas" aria-labelledby="temas-titulo"><h2 id="temas-titulo" class="secao-titulo">Você também encontrará nesta obra</h2>'
    + '<p class="secao-texto">Entre os temas abordados em ' + escapar(tituloObra) + ':</p>'
    + '<ul class="temas-lista">' + itens.join('') + '</ul></section>';
}

// Versão em áudio como OPÇÃO ADICIONAL à compra do livro (não existe venda avulsa). Só aparece se o catálogo
// diz que a obra tem audiobook; o preço não é repetido aqui — o checkout é a autoridade.
function audiobookOpcaoHtml(livro, tituloObra) {
  if (!livro || livro.audiobookDisponivel !== true) return '';
  return '<div class="opcao"><h3>Audiobook (opção adicional)</h3>'
    + '<p>Existe uma versão em áudio de ' + escapar(tituloObra) + '. Se desejar, você poderá acrescentá-la durante a compra do livro.</p></div>';
}

// Amostra OFICIAL do audiobook (trecho curto aprovado, arquivo estático próprio). FAIL-CLOSED: só renderiza se o
// catálogo diz que a obra tem audiobook, o registro editorial aprovou a amostra, o caminho é exatamente
// /audio/amostras/<livroId>.mp3 e o arquivo existe. Nunca recebe URL/caminho do áudio integral.
const RAIZ_PUBLIC = path.join(__dirname, '..', '..', 'public');

function arquivoDaAmostraExiste(caminhoPublico) {
  try { return fs.statSync(path.join(RAIZ_PUBLIC, caminhoPublico)).isFile(); } catch (e) { return false; }
}

function audioAmostraDisponivel(livro, amostra, livroId, existe) {
  const a = amostra && amostra.audioAmostra;
  if (!a || a.aprovada !== true || !livro || livro.audiobookDisponivel !== true) return null;
  if (a.arquivo !== '/audio/amostras/' + livroId + '.mp3') return null;
  if (!(existe || arquivoDaAmostraExiste)(a.arquivo)) return null;
  return a;
}

function rotuloDuracao(segundos) {
  if (!Number.isFinite(segundos) || segundos <= 0) return '';
  const min = Math.round(segundos / 60);
  return min <= 1 ? 'Cerca de 1 minuto' : 'Cerca de ' + min + ' minutos';
}

function audioBlocoHtml(a, tituloObra) {
  if (!a) return '';
  const dur = rotuloDuracao(a.duracaoSegundos);
  return '<section class="ouvir-audio" id="audio-amostra" aria-labelledby="audio-titulo">'
    + '<h2 id="audio-titulo" class="secao-titulo">Ouça um trecho do audiobook</h2>'
    + '<p class="secao-texto">Conheça uma amostra da versão narrada de ' + escapar(tituloObra) + '.</p>'
    + '<audio id="audio-player" controls preload="none" src="' + escapar(a.arquivo) + '">'
    + 'Seu navegador não reproduz áudio neste formato.</audio>'
    + '<div class="audio-ui" id="audio-ui" hidden>'
    + '<button class="btn btn-audio" type="button" id="audio-tocar" aria-label="Ouvir amostra">'
    + '<svg viewBox="0 0 24 24" aria-hidden="true" id="audio-icone"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>'
    + '<span id="audio-rotulo">Ouvir amostra</span></button>'
    + '<button class="btn btn-audio-recomecar" type="button" id="audio-recomecar" hidden>Recomeçar</button>'
    + '<div class="audio-progresso" id="audio-progresso-caixa" hidden><div class="audio-barra" aria-hidden="true"><div class="audio-barra-cheia" id="audio-barra"></div></div>'
    + '<span class="audio-tempo" id="audio-tempo" aria-hidden="true"></span></div>'
    + '</div>'
    + (dur ? '<p class="audio-duracao">' + escapar(dur) + '</p>' : '')
    + '<p class="ouvir-status" id="audio-status" role="status" aria-live="polite"></p>'
    + '</section>';
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

  const audioAmostra = audioAmostraDisponivel(livro, amostra, livroId, deps.arquivoExiste);

  const trocas = {
    TITLE: escapar(titulo + ' — Experimente ZUNI Suprema'),
    DESCRIPTION: escapar(descricao),
    CAPA_URL: escapar(capa),
    TITULO: escapar(titulo),
    CHAMADA_BLOCK: typeof amostra.chamada === 'string' && amostra.chamada.trim() ? '<p class="chamada">' + escapar(amostra.chamada.trim()) + '</p>' : '',
    TITULO_TRECHO_BLOCK: typeof amostra.tituloTrecho === 'string' && amostra.tituloTrecho.trim() ? '<h3>' + escapar(amostra.tituloTrecho.trim()) + '</h3>' : '',
    TRECHO_HTML: paragrafosHtml(trecho),
    TEMAS_BLOCK: temasHtml(amostra.outrosCapitulos, titulo),
    AUDIOBOOK_OPCAO: audiobookOpcaoHtml(livro, titulo),
    AVISO_BLOCK: amostra.avisoInformativo === true
      ? '<p class="aviso">Conteúdo de caráter informativo, que não substitui o acompanhamento de um profissional de saúde.</p>'
      : '',
    AUDIO_BLOCK: audioBlocoHtml(audioAmostra, titulo),
    // Com amostra oficial, a voz do navegador não é oferecida como demonstração comercial.
    TTS: amostra.ttsDisponivel === true && !audioAmostra ? '1' : '0',
    CHECKOUT_URL: escapar(checkoutUrl),
    PRECO: escapar(formatarPreco(preco)),
    VOLTAR_URL: escapar(voltarUrl),
    VOLTAR_ROTULO: escapar(voltarRotulo)
  };

  let html = deps.template || carregarTemplate();
  // Voz do navegador desligada (obra com amostra oficial do audiobook ou sem ttsDisponivel): o bloco nem vai para a página.
  html = audioAmostra
    ? html.replace(/<!--AUDIO-(INICIO|FIM)-->\s*/g, '')
    : html.replace(/<!--AUDIO-INICIO-->[\s\S]*?<!--AUDIO-FIM-->\s*/g, '');
  html = trocas.TTS !== '1'
    ? html.replace(/<!--TTS-INICIO-->[\s\S]*?<!--TTS-FIM-->\s*/g, '')
    : html.replace(/<!--TTS-(INICIO|FIM)-->\s*/g, '');
  html = html.replace(/\{\{([A-Z_]+)\}\}/g, (m, chave) => (Object.prototype.hasOwnProperty.call(trocas, chave) ? trocas[chave] : ''));
  return { status: 200, html };
}

module.exports = { renderizarExperimenteObra, escapar, formatarPreco, PAGINA_INDISPONIVEL };
