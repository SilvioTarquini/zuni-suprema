#!/usr/bin/env node
// scripts/subir-html-livros.js
//
// Envia o HTML (flipbook) das obras do lote para o Storage PRIVADO do Supabase: bucket LIVRO_HTML_BUCKET (padrão
// "zuni-livros-html-private", ver lib/htmlLivroStorage.js), caminho html/<slug>.html — o mesmo que a rota GET /livros/:id lê
// quando a obra não está no disco. Depois do envio baixa o objeto de volta e confere o sha256 com o manifesto, e confere que
// o acesso direto, sem URL assinada, é negado. Não toca em tabelas.
//
// SEGURANÇA (mesmo padrão de subir-pdfs-livros.js):
//   - por padrão NÃO escreve nada: mostra o plano (dry-run). Só envia com --enviar. Só cria o bucket com --criar-bucket
//     (privado, só text/html, até 20 MB). Nunca altera regras de bucket existente; recusa bucket PÚBLICO;
//   - portão do manifesto (scripts/lote/manifesto.js): o HTML precisa bater, byte a byte, com o hash do manifesto
//     (com ou sem o bloco do widget do Livro-Vivo); senão aborta antes de escrever qualquer coisa;
//   - NÃO sobrescreve objeto existente. Para trocar uma obra já enviada: --substituir=<slug> (e o objeto antigo é baixado
//     para <pasta do manifesto>/backup/ antes de ser trocado).
//
// Uso: node scripts/subir-html-livros.js --so=<slug,slug> [--fonte=<pasta dos HTMLs>] [--manifesto=<pasta>] [--enviar]
//        [--criar-bucket] [--substituir=<slug,slug>]
//   Pasta-fonte padrão: a mesma do preparar-obras-lote.js (_staging).

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { obterBucket, caminhoHtml } = require('../src/lib/htmlLivroStorage');
const M = require('./lote/manifesto');
const { FONTE_PADRAO } = require('./preparar-obras-lote');

const arg = (nome) => { const a = process.argv.find((x) => x.startsWith(`--${nome}=`)); return a ? a.slice(nome.length + 3) : null; };
const lista = (v) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
const enviar = process.argv.includes('--enviar');
const criarBucket = process.argv.includes('--criar-bucket');
const so = lista(arg('so'));
const substituir = lista(arg('substituir'));
const fonte = arg('fonte') || FONTE_PADRAO;
const pastaManifesto = arg('manifesto') || undefined;
const bucket = obterBucket();

async function status(url) {
  try { return (await fetch(url, { method: 'GET', redirect: 'manual' })).status; } catch (e) { return 'erro: ' + e.message; }
}

