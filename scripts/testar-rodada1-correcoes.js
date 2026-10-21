// Teste local (sem rede, sem Supabase, sem Stripe, sem e-mail, sem servidor) da Rodada 1 de correções pós-compra:
//   A1 capa inteira no hub e no painel da loja; A2 textos do hub; A3 aviso por obra; A4 e-mail no Stripe e
//   aviso digital neutro; A5 saudação do e-mail de entrega.
// Uso: node scripts/testar-rodada1-correcoes.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_KEY;

const raiz = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');
const { renderizarExperimenteObra } = require('../src/lib/experimenteObra');
const { saudacaoEmail } = require('../src/lib/saudacaoEmail');

let passaram = 0;
const falhas = [];
function teste(nome, fn) {
  try { fn(); passaram++; console.log('  ok   ' + nome); } catch (e) { falhas.push(nome + ' — ' + e.message); console.log('  FAIL ' + nome + ' — ' + e.message); }
}

const AVISO_SAUDE = 'Conteúdo de caráter informativo, que não substitui o acompanhamento de um profissional de saúde.';
const AVISO_TERRA = 'Conteúdo de caráter informativo. Doses, defensivos, medicamentos veterinários, projetos de irrigação e financiamentos devem ser definidos com um responsável técnico habilitado.';
const html = (id, deps) => renderizarExperimenteObra({ livroId: id }, deps).html;

const hub = ler('public/experimente-hub.html');
teste('A1 hub: capa sem max-height e sem cover (aspect 2/3 + contain)', () => {
  const regra = hub.match(/\.obra img \{[^}]*\}/)[0];
  assert.ok(/aspect-ratio:2\/3/.test(regra) && /object-fit:contain/.test(regra), regra);
  assert.ok(!/max-height/.test(regra) && !/cover/.test(regra), regra);
});
teste('A1 loja: painel de detalhe com object-fit contain', () => {
  const loja = ler('public/loja/index.html');
  const regra = loja.match(/\.painel-capa img \{[^}]*\}/)[0];
  assert.ok(/object-fit: contain/.test(regra), regra);
});
teste('A2 hub: texto novo, frase de disponibilidade removida, botão padronizado', () => {
  assert.ok(hub.includes('Leia ou ouça um trecho real de cada obra antes de decidir. Novos títulos aparecem aqui assim que ficam prontos.'));
  assert.ok(!hub.includes('somente degustações editoriais já aprovadas'));
  assert.ok(!hub.includes('A disponibilidade é confirmada diretamente pelo catálogo da ZUNI.'));
  assert.ok(hub.includes("'Ler trecho da obra'"));
});
teste('A3 da-terra: aviso próprio (sem aviso de saúde)', () => {
  const h = html('da-terra-ao-resultado');
  assert.ok(h.includes(AVISO_TERRA), 'aviso novo ausente');
  assert.ok(!h.includes('profissional de saúde'), 'aviso de saúde ainda presente');
});
teste('A3 as 3 obras de negócios: nenhum aviso', () => {
  for (const id of ['vender-bem-vender-sempre', 'toda-mesa-tem-dois-lados', 'toda-reuniao-tem-duas-pautas']) {
    assert.ok(!html(id).includes('class="aviso"'), id + ' tem aviso');
  }
});
teste('A3 ela-tem-classe continua sem aviso; avisoInformativo:true mantém o texto de saúde exato', () => {
  assert.ok(!html('ela-tem-classe').includes('class="aviso"'));
  const { obterAmostra } = require('../src/lib/amostrasExperimente');
  const base = obterAmostra('ela-tem-classe');
  const h = html('ela-tem-classe', { amostra: () => ({ ...base, avisoInformativo: true }) });
  assert.ok(h.includes('<p class="aviso">' + AVISO_SAUDE + '</p>'));
});
teste('A3 loja Empreender e Crescer: aviso por obra (só da-terra)', () => {
  const emp = ler('public/loja/empreender-e-crescer/index.html');
  assert.ok(emp.includes("aviso: '" + AVISO_TERRA + "'"));
  assert.strictEqual((emp.match(/\baviso: '/g) || []).length, 1);
  assert.ok(!/saude: true/.test(emp));
});
teste('A4 servidor: customer_email só com e-mail de formato válido, apenas na sessão de livros', () => {
  const srv = ler('src/server.js');
  assert.strictEqual((srv.match(/customer_email/g) || []).length, 1);
  const i = srv.indexOf('customer_email');
  const antes = srv.lastIndexOf("app.post('", i);
  assert.ok(srv.slice(antes, antes + 60).includes('/api/checkout/livro/stripe-session'));
});
teste('A4 checkout-livro: aviso digital sem vermelho', () => {
  const regra = ler('public/checkout-livro.html').match(/\.aviso-digital \{[^}]*\}/)[0];
  assert.ok(!/#F0997B|#D85A30/i.test(regra), regra);
  assert.ok(!/#F5C4B3/i.test(ler('public/checkout-livro.html')));
});
teste('A5 saudação: primeiro nome, vazio, só espaços, não-string e HTML escapado', () => {
  assert.strictEqual(saudacaoEmail('Silvio Tarquini'), 'Olá, Silvio!');
  assert.strictEqual(saudacaoEmail('  maria  '), 'Olá, maria!');
  for (const v of ['', '   ', null, undefined, 42]) assert.strictEqual(saudacaoEmail(v), 'Olá!');
  assert.ok(!saudacaoEmail('<script>x</script> Z').includes('<script>'));
});
teste('A5 servidor: e-mail usa saudacaoEmail e os dois fluxos passam o nome', () => {
  const srv = ler('src/server.js');
  assert.ok(srv.includes('<p>${saudacaoEmail(nome)}</p>'));
  assert.ok(/acessoAudiolivro\?\.token, nome\)/.test(srv));
  assert.ok(/acessoAudiolivro\?\.token, pedido\.nome\)/.test(srv));
  assert.ok(/\{ nome: name\.trim\(\)\.slice\(0, 120\) \}/.test(srv));
});

console.log('\nTotal: ' + (passaram + falhas.length) + ' | Passaram: ' + passaram + ' | Falharam: ' + falhas.length);
if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
console.log('OK — Rodada 1 (A1–A5) verificada.');
