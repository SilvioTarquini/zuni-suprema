// lib/leitorMobileTerra.js
//
// Patch de leitura do flipbook "Da Terra ao Resultado" (private/livros/da-terra-ao-resultado/index.html), aplicado na
// hora de servir (ver leitorMobile.js). Esse livro NÃO usa o bundle dos outros leitores: são 239 <article class="page">
// pré-montadas, com altura fixa e overflow:hidden. Num celular a altura da página depende da tela (100vh), então o
// texto era cortado e o A+ não repaginava. Dois ajustes, sem tocar no TEXTO do livro:
//
//  1. Telas de até 960 px: rolagem contínua. As páginas passam a ter altura natural e overflow visível, uma abaixo da
//     outra; sumário, busca, barra de progresso e "Capa" levam a página escolhida por rolagem; o indicador mostra o
//     capítulo atual ("Cap. 4 · 35/239"); setas de página e deslize lateral ficam desligados. Computador: inalterado.
//  2. Impressão: sem min-height:95vh por página (que gerava folhas a mais). Altura natural, @page A4 com margens,
//     quebra de página só na capa, folha de rosto, páginas de arte, encerramento e abertura de capítulo.
//
// Toda âncora é obrigatória: se faltar alguma, devolve { ok:false } e o chamador entrega o livro original.

const MARCADOR_LEITOR = 'zuni-terra-pos';
const ANCORAS = ['</head>', '</body>', 'id="tocOverlay"', 'id="progress"', 'id="status"', 'class="viewport"', 'class="stage"', 'function render()', 'function step(d)'];

function ehLeitorDaTerra(html) {
  return typeof html === 'string' && html.includes(MARCADOR_LEITOR) && html.includes('class="topbar"') && html.includes('class="book-shell"');
}

const CSS_TERRA = String.raw`<style id="zs-leitor-terra">
@media screen and (max-width:960px){
  .viewport{overflow-y:auto !important; overflow-x:hidden !important; align-items:flex-start !important; -webkit-overflow-scrolling:touch; overscroll-behavior:contain}
  .book-shell{display:block !important; height:auto !important}
  .stage{display:block !important; height:auto !important; padding:2px 12px 28px !important; gap:0 !important}
  .page,.page.active{display:block !important; width:100% !important; max-width:620px; margin:0 auto 12px !important; height:auto !important; max-height:none !important; aspect-ratio:auto !important; overflow:visible !important}
  .page:not([data-kind="text"]){aspect-ratio:10/16 !important}
  .text-shell{height:auto !important; overflow:visible !important; padding-bottom:1.9rem !important}
  .navbtn{display:none !important}
  /* Página só com um subtítulo (o pré-montado deixou o título isolado): em rolagem ele fica colado ao texto que o segue. */
  .page[data-kind="text"]:has(> .text-shell > :is(h2,h3,h4):only-child){background:none !important; box-shadow:none !important; margin-bottom:-6px !important; padding-top:.2rem !important; padding-bottom:0 !important}
  .page[data-kind="text"]:has(> .text-shell > :is(h2,h3,h4):only-child) .text-shell{padding-bottom:0 !important}
  .page[data-kind="text"]:has(> .text-shell > :is(h2,h3,h4):only-child) .folio{display:none}
  .status{flex:none !important; min-width:0 !important; font-size:.78rem; white-space:nowrap}
  .bottombar #progress{flex:1 1 40px !important; min-width:40px !important; width:auto}
  .bottombar button{padding-left:.5rem !important; padding-right:.5rem !important}
}
@media print{
  @page{size:A4; margin:16mm 15mm 18mm}
  html,body{height:auto !important; overflow:visible !important; background:#fff !important}
  body{display:block !important}
  .viewport,.book-shell,.stage{display:block !important; height:auto !important; overflow:visible !important; padding:0 !important; max-width:none !important}
  .page,.page.active{display:block !important; width:100% !important; max-width:none !important; height:auto !important; min-height:0 !important; max-height:none !important; aspect-ratio:auto !important;
    margin:0 0 3mm !important; padding:0 !important; overflow:visible !important; border-radius:0 !important; box-shadow:none !important;
    break-after:auto !important; page-break-after:auto !important; break-before:auto !important; page-break-before:auto !important}
  .page[data-kind="cover"],.page[data-kind="title"],.page[data-kind="art"],.page[data-kind="closing"]{
    width:153mm !important; height:244mm !important; margin:0 auto !important; overflow:hidden !important;
    break-before:page !important; page-break-before:always !important; break-after:page !important; page-break-after:always !important}
  .page[data-kind="cover"]{break-before:auto !important; page-break-before:auto !important}
  .page[data-kind="text"]:has(> .text-shell > .major:first-child){break-before:page !important; page-break-before:always !important}
  .text-shell{height:auto !important; overflow:visible !important; padding:0 !important}
  .folio{display:none !important}
  .major,.subhead,.minor{break-after:avoid; page-break-after:avoid}
  .bodyp{orphans:3; widows:3}
  .cover-image,.cover-image img{height:100% !important}
}
</style>
`;

