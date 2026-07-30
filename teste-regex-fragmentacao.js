// TESTE: Regex da função limparMarkdown() que está fragmentando o texto

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║  TESTE: Regex que está causando fragmentação               ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// A função limparMarkdown com os regexes problemáticos
function limparMarkdown(texto) {
  if (!texto) return texto;

  console.log('ANTES:\n' + texto + '\n');

  // Remove títulos
  texto = texto.replace(/^#+\s*/gm, '');
  console.log('Após remover títulos:\n' + texto + '\n');

  // Remove negrito
  texto = texto.replace(/\*\*(.+?)\*\*/g, '$1');
  console.log('Após remover negrito:\n' + texto + '\n');

  // ===== REGEX PROBLEMÁTICO 1 =====
  console.log('=== TESTANDO REGEX PROBLEMÁTICO ===\n');
  console.log('Regex: /\\*([^\\s*][^*]*[^\\s*])\\*/g');
  console.log('Descrição: Remove *itálico* mas com padrão restritivo\n');

  const regexProblematico1 = /\*([^\s*][^*]*[^\s*])\*/g;
  const matches1 = [...texto.matchAll(regexProblematico1)];

  if (matches1.length > 0) {
    console.log('Matches encontrados:');
    matches1.forEach((m, i) => {
      console.log(`  ${i + 1}. "${m[0]}" → "${m[1]}"`);
    });
  } else {
    console.log('Nenhum match encontrado com esse regex.');
  }

  texto = texto.replace(/\*([^\s*][^*]*[^\s*])\*/g, '$1');
  console.log('\nApós aplicar esse regex:\n' + texto + '\n');

  // ===== REGEX PROBLEMÁTICO 2 =====
  console.log('=== TESTANDO SEGUNDO REGEX ===\n');
  console.log('Regex: /\\*([^\\s*])\\*/g');
  console.log('Descrição: Remove *x* onde x é um caractere\n');

  const regexProblematico2 = /\*([^\s*])\*/g;
  const matches2 = [...texto.matchAll(regexProblematico2)];

  if (matches2.length > 0) {
    console.log('Matches encontrados:');
    matches2.forEach((m, i) => {
      console.log(`  ${i + 1}. "${m[0]}" → "${m[1]}"`);
    });
  } else {
    console.log('Nenhum match encontrado com esse regex.');
  }

  texto = texto.replace(/\*([^\s*])\*/g, '$1');
  console.log('\nApós aplicar esse regex:\n' + texto + '\n');

  return texto.trim();
}

// ===== TESTE COM TEXTO REALISTA =====
console.log('═════════════════════════════════════════════════════════════\n');
console.log('TESTE 1: Texto com *itálico* e **negrito**\n');

const textoTeste1 = `Carlos possui uma *natureza* forte e determinada.
Ele é reconhecido por sua **capacidade** de liderança.
Seu *perfil* profissional destaca-se em *ambientes* desafiadores.
A *razão* de tudo está na sua *essência*.`;

console.log('ENTRADA:\n' + textoTeste1 + '\n');
const resultado1 = limparMarkdown(textoTeste1);
console.log('RESULTADO FINAL:\n' + resultado1 + '\n');

// ===== TESTE 2: Palavras que podem ser confundidas =====
console.log('═════════════════════════════════════════════════════════════\n');
console.log('TESTE 2: Palavras problemáticas\n');

const textoTeste2 = `O *porquê* de tudo é claro.
A *moda* e a *mosca* não combinam.
Há *a* possibilidade de *o* sistema falhar.
Os *e* símbolos podem confundir a lógica.`;

console.log('ENTRADA:\n' + textoTeste2 + '\n');
const resultado2 = limparMarkdown(textoTeste2);
console.log('RESULTADO FINAL:\n' + resultado2 + '\n');

// ===== TESTE 3: Caso específico reportado =====
console.log('═════════════════════════════════════════════════════════════\n');
console.log('TESTE 3: Caso específico (fragmentação reportada)\n');

const textoTeste3 = `Carlos possui a capacidade de ser reconhecido.
A razão de tudo está em sua essência.
Seu *potencial* é evidente no *mercado*.
Há *uma* possibilidade de *o* sistema mudar.`;

console.log('ENTRADA:\n' + textoTeste3 + '\n');
const resultado3 = limparMarkdown(textoTeste3);
console.log('RESULTADO FINAL:\n' + resultado3 + '\n');

console.log('═════════════════════════════════════════════════════════════\n');
console.log('CONCLUSÃO:\n');
console.log('✓ Se houver fragmentação nos resultados acima,');
console.log('  o regex /\\*([^\\s*][^*]*[^\\s*])\\*/g é o culpado.');
console.log('✓ O padrão está removendo caracteres além do marcador *.\n');
