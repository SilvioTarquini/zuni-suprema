// lib/leitorMobile.js
//
// Adapta para celular o leitor "flipbook" (duas páginas lado a lado) que está
// embutido em private/livros/<livro>/index.html. Os arquivos são bundles de
// vários MB: o leitor vive como JSON numa <script type="__bundler/template">.
// Em vez de reescrever ~25 arquivos gigantes, o servidor aplica o patch na
// hora de servir (routes/livros.js), com cache em memória.
//
// Regra de ouro: o patch NUNCA pode impedir o livro de abrir. Qualquer
// âncora não encontrada, JSON inválido ou exceção => devolve o HTML ORIGINAL
// e registra [LEITOR_PATCH_FALHOU] livroId=... (ver lerLivroComPatch).
//
// O que o patch faz (só em telas estreitas/baixas — desktop fica idêntico):
//  - modo de página única (largura < 820px ou altura < 500px): uma página por
//    vez, escalada pela largura da tela; navegação por toque/deslize/botões;
//  - barra de controles em duas linhas em telas < 760px, sem cortar botões;
//  - A+/A− com limite maior (até 1,6) — o texto muda de fato de tamanho.

const fs = require('fs/promises');
const { patchMotorB, ehMotorB } = require('./leitorMobileMotorB');
const { patchMotorC, ehMotorC, patchMotorD, ehMotorD } = require('./leitorMobileMotoresCD');

// HTML sem bundle (ex.: Os Bastidores da Mente) já é responsivo: não há o que
// remendar e isso não é falha.
const MOTIVO_SEM_BUNDLE = 'html sem bundle do leitor';
const MARCADOR_TEMPLATE = '<script type="__bundler/template">';

// Âncoras: todas precisam existir no template, senão o patch é abortado.
const ANCORA_LAYOUT = /\n  layout\(\)\{\n    const availW = window\.innerWidth - 40;\n    const availH = window\.innerHeight - 92 - 30;\n    const scale = Math\.min\(availW\/\(this\.PW\*2\), availH\/this\.PH, 1\.15\);\n    this\.scaler\.style\.transform = 'scale\('\+scale\+'\)';\n  \}/;
const ANCORA_LIMITE_FONTE = 'Math.min(1.35, Math.max(0.8';
const ANCORA_INIT = '    this.bind();\n    this.layout();';
const ANCORA_METODO_ESC = '\n  esc(s){';
const ANCORA_FIM_HELMET = '</helmet>';
const ANCORAS_EXIGIDAS = [
  'id="leafLeft"', 'id="leafRight"', 'id="controls"', 'id="stageWrap"', 'id="scaler"',
  'id="book"', 'id="spine"', 'id="reader"', 'id="folioLabel"', 'id="progress"',
  'updateControls(){', 'setFont(delta){', 'jumpTo(pageIdx){', 'renderStatic(){',
  '  next(){', '  prev(){'
];

const CSS_PATCH = String.raw`<style id="zs-leitor-mobile">
@keyframes zsIn{ from{ opacity:0 } to{ opacity:1 } }
#reader.zs-single #stageWrap{ overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; }
#reader.zs-single #scaler{ margin:auto; transform:none !important; overflow:hidden; flex:none; }
#reader.zs-single #book{ transform-origin:0 0; }
#reader.zs-single #spine{ display:none; }
#reader.zs-single .nav-zone{ width:12%; }
@media (max-width:759px){
  #controls{ height:auto; flex-wrap:wrap; justify-content:center; align-content:center;
    gap:6px 10px; padding:8px 10px calc(8px + env(safe-area-inset-bottom, 0px)); }
  #controls > .ctl-div{ display:none; }
  #controls > :nth-child(3){ order:-1; flex:0 0 100%; justify-content:center; }
  #controls #folioLabel{ display:block !important; min-width:56px; letter-spacing:.06em; font-size:11px; }
  #controls #progress{ flex:1 1 auto; width:auto; min-width:80px; max-width:220px; }
  #controls .zs-btn{ width:40px; height:40px; }
  #controls .zs-btn.small{ width:38px; height:38px; }
}
@media (max-height:500px) and (min-width:760px){
  #controls{ height:56px; }
  #controls .zs-btn{ width:38px; height:38px; }
  #controls .zs-btn.small{ width:34px; height:34px; }
  #controls #progress{ width:140px; }
}
</style>
`;