const JS_TERRA = String.raw`<script id="zs-leitor-terra">
(function(){
  try{
    var viewport=document.querySelector('.viewport'), stage=document.querySelector('.stage');
    var toc=[].slice.call(document.querySelectorAll('.toc-link')).map(function(b){
      var s=b.querySelector('span'); return {go:Number(b.dataset.go), nome:(s?s.textContent:'').trim()};
    }).sort(function(a,b){return a.go-b.go});
    var renderOriginal=render, rolando=0, fila=0;

    function rotulo(i){
      var n=i+1, c=null;
      for(var k=0;k<toc.length;k++){ if(toc[k].go<=n) c=toc[k]; else break; }
      if(!c) return '';
      var m=/^(\d+)\s/.exec(c.nome);
      return m ? 'Cap. '+m[1] : c.nome;
    }
    function indicador(){
      progressEl.value=index+1;
      var r=rotulo(index);
      statusEl.textContent=(r?r+' · ':'')+(index+1)+'/'+pages.length;
      document.title='Da Terra ao Resultado — '+(index+1)+'/'+pages.length;
      document.getElementById('prev').disabled=index<=0;
      document.getElementById('next').disabled=index>=pages.length-1;
      try{ localStorage.setItem('zuni-terra-pos',index); }catch(e){}
    }
    function irPara(i){
      var p=pages[i]; if(!p) return;
      rolando=Date.now()+450;
      viewport.scrollTop += p.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 6;
    }
    function paginaVisivel(){
      var topo=viewport.getBoundingClientRect().top+12, lo=0, hi=pages.length-1;
      while(lo<hi){ var mid=(lo+hi+1)>>1; if(pages[mid].getBoundingClientRect().top<=topo) lo=mid; else hi=mid-1; }
      return lo;
    }

    render=function(){
      if(!mobile()){ document.documentElement.classList.remove('zs-rolagem'); return renderOriginal(); }
      document.documentElement.classList.add('zs-rolagem');
      irPara(index);
      indicador();
    };

    viewport.addEventListener('scroll',function(){
      if(!mobile() || Date.now()<rolando || fila) return;
      fila=requestAnimationFrame(function(){
        fila=0;
        var i=paginaVisivel();
        if(i!==index){ index=i; indicador(); }
      });
    },{passive:true});

    // Deslize lateral (troca de página do modo livro) não faz sentido em rolagem: desliga só no celular.
    ['touchstart','touchend'].forEach(function(t){
      stage.addEventListener(t,function(e){ if(mobile()) e.stopImmediatePropagation(); },true);
    });
    // Mudar fonte/espaçamento altera as alturas: mantém a página atual na tela.
    ['fontMinus','fontPlus','spaceBtn'].forEach(function(id){
      var b=document.getElementById(id);
      if(b) b.addEventListener('click',function(){ if(mobile()) requestAnimationFrame(function(){ irPara(index); }); });
    });
    addEventListener('resize',function(){ if(mobile()) render(); });
    addEventListener('load',function(){ if(mobile()) irPara(index); });
    if(mobile()) render();
  }catch(err){ if(window.console) console.error('[zs-leitor-terra]',err); }
})();
</script>
`;

// Devolve { ok, html } ou { ok:false, motivo }. Nunca lança.
function patchDaTerra(html) {
  try {
    if (!ehLeitorDaTerra(html)) return { ok: false, motivo: 'não é o leitor estático do Da Terra' };
    for (const a of ANCORAS) {
      if (!html.includes(a)) return { ok: false, motivo: `âncora não encontrada: ${a}` };
    }
    if (html.split('</head>').length !== 2) return { ok: false, motivo: '</head> ausente ou repetido' };
    const iBody = html.lastIndexOf('</body>');
    const comCss = html.replace('</head>', () => CSS_TERRA + '</head>');
    const fim = comCss.lastIndexOf('</body>');
    if (fim < 0 || iBody < 0) return { ok: false, motivo: '</body> ausente' };
    return { ok: true, html: comCss.slice(0, fim) + JS_TERRA + comCss.slice(fim) };
  } catch (err) {
    return { ok: false, motivo: `exceção: ${err.message}` };
  }
}

module.exports = { patchDaTerra, ehLeitorDaTerra };
