// Desfaz "codificação dupla" (mojibake): texto UTF-8 que foi lido como Windows-1252 e regravado como UTF-8 ("AntÃ­doto" → "Antídoto",
// "â€”" → "—"). Só troca as SEQUÊNCIAS que formam UTF-8 válido quando lidas como bytes cp1252; todo o resto do arquivo (ASCII, acentos já
// corretos, emoji, o widget injetado depois) fica exatamente como está. Nenhuma palavra é alterada, só caracteres não ASCII.
//
// Uso: node scripts/corrigir-encoding-duplo.js [--gravar] <arquivo.html> ...   (sem --gravar: só mede e mostra)
//   Conferências impressas por arquivo: ocorrências de "Ã" e "â€" antes/depois; palavras (separadas por espaço ASCII) antes/depois;
//   "só mudou o que não é ASCII" (texto sem caracteres não ASCII idêntico antes e depois); linhas alteradas.

const fs = require('fs');

// byte cp1252 → caractere Unicode (0x80–0x9F) e inverso
const CP1252 = { 0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ' };
const INVERSO = new Map(Object.entries(CP1252).map(([b, c]) => [c, Number(b)]));
function byteDe(c) {
  const cp = c.codePointAt(0);
  if (cp < 0x80) return cp;
  if (INVERSO.has(c)) return INVERSO.get(c);
  if (cp >= 0xa0 && cp <= 0xff) return cp;
  if (cp >= 0x80 && cp <= 0x9f) return cp; // controles C1 (0x81, 0x8d, 0x8f, 0x90, 0x9d não existem em cp1252 e viram o próprio controle)
  return -1;
}

function corrigir(texto) {
  const dec = new TextDecoder('utf-8', { fatal: true });
  const chars = [...texto]; let saida = ''; let trocas = 0;
  for (let i = 0; i < chars.length;) {
    const b = byteDe(chars[i]);
    const n = b >= 0xc2 && b <= 0xdf ? 1 : b >= 0xe0 && b <= 0xef ? 2 : b >= 0xf0 && b <= 0xf4 ? 3 : 0;
    if (n && i + n < chars.length + 0) {
      const bytes = [b]; let ok = true;
      for (let k = 1; k <= n; k++) { const bk = i + k < chars.length ? byteDe(chars[i + k]) : -1; if (bk < 0x80 || bk > 0xbf) { ok = false; break; } bytes.push(bk); }
      if (ok) { try { saida += dec.decode(Uint8Array.from(bytes)); i += n + 1; trocas++; continue; } catch (e) { /* não é UTF-8 válido: deixa como está */ } }
    }
    saida += chars[i]; i++;
  }
  return { texto: saida, trocas };
}

const conta = (t, re) => (t.match(re) || []).length;
const palavras = (t) => t.split(/[ \t\r\n]+/).filter(Boolean).length;
const soAscii = (t) => t.replace(/[^\x00-\x7f]/g, '');

if (require.main === module) {
  const gravar = process.argv.includes('--gravar');
  const arquivos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  let falhou = false;
  for (const arq of arquivos) {
    const antes = fs.readFileSync(arq, 'utf8'); const { texto: depois, trocas } = corrigir(antes);
    const la = antes.split('\n'); const ld = depois.split('\n');
    const alteradas = la.reduce((n, l, i) => n + (l !== ld[i] ? 1 : 0), 0);
    const r = { arquivo: arq, trocas, 'Ã_antes': conta(antes, /Ã/g), 'Ã_depois': conta(depois, /Ã/g), 'â€_antes': conta(antes, /â€/g), 'â€_depois': conta(depois, /â€/g), palavras_antes: palavras(antes), palavras_depois: palavras(depois), linhas_alteradas: alteradas,
      so_mudou_nao_ascii: soAscii(antes) === soAscii(depois), mesmas_linhas: la.length === ld.length };
    console.log(JSON.stringify(r));
    if (!r.so_mudou_nao_ascii || r.palavras_antes !== r.palavras_depois || !r.mesmas_linhas) { console.log('  !! conferência falhou — arquivo NÃO gravado'); falhou = true; continue; }
    if (gravar) fs.writeFileSync(arq, depois, 'utf8');
  }
  process.exit(falhou ? 1 : 0);
}

module.exports = { corrigir, soAscii };
