// Lote 2 — extratores dos formatos novos (módulo de dados, páginas em JSON, páginas estáticas), limpeza e folha de rosto do PDF.
// Lê as cópias de _staging (fora do repositório); sem rede, sem banco, sem bucket. Se _staging não existir, avisa e sai com 0.
// Uso: node scripts/testar-lote2-extracao.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('./lote/extrairLivro');
const { varrer } = require('./lote/residuos');
const { serieDoPdf, montarHtmlPdf } = require('./lote/htmlPdf');
const { carregarRemocoes, aplicarRemocoes } = require('./lote/limpeza');
const { OBRAS_LOTE2, FONTE_PADRAO } = require('./preparar-obras-lote');
const { NOMES_ARQUIVO } = require('../src/lib/pdfLivro');

let total = 0; const falhas = [];
function teste(nome, fn) { total++; try { fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }

console.log('Folha de rosto do PDF (só no PDF; o HTML da obra não é tocado)');
teste('"EDIÇÃO PREMIUM · FLIPBOOK" vira "Edição Premium"', () => assert.strictEqual(serieDoPdf('EDIÇÃO PREMIUM · FLIPBOOK'), 'Edição Premium'));
teste('"EDIÇÃO DE LUXO · FLIPBOOK" vira "Edição de Luxo"', () => assert.strictEqual(serieDoPdf('EDIÇÃO DE LUXO · FLIPBOOK'), 'Edição de Luxo'));
teste('série que não é de flipbook fica como está; vazia continua vazia', () => { assert.strictEqual(serieDoPdf('Romance'), 'Romance'); assert.strictEqual(serieDoPdf(''), ''); assert.strictEqual(serieDoPdf(undefined), ''); });
teste('o HTML do PDF não tem a palavra "flipbook" nem hifenização automática nos títulos', () => {
  const html = montarHtmlPdf({ meta: { titulo: 'X', serie: 'EDIÇÃO PREMIUM · FLIPBOOK', autor: 'Zuni Suprema' }, secoes: [{ tipo: 'capitulo', rotulo: '', titulo: 'Título', parte: '', blocos: [{ t: 'orn' }, { t: 'p', html: 'a', texto: 'a' }] }] }, null, {});
  assert.ok(!/flipbook/i.test(html)); assert.ok(/h1, h2, h3, h4[^{]*\{[^}]*hyphens: manual/.test(html)); assert.ok(/white-space: break-spaces/.test(html)); assert.ok(html.includes('✦ ✦ ✦'));
});

console.log('Caixa de título (título em MAIÚSCULAS do flipbook)');
teste('algarismos romanos em maiúsculas; artigos e preposições em minúsculas só no meio; maiúscula após travessão e dois-pontos', () => {
  const { capitalizar } = require('./lote/extrairLote2');
  const casos = [['CAPÍTULO II — O ALUGUEL DA DIGNIDADE', 'Capítulo II — O Aluguel da Dignidade'], ['PARTE II', 'Parte II'], ['PARTE III — A ESCALADA', 'Parte III — A Escalada'], ['CAPÍTULO XX — A PORTA E O VENTO', 'Capítulo XX — A Porta e o Vento'],
    ['PRIMEIRO ATO — O REGRESSO DE UM MORTO', 'Primeiro Ato — O Regresso de um Morto'], ['CAPÍTULO I — A ARTE DO VELÓRIO SEM DEFUNTO', 'Capítulo I — A Arte do Velório sem Defunto'], ['CAPÍTULO IV: UMA NOITE SEM FIM', 'Capítulo IV: Uma Noite sem Fim'],
    ['O BAILE DOS HERDEIROS POSTIÇOS', 'O Baile dos Herdeiros Postiços'], ['QUINTA-FEIRA', 'Quinta-feira'], ['Parte II — já em caixa mista', 'Parte II — já em caixa mista']];
  casos.forEach(([entrada, esperado]) => assert.strictEqual(capitalizar(entrada), esperado));
});

console.log('Limpeza: cópia de _staging já limpa (Máscara para o Controle)');
teste('sem "jaAplicadoNoStaging", item ausente é erro; com ele, é aceito e a verificação final continua', () => {
  const modelo = { secoes: [{ titulo: 'Cap', blocos: [{ t: 'p', texto: 'texto bom', html: 'texto bom' }] }] };
  assert.throws(() => aplicarRemocoes(modelo, [{ trecho: 'lixo de IA' }], [], {}), /não encontrada/);
  assert.doesNotThrow(() => aplicarRemocoes(modelo, [{ trecho: 'lixo de IA' }], ['Epílogo:'], { tolerante: true }));
  const presente = { secoes: [{ titulo: 'Cap', blocos: [{ t: 'p', texto: 'lixo de IA', html: 'lixo de IA' }] }] };
  const r = aplicarRemocoes(presente, [{ trecho: 'lixo de IA' }], [], { tolerante: true });
  assert.strictEqual(r.removidos, 1);
});
teste('mascara-para-o-controle está marcada como já limpa no staging', () => assert.strictEqual(carregarRemocoes('mascara-para-o-controle').jaAplicadoNoStaging, true));

console.log('Trava de resíduos: ocorrência revisada vira aviso; qualquer outra continua barrando');
teste('a mesma frase só é rebaixada para a obra e o trecho revisados', () => {
  const frase = 'Nuno parou. — Quer que eu continue nos negativos? A escrevente levantou os olhos.';
  assert.ok(varrer(frase, { literais: [] }).bloqueios.length >= 1, 'sem revisão deveria barrar');
  assert.strictEqual(varrer(frase, { literais: [], slug: 'ninguem-avisou-que-ele-morreu' }).bloqueios.length, 0);
  assert.ok(varrer(frase, { literais: [], slug: 'almas-silenciadas' }).bloqueios.length >= 1, 'outra obra continua barrando');
  assert.ok(varrer('Quer que eu reescreva o capítulo 3?', { literais: [], slug: 'ninguem-avisou-que-ele-morreu' }).bloqueios.length >= 1, 'outra frase continua barrando');
});

console.log('Entrada da Loja e universos (lote 2)');
teste('a entrada da Loja tem as 5 portas, com o cupom repassado nas 3 novas', () => {
  const h = fs.readFileSync(path.join(__dirname, '..', 'public', 'loja', 'index.html'), 'utf8');
  for (const [id, slug] of [['porta-romances-link', 'romances-e-historias'], ['porta-relacoes-link', 'relacoes-e-convivencia'], ['porta-pais-link', 'pais-e-filhos']]) {
    assert.ok(h.includes(`id="${id}" href="/loja/${slug}/"`), id);
    assert.ok(h.includes(`getElementById('${id}').href = '/loja/${slug}/?cupom='`), 'cupom em ' + id);
  }
  assert.strictEqual((h.match(/class="btn-universo"/g) || []).length, 5);
});
teste('Pais e Filhos: só a seção "Em família" é nova e nenhum romance entra', () => {
  const { UNIVERSOS: U } = require('../src/lib/universosConfig');
  const ids = U['pais-e-filhos'].secoes.flatMap((x) => x.ids);
  assert.deepStrictEqual(ids.sort(), ['a-bussola-do-adolescente', 'alem-do-que-voce-sente', 'alem-do-que-voce-ve', 'toda-familia-tem-duas-historias']);
  const { CATALOGO } = require('../src/lib/catalogoLivros');
  assert.ok(!ids.some((i) => CATALOGO[i] && CATALOGO[i].departamento === 'Romances e Histórias'));
});
teste('as 19 estão em seções de universo, com editorial e sem duplicata; o aviso de Almas Silenciadas existe', () => {
  const { UNIVERSOS: U } = require('../src/lib/universosConfig');
  for (const u of ['romances-e-historias', 'relacoes-e-convivencia']) {
    const ids = U[u].secoes.flatMap((x) => x.ids);
    assert.strictEqual(new Set(ids).size, ids.length, 'duplicata em ' + u);
    ids.forEach((i) => assert.ok(U[u].editorial[i], `${u}: sem editorial de ${i}`));
  }
  assert.ok(/violência contra mulheres, escravidão e internação forçada/.test(U['romances-e-historias'].editorial['almas-silenciadas'].aviso));
});

const staging = FONTE_PADRAO;
if (!fs.existsSync(staging)) { console.log(`\n_staging não encontrado (${staging}): partes que leem os 19 HTML foram puladas`); } else {
  console.log(`\nExtração das ${OBRAS_LOTE2.length} obras do lote 2 (${staging})`);
  teste('as 19 têm nome de arquivo de PDF', () => OBRAS_LOTE2.forEach((s) => assert.ok(NOMES_ARQUIVO[s], s)));
  const FORMATOS = { modulo: [], pagsjson: [], estatico: [], bookdata: [] };
  for (const slug of OBRAS_LOTE2) {
    teste(`${slug}: texto completo (cobertura de letras 100%), seções e blocos não vazios`, () => {
      const html = path.join(staging, `${slug}.html`);
      const m = E.extrair(html);
      FORMATOS[m.formato] = (FORMATOS[m.formato] || []).concat(slug);
      const c = E.conferirCobertura(html, m);
      assert.strictEqual(c.faltam, 0, `faltam ${c.faltam} letras (${c.exemplos.join(', ')})`);
      assert.ok(m.secoes.length >= 10, `só ${m.secoes.length} seções`);
      assert.ok(m.meta.titulo, 'sem título');
      const t = E.textoDoLivro(m);
      assert.ok(E.contarPalavras(t) > 10000, 'texto curto demais');
      assert.ok(!/flipbook|retrofit|Gold Plus/i.test(t), 'texto de design (flipbook/retrofit) entrou no corpo');
      assert.ok(!/\u0001|\u0002|\u0003|\u0004/.test(t), 'marcador de formatação vazou para o texto');
      const titulos = m.secoes.flatMap((x) => [x.titulo, x.rotulo, x.parte].filter(Boolean));
      const ruins = titulos.filter((x) => /(^|[\s—–-])(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii|Xiii|Xiv|Xv|Xvi|Xvii|Xviii|Xix|Xx|Xxi)(\s|$|—|:)/.test(x) || (/^[A-ZÀ-Ú]/.test(x) && /— [a-zà-ú]/.test(x)));
      assert.deepStrictEqual(ruins, [], 'título com romano ou artigo mal escrito: ' + ruins.slice(0, 2).join(' | '));
      const trava = varrer(t, { slug });
      assert.strictEqual(trava.bloqueios.length, 0, JSON.stringify(trava.bloqueios[0]));
    });
  }
  teste('os 4 formatos foram exercitados (módulo, páginas em JSON, estático, bookData)', () => {
    assert.ok(FORMATOS.modulo.length >= 8 && FORMATOS.pagsjson.length === 3 && FORMATOS.estatico.length === 4 && FORMATOS.bookdata.length === 2, JSON.stringify(FORMATOS));
  });
}

console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`);
process.exit(falhas.length ? 1 : 0);