const NOVO_LAYOUT = String.raw`
  zsSingle(){ return window.innerWidth < 820 || window.innerHeight < 500; }
  layout(){
    const sw = this.$('stageWrap');
    if(!this.zsSingle()){
      sw.style.bottom = '';
      const availW = window.innerWidth - 40;
      const availH = window.innerHeight - 92 - 30;
      const scale = Math.min(availW/(this.PW*2), availH/this.PH, 1.15);
      this.scaler.style.transform = 'scale('+scale+')';
      this.zsScale = null;
      this.zsApply();
      return;
    }
    const ch = this.$('controls').offsetHeight || 92;
    sw.style.bottom = ch + 'px';
    const availW = window.innerWidth - 16;
    const availH = window.innerHeight - ch - 16;
    const portrait = window.innerWidth <= window.innerHeight;
    this.zsScale = portrait
      ? Math.min(availW/this.PW, availH/this.PH, 1.3)
      : Math.min(availW/this.PW, 1);
    this.zsApply();
  }
  zsApply(){
    const single = this.zsSingle();
    const book = this.book, sc = this.scaler;
    const L = this.leftEl, R = this.rightEl;
    this.$('reader').classList.toggle('zs-single', single);
    if(!single || !this.zsScale){
      this.zsHalf = 0;
      book.style.transform = ''; book.style.animation = '';
      sc.style.width = ''; sc.style.height = '';
      L.style.visibility = ''; R.style.visibility = '';
      return;
    }
    const s = this.zsScale, half = this.zsHalf || 0;
    sc.style.width = Math.round(this.PW*s) + 'px';
    sc.style.height = Math.round(this.PH*s) + 'px';
    book.style.transform = 'translateX(' + (-half*this.PW*s) + 'px) scale(' + s + ')';
    L.style.visibility = half === 0 ? 'visible' : 'hidden';
    R.style.visibility = half === 1 ? 'visible' : 'hidden';
    book.style.animation = 'none'; void book.offsetWidth; book.style.animation = 'zsIn .22s ease';
    this.updateControls();
  }
  zsInstall(){
    const self = this;
    this.zsHalf = 0;
    const origUpdate = this.updateControls.bind(this);
    const origRender = this.renderStatic.bind(this);
    const origJump = this.jumpTo.bind(this);
    const origSetFont = this.setFont.bind(this);
    const origNext = this.next.bind(this);
    const origPrev = this.prev.bind(this);
    this.renderStatic = function(){ origRender(); self.zsApply(); };
    this.updateControls = function(){
      origUpdate();
      if(!self.zsSingle() || !self.zsScale) return;
      const total = self.pages.length, pos = self.cur + self.zsHalf;
      self.$('folioLabel').textContent = (pos+1) + ' / ' + total;
      const prog = self.$('progress');
      prog.max = Math.max(0, total-1);
      prog.value = pos;
      prog.style.setProperty('--pct', (total>1 ? (pos/(total-1))*100 : 0) + '%');
    };
    this.next = function(){
      if(!self.zsSingle()) return origNext();
      if(self.animating) return;
      if(self.zsHalf === 0 && self.cur + 1 < self.pages.length){ self.zsHalf = 1; self.zsApply(); return; }
      if(self.cur + 2 >= self.pages.length) return;
      self.cur += 2; self.zsHalf = 0; self.renderStatic();
      self.$('stageWrap').scrollTop = 0;
    };
    this.prev = function(){
      if(!self.zsSingle()) return origPrev();
      if(self.animating) return;
      if(self.zsHalf === 1){ self.zsHalf = 0; self.zsApply(); return; }
      if(self.cur - 2 < 0) return;
      self.cur -= 2; self.zsHalf = 1; self.renderStatic();
      self.$('stageWrap').scrollTop = 0;
    };
    this.jumpTo = function(i){
      origJump(i);
      self.zsHalf = (self.zsSingle() && i != null && !isNaN(i) && i % 2 === 1 && self.cur + 1 < self.pages.length) ? 1 : 0;
      self.zsApply();
      self.$('stageWrap').scrollTop = 0;
    };
    this.setFont = function(d){
      const p = self.pages && self.pages[self.cur + (self.zsHalf || 0)];
      const folio = p ? p.folio : null;
      origSetFont(d);
      let half = 0;
      if(self.zsSingle() && folio != null){
        const idx = self.pages.findIndex(function(x){ return x.folio === folio; });
        if(idx >= 0){ self.cur = idx - (idx % 2); half = idx % 2; }
      }
      self.zsHalf = half;
      self.renderStatic();
      self.layout();
    };
    let x0 = null, y0 = null;
    const sw = this.$('stageWrap');
    sw.addEventListener('touchstart', function(e){
      if(e.touches.length !== 1){ x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, {passive:true});
    sw.addEventListener('touchend', function(e){
      if(x0 == null || !self.zsSingle()) return;
      if(window.visualViewport && window.visualViewport.scale > 1.05){ x0 = null; return; }
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5){ if(dx < 0) self.next(); else self.prev(); }
    }, {passive:true});
  }`;