(async () => {
  if (!so.length) throw new Error('informe --so=<slug,slug> (nada é enviado "por padrão para todas")');
  const itens = so.map((slug) => ({ slug, arquivo: path.join(fonte, `${slug}.html`), destino: caminhoHtml(slug) }));
  const problemas = [];
  for (const i of itens) problemas.push(...M.conferirHtmlLoja(i.slug, i.arquivo, pastaManifesto));
  if (problemas.length) throw new Error(['manifesto recusou o envio:', ...problemas].join('\n  - '));
  for (const i of itens) i.bytes = fs.statSync(i.arquivo).size;
  console.log(`Manifesto: ${so.join(', ')} conferem (hash do HTML).`);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) throw new Error('SUPABASE_URL e SUPABASE_KEY são obrigatórios.');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  const { data: buckets, error: eBuckets } = await supabase.storage.listBuckets();
  if (eBuckets) throw new Error('listBuckets: ' + eBuckets.message);
  const existente = buckets.find((b) => b.name === bucket);
  console.log(`Bucket de destino: ${bucket} — ${existente ? `existe (public: ${existente.public}, tipos: ${JSON.stringify(existente.allowed_mime_types)})` : 'NÃO existe'}`);
  if (!existente && !criarBucket) throw new Error(`O bucket "${bucket}" não existe. Rode com --criar-bucket (privado, só text/html).`);
  if (existente && existente.public) throw new Error(`O bucket "${bucket}" é PÚBLICO: os livros ficariam abertos. Abortado.`);
  if (existente && Array.isArray(existente.allowed_mime_types) && existente.allowed_mime_types.length && !existente.allowed_mime_types.includes('text/html')) {
    throw new Error(`O bucket "${bucket}" só aceita ${JSON.stringify(existente.allowed_mime_types)}: HTML seria recusado. Este script não altera regras de bucket existente.`);
  }

  for (const i of itens) {
    let jaExiste = false;
    if (existente) {
      const { data } = await supabase.storage.from(bucket).list('html', { search: `${i.slug}.html`, limit: 5 });
      jaExiste = !!(data && data.some((o) => o.name === `${i.slug}.html`));
    }
    i.jaExiste = jaExiste;
    console.log(`  ${enviar ? 'enviar' : 'plano '} ${i.slug} → ${bucket}/${i.destino} (${(i.bytes / 1048576).toFixed(2)} MB)${jaExiste ? (substituir.includes(i.slug) ? ' — SUBSTITUI o existente (backup antes)' : ' — JÁ EXISTE (recusado sem --substituir)') : ''}`);
    if (jaExiste && !substituir.includes(i.slug)) problemas.push(`${i.slug}: objeto já existe no bucket; use --substituir=${i.slug} se for a intenção`);
  }
  if (problemas.length) throw new Error(problemas.join('\n  - '));
  if (!enviar) { console.log('\n(dry-run) nada foi escrito. Use --enviar para subir.'); return; }

  if (!existente) {
    const { error } = await supabase.storage.createBucket(bucket, { public: false, allowedMimeTypes: ['text/html'], fileSizeLimit: 20 * 1024 * 1024 });
    if (error) throw new Error('createBucket: ' + error.message);
    console.log(`Bucket "${bucket}" criado (privado, text/html, até 20 MB).`);
  }
  for (const i of itens) {
    if (i.jaExiste) {
      const { data, error } = await supabase.storage.from(bucket).download(i.destino);
      if (error) throw new Error(`backup de ${i.slug}: ${error.message}`);
      const pasta = path.join(pastaManifesto || M.PASTA_PADRAO, 'backup'); fs.mkdirSync(pasta, { recursive: true });
      const dest = path.join(pasta, `${i.slug}.html.${Date.now()}.bak`);
      fs.writeFileSync(dest, Buffer.from(await data.arrayBuffer()));
      console.log(`  backup do objeto antigo: ${dest}`);
    }
    const { error } = await supabase.storage.from(bucket).upload(i.destino, fs.readFileSync(i.arquivo), { contentType: 'text/html', upsert: substituir.includes(i.slug) });
    if (error) throw new Error(`upload ${i.slug}: ${error.message}`);
    const { data: volta, error: eVolta } = await supabase.storage.from(bucket).download(i.destino);
    if (eVolta) throw new Error(`conferência de ${i.slug}: ${eVolta.message}`);
    const hash = require('crypto').createHash('sha256').update(Buffer.from(await volta.arrayBuffer())).digest('hex');
    const base = process.env.SUPABASE_URL.replace(/\/$/, '');
    const publico = await status(`${base}/storage/v1/object/public/${bucket}/${i.destino}`);
    const semAssinar = await status(`${base}/storage/v1/object/${bucket}/${i.destino}`);
    console.log(`  ok ${i.slug} → ${bucket}/${i.destino}\n     sha256 do objeto baixado: ${hash}\n     sha256 do arquivo local : ${M.sha256Arquivo(i.arquivo)}  ${hash === M.sha256Arquivo(i.arquivo) ? '(IGUAIS)' : '(DIFERENTES!)'}\n     acesso direto /public: HTTP ${publico} | /object sem assinatura: HTTP ${semAssinar} (esperado 400/403/404)`);
    if (hash !== M.sha256Arquivo(i.arquivo)) throw new Error(`${i.slug}: objeto no bucket ≠ arquivo local`);
  }
})().catch((e) => { console.error('ERRO: ' + e.message); process.exitCode = 1; });
