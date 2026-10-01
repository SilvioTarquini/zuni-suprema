// lib/leitorMobileMotoresCD.js
//
// Patches de celular para os dois leitores restantes (os demais estão em
// leitorMobile.js — motor A — e leitorMobileMotorB.js):
//
//  motor C — inesquecivel-charme-feminino: leitor declarativo cuja dupla de
//    páginas usa tamanhos em px e vaza da tela. Em telas estreitas/baixas a
//    dupla (940x720) é escalada por variável CSS e deslocada para mostrar uma
//    página por vez; a barra de controles quebra em linhas e fica colada
//    embaixo.
//
//  motor D — a-arquitetura-da-decisao-humana: documento em folhas A4 de 794px
//    (modo rolagem) que ficavam cortadas à esquerda. Em telas estreitas as
//    folhas passam a ocupar a largura da tela (o texto reflui), a coluna de
//    botões encolhe e o "modo livro" (duas folhas de 1588px) fica oculto.
//    Os botões +/− (zoom) continuam funcionando.
//
// Toda âncora é obrigatória: se faltar alguma, substituir() lança e o
// chamador devolve o livro original (ver lerLivroComPatch).

function substituir(texto, alvo, novo) {
  if (typeof alvo === 'string') {
    const partes = texto.split(alvo);
    if (partes.length !== 2) throw new Error(`âncora ocorre ${partes.length - 1}x: ${alvo.slice(0, 45)}`);
    return partes[0] + novo + partes[1];
  }
  if (!alvo.test(texto)) throw new Error(`âncora não encontrada: ${String(alvo).slice(0, 45)}`);
  return texto.replace(alvo, () => novo);
}

// ---------------------------------------------------------------- motor C
const SPREAD_C = '<div style="display: flex; height: min(74dvh, 720px); max-width: 100%; aspect-ratio: 3 / 2; background: #efe6d8; box-shadow: 0 30px 70px rgba(0,0,0,0.55); border-radius: 3px; overflow: hidden;">';
const CONTROLES_C = '<div style="display: flex; align-items: center; gap: 14px; color: #e8cf8e;">';

const CSS_C = String.raw`<style id="zs-leitor-mobile-c">
.zsclip{ display:contents; }
@media (max-width:819px),(max-height:499px){
  .zsclip{ display:block; position:relative; flex:none; overflow-x:hidden; overflow-y:hidden;
    width:min(calc(470px * var(--zs-s, 1)), calc(100vw - 16px)); height:calc(720px * var(--zs-s, 1)); }
  html.zs-zoomed .zsclip{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
  .zsscale{ width:calc(940px * var(--zs-s, 1)); height:calc(720px * var(--zs-s, 1)); }
  .zsspread{ width:940px !important; height:720px !important; max-width:none !important;
    aspect-ratio:auto !important; flex:none !important; transform-origin:0 0;
    transform:scale(var(--zs-s, 1)); }
  .zsctl{ flex-wrap:wrap !important; justify-content:center; gap:8px 8px !important; max-width:100%;
    position:sticky; bottom:0; z-index:5; background:#170b11; padding:8px 4px calc(8px + env(safe-area-inset-bottom, 0px)); }
  div:has(.zsclip){ box-sizing:border-box !important; max-width:100vw !important; }
  .zsctl > input[type=range]{ width:110px !important; }
  .zsctl > :nth-child(2){ min-width:70px !important; }
  .zsctl > :nth-child(10){ display:none !important; }
  .zsctl > button{ padding:8px 10px !important; }
  .zsctl > :nth-child(5){ flex:0 0 100%; width:100% !important; height:0 !important; margin:0 !important; background:none !important; }
}
</style>
`;

const METODOS_C = String.raw`
  zsSingle(){ return window.innerWidth < 820 || window.innerHeight < 500; }
  zsFit(){
    const el = document.documentElement;
    if(!this.zsSingle()){ el.style.removeProperty('--zs-s'); el.classList.remove('zs-zoomed'); return; }
    const availW = window.innerWidth - 16;
    const portrait = window.innerWidth <= window.innerHeight;
    const fit = portrait ? Math.min(availW / 470, 1.3) : Math.min(availW / 470, 1);
    const z = this.zsZoom || 1;
    this.zsS = fit * z;
    el.style.setProperty('--zs-s', this.zsS);
    el.classList.toggle('zs-zoomed', z > 1.001);
    const self = this;
    requestAnimationFrame(function(){
      const clip = document.querySelector('.zsclip');
      if(clip) clip.scrollTo({ left: (self.zsHalf || 0) * 470 * self.zsS, behavior: 'smooth' });
    });
  }
  zsZoomBy(d){
    if(!this.zsSingle()) return false;
    this.zsZoom = Math.min(1.7, Math.max(0.8, Math.round(((this.zsZoom || 1) + d) * 100) / 100));
    this.zsFit();
    return true;
  }
  zsReset(){ this.zsHalf = 0; this.zsFit(); }
  zsNext(idx, max){
    if(this.zsSingle() && !this.zsHalf){ this.zsHalf = 1; this.zsFit(); return; }
    this.zsHalf = 0; this.zsFit();
    this.setState({ spreadIndex: this.clampSpread(idx + 1, max) });
  }
  zsPrev(idx, max){
    if(this.zsSingle() && this.zsHalf){ this.zsHalf = 0; this.zsFit(); return; }
    if(idx <= 0) return;
    this.zsHalf = this.zsSingle() ? 1 : 0; this.zsFit();
    this.setState({ spreadIndex: this.clampSpread(idx - 1, max) });
  }
  zsInit(){
    const self = this;
    this.zsHalf = 0; this.zsZoom = 1; this.zsFit();
    window.addEventListener('resize', function(){ self.zsFit(); });
    let x0 = null, y0 = null;
    document.addEventListener('touchstart', function(e){
      if(e.touches.length !== 1){ x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, {passive:true});
    document.addEventListener('touchend', function(e){
      if(x0 == null || !self.zsSingle() || !self.state.opened || (self.zsZoom || 1) > 1.001) { x0 = null; return; }
      if(window.visualViewport && window.visualViewport.scale > 1.05){ x0 = null; return; }
      if(e.target && e.target.closest && e.target.closest('.zsctl')){ x0 = null; return; }
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && self.zsNav){ if(dx < 0) self.zsNav.next(); else self.zsNav.prev(); }
    }, {passive:true});
  }
`;

