#!/usr/bin/env node
// scripts/preparar-livro-vivo-lote.js
//
// Gera, LOCALMENTE, os .txt de indexação do Livro-Vivo das obras do lote — o mesmo formato e o mesmo indexador do
// Universo Feminino (src/indexarLivro.js: blocos "[Título]\ncorpo\n==========", um chunk por bloco). Fonte = o texto limpo
// gerado por scripts/preparar-obras-lote.js (<saida>/<slug>/modelo.json), o mesmo do PDF.
//
// Regra de blocos (a mesma lógica das obras já indexadas: um bloco por capítulo, capítulos longos em partes):
//   - cada seção (apresentação, capítulo, parte, glossário, referências…) vira um bloco "[Capítulo N — Título]";
//   - seção com mais de LIMITE_UM_BLOCO palavras é dividida em n partes de tamanho parecido (≈ ALVO_PALAVRAS), sempre em
//     fronteira de bloco do texto, com título "[… — parte i/n]" (convenção do Da Terra já indexado);
//   - depois, trava de segurança do indexador de temas: nenhum bloco passa de MAX_PALAVRAS_POR_CHUNK (lida de
//     src/indexarTema.js, hoje 2500); excedente é dividido por parágrafo e, se um parágrafo sozinho passar do limite, por
//     frase (dividirEmSubChunks / dividirParagrafoPorFrase, as mesmas funções).
// Não conecta em banco nem chama a API de embeddings. Confere o resultado com o parser real do indexarLivro.js.
//
// Uso: node scripts/preparar-livro-vivo-lote.js [--saida=<pasta>] [slug ...]
//   saída: <saida>/livro-vivo-txt/<slug>.txt  (NÃO sobrescreve livro-vivo-txt/ do projeto, onde está o .txt antigo do Da Terra)

const fs = require('fs');
const path = require('path');
const { textoDoBloco, tituloCompleto, contarPalavras, sha256 } = require('./lote/extrairLivro');
const { PASTA_PADRAO, lerManifesto, gravarManifesto } = require('./lote/manifesto');
const { expandirBlocosParaChunks } = require('../src/indexarTema');
const { parseBlocos } = require('../src/indexarLivro');
const { slugsDoLote } = require('./preparar-obras-lote');

const MAX_PALAVRAS_POR_CHUNK = Number((fs.readFileSync(path.join(__dirname, '..', 'src', 'indexarTema.js'), 'utf8').match(/const MAX_PALAVRAS_POR_CHUNK = (\d+);/) || [])[1]);
if (!MAX_PALAVRAS_POR_CHUNK) throw new Error('MAX_PALAVRAS_POR_CHUNK não encontrado em src/indexarTema.js');
const LIMITE_UM_BLOCO = 700;
const ALVO_PALAVRAS = 450;

const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const limparTitulo = (t) => t.replace(/[\[\]\n]/g, ' ').replace(/\s+/g, ' ').trim();

// Divide as unidades (blocos do texto) em n grupos de tamanho parecido, sem partir nenhuma unidade.
function agrupar(unidades, n) {
  const total = unidades.reduce((a, u) => a + u.palavras, 0);
  const alvo = total / n;
  const grupos = [[]]; let acum = 0;
  for (const u of unidades) {
    const g = grupos[grupos.length - 1];
    if (g.length && acum + u.palavras / 2 > alvo * grupos.length && grupos.length < n) grupos.push([]);
    grupos[grupos.length - 1].push(u); acum += u.palavras;
  }
  return grupos.filter((g) => g.length);
}

function blocosDaObra(modelo) {
  const blocos = [];
  for (const s of modelo.secoes) {
    const unidades = s.blocos.map((b) => textoDoBloco(b)).filter(Boolean).map((t) => ({ texto: t, palavras: contarPalavras(t) }));
    if (!unidades.length) continue;
    const total = unidades.reduce((a, u) => a + u.palavras, 0);
    const base = limparTitulo(tituloCompleto(s));
    if (total <= LIMITE_UM_BLOCO) { blocos.push({ tema: base, corpo: unidades.map((u) => u.texto).join('\n\n') }); continue; }
    const grupos = agrupar(unidades, Math.ceil(total / ALVO_PALAVRAS));
    grupos.forEach((g, i) => blocos.push({ tema: grupos.length > 1 ? `${base} — parte ${i + 1}/${grupos.length}` : base, corpo: g.map((u) => u.texto).join('\n\n') }));
  }
  return blocos;
}

