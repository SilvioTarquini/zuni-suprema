'use strict';
// rag3/currentAdapter.js — reproduz a LÓGICA do pipeline de produção atual (variante D do benchmark) SEM alterá-lo e SEM importá-lo
// (server.js sobe o servidor ao ser carregado). O prompt é extraído do texto do server.js em tempo de execução, só leitura;
// o fingerprint vai nos artefatos do benchmark para ligar cada resultado à versão do prompt vigente.
const fs = require('fs');
const path = require('path');
const { sha256 } = require('./util');

const CAMINHO_SERVER = path.join(__dirname, '..', 'server.js');

// Mesmo texto que o handler /api/chat acrescenta quando productType === 'chat-mentor' (conferido por teste de deriva).
const NOMENCLATURA_CHAT_MENTOR = `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nNOMENCLATURA DESTA SESSÃO (ZUNI Direciona)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\nO documento final entregue ao fim desta sessão chama-se "Síntese ZUNI Direciona" — nunca "Dossiê". Sempre que for mencioná-lo (inclusive no encerramento e em qualquer recomendação de leitura do acervo), use exatamente esse nome.`;

let cache = null;

function carregarPromptAtual({ caminhoServer = CAMINHO_SERVER } = {}) {
  if (cache && cache.caminho === caminhoServer) return cache.valor;
  const src = fs.readFileSync(caminhoServer, 'utf8');
  const ini = src.indexOf('const SYSTEM_PROMPT = `');
  const marcaFim = 'const SYSTEM_PROMPT_CHAT_AO_VIVO = SYSTEM_PROMPT + ACERVO_ZUNI_BLOCK;';
  const fim = src.indexOf(marcaFim, ini);
  if (ini < 0 || fim < 0) throw new Error('RAG3_PROMPT_ATUAL_NAO_ENCONTRADO');
  const trecho = src.slice(ini, fim + marcaFim.length);
  const req = (p) => require(p.startsWith('.') ? path.resolve(path.dirname(caminhoServer), p) : p);
  const { SYSTEM_PROMPT, ACERVO_ZUNI_BLOCK, SYSTEM_PROMPT_CHAT_AO_VIVO } = new Function('require', trecho + '; return { SYSTEM_PROMPT, ACERVO_ZUNI_BLOCK, SYSTEM_PROMPT_CHAT_AO_VIVO };')(req);
  const nomeOk = src.includes('NOMENCLATURA DESTA SESSÃO (ZUNI Direciona)');
  const valor = { systemChatAoVivo: SYSTEM_PROMPT_CHAT_AO_VIVO, systemBase: SYSTEM_PROMPT, acervoBlock: ACERVO_ZUNI_BLOCK, fingerprint: { caracteres: SYSTEM_PROMPT_CHAT_AO_VIVO.length, hash: sha256(SYSTEM_PROMPT_CHAT_AO_VIVO + NOMENCLATURA_CHAT_MENTOR), nomenclaturaConfere: nomeOk } };
  cache = { caminho: caminhoServer, valor };
  return valor;
}

// Recuperação ATUAL: embedding só da última mensagem; busca padrão (5) ou ranqueada (tema); sem título/fonte no contexto.
async function recuperarComoAtual({ message, theme = null, embedder, store }) {
  const [vetor] = await embedder.embed([String(message || '')]);
  const blocos = await store.searchCurrent({ embedding: vetor, theme, total: 5 });
  return { blocos, conhecimento: blocos.map((b) => b.text), embeddingsExecutados: 1 };
}

// Requisição como o handler /api/chat monta hoje (mensagem + contexto colado ao final; histórico com papéis user/assistant).
function buildCurrentRequest({ history = [], message, conhecimento = [], productType = 'chat-mentor', promptAtual = null }) {
  const p = promptAtual || carregarPromptAtual();
  const contexto = conhecimento.length > 0 ? `\n\nConhecimento relevante da base ZUNI Suprema:\n${conhecimento.join('\n\n')}` : '';
  const mensagens = [...history.filter((m) => m && (m.role === 'user' || m.role === 'assistant')).map((m) => ({ role: m.role, content: m.content })), { role: 'user', content: `${message}${contexto}` }];
  const system = p.systemChatAoVivo + (productType === 'chat-mentor' ? NOMENCLATURA_CHAT_MENTOR : '');
  return { variante: 'current', systemText: system, messages: mensagens, hashes: { politica: sha256(system), knowledgePack: sha256(contexto), mensagens: sha256(JSON.stringify(mensagens)) }, meta: { statusConhecimento: conhecimento.length ? 'found-unvalidated' : 'none', modeloAtual: 'claude-sonnet-4-6', maxTokensAtual: 1024, fingerprint: p.fingerprint } };
}

module.exports = { carregarPromptAtual, recuperarComoAtual, buildCurrentRequest, NOMENCLATURA_CHAT_MENTOR };
