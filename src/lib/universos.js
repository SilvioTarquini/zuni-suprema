// lib/universos.js
//
// Página única e parametrizada dos universos da Loja (/loja/<slug>/). A configuração editorial de cada universo está em
// lib/universosConfig.js; o HTML é um modelo só (templates/universo-loja.html), preenchido aqui:
//   - <head> e cabeçalho (título, descrição, cor, textos) saem prontos no HTML, sem depender de JavaScript;
//   - cores do universo viram variáveis CSS; seções, apresentação das obras e avisos vão no objeto window.__UNIVERSO__;
//   - as obras (preço, formatos, capa) continuam vindo de /api/livros, filtradas no navegador.
//
// Campo `universo` do catálogo: aceita um texto ('empreender-e-crescer') OU uma lista (['a', 'b']); universosDaObra() normaliza.

const fs = require('fs');
const path = require('path');
const { UNIVERSOS } = require('./universosConfig');

const MODELO = path.join(__dirname, '..', '..', 'templates', 'universo-loja.html');
const SLUG_VALIDO = /^[a-z0-9-]+$/;

// ['a','b'] para universo: ['a','b'] | 'a' | undefined → []
function universosDaObra(livro) {
  const u = livro && livro.universo;
  if (Array.isArray(u)) return u.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  return typeof u === 'string' && u.trim() ? [u.trim()] : [];
}

function obterUniverso(slug) {
  if (typeof slug !== 'string' || !SLUG_VALIDO.test(slug)) return null;
  return Object.prototype.hasOwnProperty.call(UNIVERSOS, slug) ? UNIVERSOS[slug] : null;
}

function listarUniversos() {
  return Object.keys(UNIVERSOS);
}

// A obra pertence ao universo pelo campo `universo` (texto ou lista) ou, se o universo definir, pelo departamento.
function obraDoUniverso(livro, universo) {
  if (universosDaObra(livro).includes(universo.slug)) return true;
  return !!(universo.criterio && universo.criterio.departamento && livro.departamento === universo.criterio.departamento);
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const jsonSeguro = (o) => JSON.stringify(o).replace(/</g, String.fromCharCode(92) + "u003c").split(String.fromCharCode(0x2028)).join("\u2028").split(String.fromCharCode(0x2029)).join("\u2029");

function temaVars(t) {
  return [
    `    --fundo: ${t.fundo};`, `    --carta: ${t.carta};`, `    --tinta: ${t.tinta};`, `    --suave: ${t.suave};`,
    `    --borda: ${t.borda};`, `    --acento: ${t.acento};`, `    --acento-escuro: ${t.acentoEscuro};`,
    `    --capa-fundo: ${t.capaFundo};`, `    --carta-clara: ${t.cartaClara};`,
    `    --tinta-rgb: ${t.tintaRgb};`, `    --acento-rgb: ${t.acentoRgb};`
  ].join('\n');
}

function blocoExtra(b) {
  if (!b) return '';
  return `  <section class="diagnostico" aria-labelledby="diagnostico-titulo">
    <span class="selo-em-breve">${esc(b.selo)}</span>
    <h2 id="diagnostico-titulo">${esc(b.titulo)}</h2>
    <p>${esc(b.texto)}</p>
  </section>
`;
}

// Bloco de link para outro universo (opcional): { titulo, texto, rotulo, href } — href só pode ser /loja/<slug>/ de um universo existente.
function linkRelacionado(l) {
  if (!l || !/^\/loja\/[a-z0-9-]+\/$/.test(l.href || '')) return '';
  return `  <aside class="relacionado" aria-labelledby="relacionado-titulo">
    <div class="texto">
      <h2 id="relacionado-titulo">${esc(l.titulo)}</h2>
      <p>${esc(l.texto)}</p>
    </div>
    <a class="btn btn-primario" href="${esc(l.href)}">${esc(l.rotulo)}</a>
  </aside>
`;
}

let modeloEmCache = null;
function lerModelo() {
  if (!modeloEmCache) modeloEmCache = fs.readFileSync(MODELO, 'utf8').replace(/\r\n/g, '\n');
  return modeloEmCache;
}

// HTML completo da página do universo, ou null se o slug não existir.
function renderizarPagina(slug) {
  const u = obterUniverso(slug);
  if (!u) return null;
  const valores = {
    TITULO: esc(u.nome), DESCRICAO: esc(u.descricao), DESCRICAO_OG: esc(u.descricaoOg), THEME_COLOR: esc(u.themeColor),
    TEMA_VARS: temaVars(u.tema), SOBRETITULO: esc(u.sobretitulo), H1: esc(u.h1), INTRO: esc(u.intro), FECHO: esc(u.fecho),
    BLOCO_EXTRA: blocoExtra(u.blocoExtra), LINK_RELACIONADO: linkRelacionado(u.linkRelacionado), DIRECIONA_TITULO: esc(u.direciona.titulo), DIRECIONA_TEXTO: esc(u.direciona.texto),
    DIRECIONA_HREF: esc(u.direciona.href),
    CONFIG_SCRIPT: `<script>window.__UNIVERSO__ = ${jsonSeguro({ slug: u.slug, origem: u.origem, criterio: u.criterio, secoes: u.secoes, restantes: u.restantes, editorial: u.editorial })};</script>`
  };
  return lerModelo().replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (k in valores ? valores[k] : m));
}

// Parte pública da configuração (sem nada interno): GET /api/universos/:slug
function configPublica(slug) {
  const u = obterUniverso(slug);
  if (!u) return null;
  const { nome, sobretitulo, h1, intro, fecho, criterio, origem, secoes, restantes, editorial } = u;
  return { slug: u.slug, nome, sobretitulo, h1, intro, fecho, criterio, origem, secoes, restantes, editorial };
}

module.exports = { universosDaObra, obterUniverso, listarUniversos, obraDoUniverso, renderizarPagina, configPublica };