function preparar(slug, saida) {
  const arqModelo = path.join(saida, slug, 'modelo.json');
  if (!fs.existsSync(arqModelo)) throw new Error(`${slug}: rode scripts/preparar-obras-lote.js antes (sem modelo.json)`);
  const modelo = JSON.parse(fs.readFileSync(arqModelo, 'utf8'));
  const base = blocosDaObra(modelo);
  const chunks = expandirBlocosParaChunks(base, MAX_PALAVRAS_POR_CHUNK).map((c) => ({ tema: limparTitulo(c.titulo), corpo: c.corpo }));
  const extra = chunks.length - base.length; // blocos que a trava de 2500 palavras precisou dividir
  for (const c of chunks) {
    if (/^={5,}$/m.test(c.corpo)) throw new Error(`${slug}: corpo com linha "=====" quebraria o parser`);
    if (contarPalavras(c.corpo) > MAX_PALAVRAS_POR_CHUNK) throw new Error(`${slug}: bloco acima do limite: ${c.tema}`);
  }
  const txt = chunks.map((c) => `[${c.tema}]\n${c.corpo}\n==========`).join('\n') + '\n';
  const pasta = path.join(saida, 'livro-vivo-txt');
  fs.mkdirSync(pasta, { recursive: true });
  const arq = path.join(pasta, `${slug}.txt`);
  fs.writeFileSync(arq, txt);

  // Prova com o parser REAL do indexador: mesma quantidade, mesmos títulos, mesmo texto.
  const lidos = parseBlocos(fs.readFileSync(arq, 'utf8'));
  if (lidos.length !== chunks.length) throw new Error(`${slug}: o parser do indexarLivro leu ${lidos.length} blocos, esperado ${chunks.length}`);
  lidos.forEach((b, i) => { if (b.tema !== chunks[i].tema || b.corpo.trim() !== chunks[i].corpo.trim()) throw new Error(`${slug}: bloco ${i + 1} difere depois do parser`); });

  const palavras = chunks.map((c) => contarPalavras(c.corpo));
  const origem = modelo.secoes.reduce((a, s) => a + s.blocos.map(textoDoBloco).reduce((x, t) => x + contarPalavras(t), 0), 0);
  return {
    slug, arquivo: arq, blocos: chunks.length, divididosPelaTrava: extra,
    palavrasMin: Math.min(...palavras), palavrasMax: Math.max(...palavras), palavrasMedia: Math.round(palavras.reduce((a, b) => a + b, 0) / palavras.length),
    palavrasTotal: palavras.reduce((a, b) => a + b, 0), palavrasNoTexto: origem, sha256: sha256(txt)
  };
}

if (require.main === module) {
  const saida = arg('saida') || PASTA_PADRAO;
  const pedidos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const slugs = slugsDoLote(pedidos);
  const manifesto = lerManifesto(saida);
  let falhou = false;
  console.log(`MAX_PALAVRAS_POR_CHUNK (src/indexarTema.js) = ${MAX_PALAVRAS_POR_CHUNK} | um bloco por seção até ${LIMITE_UM_BLOCO} palavras; acima disso, partes de ≈${ALVO_PALAVRAS}`);
  for (const slug of slugs) {
    try {
      const r = preparar(slug, saida);
      if (manifesto.obras[slug]) manifesto.obras[slug].livroVivo = { arquivo: r.arquivo, sha256: r.sha256, blocos: r.blocos, textoSha256: manifesto.obras[slug].texto.sha256 };
      console.log(`ok  ${slug}: ${r.blocos} trechos (palavras por trecho: mín ${r.palavrasMin} / média ${r.palavrasMedia} / máx ${r.palavrasMax}; divididos pela trava de ${MAX_PALAVRAS_POR_CHUNK}: ${r.divididosPelaTrava}) — ${r.arquivo}`);
    } catch (e) { falhou = true; console.error(`ERRO ${slug}: ${e.message}`); }
  }
  gravarManifesto(manifesto, saida);
  process.exitCode = falhou ? 1 : 0;
}

module.exports = { preparar, blocosDaObra, MAX_PALAVRAS_POR_CHUNK };
