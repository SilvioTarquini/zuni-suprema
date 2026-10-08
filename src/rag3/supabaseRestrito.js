'use strict';
// rag3/supabaseRestrito.js — CONTENÇÃO OPERACIONAL do acesso ao Supabase, para a execução INTERNA do benchmark (Candidate RAG 3.0).
// NÃO é menor privilégio real e NÃO autoriza uso em produção: a identidade (sb_secret) continua privilegiada; a contenção só vale DENTRO deste processo controlado.
//
// Camadas (todas obrigatórias no caminho do benchmark):
//  1. `criarFetchSupabaseRestrito`: transporte que só deixa passar HTTPS POST para os caminhos EXATOS das duas RPCs de busca, na origem autorizada.
//     A comparação é por IGUALDADE do texto completo da URL (nada de substring/regex): qualquer query, fragmento, userinfo, porta, caixa diferente,
//     segmento de ponto, codificação alternativa, barra final, outro host/esquema ou outro caminho/método é bloqueado ANTES de sair do processo.
//     Redirecionamentos são proibidos (redirect:'error' forçado; resposta 3xx/redirected → bloqueio). Corpo só em string e limitado; sem dispatcher/agent alternativos.
//  2. `criarClienteSupabaseRestrito`: o cliente supabase-js é criado AQUI, com esse transporte em TODOS os subsistemas HTTP (rest, auth, storage, functions) e com o
//     transporte de realtime (WebSocket, que não passa por fetch) desativado; o chamador recebe apenas uma FACHADA { rpc, estatisticas } — o cliente bruto
//     (com .from/.storage/.auth/.functions/.channel) não é exportado nem alcançável.
const ORIGEM_SUPABASE_AUTORIZADA = 'https://yirxjunmjfnajotcnywc.supabase.co';
const RPCS_PERMITIDAS = Object.freeze(['buscar_documentos', 'buscar_documentos_ranqueado']);
const MAX_CORPO_BYTES = 262144; // um embedding de 1.536 números cabe com folga
const CABECALHOS_PROIBIDOS = Object.freeze(['x-http-method-override', 'x-method-override', 'x-http-method']);
const FORMATO_ORIGEM = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;

class RequisicaoSupabaseBloqueada extends Error {
  constructor(motivo) { super('RAG3_REQUISICAO_SUPABASE_BLOQUEADA'); this.name = 'RequisicaoSupabaseBloqueada'; this.codigo = 'supabase_bloqueado'; this.motivo = motivo; }
}
function erroOrigem() { const e = new Error('RAG3_SUPABASE_ORIGEM_NAO_AUTORIZADA'); e.codigo = 'supabase_origem_nao_autorizada'; return e; }

/** A origem informada (p.ex. SUPABASE_URL) precisa ser EXATAMENTE a autorizada (com ou sem uma barra final). Nunca imprime valores. */
function validarOrigem(url, origemAutorizada = ORIGEM_SUPABASE_AUTORIZADA) {
  if (!FORMATO_ORIGEM.test(String(origemAutorizada))) throw erroOrigem();
  const s = String(url == null ? '' : url);
  if (s !== origemAutorizada && s !== origemAutorizada + '/') throw erroOrigem();
  return origemAutorizada;
}

function nomesDeCabecalhos(h) {
  if (!h) return [];
  if (typeof Headers !== 'undefined' && h instanceof Headers) return [...h.keys()].map((k) => k.toLowerCase());
  if (Array.isArray(h)) return h.map((p) => String(p && p[0]).toLowerCase());
  return Object.keys(h).map((k) => k.toLowerCase());
}

