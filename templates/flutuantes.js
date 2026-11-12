/* Posição dos botões flutuantes (Livro-Vivo e "Baixar PDF") — arquivo-fonte único.
 *
 * Não editar a cópia que está dentro de um livro: edite ESTE arquivo. Ele é embutido (src/lib/flutuantes.js) no widget do
 * Livro-Vivo (templates/chat-livro-widget.html) e no botão flutuante "Baixar PDF" (src/lib/leitorSemImpressao.js); quando os dois
 * existem na mesma página, só a primeira cópia define window.ZuniFlutuantes e a outra apenas a usa.
 *
 * Regras (valem para qualquer leitor e para qualquer largura; nada é específico de obra):
 *   1. controle = botão, link, campo, seta, ícone ... realmente visível (o elemento do topo no ponto central é ele mesmo);
 *   2. o botão flutuante nunca fica a menos de 16 px de um controle do leitor (margem de toque). Se a tela estiver tão cheia
 *      que não haja posição assim, cai para 8 px e, em último caso, 4 px — nunca fica por cima de um controle se existir lugar;
 *   3. os flutuantes também se evitam entre si (o "Baixar PDF" é posicionado primeiro; o Livro-Vivo o trata como um controle);
 *   4. texto da página: onde o botão pede (celular para o Livro-Vivo; sempre para o "Baixar PDF") ele prefere uma posição sem
 *      texto — a barra inferior, a margem. Se não houver, escolhe a posição com MENOS texto coberto.
 * Fica na posição do CSS quando ela já satisfaz as regras; senão vai para a posição boa mais próxima dela.
 * Reavalia ao carregar, ao girar/redimensionar a tela e quando o leitor muda (abrir o livro, virar a página, mostrar/esconder barras).
 */
