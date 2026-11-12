// Rodada 3A — e-mail de entrega dos livros: link "Baixar o livro em PDF" e texto "Leia no site por {N} dias e baixe o PDF
// para guardar." Sem rede, sem servidor, sem Resend: extrai enviarEmailAcessoLivro de src/server.js, troca só o envio
// (./lib/email) por um registro em memória e roda o código real (prazoAcesso e pdfLivro são os de verdade).
// Uso: node scripts/testar-email-livro-pdf.js

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.LIVRO_ACESSO_DIAS = '90';
delete process.env.LIVRO_PDF_BUCKET;

const raiz = path.join(__dirname, '..');
const srv = fs.readFileSync(path.join(raiz, 'src', 'server.js'), 'utf8');
const ini = srv.indexOf('async function enviarEmailAcessoLivro(');
const fim = srv.indexOf('// Prazo de leitura no site depois da compra');
assert.ok(ini > 0 && fim > ini, 'função de e-mail não encontrada em server.js');

const enviados = [];
const requireFalso = (m) => {
  if (m === './lib/email') return { enviarEmail: async (o) => { enviados.push(o); return { sucesso: true }; } };
  return require(path.join(raiz, 'src', m));
};
const { saudacaoEmail } = require('../src/lib/saudacaoEmail');
const enviarEmailAcessoLivro = new Function('require', 'saudacaoEmail', 'console', srv.slice(ini, fim) + '\nreturn enviarEmailAcessoLivro;')(requireFalso, saudacaoEmail, console);

let passaram = 0;
const falhas = [];
async function teste(nome, fn) {
  try { await fn(); passaram++; console.log('  ok   ' + nome); } catch (e) { falhas.push(nome + ' — ' + e.message.split('\n')[0]); console.log('  FAIL ' + nome + ' — ' + e.message.split('\n')[0]); }
}
const expira = new Date('2027-01-20T12:00:00-03:00');
const texto = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