function criarFetchSupabaseRestrito({ origemAutorizada = ORIGEM_SUPABASE_AUTORIZADA, fetchBase = globalThis.fetch, aoBloquear = () => {} } = {}) {
  if (!FORMATO_ORIGEM.test(String(origemAutorizada))) throw erroOrigem();
  if (typeof fetchBase !== 'function') throw new Error('RAG3_FETCH_BASE_AUSENTE');
  const permitidos = new Set(RPCS_PERMITIDAS.map((n) => origemAutorizada + '/rest/v1/rpc/' + n));
  const stats = { permitidas: 0, bloqueadas: 0, motivos: {} };
  async function fetchRestrito(input, init) {
    const opcoes = init || {};
    const bloquear = (motivo) => { stats.bloqueadas++; stats.motivos[motivo] = (stats.motivos[motivo] || 0) + 1; try { aoBloquear(motivo); } catch (_) { /* observador nunca interfere */ } throw new RequisicaoSupabaseBloqueada(motivo); };
    let bruto;
    if (typeof input === 'string') bruto = input;
    else if (typeof URL !== 'undefined' && input instanceof URL) bruto = input.href;
    else return bloquear('entrada_nao_aceita'); // Request, objetos, null…
    if (!permitidos.has(bruto)) return bloquear('destino_nao_permitido'); // igualdade EXATA do texto completo
    if (opcoes.method !== 'POST') return bloquear('metodo_nao_permitido');
    if (typeof opcoes.body !== 'string') return bloquear('corpo_nao_string');
    if (Buffer.byteLength(opcoes.body, 'utf8') > MAX_CORPO_BYTES) return bloquear('corpo_grande_demais');
    if (opcoes.dispatcher || opcoes.agent) return bloquear('transporte_alternativo');
    if (nomesDeCabecalhos(opcoes.headers).some((n) => CABECALHOS_PROIBIDOS.includes(n))) return bloquear('cabecalho_proibido');
    const resposta = await fetchBase(bruto, { ...opcoes, redirect: 'error' }); // redirecionamento nunca é seguido
    if (resposta && (resposta.redirected === true || (resposta.status >= 300 && resposta.status < 400))) return bloquear('redirecionamento_inesperado');
    stats.permitidas++;
    return resposta;
  }
  fetchRestrito.estatisticas = () => ({ permitidas: stats.permitidas, bloqueadas: stats.bloqueadas, motivos: { ...stats.motivos } });
  return fetchRestrito;
}

/** Transporte de realtime desativado: qualquer tentativa de abrir WebSocket falha na construção. */
class TransporteRealtimeBloqueado { constructor() { throw new RequisicaoSupabaseBloqueada('realtime_bloqueado'); } }

/**
 * Cria o cliente e devolve só a FACHADA { rpc, estatisticas }. `createClient` e `fetchBase` são injetáveis para teste; em uso real, ficam nos padrões.
 * A origem é validada ANTES de a chave ser usada; a chave nunca é exposta, registrada nem devolvida.
 */
function criarClienteSupabaseRestrito({ url, key, origemAutorizada = ORIGEM_SUPABASE_AUTORIZADA, createClient = null, fetchBase = globalThis.fetch, aoBloquear = () => {} } = {}) {
  validarOrigem(url, origemAutorizada);
  if (typeof key !== 'string' || !key) throw new Error('RAG3_SUPABASE_CHAVE_AUSENTE');
  const fetchRestrito = criarFetchSupabaseRestrito({ origemAutorizada, fetchBase, aoBloquear });
  const criar = createClient || require('@supabase/supabase-js').createClient;
  const cliente = criar(origemAutorizada, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchRestrito },
    realtime: { transport: TransporteRealtimeBloqueado }
  });
  return Object.freeze({
    rpc: (nome, args) => { if (!RPCS_PERMITIDAS.includes(nome)) throw new RequisicaoSupabaseBloqueada('rpc_nao_permitida'); return cliente.rpc(nome, args); },
    estatisticas: fetchRestrito.estatisticas
  });
}

module.exports = { ORIGEM_SUPABASE_AUTORIZADA, RPCS_PERMITIDAS, MAX_CORPO_BYTES, CABECALHOS_PROIBIDOS, RequisicaoSupabaseBloqueada, validarOrigem, criarFetchSupabaseRestrito, criarClienteSupabaseRestrito, TransporteRealtimeBloqueado };
