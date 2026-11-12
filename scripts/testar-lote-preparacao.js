// Lote-piloto — testes da preparação local (limpeza versionada, trava de resíduos, manifesto com hash, Livro-Vivo).
// Não usa rede, banco nem bucket. Lê as cópias de _staging e os arquivos gerados em ..\lote-piloto (rode antes
// scripts/preparar-obras-lote.js, scripts/gerar-pdf-lote.js e scripts/preparar-livro-vivo-lote.js).
// Uso: node scripts/testar-lote-preparacao.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const E = require('./lote/extrairLivro');
const L = require('./lote/limpeza');
const R = require('./lote/residuos');
const M = require('./lote/manifesto');
const { FONTE_PADRAO, OBRAS_DO_LOTE } = require('./preparar-obras-lote');
const { blocosDaObra, MAX_PALAVRAS_POR_CHUNK } = require('./preparar-livro-vivo-lote');
const { expandirBlocosParaChunks } = require('../src/indexarTema');
const { parseBlocos } = require('../src/indexarLivro');
const { NOMES_ARQUIVO } = require('../src/lib/pdfLivro');

const MASCARA_ORIGINAL = path.join(FONTE_PADRAO, '..', '1- Romances Histórias - (15) Prontos', 'Máscara Para o Controle - Pronta', 'Mascara_para_o_Controle_Flipbook.html');
const MASCARA_LIMPA = path.join(FONTE_PADRAO, 'mascara-para-o-controle.html');