(async () => {
  await teste('livro com PDF: "Leia no site por 90 dias e baixe o PDF para guardar." + link do PDF com o token', async () => {
    enviados.length = 0;
    await enviarEmailAcessoLivro('c@x.com', 'vender-bem-vender-sempre', 'TOK123', expira, undefined, 'Silvio Tarquini');
    assert.strictEqual(enviados.length, 1);
    const { html, to, subject } = enviados[0];
    assert.strictEqual(to, 'c@x.com');
    assert.ok(subject.includes('liberado'));
    const t = texto(html);
    assert.ok(t.includes('Olá, Silvio!'));
    assert.ok(t.includes('Leia no site por 90 dias e baixe o PDF para guardar.'), t);
    assert.ok(t.includes('Baixar o livro em PDF'));
    assert.ok(html.includes('href="https://www.zunisuprema.com.br/livros/vender-bem-vender-sempre/pdf?token=TOK123"'));
    assert.ok(html.includes('href="https://www.zunisuprema.com.br/livros/vender-bem-vender-sempre?token=TOK123"'), 'link de leitura sumiu');
    assert.ok(t.includes('A leitura no site fica disponível até') && t.includes('O PDF é seu para guardar.'));
    assert.ok(!/imprim/i.test(html));
  });
  await teste('livro com PDF e audiolivro: os três links (ler, PDF, ouvir)', async () => {
    enviados.length = 0;
    await enviarEmailAcessoLivro('c@x.com', 'toda-mesa-tem-dois-lados', 'TOK1', expira, 'TOKAUD', 'Ana');
    const { html } = enviados[0];
    assert.ok(html.includes('/livros/toda-mesa-tem-dois-lados?token=TOK1') && html.includes('/livros/toda-mesa-tem-dois-lados/pdf?token=TOK1') && html.includes('/audiolivros/toda-mesa-tem-dois-lados?token=TOKAUD'));
  });
  await teste('os 4 livros à venda recebem o link do PDF', async () => {
    for (const id of ['da-terra-ao-resultado', 'vender-bem-vender-sempre', 'toda-mesa-tem-dois-lados', 'toda-reuniao-tem-duas-pautas']) {
      enviados.length = 0;
      await enviarEmailAcessoLivro('c@x.com', id, 'T', expira, undefined, 'X');
      assert.ok(enviados[0].html.includes(`/livros/${id}/pdf?token=T`), id);
    }
  });
  await teste('livro SEM PDF configurado: sem link de PDF e sem prometer PDF; sem a palavra imprimir', async () => {
    enviados.length = 0;
    await enviarEmailAcessoLivro('c@x.com', 'a-arquitetura-da-decisao-humana', 'TOK9', expira, undefined, '');
    const { html } = enviados[0];
    const t = texto(html);
    assert.ok(!html.includes('/pdf?token='));
    assert.ok(!/PDF/.test(t), t);
    assert.ok(t.includes('O acesso fica disponível até'));
    assert.ok(t.includes('Olá!'));
    assert.ok(!/imprim/i.test(html));
  });
  await teste('prazo vem da configuração (LIVRO_ACESSO_DIAS=90)', async () => {
    const { textoEmailLeituraPdf } = require('../src/lib/prazoAcesso');
    assert.strictEqual(textoEmailLeituraPdf(), 'Leia no site por 90 dias e baixe o PDF para guardar.');
  });

  await teste('frase do prazo por obra: com PDF promete o PDF; sem PDF só a leitura; página /experimente de cada obra aprovada segue a mesma regra', async () => {
    const { textoPrazoLeitura } = require('../src/lib/prazoAcesso');
    const { resolverPdf } = require('../src/lib/pdfLivro');
    const { AMOSTRAS } = require('../src/lib/amostrasExperimente');
    const { renderizarExperimenteObra } = require('../src/lib/experimenteObra');
    assert.strictEqual(textoPrazoLeitura('vender-bem-vender-sempre'), 'Você recebe o livro em PDF para guardar e pode ler no site por 90 dias.');
    assert.strictEqual(textoPrazoLeitura('a-arquitetura-da-decisao-humana'), 'Leitura no site por 90 dias a partir da compra.');
    assert.strictEqual(textoPrazoLeitura(), 'Você recebe o livro em PDF para guardar e pode ler no site por 90 dias.');
    let comPdf = 0, semPdf = 0;
    for (const id of Object.keys(AMOSTRAS).filter((k) => AMOSTRAS[k] && AMOSTRAS[k].aprovada === true)) {
      const r = renderizarExperimenteObra({ livroId: id });
      const html = typeof r === 'string' ? r : (r && r.html) || '';
      if (!/prazo-leitura/.test(html)) continue; // página indisponível (obra fora do catálogo público)
      const promete = html.includes('Você recebe o livro em PDF para guardar');
      assert.strictEqual(promete, !!resolverPdf(id), `${id}: promete PDF = ${promete}, mas resolverPdf = ${!!resolverPdf(id)}`);
      promete ? comPdf++ : semPdf++;
    }
    assert.ok(comPdf >= 1, 'nenhuma página de obra com PDF foi conferida');
    assert.ok(semPdf >= 1, 'nenhuma página de obra SEM PDF foi conferida (era o caso do bug)');
  });

  // Livro-Vivo no e-mail de acesso (só obras com chatDisponivel na ficha)
  const FRASE = (data, comPdf) => `Na página do livro, converse com o Livro-Vivo durante a sua leitura.`;
  const PRAZO_CHAT = (data, comPdf) => `A leitura no site e o Livro-Vivo ficam disponíveis até ${data}.${comPdf ? ' O PDF é seu para guardar.' : ''}`;
  const contar = (texto, trecho) => texto.split(trecho).length - 1;
  await teste('obra com chat e PDF (Fazenda Lucrativa): frase do Livro-Vivo com a data de expiração e "não acompanha o PDF"', async () => {
    enviados.length = 0;
    await enviarEmailAcessoLivro('c@x.com', 'fazenda-lucrativa', 'TOKF', expira, undefined, 'Ana');
    const t = texto(enviados[0].html);
    assert.ok(t.includes(FRASE(expira.toLocaleDateString('pt-BR'), true)), t);
    assert.ok(t.includes(PRAZO_CHAT(expira.toLocaleDateString('pt-BR'), true)), 'linha única de prazo: ' + t);
    assert.strictEqual(contar(t, expira.toLocaleDateString('pt-BR')), 1, 'a data deve aparecer UMA vez só: ' + t);
    assert.ok(!/funciona no site até|não acompanha o PDF|fica disponível até/.test(t), 'sobrou a linha de data antiga: ' + t);
    assert.ok(t.includes('Baixar o livro em PDF') && t.includes('Acessar meu livro'), 'os links existentes sumiram');
  });
  await teste('as 5 obras do lote com PDF recebem a frase; a data é a de expiração do acesso', async () => {
    for (const id of ['da-terra-ao-resultado', 'fazenda-lucrativa', 'a-bussola-do-adolescente', 'situacoes-da-vida-real', 'heranca-de-papel']) {
      enviados.length = 0;
      await enviarEmailAcessoLivro('c@x.com', id, 'T', expira, undefined, 'X');
      assert.ok(texto(enviados[0].html).includes(FRASE(expira.toLocaleDateString('pt-BR'), true)) && texto(enviados[0].html).includes(PRAZO_CHAT(expira.toLocaleDateString('pt-BR'), true)), id);
    }
  });
  await teste('obra com chat e SEM PDF (Ela Tem Classe): a frase sai sem a menção ao PDF', async () => {
    enviados.length = 0;
    await enviarEmailAcessoLivro('c@x.com', 'ela-tem-classe', 'TOKE', expira, undefined, '');
    const t = texto(enviados[0].html);
    assert.ok(t.includes(FRASE(expira.toLocaleDateString('pt-BR'), false)), t);
    assert.ok(t.includes(PRAZO_CHAT(expira.toLocaleDateString('pt-BR'), false)) && contar(t, expira.toLocaleDateString('pt-BR')) === 1, t);
    assert.ok(!/PDF/.test(t), 'prometeu PDF numa obra sem PDF');
  });
  await teste('obra SEM chat na ficha (Vender Bem): nenhuma menção ao Livro-Vivo', async () => {
    enviados.length = 0;
    await enviarEmailAcessoLivro('c@x.com', 'vender-bem-vender-sempre', 'TOKV', expira, undefined, 'X');
    assert.ok(!/Livro-Vivo/.test(enviados[0].html));
    const t = texto(enviados[0].html); assert.ok(t.includes(`A leitura no site fica disponível até ${expira.toLocaleDateString('pt-BR')}. O PDF é seu para guardar.`), 'obra sem chat mudou: ' + t);
  });
  await teste('textoEmailLivroVivo: vazio sem chat ou sem data; frase exata com chat', () => {
    const { textoEmailLivroVivo } = require('../src/lib/prazoAcesso');
    assert.strictEqual(textoEmailLivroVivo({ chatDisponivel: false, temPdf: true, dataExpiracaoFormatada: '20/01/2027' }), '');
    assert.strictEqual(textoEmailLivroVivo({ chatDisponivel: true, temPdf: true, dataExpiracaoFormatada: '' }), '');
    assert.strictEqual(textoEmailLivroVivo({ chatDisponivel: true, temPdf: true, dataExpiracaoFormatada: '20/01/2027' }), 'Na página do livro, converse com o Livro-Vivo durante a sua leitura.');
    const { textoEmailPrazoAcesso } = require('../src/lib/prazoAcesso');
    assert.strictEqual(textoEmailPrazoAcesso({ chatDisponivel: true, temPdf: true, dataExpiracaoFormatada: '20/01/2027' }), 'A leitura no site e o Livro-Vivo ficam disponíveis até 20/01/2027. O PDF é seu para guardar.');
    assert.strictEqual(textoEmailPrazoAcesso({ chatDisponivel: true, temPdf: false, dataExpiracaoFormatada: '20/01/2027' }), 'A leitura no site e o Livro-Vivo ficam disponíveis até 20/01/2027.');
    assert.strictEqual(textoEmailPrazoAcesso({ chatDisponivel: false, temPdf: true, dataExpiracaoFormatada: '20/01/2027' }), 'A leitura no site fica disponível até 20/01/2027. O PDF é seu para guardar.');
    assert.strictEqual(textoEmailPrazoAcesso({ chatDisponivel: false, temPdf: false, dataExpiracaoFormatada: '20/01/2027' }), 'O acesso fica disponível até 20/01/2027.');
  });

  console.log('\nTotal: ' + (passaram + falhas.length) + ' | Passaram: ' + passaram + ' | Falharam: ' + falhas.length);
  if (falhas.length) { console.log('Falhas: ' + falhas.join(' | ')); process.exitCode = 1; return; }
  console.log('OK — e-mail de entrega com PDF.');
})().catch((e) => { console.error(e); process.exitCode = 2; });
