// Teste estático da integração comercial do Experimente ZUNI.
// Não inicia servidor, não usa rede, banco, IA, Stripe ou pagamentos.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');

const hub = ler('public/experimente-hub.html');
const loja = ler('public/loja/index.html');
const legado = ler('public/experimente.html');
const servidor = ler('src/server.js');

const VOLUME_I = 'os-bastidores-da-mente-1-a-origem-de-todo-bem-e-de-todo-mal';

function teste(nome, fn) {
  try {
    fn();
    console.log(`  ok   ${nome}`);
  } catch (erro) {
    console.error(`  FAIL ${nome}\n       ${erro.message}`);
    process.exitCode = 1;
  }
}

console.log('Integração comercial — Hub Experimente ZUNI\n');

teste('a rota /experimente serve o hub e a experiência legada continua em /experimente.html', () => {
  assert.ok(servidor.includes("res.sendFile(path.join(__dirname, '../public/experimente-hub.html'));"));
  assert.ok(servidor.includes('/experimente.html (Bastidores)'));
  assert.ok(hub.includes('href="/experimente.html#modulo-livro"'));
});

teste('o hub descobre exclusivamente amostras aprovadas pelo catálogo público', () => {
  assert.ok(hub.includes("fetch('/api/livros')"));
  assert.ok(hub.includes('entrada[1].amostraDisponivel === true'));
  assert.ok(hub.includes("id === 'ela-tem-classe' ? 'Experimentar Ela Tem Classe'"));
  assert.ok(!hub.includes('codigo-feminino'));
});

teste('hub e Loja preservam cupom e origem permitida sem alterar checkout', () => {
  assert.ok(hub.includes("params.get('origem') === 'universo-feminino'"));
  assert.ok(hub.includes("destino.set('cupom', cupom)"));
  assert.ok(loja.includes("id=\"porta-experimente-link\""));
  assert.ok(loja.includes("'/experimente?cupom=' + encodeURIComponent(cupom)"));
  assert.ok(!loja.includes('stripe-session'));
});

teste('Loja só exibe Experimentar para obras marcadas com amostraDisponivel', () => {
  assert.ok(loja.includes("painelExperimentar.hidden = livro.amostraDisponivel !== true"));
  assert.ok(loja.includes("livro.amostraDisponivel === true ? `<span class=\"badge-experimente\">EXPERIMENTE</span>` : ''"));
  assert.ok(loja.includes('id="painel-experimentar"'));
});

teste('as CTAs específicas do Volume I vão ao checkout correto e preservam contexto', () => {
  assert.ok(legado.includes(`livro=${VOLUME_I}`));
  assert.ok(legado.includes('data-checkout-volume-i'));
  assert.ok(legado.includes("origem === 'universo-feminino'"));
  assert.ok(legado.includes("destino.set('cupom', cupom)"));
});

teste('chat, leitor de voz e limites legados permanecem no HTML publicado', () => {
  assert.ok(legado.includes('id="btn-ouvir-capitulo"'));
  assert.ok(legado.includes('id="livro-chat-container"'));
  assert.ok(legado.includes('id="chatInput"'));
  assert.ok(legado.includes('/js/experimente-client.js'));
});

if (!process.exitCode) console.log('\nResultado: 6/6 verificações passaram.');
