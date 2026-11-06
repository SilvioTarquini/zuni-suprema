#!/usr/bin/env node
// scripts/preparar-obras-lote.js
//
// Prepara o TEXTO de cada obra do lote a partir da cópia da loja (flipbook em _staging). Faz, nesta ordem:
//   1. extrai o texto do flipbook para um modelo único (scripts/lote/extrairLivro.js) e confere a cobertura
//      (nenhuma letra do texto-fonte pode faltar no modelo);
//   2. aplica a limpeza versionada "T" (obras-lote/remocoes/<slug>.json) — só aceita remoção verificável;
//   3. roda a trava de resíduos no texto (scripts/lote/residuos.js); bloqueio = erro, nada é gravado;
//   4. grava em <saida>/<slug>/: texto.txt (texto integral), pdf-fonte.html (fonte do PDF) e o hash de cada peça em
//      <saida>/pdf-manifesto.json. O PDF (scripts/gerar-pdf-lote.js) e o Livro-Vivo
//      (scripts/preparar-livro-vivo-lote.js) saem DESTE mesmo texto, então não podem divergir do HTML da loja.
//
// NÃO escreve em banco, bucket nem repositório (só na pasta de saída, fora do repo).
//
// Uso: node scripts/preparar-obras-lote.js [--fonte=<pasta com <slug>.html e capas/>] [--saida=<pasta>] [slug ...]

const fs = require('fs');
const path = require('path');
const { extrair, textoDoLivro, sha256, conferirCobertura, contarPalavras } = require('./lote/extrairLivro');
const { carregarRemocoes, aplicarRemocoes } = require('./lote/limpeza');
const { varrer } = require('./lote/residuos');
const { montarHtmlPdf } = require('./lote/htmlPdf');
const { lerManifesto, gravarManifesto, sha256Arquivo, PASTA_PADRAO } = require('./lote/manifesto');

const FONTE_PADRAO = path.join(__dirname, '..', '..', '..', 'Prontas para subir à loja', '_staging');
const OBRAS_DO_LOTE = ['da-terra-ao-resultado', 'fazenda-lucrativa', 'a-bussola-do-adolescente', 'situacoes-da-vida-real', 'heranca-de-papel'];
const ROMANCES = new Set(['heranca-de-papel']);

const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };

function preparar(slug, { fonte, saida }) {
  const html = path.join(fonte, `${slug}.html`);
  const capa = path.join(fonte, 'capas', `${slug}.jpg`);
  if (!fs.existsSync(html)) throw new Error(`HTML não encontrado: ${html}`);

  const bruto = extrair(html);
  const cobertura = conferirCobertura(html, bruto);
  const { existe, remocoes, secoesRemovidas } = carregarRemocoes(slug);
  const { modelo, removidos } = aplicarRemocoes(bruto, remocoes, secoesRemovidas);
  if (removidos === 0 && cobertura.faltam !== 0) throw new Error(`${slug}: ${cobertura.faltam} letras do texto-fonte não chegaram ao modelo (${cobertura.exemplos.join(', ')})`);

  const texto = textoDoLivro(modelo);
  const trava = varrer(texto, { rotulo: 'texto-loja' });
  if (trava.bloqueios.length) throw new Error(`${slug}: resíduos BLOQUEANTES no texto: ${JSON.stringify(trava.bloqueios)}`);

  const pastaObra = path.join(saida, slug);
  fs.mkdirSync(pastaObra, { recursive: true });
  const htmlPdf = montarHtmlPdf(modelo, capa, { romance: ROMANCES.has(slug) });
  fs.writeFileSync(path.join(pastaObra, 'texto.txt'), texto + '\n');
  fs.writeFileSync(path.join(pastaObra, 'pdf-fonte.html'), htmlPdf);
  fs.writeFileSync(path.join(pastaObra, 'modelo.json'), JSON.stringify({ slug, meta: modelo.meta, secoes: modelo.secoes }, null, 1));

  return {
    slug, formato: modelo.formato,
    htmlLoja: { arquivo: html, sha256: sha256Arquivo(html), bytes: fs.statSync(html).size },
    capa: { arquivo: capa, sha256: fs.existsSync(capa) ? sha256Arquivo(capa) : null },
    texto: { sha256: sha256(texto), palavras: contarPalavras(texto), secoes: modelo.secoes.length },
    pdfFonte: { sha256: sha256(htmlPdf) },
    limpeza: { arquivoDeRemocoes: existe, remocoesAplicadas: removidos },
    residuos: { bloqueios: trava.bloqueios.length, avisos: trava.avisos },
    cobertura: { letrasFonte: cobertura.letrasFonte, faltam: cobertura.faltam },
    preparadoEm: new Date().toISOString()
  };
}

if (require.main === module) {
  const fonte = arg('fonte') || FONTE_PADRAO;
  const saida = arg('saida') || PASTA_PADRAO;
  const pedidos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const slugs = pedidos.length ? pedidos : OBRAS_DO_LOTE;
  const manifesto = lerManifesto(saida);
  let falhou = false;
  for (const slug of slugs) {
    try {
      const r = preparar(slug, { fonte, saida });
      const anterior = manifesto.obras[slug];
      // Texto mudou → o PDF antigo deixa de valer (o hash do texto no PDF não bate mais).
      const mesmoTexto = anterior && anterior.texto.sha256 === r.texto.sha256;
      manifesto.obras[slug] = { ...r, pdf: mesmoTexto ? anterior.pdf : undefined, livroVivo: mesmoTexto ? anterior.livroVivo : undefined };
      console.log(`ok  ${slug}: ${r.texto.secoes} seções, ${r.texto.palavras} palavras, cobertura ${r.cobertura.faltam === 0 ? 'completa' : 'FALTAM ' + r.cobertura.faltam}, remoções ${r.limpeza.remocoesAplicadas}, resíduos: bloqueios ${r.residuos.bloqueios} / avisos ${r.residuos.avisos.length}`);
      for (const a of r.residuos.avisos) console.log(`     aviso: ${a.regra} ×${a.ocorrencias} — "${a.contexto}"`);
    } catch (e) { falhou = true; console.error(`ERRO ${slug}: ${e.message}`); }
  }
  manifesto.atualizadoEm = new Date().toISOString();
  gravarManifesto(manifesto, saida);
  process.exitCode = falhou ? 1 : 0;
}

module.exports = { preparar, OBRAS_DO_LOTE, FONTE_PADRAO };
