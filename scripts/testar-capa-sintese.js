// Teste LOCAL da capa nova da Síntese ZUNI Direciona (PDF): servidor real com Supabase/Claude/Resend falsos (sem rede, sem custo).
// Confere: arquivo aprovado instalado, proporção preservada (sem distorção), cobertura da página A4, fallback para a capa vetorial,
// e que o corpo do relatório não foi alterado (o texto da IA continua presente no PDF).
// Uso: node scripts/testar-capa-sintese.js
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const zlib = require('zlib');
const { spawn } = require('child_process');

const SEGREDO = 'segredo-de-teste-local-nao-real-0123456789';
process.env.SESSION_TOKEN_SECRET = SEGREDO;
const raiz = path.join(__dirname, '..');
const T = require(path.join(raiz, 'src/lib/sessionToken'));
const SHA_CAPA_APROVADA_PREFIXO = 'd750089c44f783c3'; // capa-sintese-zuni-direciona.jpg entregue em 09/10/2026 (950x1487)

let total = 0, ok = 0; const falhas = [];
async function teste(nome, fn) { total++; try { await fn(); ok++; console.log(`  ok   ${nome}`); } catch (e) { falhas.push(nome); console.log(`  FAIL ${nome}\n       ${String(e.message).split('\n')[0]}`); } }

function dimensoesJpeg(buf) { let i = 2; while (i < buf.length) { if (buf[i] !== 0xFF) { i++; continue; } const m = buf[i + 1]; if (m >= 0xC0 && m <= 0xC3) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) }; i += 2 + buf.readUInt16BE(i + 2); } return null; }