// Aplica o patch ao HTML completo do livro. Devolve { ok, html, motivo }.
// Nunca lança: qualquer problema vira { ok:false, motivo }.
function aplicarPatchLeitor(htmlOriginal) {
  try {
    const iMarcador = htmlOriginal.lastIndexOf(MARCADOR_TEMPLATE);
    if (iMarcador < 0) return { ok: false, motivo: MOTIVO_SEM_BUNDLE };

    // O JSON do template começa logo depois do marcador (na mesma linha ou na
    // seguinte, conforme o bundle) e termina no primeiro "</script>" literal —
    // dentro do JSON, "</" sempre aparece escapado.
    let iLinha = iMarcador + MARCADOR_TEMPLATE.length;
    while (/\s/.test(htmlOriginal[iLinha])) iLinha++;
    const iFim = htmlOriginal.indexOf('</script>', iLinha);
    if (htmlOriginal[iLinha] !== '"' || iFim < 0) return { ok: false, motivo: 'template truncado' };

    let template = JSON.parse(htmlOriginal.slice(iLinha, iFim));
    if (typeof template !== 'string') return { ok: false, motivo: 'template não é string' };

    if (ANCORA_LAYOUT.test(template)) {
      for (const a of [ANCORA_LIMITE_FONTE, ANCORA_INIT, ANCORA_METODO_ESC, ANCORA_FIM_HELMET, ...ANCORAS_EXIGIDAS]) {
        if (!template.includes(a)) return { ok: false, motivo: `âncora não encontrada: ${a.trim().slice(0, 40)}` };
      }

      template = template
        .replace(ANCORA_LAYOUT, () => NOVO_LAYOUT)
        .replace(ANCORA_LIMITE_FONTE, () => 'Math.min(1.6, Math.max(0.8')
        .replace(ANCORA_INIT, () => '    this.bind();\n    this.zsInstall();\n    this.layout();')
        .replace(ANCORA_FIM_HELMET, () => CSS_PATCH + ANCORA_FIM_HELMET);
    } else if (ehMotorB(template)) {
      template = patchMotorB(template);
    } else if (ehMotorC(template)) {
      template = patchMotorC(template);
    } else if (ehMotorD(template)) {
      template = patchMotorD(template);
    } else {
      return { ok: false, motivo: 'leitor não reconhecido (âncora layout() não encontrada)' };
    }

    // '</' precisa sair escapado: o JSON vive dentro de uma <script> do HTML externo.
    const json = JSON.stringify(template).replace(/<\//g, '<\\/');
    return { ok: true, html: htmlOriginal.slice(0, iLinha) + json + htmlOriginal.slice(iFim) };
  } catch (err) {
    return { ok: false, motivo: `exceção: ${err.message}` };
  }
}

// Cache LRU em memória: livroId + mtime do arquivo. Arquivos têm vários MB,
// então o limite é por quantidade de livros (não por bytes).
const CACHE_MAX = 6;
const cache = new Map();

async function lerLivroComPatch(livroId, htmlPath) {
  const { mtimeMs } = await fs.stat(htmlPath);

  const noCache = cache.get(livroId);
  if (noCache && noCache.mtimeMs === mtimeMs) {
    cache.delete(livroId);
    cache.set(livroId, noCache);
    return noCache.html;
  }

  const original = await fs.readFile(htmlPath, 'utf8');
  let html = original;
  const resultado = aplicarPatchLeitor(original);
  if (resultado.ok) {
    html = resultado.html;
  } else if (resultado.motivo !== MOTIVO_SEM_BUNDLE) {
    console.error(`[LEITOR_PATCH_FALHOU] livroId=${livroId} motivo=${resultado.motivo} — entregando o livro original.`);
  }

  cache.set(livroId, { mtimeMs, html });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return html;
}

module.exports = { aplicarPatchLeitor, lerLivroComPatch };
