// lib/leitorMobileMotorE.js
//
// Patch de celular do leitor de "Toda Mesa Tem Dois Lados" (motor E): leitor de PÁGINA ÚNICA 680x960 px (componente
// React declarativo, paginação própria com orçamento de 860 px). O patch dos outros motores não o reconhece, então o
// livro era entregue original: no celular a página inteira de 680 px era reduzida a ~34% (texto de ~5,6 px) e os botões
// do topo se sobrepunham.
//
// Escolha de menor risco: escalar a página não resolve (a 390 px o texto ficaria em ~9 px, abaixo de 12 px), então, SÓ em
// tela estreita (largura < 820 px ou altura < 500 px), o patch monta por cima um leitor em ROLAGEM CONTÍNUA, com os mesmos
// blocos de texto do livro (this.buildGroups) e o mesmo gerador de elementos (this.elFor), refluindo na largura da tela:
// barra com Sumário, A−/A+ e Baixar em PDF (a impressão original continua sendo a do livro). Nada do texto é alterado.
// No computador (e se qualquer passo falhar) o leitor original continua exatamente como é.
//
// Toda âncora é obrigatória: se faltar alguma, substituir() lança e o chamador devolve o livro original.

function substituir(texto, alvo, novo) {
  const partes = texto.split(alvo);
  if (partes.length !== 2) throw new Error(`âncora ocorre ${partes.length - 1}x: ${alvo.slice(0, 45)}`);
  return partes[0] + novo + partes[1];
}

const A_MONTAGEM = "      const groups = this.buildGroups(BOOK);\n      const pages = this.paginate(groups);\n      this.setState({ pages, loading: false });";
const A_TECLADO = "    window.addEventListener('keydown', this.handleKey);";
const A_DESMONTAGEM = '  componentWillUnmount() {';

function ehMotorE(template) {
  return typeof template === 'string'
    && template.includes('class Component extends DCLogic')
    && template.includes('(w - 160) / 680')
    && template.includes('buildGroups(BOOK)')
    && template.includes('elFor(block)')
    && template.includes('id="screenOnly"');
}

