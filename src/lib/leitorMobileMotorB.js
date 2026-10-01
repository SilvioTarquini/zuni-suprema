// lib/leitorMobileMotorB.js
//
// Patch de celular para o "motor B" do flipbook: o leitor declarativo
// (sc-if/sc-for) com estado em React e páginas num módulo bookPages*.js —
// usado por a-inteligencia-da-vida, a-neurobiologia-integrativa-da-depressao
// e a-visao-integrativa-da-obesidade. O motor A (a maioria dos livros) está
// em leitorMobile.js.
//
// Mesma ideia do motor A: em telas estreitas/baixas mostra UMA página por vez
// (a dupla é escalada e deslocada para a metade esquerda ou direita), a barra
// de controles quebra em duas linhas e A+/A− têm limite maior. Em telas largas
// nada muda. Toda âncora é obrigatória: se faltar alguma, substituir() lança e
// o chamador devolve o livro original.

function substituir(texto, alvo, novo) {
  const partes = typeof alvo === 'string' ? texto.split(alvo) : null;
  if (partes) {
    if (partes.length !== 2) throw new Error(`âncora (motor B) ocorre ${partes.length - 1}x: ${alvo.slice(0, 45)}`);
    return partes[0] + novo + partes[1];
  }
  if (!alvo.test(texto)) throw new Error(`âncora (motor B) não encontrada: ${String(alvo).slice(0, 45)}`);
  return texto.replace(alvo, () => novo);
}

const CSS_B = String.raw`<style id="zs-leitor-mobile-b">
@media (max-width:759px){
  .zsb{ height:auto !important; padding:8px 10px calc(8px + env(safe-area-inset-bottom, 0px)) !important; gap:6px 10px !important; }
  .zsb > :nth-child(7){ display:none !important; }
  .zsb > :nth-child(4), .zsb > :nth-child(5), .zsb > :nth-child(6){ order:-2; }
  .zsb > :nth-child(3){ order:-1; flex:0 0 100% !important; width:100% !important; height:0 !important; background:none !important; }
  img[alt="capa"]{ max-height:calc(100vh - 380px) !important; }
}
@media (max-height:500px) and (min-width:760px){
  .zsb{ height:60px !important; }
}
</style>
`;

const METODOS_B = String.raw`
  zsSingle(){ return window.innerWidth < 820 || window.innerHeight < 500; }
  zsBarH(){ return window.innerWidth < 760 ? 112 : (window.innerHeight < 500 ? 60 : 88); }
  zsSolo(){ return !!(this.state.pages && this.isSoloAt(this.state.cur)); }
  zsEffScale(){
    if(!this.zsSingle()){
      const availW0 = window.innerWidth - 60, availH0 = window.innerHeight - 140;
      return Math.max(0.35, Math.min(1.15, availW0 / (LEAF_W * 2), availH0 / BOOK_H));
    }
    const availW = window.innerWidth - 16, availH = window.innerHeight - this.zsBarH() - 16;
    const unitW = LEAF_W;
    const portrait = window.innerWidth <= window.innerHeight;
    return portrait ? Math.min(availW / unitW, availH / BOOK_H, 1.3) : Math.min(availW / unitW, 0.8);
  }
  zsPanX(){
    if(!this.zsSingle()) return 0;
    return (this.zsHalf === 1 ? -1 : 1) * (LEAF_W / 2) * this.zsEffScale();
  }
  zsLimitesY(){
    const s = this.zsEffScale(), scaledH = BOOK_H * s;
    const y0 = window.innerHeight / 2;
    const max = 8 - y0 + scaledH / 2;
    const min = window.innerHeight - this.zsBarH() - 8 - y0 - scaledH / 2;
    return { min: Math.min(min, max), max: Math.max(min, max), cabe: scaledH <= window.innerHeight - this.zsBarH() - 16 };
  }
  zsPanY(){
    if(!this.zsSingle()) return 0;
    const l = this.zsLimitesY();
    if(l.cabe) return 0;
    const v = (this.zsPY == null) ? l.max : this.zsPY;
    return Math.min(l.max, Math.max(l.min, v));
  }
  zsSetHalf(h){
    this.zsHalf = h; this.zsPY = null;
    this.setState({ zsTick: Date.now() }, () => this.zsApplyVis());
  }
  zsApplyVis(){
    if(!this.leftEl || !this.rightEl) return;
    if(!this.zsSingle() || this.zsSolo()){ return; } // página solo ocupa o livro todo; o deslocamento já mostra a metade certa
    this.leftEl.style.visibility = this.zsHalf === 1 ? 'hidden' : 'visible';
    this.rightEl.style.visibility = this.zsHalf === 1 ? 'visible' : 'hidden';
  }
  zsBindTouch(){
    const self = this;
    let x0 = null, y0 = null, p0 = 0;
    document.addEventListener('touchstart', function(e){
      if(e.touches.length !== 1 || !self.state.opened){ x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; p0 = self.zsPanY();
    }, {passive:true});
    document.addEventListener('touchmove', function(e){
      if(x0 == null || !self.zsSingle()) return;
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if(Math.abs(dy) > Math.abs(dx) && !self.zsLimitesY().cabe){
        self.zsPY = p0 + dy; self.setState({ zsTick: Date.now() });
      }
    }, {passive:true});
    document.addEventListener('touchend', function(e){
      if(x0 == null || !self.zsSingle()) { x0 = null; return; }
      if(window.visualViewport && window.visualViewport.scale > 1.05){ x0 = null; return; }
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if(e.target && e.target.closest && e.target.closest('.zsb')) return;
      if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5){ if(dx < 0) self.next(); else self.prev(); }
    }, {passive:true});
  }
  next(){
    if(!this.zsSingle()) return this.zsNextOrig();
    const { pages, cur, phase } = this.state;
    if(!pages || phase === 'anim') return;
    if(this.zsHalf !== 1 && (this.zsSolo() || pages[cur + 1])){ this.zsSetHalf(1); return; }
    const nextCur = cur + this.step(cur);
    if(nextCur >= pages.length) return;
    this.zsHalf = 0; this.zsPY = null;
    this.setState({ cur: nextCur, tocOpen: false }, () => { this.paintStatic(); });
  }
  prev(){
    if(!this.zsSingle()) return this.zsPrevOrig();
    const { pages, cur, phase } = this.state;
    if(!pages || phase === 'anim') return;
    if(this.zsHalf === 1){ this.zsSetHalf(0); return; }
    if(cur <= 0) return;
    const prevCur = Math.max(0, cur - (this.zsSolo() ? 1 : 2));
    this.zsHalf = (this.isSoloAt(prevCur) || pages[prevCur + 1]) ? 1 : 0; this.zsPY = null;
    this.setState({ cur: prevCur, tocOpen: false }, () => { this.paintStatic(); });
  }
  paintStatic(){ this.zsPaintStaticOrig(); this.zsApplyVis(); }
`;

