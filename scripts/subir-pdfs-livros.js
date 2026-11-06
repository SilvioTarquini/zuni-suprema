#!/usr/bin/env node
// scripts/subir-pdfs-livros.js
//
// Envia os PDFs gerados por scripts/gerar-pdf-livro.js para o Storage PRIVADO do Supabase (único destino: o bucket de
// LIVRO_PDF_BUCKET, padrão "zuni-livros-pdf-private"; ver lib/pdfLivro.js) e confere que o acesso direto, sem URL
// assinada, é negado. Não toca em tabelas.
//
// Por padrão NÃO escreve nada: mostra o plano (dry-run). Só envia com --enviar. Só cria o bucket com --criar-bucket
// (privado, só application/pdf). Não altera as regras de nenhum bucket existente.
//
// Uso: node scripts/subir-pdfs-livros.js [--pasta=<pasta dos PDFs>] [--so=<slug,slug>] [--manifesto=<pasta do manifesto>] [--enviar] [--criar-bucket]
//   Pasta padrão: <temp do sistema>/zuni-pdfs (a mesma do gerador).
//   --so: envia só essas obras (os demais nomes de NOMES_ARQUIVO são ignorados).
//   Manifesto (lote-piloto, scripts/lote/manifesto.js): toda obra que consta no pdf-manifesto.json só é enviada se o hash do
//   PDF, o hash do texto e as travas (resíduos, letras ausentes) baterem com o manifesto; senão o script ABORTA antes de
//   escrever qualquer coisa. Obra que não consta no manifesto (PDFs antigos) segue como sempre — a menos que se passe
//   --exigir-manifesto (aí a obra fora do manifesto também é recusada).

require('dotenv').config();
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { NOMES_ARQUIVO, obterBucket, caminhoPdf } = require('../src/lib/pdfLivro');

const arg = (nome) => { const a = process.argv.find((x) => x.startsWith(`--${nome}=`)); return a ? a.split('=')[1] : null; };
const enviar = process.argv.includes('--enviar');
const criarBucket = process.argv.includes('--criar-bucket');
const pasta = arg('pasta') || path.join(os.tmpdir(), 'zuni-pdfs');
const so = arg('so') ? arg('so').split(',').map((x) => x.trim()).filter(Boolean) : null;
const pastaManifesto = arg('manifesto') || undefined;
const exigirManifesto = process.argv.includes('--exigir-manifesto');
const manifestos = require('./lote/manifesto');
const bucket = obterBucket();

async function status(url) {
  try { return (await fetch(url, { method: 'GET', redirect: 'manual' })).status; } catch (e) { return 'erro: ' + e.message; }
}

(async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) throw new Error('SUPABASE_URL e SUPABASE_KEY são obrigatórios.');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  const itens = Object.entries(NOMES_ARQUIVO).filter(([livroId]) => !so || so.includes(livroId)).map(([livroId, nome]) => ({ livroId, arquivo: path.join(pasta, nome), destino: caminhoPdf(livroId) }));
  for (const i of itens) {
    if (!fs.existsSync(i.arquivo)) throw new Error(`PDF não encontrado: ${i.arquivo} (rode scripts/gerar-pdf-livro.js ${i.livroId} --saida="${pasta}")`);
    i.bytes = fs.statSync(i.arquivo).size;
  }
  if (so) { const falta = so.filter((x) => !NOMES_ARQUIVO[x]); if (falta.length) throw new Error('--so com obra sem nome de arquivo em NOMES_ARQUIVO: ' + falta.join(', ')); }
  // Portão do manifesto: nada é escrito se algum PDF não bater.
  const manifesto = manifestos.lerManifesto(pastaManifesto);
  const problemas = [];
  for (const i of itens) {
    if (manifesto.obras[i.livroId] || exigirManifesto) problemas.push(...manifestos.conferirPdf(i.livroId, i.arquivo, pastaManifesto));
  }
  if (problemas.length) throw new Error(['manifesto recusou o envio:', ...problemas].join('\n  - '));
  console.log('Manifesto: ' + itens.filter((i) => manifesto.obras[i.livroId]).map((i) => i.livroId).join(', ') + ' conferem (hash do PDF e do texto, resíduos 0, letras ausentes 0).');

  const { data: buckets, error: eBuckets } = await supabase.storage.listBuckets();
  if (eBuckets) throw new Error('listBuckets: ' + eBuckets.message);
  const existente = buckets.find((b) => b.name === bucket);
  console.log(`Bucket de destino: ${bucket} — ${existente ? `existe (public: ${existente.public}, tipos: ${JSON.stringify(existente.allowed_mime_types)})` : 'NÃO existe'}`);
  for (const i of itens) console.log(`  ${enviar ? 'enviar' : 'plano '} ${i.livroId} → ${bucket}/${i.destino} (${(i.bytes / 1048576).toFixed(1)} MB)`);

  if (!existente && !criarBucket) throw new Error(`O bucket "${bucket}" não existe. Rode com --criar-bucket (privado, só PDF) ou aponte LIVRO_PDF_BUCKET para um bucket privado que aceite application/pdf.`);
  if (existente && existente.public) throw new Error(`O bucket "${bucket}" é PÚBLICO: os PDFs ficariam abertos. Abortado.`);
  if (existente && Array.isArray(existente.allowed_mime_types) && existente.allowed_mime_types.length && !existente.allowed_mime_types.includes('application/pdf')) {
    throw new Error(`O bucket "${bucket}" só aceita ${JSON.stringify(existente.allowed_mime_types)}: PDF seria recusado. Este script não altera regras de bucket existente.`);
  }
  if (!enviar) { console.log('\n(dry-run) nada foi escrito. Use --enviar para subir.'); return; }

  if (!existente) {
    const { error } = await supabase.storage.createBucket(bucket, { public: false, allowedMimeTypes: ['application/pdf'], fileSizeLimit: 50 * 1024 * 1024 });
    if (error) throw new Error('createBucket: ' + error.message);
    console.log(`Bucket "${bucket}" criado (privado, application/pdf, até 50 MB).`);
  }

  for (const i of itens) {
    const { error } = await supabase.storage.from(bucket).upload(i.destino, fs.readFileSync(i.arquivo), { contentType: 'application/pdf', upsert: true });
    if (error) throw new Error(`upload ${i.livroId}: ${error.message}`);
    const base = process.env.SUPABASE_URL.replace(/\/$/, '');
    const publico = await status(`${base}/storage/v1/object/public/${bucket}/${i.destino}`);
    const semAssinar = await status(`${base}/storage/v1/object/${bucket}/${i.destino}`);
    const { data: ass, error: eAss } = await supabase.storage.from(bucket).createSignedUrl(i.destino, 60, { download: NOMES_ARQUIVO[i.livroId] });
    let assinada = 'sem URL';
    if (!eAss && ass && ass.signedUrl) {
      const r = await fetch(ass.signedUrl, { method: 'GET' });
      assinada = `${r.status} ${r.headers.get('content-type')} ${r.headers.get('content-disposition') || ''}`.trim();
    }
    console.log(`  ok ${i.livroId} → ${bucket}/${i.destino}\n     acesso direto /public: HTTP ${publico} | /object sem assinatura: HTTP ${semAssinar} (esperado 400/403/404)\n     URL assinada (60 s): ${assinada}`);
  }
})().catch((e) => { console.error('ERRO: ' + e.message); process.exitCode = 1; });