let total = 0; const falhas = [];
function teste(nome, fn) { total++; try { fn(); console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FALHOU ${nome}: ${e.message.split('\n')[0]}`); } }
const manifesto = M.lerManifesto();

console.log('A. Extração: o texto do flipbook chega inteiro ao modelo');
for (const slug of OBRAS_DO_LOTE) {
  teste(`${slug}: nenhuma letra do texto-fonte falta no modelo; sem caractere de controle`, () => {
    const arq = path.join(FONTE_PADRAO, `${slug}.html`);
    const m = E.extrair(arq);
    const c = E.conferirCobertura(arq, m);
    assert.strictEqual(c.faltam, 0, `faltam ${c.faltam}: ${c.exemplos.join(',')}`);
    assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(E.textoDoLivro(m)), 'caractere de controle no texto');
  });
}

console.log('B. Limpeza versionada (T): remoção só é aceita se verificável');
const mo = E.extrair(MASCARA_ORIGINAL); const ms = E.extrair(MASCARA_LIMPA);
const cfg = L.carregarRemocoes('mascara-para-o-controle');
teste('Máscara: T(original) reproduz, texto a texto, a cópia limpa de _staging (34 blocos + seção "Epílogo:" = 50 blocos)', () => {
  const r = L.aplicarRemocoes(mo, cfg.remocoes, cfg.secoesRemovidas);
  assert.strictEqual(r.removidos, 50);
  assert.strictEqual(E.textoDoLivro(r.modelo), E.textoDoLivro(ms));
});
teste('trecho da lista que não existe no original → erro (lista desatualizada)', () => {
  assert.throws(() => L.aplicarRemocoes(mo, [{ trecho: 'frase que nunca existiu neste livro' }]), /não encontrada/);
});
teste('seção da lista que não existe → erro', () => {
  assert.throws(() => L.aplicarRemocoes(mo, [], ['Capítulo 99']), /não encontrada/);
});
teste('as 5 obras do lote têm arquivo de remoções (lista vazia = revisada, nada a remover)', () => {
  for (const slug of OBRAS_DO_LOTE) { const c = L.carregarRemocoes(slug); assert.ok(c.existe, slug); assert.strictEqual(c.remocoes.length, 0, slug); }
});

console.log('C. Trava de resíduos');
const literais = R.carregarLiterais();
teste('a lista de trechos removidos tem os 34 blocos da Máscara', () => { assert.strictEqual(literais.length, 34); });
teste('texto ORIGINAL da Máscara (com bastidor de IA) → BLOQUEIO', () => {
  const v = R.varrer(E.textoDoLivro(mo), { literais });
  assert.ok(v.bloqueios.length >= 10, `só ${v.bloqueios.length} bloqueios`);
});
teste('texto da Máscara limpa (_staging) → 0 bloqueios', () => {
  const v = R.varrer(E.textoDoLivro(ms), { literais });
  assert.strictEqual(v.bloqueios.length, 0, JSON.stringify(v.bloqueios[0]));
});
teste('reintroduzir UM trecho removido num texto limpo é pego (caixa e espaços diferentes)', () => {
  const t = E.textoDoLivro(ms) + '\n\n' + cfg.remocoes[1].trecho.toUpperCase().replace(/ /g, '   ');
  assert.ok(R.varrer(t, { literais }).bloqueios.length >= 1);
});
const AMOSTRAS = {
  'modelo de linguagem': 'Como modelo de linguagem, não posso opinar.',
  '"Aqui está…" de assistente': 'Aqui está o próximo capítulo, reescrito.',
  '"reescrito integralmente"': 'o bloco foi reescrito integralmente no mesmo padrão',
  'oferta de assistente': 'Quer que eu continue com o capítulo seguinte?',
  '"Sumário Oficial/Sanitizado"': 'Sumário Oficial Completo e Sanitizado da obra',
  'marca de IA': 'Gerado pelo ChatGPT em outubro.',
  'marcador de rascunho': 'Texto [inserir exemplo aqui] fim.',
  'instrução ao modelo': 'A autora de uma narrativa ao estilo Machado de Assis intercalaria comentários'
};
for (const [nome] of require('./lote/residuos').PISTAS_BLOQUEIO) {
  teste(`pista de bloqueio "${nome}" dispara numa amostra e não dispara em texto comum`, () => {
    assert.ok(AMOSTRAS[nome], 'sem amostra para ' + nome);
    assert.ok(R.varrer(AMOSTRAS[nome], { literais: [] }).bloqueios.some((b) => b.regra === nome), 'não disparou');
    assert.strictEqual(R.varrer('A fazenda vende leite todo dia. — Quer que eu assuma a conta? perguntou ele.', { literais: [] }).bloqueios.length, 0);
  });
}
for (const slug of OBRAS_DO_LOTE) {
  teste(`${slug}: texto da loja sem bloqueio`, () => { assert.strictEqual(R.varrer(fs.readFileSync(path.join(M.PASTA_PADRAO, slug, 'texto.txt'), 'utf8'), { literais }).bloqueios.length, 0); });
  teste(`${slug}: texto EXTRAÍDO DO PDF (pdftotext) sem bloqueio`, () => {
    const pdf = path.join(M.PASTA_PADRAO, 'pdf', NOMES_ARQUIVO[slug]);
    const t = execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', pdf, '-'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    assert.strictEqual(R.varrer(t, { literais }).bloqueios.length, 0);
  });
}

console.log('D. Manifesto com hash');
for (const slug of OBRAS_DO_LOTE) {
  teste(`${slug}: PDF confere com o manifesto (hash do PDF, do texto; resíduos 0; letras ausentes 0)`, () => {
    const p = M.conferirPdf(slug, path.join(M.PASTA_PADRAO, 'pdf', NOMES_ARQUIVO[slug]));
    assert.deepStrictEqual(p, []);
  });
  teste(`${slug}: HTML da loja confere com o manifesto`, () => { assert.deepStrictEqual(M.conferirHtmlLoja(slug, path.join(FONTE_PADRAO, `${slug}.html`)), []); });
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zuni-manifesto-'));
teste('PDF adulterado (1 byte) é RECUSADO', () => {
  const orig = path.join(M.PASTA_PADRAO, 'pdf', NOMES_ARQUIVO['fazenda-lucrativa']);
  const copia = path.join(tmp, 'x.pdf'); const b = fs.readFileSync(orig); b[b.length - 20] ^= 1; fs.writeFileSync(copia, b);
  assert.ok(M.conferirPdf('fazenda-lucrativa', copia).some((x) => /hash do PDF/.test(x)));
});
teste('PDF de obra fora do manifesto é RECUSADO', () => { assert.ok(M.conferirPdf('obra-que-nao-existe', path.join(tmp, 'x.pdf')).length === 1); });
teste('trocar o texto da obra invalida o PDF antigo (hash do texto ≠ hash gravado no PDF)', () => {
  const m = JSON.parse(JSON.stringify(manifesto)); m.obras['fazenda-lucrativa'].texto.sha256 = 'mudou';
  const pasta = path.join(tmp, 'm'); fs.mkdirSync(pasta); M.gravarManifesto(m, pasta);
  assert.ok(M.conferirPdf('fazenda-lucrativa', path.join(M.PASTA_PADRAO, 'pdf', NOMES_ARQUIVO['fazenda-lucrativa']), pasta).some((x) => /outro texto/.test(x)));
});
teste('HTML da loja com o widget do Livro-Vivo injetado continua aceito; HTML alterado é recusado', () => {
  const slug = 'fazenda-lucrativa';
  const html = fs.readFileSync(path.join(FONTE_PADRAO, `${slug}.html`), 'utf8');
  const com = html.replace(/\s*<\/body>/i, '\n<!-- ZUNI-CHAT-WIDGET-START -->\n<div>widget</div>\n<!-- ZUNI-CHAT-WIDGET-END -->\n</body>');
  assert.notStrictEqual(com, html);
  const a = path.join(tmp, 'com-widget.html'); fs.writeFileSync(a, com);
  assert.deepStrictEqual(M.conferirHtmlLoja(slug, a), []);
  const b = path.join(tmp, 'alterado.html'); fs.writeFileSync(b, html.replace('Fazenda', 'Fazenda!'));
  assert.ok(M.conferirHtmlLoja(slug, b).length === 1);
});

console.log('E. Livro-Vivo (.txt) — formato do indexarLivro.js e limite de ' + MAX_PALAVRAS_POR_CHUNK + ' palavras');
for (const slug of OBRAS_DO_LOTE) {
  teste(`${slug}: o parser REAL do indexarLivro.js lê o .txt; nenhum trecho passa de ${MAX_PALAVRAS_POR_CHUNK} palavras; texto todo presente`, () => {
    const txt = fs.readFileSync(path.join(M.PASTA_PADRAO, 'livro-vivo-txt', `${slug}.txt`), 'utf8');
    const blocos = parseBlocos(txt);
    assert.ok(blocos.length > 0);
    assert.ok(blocos.every((b) => b.corpo.split(/\s+/).length <= MAX_PALAVRAS_POR_CHUNK));
    assert.strictEqual(blocos.length, manifesto.obras[slug].livroVivo.blocos);
    const modelo = JSON.parse(fs.readFileSync(path.join(M.PASTA_PADRAO, slug, 'modelo.json'), 'utf8'));
    const esperado = E.contarPalavras(modelo.secoes.map((s) => s.blocos.map(E.textoDoBloco).join('\n\n')).join('\n\n'));
    const obtido = blocos.reduce((a, b) => a + E.contarPalavras(b.corpo), 0);
    assert.strictEqual(obtido, esperado, `palavras no .txt ${obtido} ≠ ${esperado} no texto`);
  });
}
teste(`trava de ${MAX_PALAVRAS_POR_CHUNK} palavras: parágrafo gigante (6.000 palavras, sem quebra) é dividido por FRASE, nenhum pedaço acima do limite, nada perdido`, () => {
  const frase = 'Esta é uma frase de teste do Livro-Vivo com tamanho conhecido de doze palavras exatas. ';
  const par = frase.repeat(500).trim(); // 500 × 14 palavras = 7.000
  const chunks = expandirBlocosParaChunks([{ tema: 'Gigante', corpo: par }], MAX_PALAVRAS_POR_CHUNK);
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((c) => c.corpo.split(/\s+/).length <= MAX_PALAVRAS_POR_CHUNK));
  assert.strictEqual(chunks.map((c) => c.corpo).join('').replace(/\s+/g, ' ').trim(), par.replace(/\s+/g, ' ').trim());
});
teste('capítulo comprido é dividido em partes "parte i/n" em fronteira de bloco', () => {
  const unidade = { t: 'p', html: 'x', texto: 'palavra '.repeat(200).trim() };
  const modelo = { secoes: [{ tipo: 'capitulo', rotulo: 'Capítulo 1', titulo: 'Longo', blocos: Array.from({ length: 12 }, () => unidade) }] };
  const b = blocosDaObra(modelo);
  assert.ok(b.length >= 4 && b.every((x) => /— parte \d+\/\d+$/.test(x.tema)));
  assert.strictEqual(b.reduce((a, x) => a + E.contarPalavras(x.corpo), 0), 2400);
});

console.log('F. Universos novos: criados, mas SEM botão na entrada da Loja');
const U = require('./../src/lib/universos');
for (const slug of ['pais-e-filhos', 'relacoes-e-convivencia', 'romances-e-historias']) {
  teste(`${slug}: página renderiza completa (sem {{placeholder}}) e o universo está configurado`, () => {
    const h = U.renderizarPagina(slug);
    assert.ok(h && h.length > 5000);
    assert.strictEqual((h.match(/\{\{[A-Z0-9_]+\}\}/g) || []).length, 0);
    assert.ok(U.listarUniversos().includes(slug));
  });
  // Lote 2 (11/11/2026, decisão do Silvio): os três universos ganharam botão na entrada da Loja (antes do lote 2 não tinham).
  teste(`${slug}: aparece em public/loja/index.html (botão de entrada, com o cupom repassado)`, () => {
    const h = fs.readFileSync(path.join(__dirname, '..', 'public', 'loja', 'index.html'), 'utf8');
    assert.ok(h.includes(`href="/loja/${slug}/"`));
    assert.ok(h.includes(`'/loja/${slug}/?cupom='`));
  });
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${total - falhas.length}/${total} ok${falhas.length ? '\nFALHARAM:\n - ' + falhas.join('\n - ') : ''}`);
process.exit(falhas.length ? 1 : 0);