(function () {
  if (window.ZuniFlutuantes) return;
  var FOLGAS = [16, 8, 4]; var MARGEM_TELA = 8; var PASSO = 8; var TOLERANCIA_TEXTO = 0.02; var MIN_CARACTERES_TEXTO = 12;
  var itens = []; var agendamento = null; var observador = null;

  function interseta(a, b, folga) { return a.left < b.right + folga && a.right > b.left - folga && a.top < b.bottom + folga && a.bottom > b.top - folga; }
  function area(a, b) {
    var w = Math.min(a.right, b.right) - Math.max(a.left, b.left); var h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function ret(r) { return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; }
  function ehNosso(e) {
    if (e.closest && e.closest('#zuni-chat-widget')) return true;
    for (var i = 0; i < itens.length; i++) if (itens[i].el === e || itens[i].el.contains(e)) return true;
    return false;
  }

  function controlesDoLeitor() {
    var vw = window.innerWidth; var vh = window.innerHeight; var lista = [];
    var els = document.querySelectorAll('button, [role=button], a[href], input, select, textarea, summary');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (ehNosso(e)) continue;
      var r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
      if (r.width * r.height > 0.35 * vw * vh) continue; // área de clique do tamanho da tela: ignorar, senão não sobra lugar
      var cs = window.getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none' || parseFloat(cs.opacity) === 0) continue;
      var cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1); var cy = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
      var topo = document.elementFromPoint(cx, cy);
      if (!topo || !(topo === e || e.contains(topo))) continue; // coberto por outra coisa: não está disponível ao toque
      lista.push(ret(r));
    }
    return lista;
  }

  // Linhas de texto da página visíveis agora (um retângulo por linha). Rótulos curtos ("5 / 315") e texto de botões não contam.
  function linhasDeTexto() {
    var vw = window.innerWidth; var vh = window.innerHeight; var linhas = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var n; var guarda = 0;
    while ((n = walker.nextNode()) && guarda++ < 30000 && linhas.length < 1500) {
      var t = n.nodeValue; if (!t) continue; t = t.replace(/\s+/g, ' ').trim();
      var p = n.parentElement; if (!p) continue;
      if (t.length < MIN_CARACTERES_TEXTO && !/^H[1-4]$/.test(p.tagName)) continue;
      if (/^(SCRIPT|STYLE|NOSCRIPT|BUTTON|A|SELECT|TEXTAREA|LABEL|SVG|OPTION)$/i.test(p.tagName)) continue;
      var pr = p.getBoundingClientRect();
      if (pr.width === 0 || pr.height === 0 || pr.bottom <= 0 || pr.top >= vh || pr.right <= 0 || pr.left >= vw) continue;
      if (p.closest('button, a, select, textarea, label, svg, [role=button], noscript') || ehNosso(p)) continue;
      var cs = window.getComputedStyle(p);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
      var rg = document.createRange(); rg.selectNodeContents(n);
      var rs = rg.getClientRects();
      for (var k = 0; k < rs.length; k++) {
        var r = rs[k];
        if (r.width < 8 || r.height < 6 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
        var cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1); var cy = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
        var topo = document.elementFromPoint(cx, cy);
        if (!topo || !(p === topo || p.contains(topo) || topo.contains(p))) continue; // texto de página que não está na tela (capa, painel por cima)
        linhas.push(ret(r));
      }
    }
    return linhas;
  }

  function textoCoberto(c, linhas) {
    var total = 0;
    for (var i = 0; i < linhas.length; i++) total += area(c, linhas[i]);
    return total;
  }

  // Melhor posição para um retângulo w×h, partindo da preferida (do CSS). Devolve { left, top } ou null (= ficar onde está).
  function melhorPosicao(pref, obstaculos, linhas) {
    var vw = window.innerWidth; var vh = window.innerHeight; var w = pref.width; var h = pref.height; var areaBotao = w * h;
    for (var f = 0; f < FOLGAS.length; f++) {
      var folga = FOLGAS[f];
      var livres = [];
      for (var top = MARGEM_TELA; top <= vh - h - MARGEM_TELA; top += PASSO) {
        for (var left = MARGEM_TELA; left <= vw - w - MARGEM_TELA; left += PASSO) {
          var c = { left: left, top: top, right: left + w, bottom: top + h };
          var ok = true;
          for (var i = 0; i < obstaculos.length; i++) if (interseta(c, obstaculos[i], folga)) { ok = false; break; }
          if (ok) { var dx = left - pref.left; var dy = top - pref.top; livres.push({ left: left, top: top, d: dx * dx + dy * dy, c: c }); }
        }
      }
      if (!livres.length) continue;
      var melhor = null;
      if (linhas) {
        for (var j = 0; j < livres.length; j++) livres[j].texto = textoCoberto(livres[j].c, linhas) / areaBotao;
        for (var m = 0; m < livres.length; m++) {
          var a = livres[m]; var tA = a.texto <= TOLERANCIA_TEXTO ? 0 : a.texto;
          if (!melhor) { melhor = a; continue; }
          var tB = melhor.texto <= TOLERANCIA_TEXTO ? 0 : melhor.texto;
          if (tA < tB - 1e-9 || (Math.abs(tA - tB) < 1e-9 && a.d < melhor.d)) melhor = a;
        }
      } else {
        for (var q = 0; q < livres.length; q++) if (!melhor || livres[q].d < melhor.d) melhor = livres[q];
      }
      return { left: melhor.left, top: melhor.top, folga: folga };
    }
    return null;
  }

  function limpar(el) { el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = ''; }
  function observar(ligar) {
    if (!observador) return;
    if (ligar) observador.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
    else observador.disconnect();
  }

  function reposicionarTodos() {
    try {
      observar(false);
      var ativos = itens.filter(function (it) { return it.ativo ? it.ativo() : true; });
      ativos.forEach(function (it) { limpar(it.el); it.el.style.visibility = 'hidden'; });
      var prefs = ativos.map(function (it) { return ret(it.el.getBoundingClientRect()); });
      var controles = controlesDoLeitor();
      var queroTexto = ativos.some(function (it) { return it.evitarTexto && it.evitarTexto(); });
      var linhas = queroTexto ? linhasDeTexto() : null;
      ativos.forEach(function (it) { it.el.style.visibility = ''; });
      var colocados = []; // retângulos finais dos já posicionados (o próximo os trata como controles)
      for (var i = 0; i < ativos.length; i++) {
        var it = ativos[i]; var pref = prefs[i];
        if (pref.width <= 0) { colocados.push(pref); continue; }
        var obst = controles.concat(colocados);
        for (var k = i + 1; k < ativos.length; k++) if (prefs[k].width > 0) obst.push(prefs[k]); // os que ainda não foram colocados, na posição de partida
        var usaTexto = linhas && it.evitarTexto && it.evitarTexto();
        var folga0 = FOLGAS[0]; var livre = true;
        for (var o = 0; o < obst.length; o++) if (interseta(pref, obst[o], folga0)) { livre = false; break; }
        if (livre && usaTexto && textoCoberto(pref, linhas) / (pref.width * pref.height) > TOLERANCIA_TEXTO) livre = false;
        var final = pref;
        if (!livre) {
          var p = melhorPosicao(pref, obst, usaTexto ? linhas : null);
          if (p) {
            it.el.style.right = 'auto'; it.el.style.bottom = 'auto'; it.el.style.left = p.left + 'px'; it.el.style.top = p.top + 'px';
            final = { left: p.left, top: p.top, right: p.left + pref.width, bottom: p.top + pref.height, width: pref.width, height: pref.height };
          }
        }
        colocados.push(final);
      }
    } catch (e) {
      itens.forEach(function (it) { it.el.style.visibility = ''; });
    } finally { observar(true); }
  }

  function agendar(ms) { if (agendamento) clearTimeout(agendamento); agendamento = setTimeout(reposicionarTodos, ms); }

  if (typeof MutationObserver === 'function') {
    observador = new MutationObserver(function (registros) {
      for (var i = 0; i < registros.length; i++) {
        var alvo = registros[i].target;
        var proprio = false;
        for (var k = 0; k < itens.length; k++) if (itens[k].el === alvo || itens[k].el.contains(alvo)) { proprio = true; break; }
        if (!proprio) { agendar(300); return; }
      }
    });
    observar(true);
  }
  window.addEventListener('resize', function () { agendar(150); });
  window.addEventListener('orientationchange', function () { agendar(400); });
  window.addEventListener('load', function () { agendar(100); });
  document.addEventListener('click', function () { agendar(450); }, true);
  document.addEventListener('keyup', function () { agendar(450); }, true);
  [60, 600, 1600, 3600].forEach(function (ms) { setTimeout(function () { agendar(0); }, ms); }); // leitores que montam a tela aos poucos

  // el: elemento fixo; opcoes: { ordem (menor = posicionado primeiro), ativo(): bool, evitarTexto(): bool }
  window.ZuniFlutuantes = {
    registrar: function (el, opcoes) {
      opcoes = opcoes || {};
      itens.push({ el: el, ordem: opcoes.ordem || 0, ativo: opcoes.ativo, evitarTexto: opcoes.evitarTexto });
      itens.sort(function (a, b) { return a.ordem - b.ordem; });
      agendar(100);
    },
    reposicionar: function (ms) { agendar(ms || 0); }
  };
})();