const FIT_SCALE_NOVO = String.raw`fitScale = () => {
    this.zsPY = null;
    this.setState({ scale: this.zsEffScale(), zsTick: Date.now() }, () => this.zsApplyVis());
  };`;

function patchMotorB(template) {
  let t = template;

  // template: translação + escala, e classe na barra de controles
  t = substituir(t, '<div style="transform:scale({{ scale }});transition:transform .2s ease">',
    '<div style="transform:translate({{ zsPanX }}px,{{ zsPanY }}px) scale({{ scale }});transition:transform .2s ease">');
  t = substituir(t, '<div style="position:absolute;left:0;right:0;bottom:0;height:88px;z-index:30;',
    '<div class="zsb" style="position:absolute;left:0;right:0;bottom:0;height:88px;z-index:30;');
  t = substituir(t, '</helmet>', CSS_B + '</helmet>');

  // script: escala/pan calculados pelos métodos novos
  t = substituir(t, /fitScale = \(\) => \{[\s\S]*?\n  \};/, FIT_SCALE_NOVO);
  t = substituir(t, '      scale: this.state.scale,',
    '      scale: this.zsEffScale(), zsPanX: this.zsPanX(), zsPanY: this.zsPanY(),');
  t = substituir(t, '  paintStatic() {', METODOS_B + '\n  zsPaintStaticOrig() {');
  t = substituir(t, '  next() {', '  zsNextOrig() {');
  t = substituir(t, '  prev() {', '  zsPrevOrig() {');
  t = substituir(t, "    window.addEventListener('resize', this.fitScale);",
    "    window.addEventListener('resize', this.fitScale);\n    this.zsBindTouch();");

  // jumpTo/goCover/scrub voltam sempre para a metade esquerda
  t = substituir(t, /this\.setState\(\{ cur: idx, tocOpen: false \}/,
    'this.setState({ cur: idx, tocOpen: false, zsReset: (this.zsHalf = 0) }');
  t = substituir(t, /this\.setState\(\{ cur: 0, tocOpen: false \}/,
    'this.setState({ cur: 0, tocOpen: false, zsReset: (this.zsHalf = 0) }');
  t = substituir(t, /this\.setState\(\{ cur: v \}/,
    'this.setState({ cur: v, zsReset: (this.zsHalf = 0) }');

  // A+ chega a 1,6
  t = substituir(t, 'Math.min(1.4, s.fontScale + 0.1)', 'Math.min(1.6, s.fontScale + 0.1)');
  return t;
}

function ehMotorB(template) {
  return template.includes('fitScale = () => {') && template.includes('const LEAF_W = 480');
}

module.exports = { patchMotorB, ehMotorB };
