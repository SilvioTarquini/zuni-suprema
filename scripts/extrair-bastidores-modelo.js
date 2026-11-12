#!/usr/bin/env node
// Os Bastidores da Mente (leitor estático de private/livros/<id>/index.html) → modelo.json no formato do pipeline dos lotes
// (<saida>/<slug>/modelo.json + texto.txt), para que scripts/preparar-livro-vivo-lote.js gere os trechos do Livro-Vivo pelo
// MESMO processo das demais obras. SOMENTE LEITURA do HTML; escreve só na pasta de saída (fora do repositório). Não toca em banco.
//
// Estrutura lida: <article class="conteudo-livro"> com h1 (título), p.subtitulo-livro, p.autor-livro, h2.parte-livro (parte),
// h2 ("Capítulo N — Título" ou título avulso), h3 (subtítulo interno), p (parágrafo; <em>/<strong> viram texto simples).
// Confere: (1) cobertura — todas as letras do texto do <article> estão no modelo; (2) trava de resíduos (scripts/lote/residuos.js);
// (3) nenhuma marca de codificação quebrada ("Ã" seguido de byte de continuação, "â€").
//
// Uso: node scripts/extrair-bastidores-modelo.js --saida=<pasta> <livroId> ...

const fs = require('fs');
const path = require('path');
const { varrer } = require('./lote/residuos');
const { textoDoLivro, letras, contar } = require('./lote/extrairLivro');

const arg = (n) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : null; };
const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&apos;': "'" };
const decodificar = (t) => t.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTIDADES[m]).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const limpar = (t) => decodificar(t.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();

function extrair(html) {
  const a = html.indexOf('<article class="conteudo-livro"'); const b = html.indexOf('</article>', a);
  if (a < 0 || b < 0) throw new Error('article.conteudo-livro não encontrado');
  const art = html.slice(a, b);
  const meta = { titulo: '', subtitulo: '', autor: '' };
  const secoes = []; let parte = ''; let atual = null; const fonte = [];
  const re = /<(h1|h2|h3|p|ul|ol)\b([^>]*)>([\s\S]*?)<\/\1>/g; let m;
  while ((m = re.exec(art)) !== null) {
    const [, tag, attrs, interno] = m; const t = limpar(interno); if (!t) continue;
    const cls = (/class="([^"]*)"/.exec(attrs) || [])[1] || '';
    if (tag === 'ul' || tag === 'ol') {
      const itens = [...interno.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((x) => limpar(x[1])).filter(Boolean);
      if (!itens.length) continue;
      if (!atual) { atual = { tipo: 'front', rotulo: '', titulo: meta.titulo || 'Abertura', parte: '', tituloOriginal: meta.titulo, blocos: [] }; secoes.push(atual); }
      atual.blocos.push({ t: 'list', label: '', ordered: tag === 'ol', itens: itens.map((x) => ({ texto: x, html: x })) }); itens.forEach((x) => fonte.push(x)); continue;
    }
    if (tag === 'h1') { meta.titulo = t; continue; }
    if (tag === 'p' && cls.includes('subtitulo-livro')) { meta.subtitulo = t; continue; }
    if (tag === 'p' && cls.includes('autor-livro')) { meta.autor = t; continue; }
    if (tag === 'h2' && cls.includes('parte-livro')) { parte = t; fonte.push(t); continue; }
    if (tag === 'h2') {
      const k = /^(Cap[íi]tulo\s+\d+)\s*[—–-]\s*(.+)$/.exec(t);
      atual = { tipo: k ? 'capitulo' : (secoes.length ? 'back' : 'front'), rotulo: k ? k[1] : '', titulo: k ? k[2] : t, parte: k ? parte : '', tituloOriginal: t, blocos: [] };
      secoes.push(atual); fonte.push(t); continue;
    }
    if (!atual) { atual = { tipo: 'front', rotulo: '', titulo: meta.titulo || 'Abertura', parte: '', tituloOriginal: meta.titulo, blocos: [] }; secoes.push(atual); }
    if (tag === 'h3') { atual.blocos.push({ t: 'sec', texto: t }); fonte.push(t); continue; }
    atual.blocos.push({ t: 'p', texto: t, html: t }); fonte.push(t);
  }
  return { formato: 'estatico-bastidores', meta, secoes: secoes.filter((s) => s.blocos.length), _fonte: fonte.join('\n') };
}

if (require.main === module) {
  const saida = arg('saida'); const ids = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  if (!saida || !ids.length) { console.error('Uso: node scripts/extrair-bastidores-modelo.js --saida=<pasta> <livroId> ...'); process.exit(2); }
  let falhou = false;
  for (const id of ids) {
    try {
      const arq = path.join(__dirname, '..', 'private', 'livros', id, 'index.html');
      const html = fs.readFileSync(arq, 'utf8');
      const quebrados = (html.match(/Ã[\u0080-¿©£³¡§ª]|â€/g) || []).length;
      if (quebrados) throw new Error(`HTML com ${quebrados} marcas de codificação quebrada: corrija os acentos antes de indexar`);
      const modelo = extrair(html);
      const fonte = contar(letras(modelo._fonte)); const artTexto = html.slice(html.indexOf('<article class="conteudo-livro"'), html.indexOf('</article>'));
      const todas = contar(letras(decodificar(artTexto.replace(/<(h1|p)\b[^>]*class="(?:subtitulo|autor)-livro"[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<h1>[\s\S]*?<\/h1>/, '').replace(/<[^>]*>/g, ' '))));
      let faltam = 0; for (const [c, n] of todas) faltam += Math.max(0, n - (fonte.get(c) || 0));
      if (faltam) throw new Error(`${faltam} letras do <article> não chegaram ao modelo`);
      const texto = textoDoLivro(modelo);
      const trava = varrer(texto, { rotulo: 'texto-loja', slug: id });
      if (trava.bloqueios.length) throw new Error(`resíduos BLOQUEANTES: ${JSON.stringify(trava.bloqueios)}`);
      const pasta = path.join(saida, id); fs.mkdirSync(pasta, { recursive: true });
      fs.writeFileSync(path.join(pasta, 'modelo.json'), JSON.stringify({ slug: id, meta: modelo.meta, secoes: modelo.secoes }, null, 1));
      fs.writeFileSync(path.join(pasta, 'texto.txt'), texto + '\n');
      const palavras = texto.split(/\s+/).filter(Boolean).length;
      console.log(`ok  ${id}: ${modelo.secoes.length} seções, ${palavras} palavras, cobertura completa (0 letras faltando), resíduos: bloqueios 0 / avisos ${trava.avisos ? trava.avisos.length : 0}`);
    } catch (e) { falhou = true; console.error(`ERRO ${id}: ${e.message}`); }
  }
  process.exit(falhou ? 1 : 0);
}

module.exports = { extrair };
