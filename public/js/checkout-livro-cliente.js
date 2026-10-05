// Lógica de preço e de Pinterest do checkout de livros (checkout-livro.html).
// Isolada da página para poder ser testada em Node (scripts/testar-f2b-consistencia-preco.js).
//
// PREÇO: o total exibido sai de um estado estruturado — nunca do texto da tela.
//   sem cupom  -> base local (mesma regra de src/lib/precoLivro.js)
//   com cupom  -> total devolvido por /api/validar-cupom, que usa a mesma base
//                 e a mesma calcularDesconto da cobrança real
// O servidor continua recalculando tudo no pagamento; este módulo só garante
// que o cliente VEJA (e informe ao Pinterest) o mesmo valor.
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ZuniCheckoutLivro = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {

  function arredondar(n) {
    return Math.round(n * 100) / 100;
  }

  // livro = resposta de /api/livros/catalogo/:id (preco já é o vigente).
  function precoBaseCliente(livro, audiolivroIncluido) {
    let base = livro.precoPromocional || livro.preco;
    if (audiolivroIncluido && livro.audiobookDisponivel) base += livro.precoAudiobook;
    return arredondar(base);
  }

  // validarCupomFn(codigo, livroId, audiolivroIncluido) -> Promise<{ok, precoOriginal, desconto, precoFinal, erro}>
  function criarEstadoPreco(validarCupomFn) {
    const estado = { livro: null, livroId: null, audio: false, cupom: null, validacao: null };
    let sequencia = 0;

    function visao() {
      const base = estado.livro ? precoBaseCliente(estado.livro, estado.audio) : null;
      const comCupom = Boolean(estado.cupom && estado.validacao);
      return {
        precoBase: base,
        precoOriginal: comCupom ? estado.validacao.precoOriginal : null,
        desconto: comCupom ? estado.validacao.desconto : 0,
        precoFinal: comCupom ? estado.validacao.precoFinal : base,
        cupom: comCupom ? estado.cupom : null,
        cupomPerdido: false
      };
    }

    // Valida o cupom para o estado ATUAL (livro + áudio). Respostas fora de
    // ordem (toque rápido no checkbox) são descartadas pela sequência.
    async function revalidar(codigo) {
      const minha = ++sequencia;
      let r;
      try {
        r = await validarCupomFn(codigo, estado.livroId, estado.audio);
      } catch (e) {
        r = { ok: false, erro: 'Não foi possível validar o cupom agora.' };
      }
      if (minha !== sequencia) return { descartada: true, visao: visao() };
      if (r && r.ok) {
        estado.cupom = String(codigo).trim().toUpperCase();
        estado.validacao = { precoOriginal: r.precoOriginal, desconto: r.desconto, precoFinal: r.precoFinal };
        return { ok: true, visao: visao() };
      }
      estado.cupom = null;
      estado.validacao = null;
      return { ok: false, erro: (r && r.erro) || 'Cupom inválido ou expirado.', visao: visao() };
    }

    return {
      estado,
      visao,
      definirLivro(livroId, livro) {
        estado.livroId = livroId;
        estado.livro = livro;
        estado.cupom = null;
        estado.validacao = null;
        sequencia++;
        return visao();
      },
      aplicarCupom: (codigo) => revalidar(codigo),
      // Marcar/desmarcar o audiolivro com cupom ativo revalida no servidor.
      async definirAudio(incluido) {
        estado.audio = Boolean(incluido);
        if (!estado.cupom) {
          sequencia++;
          return { ok: true, visao: visao() };
        }
        const codigo = estado.cupom;
        const r = await revalidar(codigo);
        if (r.ok === false) r.visao.cupomPerdido = true;
        return r;
      },
      // Valor comercial da transação em andamento (número), nunca texto da tela.
      valorTransacao() {
        const v = visao().precoFinal;
        return Number.isFinite(v) && v > 0 ? v : null;
      }
    };
  }

  // Pinterest — fail-open: nenhuma falha aqui pode bloquear pagamento, confirmação ou acesso.
  // Nunca recebe nome, e-mail ou outro dado pessoal: só ids do produto/pedido e valor.
  function criarPinterestLivro({ pintrk, sessionStorage, localStorage, livroId }) {
    const disparados = new Set(); // dedup em memória, além do localStorage
    function pinTrack(evento, dados) {
      try {
        if (typeof pintrk === 'function') pintrk('track', evento, dados);
      } catch (e) {}
    }

    return {
      inicioCheckout(pedidoId, valor) {
        try {
          const dados = { product_id: livroId, order_quantity: 1 };
          if (Number.isFinite(valor) && valor > 0) {
            dados.value = valor;
            dados.currency = 'BRL';
            if (pedidoId) {
              try { sessionStorage.setItem('pin_val_' + pedidoId, String(valor)); } catch (e) {}
            }
          }
          pinTrack('addtocart', dados);
        } catch (e) {}
      },
      // Só deve ser chamada depois que stripe-status devolveu pago:true.
      compra(pedidoId) {
        try {
          if (!pedidoId || disparados.has(pedidoId)) return false;
          disparados.add(pedidoId);
          const chave = 'pin_compra_' + pedidoId;
          try { if (localStorage.getItem(chave)) return false; } catch (e) {}
          const dados = { product_id: livroId, order_id: pedidoId, order_quantity: 1 };
          try {
            const v = parseFloat(sessionStorage.getItem('pin_val_' + pedidoId));
            if (Number.isFinite(v) && v > 0) { dados.value = v; dados.currency = 'BRL'; }
          } catch (e) {}
          pinTrack('checkout', dados);
          try { localStorage.setItem(chave, '1'); } catch (e) {}
          return true;
        } catch (e) { return false; }
      }
    };
  }

  // Origem comercial (de qual vitrine a pessoa veio). Whitelist fechada, espelho de src/lib/origemCompra.js
  // (o servidor revalida). Só contexto de análise: nunca altera preço, cupom, produto ou acesso, e nunca
  // é escrita na página nem enviada ao Pinterest.
  const ORIGENS_PERMITIDAS = ['universo-feminino'];

  function lerOrigem(search) {
    try {
      const valor = new URLSearchParams(search).get('origem');
      return ORIGENS_PERMITIDAS.includes(valor) ? valor : null;
    } catch (e) {
      return null;
    }
  }

  return { precoBaseCliente, criarEstadoPreco, criarPinterestLivro, lerOrigem, ORIGENS_PERMITIDAS };
});