(async () => {
  const capa = path.join(raiz, 'public/capa-sintese-zuni-direciona.jpg');
  const src = fs.readFileSync(path.join(raiz, 'src/server.js'), 'utf8').replace(/\r\n/g, '\n');
  await teste('arquivo instalado é o aprovado (SHA-256) e tem 950x1487', async () => {
    const buf = fs.readFileSync(capa); assert.ok(crypto.createHash('sha256').update(buf).digest('hex').startsWith(SHA_CAPA_APROVADA_PREFIXO)); assert.deepStrictEqual(dimensoesJpeg(buf), { w: 950, h: 1487 });
  });
  await teste('código: capa em imagem ligada, proporção preservada (cover/center), fallback vetorial mantido, só afeta capa do Direciona', async () => {
    assert.ok(/const CAPA_SINTESE_EM_IMAGEM = true;/.test(src));
    assert.ok(/doc\.image\(capaSintesePath, 0, 0, \{ cover: \[doc\.page\.width, doc\.page\.height\], align: 'center', valign: 'center' \}\)/.test(src));
    assert.ok(!/doc\.image\(capaSintesePath, 0, 0, \{ width: doc\.page\.width, height: doc\.page\.height \}\)/.test(src), 'esticamento antigo removido');
    assert.ok(/capaSinteseComoImagem = CAPA_SINTESE_EM_IMAGEM && !usaCapaAstro\(productType, temMapaNatal\)/.test(src));
    assert.ok(/else \{\s+desenharCapaVetorMentor\(doc, userName, productType\);\s+doc\.addPage\(\);\s+\}/.test(src), 'fallback para capa vetorial se o arquivo faltar');
    assert.ok(/capa-astrologia-numerologia\.png/.test(src), 'capa do Mapa Astral intacta');
  });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zuni-capa-'));
  const seed = path.join(tmp, 'seed.json'); const SESS = 'abababab-1111-4222-8333-444444444447';
  const hist = []; for (let i = 0; i < 6; i++) { hist.push({ role: 'user', message: 'p' + i }); hist.push({ role: 'assistant', message: 'r' + i }); }
  fs.writeFileSync(seed, JSON.stringify({ sessions: [{ session_id: SESS, name: 'Cliente Capa', email: 'capa@example.test', paid: true, message_count: 12, history: hist, product_type: 'chat-mentor' }] }));
  const PORTA = 19100 + Math.floor(Math.random() * 90);
  const env = { ...process.env, PORT: String(PORTA), SESSION_TOKEN_SECRET: SEGREDO, AUTH_CORTE_TS: '0', SUPABASE_URL: 'https://falso.example.test', SUPABASE_KEY: 'chave-falsa', ANTHROPIC_API_KEY: 'chave-falsa', RESEND_API_KEY: 're_falsa', RESEND_FROM_EMAIL: 'ZUNI <nao-responda@example.test>', FAKE_DB_SEED: seed };
  for (const k of ['STRIPE_SECRET_KEY', 'OPENAI_API_KEY']) delete env[k];
  const filho = spawn(process.execPath, ['-r', path.join(raiz, 'scripts/suporte/preload-ambiente-falso.js'), path.join(raiz, 'src/server.js')], { cwd: raiz, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; filho.stdout.on('data', (d) => { log += d; }); filho.stderr.on('data', (d) => { log += d; });
  const get = (caminho, headers) => new Promise((resolve, reject) => { http.get({ host: '127.0.0.1', port: PORTA, path: caminho, headers }, (res) => { const p = []; res.on('data', (d) => p.push(d)); res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(p) })); }).on('error', reject); });
  try {
    let subiu = false; for (let i = 0; i < 160 && !subiu; i++) { await new Promise((r) => setTimeout(r, 250)); try { await get('/api/livros'); subiu = true; } catch (_) { /* aguardando */ } }
    assert.ok(subiu, 'servidor não subiu: ' + log.slice(-200));
    const pdf = await get('/api/relatorio/download/' + SESS, { 'X-Zuni-Sessao': T.gerarTokenSessao(SESS, 'chat', T.VALIDADE_CHAT_MS) });
    await teste('PDF gerado (200, %PDF) e a capa é a imagem 950x1487 — não a capa vetorial', async () => {
      assert.strictEqual(pdf.status, 200); assert.strictEqual(pdf.buf.slice(0, 4).toString(), '%PDF');
      const txt = pdf.buf.toString('latin1'); assert.ok(/\/Subtype \/Image/.test(txt)); assert.ok(/\/Width 950/.test(txt) && /\/Height 1487/.test(txt), 'imagem 950x1487 não embutida');
    });
    // Inflate dos fluxos de conteúdo para ler a matriz de colocação da capa (1ª página).
    const fluxos = []; const bruto = pdf.buf.toString('latin1'); const re = /stream\r?\n/g; let m;
    while ((m = re.exec(bruto))) { const ini = m.index + m[0].length; const fim = bruto.indexOf('endstream', ini); if (fim < 0) break; try { fluxos.push(zlib.inflateSync(pdf.buf.slice(ini, fim)).toString('latin1')); } catch (_) { /* não comprimido/imagem */ } }
    await teste('colocação: escala uniforme pela largura (595,28 x ~931,8 pt), centralizada e recortada na vertical — sem distorção', async () => {
      const alvo = fluxos.find((f) => /\/I\d+ Do/.test(f));
      assert.ok(alvo, 'fluxo da capa não encontrado'); const nums = (alvo.match(/([\-\d.]+) 0 0 ([\-\d.]+) ([\-\d.]+) ([\-\d.]+) cm\s+\/I\d+ Do/) || []).slice(1).map(Number);
      assert.ok(nums.length === 4, 'matriz cm não encontrada: ' + alvo.slice(0, 240).replace(/\n/g, ' | ')); const [sx, sy, tx, ty] = nums;
      assert.ok(Math.abs(Math.abs(sx) - 595.28) < 0.6, 'largura ' + sx); assert.ok(Math.abs(Math.abs(sx) / Math.abs(sy) - 950 / 1487) < 0.003, `proporção ${sx}/${sy}`);
      assert.ok(Math.abs(sy) > 842 && Math.abs(sy) < 940, 'altura ' + sy); assert.ok(Math.abs(tx) < 1, 'x ' + tx);
    });
    await teste('o corpo do relatório continua no PDF (texto da IA presente; capa não o substitui) e há índice', async () => {
      const paginas = (bruto.match(/\/Type \/Page\b/g) || []).length; assert.ok(paginas >= 3, 'páginas: ' + paginas); // capa + índice + corpo
      assert.ok(fluxos.reduce((a, f) => a + f.length, 0) > 400, 'conteúdo do PDF muito pequeno');
    });
  } finally { filho.kill(); }
  console.log(`\nTotal: ${total} | Passaram: ${ok} | Falharam: ${falhas.length}`);
  if (falhas.length) { console.log('Falhas:', falhas.join('; ')); process.exit(1); }
})().catch((e) => { console.error('ERRO FATAL', e.message); process.exit(1); });
