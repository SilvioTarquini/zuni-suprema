/**
 * Renderizador de markdown seguro para as mensagens do chat.
 *
 * Regra de ouro: TODO o texto de entrada é escapado ANTES de qualquer
 * formatação. Depois disso só este módulo cria tags, de um conjunto fixo
 * (<p>, <br>, <strong>, <em>, <ul>, <ol>, <li>, <hr>). Nada vindo da entrada
 * vira tag ou atributo — sem HTML bruto, sem links, sem imagens.
 *
 * Suporta: títulos (#..######), **negrito**, *itálico*, listas (-, *, +, 1.),
 * filete (---), parágrafos e quebras de linha simples.
 *
 * Sem lookbehind de propósito (Safari < 16.4 não parseia o arquivo inteiro).
 */
(function (raiz) {
  function escaparHtml(valor) {
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Recebe texto JÁ escapado.
  function formatarInline(t) {
    t = t.replace(/\*\*(?=\S)([^*]+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*\w])\*([^\s*](?:[^*]*[^\s*])?)\*(?![*\w])/g, '$1<em>$2</em>');
    return t;
  }

  function renderizarMarkdownSeguro(texto) {
    var linhas = escaparHtml(String(texto == null ? '' : texto).replace(/\r\n?/g, '\n')).split('\n');
    var saida = [];
    var paragrafo = [];
    var lista = null;

    function fecharParagrafo() {
      if (paragrafo.length) {
        saida.push('<p>' + paragrafo.map(formatarInline).join('<br>') + '</p>');
        paragrafo = [];
      }
    }
    function fecharLista() {
      if (lista) {
        saida.push('<' + lista.tipo + '>' + lista.itens.map(function (i) {
          return '<li>' + formatarInline(i) + '</li>';
        }).join('') + '</' + lista.tipo + '>');
        lista = null;
      }
    }

    linhas.forEach(function (linha) {
      var m;
      if (/^\s*$/.test(linha)) { fecharParagrafo(); fecharLista(); return; }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(linha)) {
        fecharParagrafo(); fecharLista(); saida.push('<hr>'); return;
      }
      if ((m = linha.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/))) {
        fecharParagrafo(); fecharLista();
        saida.push('<p class="md-titulo">' + formatarInline(m[1]) + '</p>');
        return;
      }
      if ((m = linha.match(/^\s*[-*+]\s+(.*)$/))) {
        fecharParagrafo();
        if (!lista || lista.tipo !== 'ul') { fecharLista(); lista = { tipo: 'ul', itens: [] }; }
        lista.itens.push(m[1]);
        return;
      }
      if ((m = linha.match(/^\s*\d+[.)]\s+(.*)$/))) {
        fecharParagrafo();
        if (!lista || lista.tipo !== 'ol') { fecharLista(); lista = { tipo: 'ol', itens: [] }; }
        lista.itens.push(m[1]);
        return;
      }
      fecharLista();
      paragrafo.push(linha.trim());
    });
    fecharParagrafo();
    fecharLista();
    return saida.join('');
  }

  raiz.escaparHtml = escaparHtml;
  raiz.renderizarMarkdownSeguro = renderizarMarkdownSeguro;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escaparHtml: escaparHtml, renderizarMarkdownSeguro: renderizarMarkdownSeguro };
  }
})(typeof window !== 'undefined' ? window : this);
