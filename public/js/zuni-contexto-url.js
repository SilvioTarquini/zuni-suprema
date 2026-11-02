// Contexto de campanha (cupom e origem) fora da URL.
//
// Carregar de forma SÍNCRONA, antes do bloco da tag do Pinterest: o script grava ?cupom= e ?origem=
// em sessionStorage e os remove da barra de endereço (history.replaceState), de modo que
// pintrk('page') nunca veja o cupom. Quem precisa do valor lê por ZuniContexto.cupom()/origem().
// Os links montados pelas páginas continuam levando ?cupom=/?origem= na URL de destino; a página
// de destino repete a captura. Fail-open: qualquer falha de storage cai para memória.
(function (raiz) {
  var CHAVES = { cupom: 'zuni_cupom', origem: 'zuni_origem' };
  var MAX_CHARS = 64;
  var memoria = {};

  function gravar(nome, valor) {
    memoria[nome] = valor;
    try { sessionStorage.setItem(CHAVES[nome], valor); } catch (e) {}
  }

  function ler(nome) {
    try {
      var v = sessionStorage.getItem(CHAVES[nome]);
      if (v) return v;
    } catch (e) {}
    return memoria[nome] || null;
  }

  function capturar() {
    try {
      var u = new URL(window.location.href);
      var mudou = false;
      ['cupom', 'origem'].forEach(function (nome) {
        var v = u.searchParams.get(nome);
        if (v === null) return;
        v = v.trim();
        if (v && v.length <= MAX_CHARS) gravar(nome, v);
        u.searchParams.delete(nome);
        mudou = true;
      });
      if (mudou) history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  // Acrescenta cupom/origem guardados a um href relativo que ainda não os tenha.
  function anexar(href) {
    try {
      var u = new URL(href, window.location.origin);
      var cupom = ler('cupom');
      var origem = ler('origem');
      if (cupom && !u.searchParams.has('cupom')) u.searchParams.set('cupom', cupom);
      if (origem && !u.searchParams.has('origem')) u.searchParams.set('origem', origem);
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return href;
    }
  }

  capturar();

  raiz.ZuniContexto = {
    cupom: function () { return ler('cupom'); },
    origem: function () { return ler('origem'); },
    anexar: anexar
  };
})(window);
