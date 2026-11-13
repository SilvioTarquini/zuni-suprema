/* "Baixar PDF" flutuante dos leitores estáticos — comportamento (código de navegador; fonte única).
 *
 * Embutido por src/lib/leitorSemImpressao.js (botaoPdfFlutuante) logo depois de templates/flutuantes.js. O marcador /*__IR_PARA_PDF__*\/ vira
 * a navegação para /livros/<id>/pdf?token=… (a rota protegida).
 *
 * Regras:
 *   - o botão flutuante só aparece na CAPA e na ÚLTIMA página; nas demais fica escondido (não cobre o texto nem os controles);
 *   - onde o leitor tem barra de controles própria (achada pelo botão "A+"), entra nela um ícone discreto de download (⇩), igual aos
 *     outros ícones da barra (é um clone do "A+"), sempre disponível;
 *   - onde não há barra, fica só o flutuante, na capa e no fim;
 *   - capa/fim vêm, em ordem, de: botão "Abrir o livro" visível (capa) · campo de página <input type=range> (primeira/última) · texto
 *     "N de M" / "N / M" do contador. Sem nenhum desses sinais, não dá para saber: o botão fica sempre visível (nunca some às cegas).
 */
(function () {
  var b = document.getElementById('zs-baixar-pdf'); if (!b) return;
  function irParaPdf() { /*__IR_PARA_PDF__*/ }
  b.addEventListener('click', irParaPdf);

  // visível de verdade: tamanho, sem ancestral escondido/transparente e recebendo o toque no ponto central (não coberto por outra camada)
  function visivel(e) {
    if (!e) return false;
    var r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false;
    for (var n = e; n && n.nodeType === 1; n = n.parentElement) {
      var cs = window.getComputedStyle(n);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false;
    }
    var cx = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1); var cy = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
    var topo = document.elementFromPoint(cx, cy);
    return !!topo && (topo === e || e.contains(topo));
  }

  // { capa, fim } ou null (não deu para saber)
  function estado() {
    var abrir = document.getElementById('openBtn'); var capaNaTela = visivel(abrir);
    var rg = document.querySelector('input[type=range]');
    if (rg && rg.max !== '') {
      var v = +rg.value; var mn = +(rg.min || 0); var mx = +rg.max;
      return { capa: capaNaTela || v <= mn + 1, fim: mx > mn + 2 && v >= mx - 1 };
    }
    var st = document.querySelector('.status, .page-status, #pageStatus, #status, .counter');
    var m = st && /(\d+)\s*(?:de|\/)\s*(\d+)/.exec(st.textContent || '');
    if (m) { var a = +m[1]; var t = +m[2]; return { capa: capaNaTela || a <= 1, fim: t > 3 && a >= t - 1 }; }
    if (abrir) return { capa: capaNaTela, fim: false };
    return null;
  }

  function acharMais() {
    var c = document.querySelectorAll('button, [role=button], div, span, a');
    for (var i = 0; i < c.length; i++) {
      var e = c[i];
      if (e.children.length === 0 && /^A\+$/.test((e.textContent || '').trim()) && !e.closest('#zuni-chat-widget') && !e.closest('#zs-baixar-pdf')) return e;
    }
    return null;
  }

  function iconeNaBarra() {
    if (document.getElementById('zs-pdf-barra')) return;
    var mais = acharMais(); if (!mais || !mais.parentNode) return;
    var ic = mais.cloneNode(false);
    ic.removeAttribute('onclick'); ic.removeAttribute('id'); ic.id = 'zs-pdf-barra';
    ic.textContent = '⇩'; ic.setAttribute('title', 'Baixar PDF'); ic.setAttribute('aria-label', 'Baixar PDF');
    ic.addEventListener('click', function (ev) { ev.stopPropagation(); ev.preventDefault(); irParaPdf(); });
    mais.parentNode.insertBefore(ic, mais.nextSibling);
  }

  var escondido = null;
  function atualizar() {
    var e = estado(); var mostrar = e === null || e.capa || e.fim;
    iconeNaBarra();
    if (escondido === !mostrar) return;
    escondido = !mostrar;
    if (mostrar) b.style.removeProperty('display'); else b.style.setProperty('display', 'none', 'important');
    if (window.ZuniFlutuantes) window.ZuniFlutuantes.reposicionar(120);
  }
  ['click', 'keyup', 'touchend', 'input', 'change'].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(atualizar, 200); }, true); });
  setInterval(atualizar, 700);
  atualizar();
})();
