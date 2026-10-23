// Teste local (sem rede, sem servidor, sem banco) da remoção do botão de imprimir/PDF dos 4 livros à venda.
//   - HTML servido das 4 obras: patch aplicado (sem [LEITOR_PATCH_FALHOU]) e sem nenhum controle de imprimir/PDF;
//   - o mesmo patch com { semImpressao: false } (usado só pela auditoria) ainda tem o controle: a remoção é a única diferença;
//   - o botão "Baixar" (.html) de Vender Bem e Toda Reunião saiu: o único download é o "Baixar PDF" (rota /livros/<id>/pdf);
//   - qualquer outro livro sai idêntico, com ou sem a opção.
// Uso: node scripts/testar-sem-impressao.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { lerLivroComPatch } = require('../src/lib/leitorMobile');
const { ehLivroSemImpressao } = require('../src/lib/leitorSemImpressao');

const RAIZ = path.join(__dirname, '..', 'private', 'livros');
const arquivo = (id) => path.join(RAIZ, id, 'index.html');
const QUATRO = ['da-terra-ao-resultado', 'vender-bem-vender-sempre', 'toda-mesa-tem-dois-lados', 'toda-reuniao-tem-duas-pautas'];
// Controles de imprimir/PDF, com e sem escape de JSON (o bundle guarda o HTML do leitor como string JSON).
const CONTROLES = /btnPrint|printBtn|PDF\/Imprimir|>Imprimir|Baixar em PDF|window\.print/;
const COM_CONTROLE = {
  'da-terra-ao-resultado': /printBtn/,
  'vender-bem-vender-sempre': /btnPrint/,
  'toda-mesa-tem-dois-lados': /Baixar em PDF/,
  'toda-reuniao-tem-duas-pautas': /btnPrint/
};

let passaram = 0;
const falhas = [];
async function teste(nome, fn) {
  try { await fn(); passaram++; console.log('  ok   ' + nome); } catch (e) { falhas.push(nome + ' — ' + e.message.split('\n')[0]); console.log('  FAIL ' + nome + ' — ' + e.message.split('\n')[0]); }
}

(async () => {
  const msgs = [];
  const orig = console.error;
  console.error = (...a) => { msgs.push(a.join(' ')); };

  await teste('a lista de livros sem impressão é exatamente os 4 à venda', async () => {
    const todos = fs.readdirSync(RAIZ).filter((d) => !d.startsWith('_'));
    assert.deepStrictEqual(todos.filter(ehLivroSemImpressao).sort(), [...QUATRO].sort());
  });

  for (const id of QUATRO) {
    const servido = await lerLivroComPatch(id, arquivo(id));
    const comImp = await lerLivroComPatch(id, arquivo(id), { semImpressao: false });
    await teste(`${id}: servido sem controle de imprimir nem window.print, com "Baixar PDF" apontando para /pdf`, async () => {
      assert.ok(/Baixar PDF/.test(servido) && /'\/pdf'/.test(servido), 'sem o botão "Baixar PDF" ou sem a rota /pdf');
      assert.ok(!msgs.some((m) => m.includes('[LEITOR_PATCH_FALHOU]') && m.includes(id)), msgs.join(' '));
      assert.ok(!CONTROLES.test(servido), 'ainda há controle de impressão: ' + (servido.match(CONTROLES) || [])[0]);
    });
    await teste(`${id}: com { semImpressao:false } o controle continua lá (só a remoção difere)`, async () => {
      assert.ok(COM_CONTROLE[id].test(comImp), 'a variante de medição perdeu o controle');
      assert.ok(comImp !== servido && !/Baixar PDF/.test(comImp), 'a variante de medição deveria ser o leitor com impressão, sem o botão novo');
    });
  }

  await teste('Vender Bem e Toda Reunião: o botão "Baixar" (.html) saiu e o único download é o "Baixar PDF"', async () => {
    for (const id of ['vender-bem-vender-sempre', 'toda-reuniao-tem-duas-pautas']) {
      const s = await lerLivroComPatch(id, arquivo(id));
      assert.ok(!/btnDownload/.test(s), id + ' ainda tem btnDownload');
      assert.ok(/id=\\"btnPdf\\"/.test(s), id + ' sem btnPdf');
    }
  });

  await teste('outros livros: idênticos com e sem a opção (nada mais mudou)', async () => {
    const outros = fs.readdirSync(RAIZ).filter((d) => !d.startsWith('_') && !QUATRO.includes(d) && fs.existsSync(arquivo(d)));
    assert.ok(outros.length >= 30, 'poucos livros: ' + outros.length);
    for (const id of outros.slice(0, 6)) {
      const a = await lerLivroComPatch(id, arquivo(id));
      const b = await lerLivroComPatch(id, arquivo(id), { semImpressao: false });
      assert.ok(a === b, id + ' mudou');
    }
  });

  console.error = orig;
  console.log('\nTotal: ' + (passaram + falhas.length) + ' | Passaram: ' + passaram + ' | Falharam: ' + falhas.length);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exit(1); }
  console.log('OK — sem controle de imprimir/PDF nos 4 livros à venda; demais livros intactos.');
})().catch((e) => { console.error(e); process.exit(2); });