function patchMotorC(template) {
  let t = template;
  t = substituir(t, SPREAD_C, '<div class="zsclip"><div class="zsscale"><div class="zsspread" style="display: flex; height: min(74dvh, 720px); max-width: 100%; aspect-ratio: 3 / 2; background: #efe6d8; box-shadow: 0 30px 70px rgba(0,0,0,0.55); border-radius: 3px; overflow: hidden;">');
  t = substituir(t, CONTROLES_C, '</div></div><div class="zsctl" style="display: flex; align-items: center; gap: 14px; color: #e8cf8e;">');
  t = substituir(t, '</helmet>', CSS_C + '</helmet>');

  t = substituir(t, '  componentDidMount() {', METODOS_C + '\n  componentDidMount() {\n    this.zsInit();');
  t = substituir(t, 'goPrev: () => this.setState({ spreadIndex: this.clampSpread(idx - 1, maxSpread) }),',
    'goPrev: () => this.zsPrev(idx, maxSpread),');
  t = substituir(t, 'goNext: () => this.setState({ spreadIndex: this.clampSpread(idx + 1, maxSpread) }),',
    'goNext: () => this.zsNext(idx, maxSpread),');
  t = substituir(t, 'onSlide: (e) => this.setState(', 'onSlide: (e) => this.zsReset() || this.setState(');
  t = substituir(t, 'const jumpTo = (i) => () => this.setState(', 'const jumpTo = (i) => () => this.zsReset() || this.setState(');
  t = substituir(t, 'incFont: () => this.setState(', 'incFont: () => this.zsZoomBy(0.15) || this.setState(');
  t = substituir(t, 'decFont: () => this.setState(', 'decFont: () => this.zsZoomBy(-0.15) || this.setState(');
  t = substituir(t, 'goCover: () => this.setState(', 'goCover: () => this.zsReset() || this.setState(');
  // expõe next/prev da renderização atual para o deslize
  t = substituir(t, '      readerRef: this.readerRef,',
    '      readerRef: this.readerRef,\n      zsExpose: (this.zsNav = { next: () => this.zsNext(idx, maxSpread), prev: () => this.zsPrev(idx, maxSpread) }) && undefined,');
  return t;
}

function ehMotorC(template) {
  return template.includes(SPREAD_C) && template.includes('goNext: () => this.setState({ spreadIndex');
}

// ---------------------------------------------------------------- motor D
const CSS_D = String.raw`<style id="zs-leitor-mobile-d">
@media (max-width:819px){
  .reader > .sheet, .sheet{ width:100% !important; min-height:0 !important; margin:0 0 10px !important; box-sizing:border-box; }
  .sheet-content{ padding:44px 20px 70px !important; }
  .sheet.bleed .sheet-content{ padding:0 !important; }
  .cover{ min-height:100vh !important; }
  .cover-frame{ max-width:100% !important; }
  section.cover-image{ min-height:0 !important; }
  section.cover-image img{ max-width:100% !important; height:auto !important; }
  .rail{ right:8px !important; top:auto !important; bottom:70px !important; transform:none !important; gap:8px !important; }
  .rail-btn{ width:38px !important; height:38px !important; font-size:15px !important; }
  .rail-btn[data-act="mode"]{ display:none !important; }
  .rail-btn .tip{ display:none !important; }
  .nav-arrow{ display:none !important; }
  .page-pill{ bottom:14px !important; }
  .toc{ width:min(340px, 88vw) !important; }
}
</style>
`;


function patchMotorD(template) {
  let t = template;
  t = substituir(t, '</head>', CSS_D + '</head>');
  // o modo livro (duas folhas de 1588px) não cabe no celular: ignora o estado salvo
  t = substituir(t, "if(d.mode==='flip')", "if(d.mode==='flip' && window.innerWidth>=820)");
  return t;
}

function ehMotorD(template) {
  return template.includes("var PKEY='zuni_adh_reader_v1'") && template.includes("mode='scroll'");
}

module.exports = { patchMotorC, ehMotorC, patchMotorD, ehMotorD };