const METODOS_E = String.raw`
  zsNarrow() { return window.innerWidth < 820 || window.innerHeight < 500; }

  zsSync() {
    try {
      const quer = !!this.zsGroups && this.zsNarrow();
      if (quer && !this.zsEl) this.zsMount();
      else if (!quer && this.zsEl) this.zsUnmount();
    } catch (err) {
      if (window.console) console.error('[zs-leitor-mesa]', err);
      try { this.zsUnmount(); } catch (e2) { /* volta ao leitor original */ }
    }
  }

  zsUnmount() {
    if (this.zsEl && this.zsEl.parentNode) this.zsEl.parentNode.removeChild(this.zsEl);
    this.zsEl = null;
    const so = document.getElementById('screenOnly');
    if (so) so.style.display = this.zsAntes || '';
  }

  zsMount() {
    const self = this;
    const grupos = this.zsGroups;
    let fs = 1;
    try { fs = parseFloat(localStorage.getItem('zs_mesa_fs')) || 1; } catch (e) { /* sem armazenamento */ }
    fs = Math.min(1.6, Math.max(0.85, fs));

    const mk = (tag, css, texto) => {
      const e = document.createElement(tag);
      if (css) e.style.cssText = css;
      if (texto != null) e.textContent = texto;
      return e;
    };
    const botao = (texto, aria, fn) => {
      const b = mk('button', 'flex:1 1 auto;min-width:60px;min-height:42px;padding:0 12px;background:none;border:1px solid #6b5533;color:#d9bd80;font-family:Cinzel,serif;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;border-radius:2px;cursor:pointer;', texto);
      b.type = 'button';
      if (aria) b.setAttribute('aria-label', aria);
      b.addEventListener('click', fn);
      return b;
    };

    const so = document.getElementById('screenOnly');
    if (so) { this.zsAntes = so.style.display; so.style.display = 'none'; }

    const raiz = mk('div', 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:2000;display:flex;flex-direction:column;background:#18110a;');
    raiz.id = 'zsScroll';
    const css = mk('style', null, '@media print{#zsScroll{display:none !important}}');
    const barra = mk('div', 'flex:none;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;padding:8px;background:#120c07;border-bottom:1px solid #3a2c1a;');
    const trilho = mk('div', 'flex:none;height:3px;background:#2a2014;');
    const progresso = mk('div', 'height:3px;width:0;background:#c9a227;');
    trilho.appendChild(progresso);
    const area = mk('div', 'flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:14px 10px 40px;');
    area.id = 'zsScrollArea';
    const col = mk('div', 'max-width:660px;margin:0 auto;padding:22px 20px 30px;background:#f6efe0;color:#2a2116;border-radius:3px;box-shadow:0 10px 40px rgba(0,0,0,0.55);text-align:justify;hyphens:auto;-webkit-hyphens:auto;word-break:normal;overflow-wrap:break-word;');
    col.id = 'zsCol';
    col.lang = 'pt-BR';
    area.appendChild(col);

    const secoes = [];
    const aplicarEscala = (el) => {
      const nos = [el].concat(Array.prototype.slice.call(el.querySelectorAll('*')));
      nos.forEach((n) => {
        if (n.style && n.style.fontSize) n.style.fontSize = (parseFloat(n.style.fontSize) * fs) + 'px';
      });
    };

    const montar = () => {
      col.textContent = '';
      secoes.length = 0;
      grupos.forEach((g, gi) => {
        const sec = mk('section');
        sec.setAttribute('data-zs-idx', String(gi));
        if (g.opener) {
          const a = mk('div', 'text-align:center;margin:26px 0 30px;');
          a.appendChild(mk('div', "font-family:'Cinzel',serif;font-size:12px;letter-spacing:3px;color:#9c7a2e;text-transform:uppercase;", g.opener.label));
          a.appendChild(mk('div', "font-family:'Cinzel',serif;font-weight:600;font-size:22px;line-height:1.35;margin:10px 0 14px;", g.opener.title));
          if (g.opener.quote) a.appendChild(mk('div', "font-family:'EB Garamond',serif;font-style:italic;font-size:16.5px;line-height:1.6;color:#4a3720;", '“' + g.opener.quote + '”'));
          aplicarEscala(a);
          sec.appendChild(a);
        }
        g.blocks.forEach((b) => {
          const el = self.elFor(b);
          el.style.width = 'auto';
          el.style.maxWidth = '100%';
          aplicarEscala(el);
          sec.appendChild(el);
        });
        col.appendChild(sec);
        secoes.push({ el: sec, nome: g.opener ? (g.opener.label + ' — ' + g.opener.title) : g.runningTitle });
      });
      const fim = mk('div', "text-align:center;margin:34px 0 6px;font-family:'Cinzel',serif;letter-spacing:4px;color:#9c7a2e;font-size:" + (13 * fs) + 'px;', '✦ ✦ ✦');
      col.appendChild(fim);
    };

    const irPara = (sec) => {
      area.scrollTop += sec.getBoundingClientRect().top - area.getBoundingClientRect().top - 8;
    };
    const mudarFonte = (delta) => {
      const razao = area.scrollHeight ? area.scrollTop / area.scrollHeight : 0;
      fs = Math.min(1.6, Math.max(0.85, Math.round((fs + delta) * 100) / 100));
      try { localStorage.setItem('zs_mesa_fs', String(fs)); } catch (e) { /* sem armazenamento */ }
      montar();
      area.scrollTop = razao * area.scrollHeight;
    };

    // Sumário: lista de capítulos; a escolha leva à seção por rolagem.
    const indice = mk('div', 'position:absolute;top:0;right:0;bottom:0;left:0;z-index:5;display:none;flex-direction:column;background:rgba(12,8,4,0.97);');
    const indiceTopo = mk('div', 'flex:none;display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #3a2c1a;');
    indiceTopo.appendChild(mk('div', "font-family:'Cinzel',serif;font-size:12px;letter-spacing:3px;color:#c9a860;text-transform:uppercase;", 'Sumário'));
    const fechar = botao('Fechar', 'Fechar o sumário', () => { indice.style.display = 'none'; });
    fechar.style.flex = 'none';
    indiceTopo.appendChild(fechar);
    const indiceLista = mk('div', 'flex:1 1 auto;min-height:0;overflow-y:auto;padding:8px 12px 24px;');
    indice.appendChild(indiceTopo);
    indice.appendChild(indiceLista);
    const montarIndice = () => {
      indiceLista.textContent = '';
      secoes.forEach((s) => {
        const it = mk('button', "display:block;width:100%;text-align:left;min-height:46px;padding:10px 6px;background:none;border:0;border-bottom:1px solid #2a2014;color:#e9dcc0;font-family:'EB Garamond',serif;font-size:17px;line-height:1.3;cursor:pointer;", s.nome);
        it.type = 'button';
        it.addEventListener('click', () => { indice.style.display = 'none'; irPara(s.el); });
        indiceLista.appendChild(it);
      });
    };

    barra.appendChild(botao('Sumário', 'Abrir o sumário', () => { montarIndice(); indice.style.display = 'flex'; }));
    barra.appendChild(botao('A−', 'Diminuir a letra', () => mudarFonte(-0.1)));
    barra.appendChild(botao('A+', 'Aumentar a letra', () => mudarFonte(0.1)));
    barra.appendChild(botao('Baixar em PDF', 'Baixar em PDF', () => self.doPrint()));

    area.addEventListener('scroll', () => {
      const max = area.scrollHeight - area.clientHeight;
      progresso.style.width = (max > 0 ? Math.min(100, (area.scrollTop / max) * 100) : 0) + '%';
    }, { passive: true });

    raiz.appendChild(css);
    raiz.appendChild(barra);
    raiz.appendChild(trilho);
    raiz.appendChild(area);
    raiz.appendChild(indice);
    montar();
    document.body.appendChild(raiz);
    this.zsEl = raiz;
  }

`;

function patchMotorE(template, opcoes = {}) {
  let t = template;
  // Livro à venda sem impressão: o modo rolagem do celular não ganha o botão "Baixar em PDF".
  const linhaPdf = "    barra.appendChild(botao('Baixar em PDF', 'Baixar em PDF', () => self.doPrint()));\n";
  const metodos = opcoes.semImpressao ? substituir(METODOS_E, linhaPdf, '') : METODOS_E;
  t = substituir(t, A_MONTAGEM, A_MONTAGEM + '\n      this.zsGroups = groups;\n      this.zsSync();');
  t = substituir(t, A_TECLADO, A_TECLADO + "\n    this.zsResize = () => this.zsSync();\n    window.addEventListener('resize', this.zsResize);");
  t = substituir(t, A_DESMONTAGEM, metodos.replace(/^\n/, '') + A_DESMONTAGEM);
  return t;
}

module.exports = { patchMotorE, ehMotorE };
