// CLI do benchmark RAG 3.0 (fase C1). SEM chamadas pagas: valida o dataset e imprime o plano e a estimativa de custo.
// Uso: node scripts/rag3-benchmark.js [--validate] [--plan] [--openai-in=5 --openai-out=20]
// O modo pago NÃO existe aqui: ele só é aberto por autorização humana explícita (RAG3_ALLOW_PAID_CALLS + --confirm-cost) em fase posterior.
const path = require('path');
const raiz = path.join(__dirname, '..');
const R = require(path.join(raiz, 'src/rag3'));
const { CASOS } = require(path.join(raiz, 'src/rag3/benchmark/dataset'));
const { validarDataset } = require(path.join(raiz, 'src/rag3/benchmark/validate'));
const { estimarCustoBenchmark, PRECOS_PADRAO } = require(path.join(raiz, 'src/rag3/benchmark/cost'));

const args = process.argv.slice(2);
const arg = (k) => { const a = args.find((x) => x.startsWith('--' + k + '=')); return a ? Number(a.split('=')[1]) : null; };

if (args.includes('--paid') || args.includes('--confirm-cost')) { console.error('BLOQUEADO: o modo pago não é executável por este CLI nesta fase (ver src/rag3/paidGuard.js).'); process.exit(2); }

const v = validarDataset(CASOS);
console.log('dataset:', v.ok ? 'OK' : 'INVÁLIDO', `(${v.total} casos)`, v.ok ? '' : v.erros.join(' | '));
if (!v.ok) process.exit(1);

if (args.includes('--plan') || !args.includes('--validate')) {
  const cfg = R.resolverConfig({}); const atual = R.carregarPromptAtual();
  const arts = []; const add = (variant, provider, chars, outMax) => CASOS.forEach((c) => arts.push({ case_id: c.id, variant, provider, estimated_tokens: { input: Math.ceil(chars / 3.5), output_max: outMax } }));
  add('generic', 'anthropic', 600, cfg.provedores.anthropic.maxTokensSaida);
  add('zuni-openai', 'openai', R.politica.texto.length + cfg.contexto.maxCharsTotal + 1400, cfg.provedores.openai.maxTokensSaida);
  add('zuni-claude', 'anthropic', R.politica.texto.length + cfg.contexto.maxCharsTotal + 1400, cfg.provedores.anthropic.maxTokensSaida);
  add('zuni-current', 'anthropic', atual.systemChatAoVivo.length + 26000 + 600, 1024);
  const pin = arg('openai-in'), pout = arg('openai-out');
  const precos = { ...PRECOS_PADRAO, openai: { entrada: pin, saida: pout } };
  const est = estimarCustoBenchmark({ artefatos: arts, precos });
  console.log('variantes: A generic | B zuni-openai | C zuni-claude | D zuni-current');
  console.log('chamadas de geração:', est.chamadasDeGeracao, '| chamadas de embedding:', est.chamadasDeEmbedding);
  console.log('custo (US$): típico', est.totalTipicoUsd, '| máximo', est.totalMaximoUsd, '| Claude apenas:', est.detalhe.anthropic.usdTipico + '–' + est.detalhe.anthropic.usdMaximo);
  console.log(est.observacao);
  console.log('política:', R.politica.versao, R.politica.hash.slice(0, 12), '| prompt CURRENT:', atual.fingerprint.hash.slice(0, 12), '| limiares calibrados:', cfg.limiares.calibrado);
}
