// lib/limiteLivroVivo.js
//
// Limite de RITMO do Livro-Vivo (por minuto), por token+livro. É a parte "por minuto" da rede de
// segurança invisível: o leitor nunca vê contador nem "perguntas restantes" — só, no caso raro de
// abuso programático, uma mensagem neutra pedindo para aguardar. O limite por dia continua em
// usoChatLivro.js (CHAT_LIVRO_LIMITE_DIARIO); os dois existem contra abuso, não contra leitura normal.
//
// Janela deslizante em memória (um processo no Railway). Reiniciar o servidor zera a janela, o que é
// aceitável: ela só protege contra rajada, e o limite diário (no banco) não é afetado.

const LIMITE_POR_MINUTO = parseInt(process.env.CHAT_LIVRO_LIMITE_POR_MINUTO || '6', 10);
const JANELA_MS = 60 * 1000;

const janelas = new Map(); // `${token}|${livroId}` -> [timestamps]

function limparAntigas(agora) {
  for (const [chave, marcas] of janelas) {
    const recentes = marcas.filter(t => agora - t < JANELA_MS);
    if (recentes.length) janelas.set(chave, recentes);
    else janelas.delete(chave);
  }
}

/**
 * Registra a tentativa e diz se ela passa. Tentativa bloqueada não entra na janela
 * (quem insiste não prolonga o próprio bloqueio indefinidamente).
 * @returns {boolean} true = pode seguir; false = ritmo acima do limite
 */
function permitirPergunta(token, livroId, agora = Date.now()) {
  const chave = `${token}|${livroId}`;
  const recentes = (janelas.get(chave) || []).filter(t => agora - t < JANELA_MS);
  if (recentes.length >= LIMITE_POR_MINUTO) {
    janelas.set(chave, recentes);
    return false;
  }
  recentes.push(agora);
  janelas.set(chave, recentes);
  if (janelas.size > 5000) limparAntigas(agora);
  return true;
}

function _reiniciarParaTeste() { janelas.clear(); }

module.exports = { permitirPergunta, LIMITE_POR_MINUTO, _reiniciarParaTeste };
