// lib/leitorMobilePaginador.js
//
// Correção do paginador dos leitores "motor A" de Vender Bem, Vender Sempre e Toda Reunião Tem Duas Pautas.
// O paginador original soma a altura dos blocos num contêiner de medida e fecha a página quando passa do limite. Dois
// defeitos deixavam texto cortado (principalmente com A+): (1) uma página com vários blocos podia passar do limite em
// alguns pixels (a regra que leva título para a página seguinte não revalida o encaixe; no Reunião, p. 59 com 7 px) e
// (2) um bloco único maior que a página (tabela, lista, quadro) nunca era dividido.
//
// O patch acrescenta uma etapa depois da paginação original: cada página é montada num contêiner idêntico ao do leitor
// (470x668 px, .pg-content) e conferida; o que não cabe vai para a página seguinte; o que sozinho não cabe é DIVIDIDO
// (parágrafo/citação por palavras, lista por itens, tabela por linhas — com o cabeçalho repetido —, quadro por partes).
// Se mesmo assim algo não couber, o botão A+ não avança para esse tamanho (volta ao último sem corte).
// Nenhuma palavra do livro é alterada: só mudam as quebras de página. Toda âncora é obrigatória (senão, original).

function substituir(texto, alvo, novo) {
  const partes = texto.split(alvo);
  if (partes.length !== 2) throw new Error(`âncora ocorre ${partes.length - 1}x: ${alvo.slice(0, 45)}`);
  return partes[0] + novo + partes[1];
}

const A_FIM_PAGINATE = "    meas.innerHTML='';\n    return pages;\n  }";
const A_SETFONT = '  setFont(delta){\n';
const A_REBUILD = '    this.buildPages();\n    let idx = 0;';
const A_BUILDPAGES = '  buildPages(){\n';

const METODOS = String.raw`  zsAjustar(blocks, pages){
    try{
      const self = this;
      const sonda = document.createElement('div');
      sonda.className = 'page';
      sonda.style.cssText = 'position:absolute;left:-99999px;top:0;width:' + this.PW + 'px;height:' + this.PH + 'px;overflow:hidden;visibility:hidden';
      document.body.appendChild(sonda);
      const cabeHtml = (html) => {
        sonda.innerHTML = '<div class="pg"><div class="pg-content">' + html + '</div></div>';
        const pc = sonda.firstChild.firstChild;
        let fundo = 0;
        for(let i = 0; i < pc.children.length; i++){ const k = pc.children[i]; fundo = Math.max(fundo, k.offsetTop + k.offsetHeight); }
        return pc.scrollHeight <= pc.clientHeight && fundo <= pc.clientHeight;
      };
      const cabe = (idxs) => cabeHtml(idxs.map(i => self.blockHTML(blocks[i])).join(''));
      const cabeBloco = (b) => cabeHtml(self.blockHTML(b));
      const novo = (b) => { blocks.push(b); return blocks.length - 1; };

      // Divide o bloco 'idx' em [parte que cabe numa página vazia, resto]. Devolve null se não souber dividir.
      const dividir = (idx) => {
        const b = blocks[idx];
        if(!b) return null;
        let n = 0, montar = null;
        if(typeof b.text === 'string' && (b.t === 'p' || b.t === 'aside' || b.t === 'quote' || b.t === 'def' || b.t === 'practice' || b.t === 'lead')){
          const w = b.text.split(' ');
          n = w.length;
          const virap = (b.t === 'p' || b.t === 'def' || b.t === 'lead');
          montar = (a, z) => Object.assign({}, b, { text: w.slice(a, z).join(' ') }, a > 0 ? (virap ? { t: 'p', first: false, drop: false } : {}) : {});
        } else if(b.t === 'list' && Array.isArray(b.items)){
          n = b.items.length;
          montar = (a, z) => Object.assign({}, b, { items: b.items.slice(a, z) }, a > 0 ? { label: null } : {});
        } else if(b.t === 'table' && Array.isArray(b.rows)){
          n = b.rows.length;
          montar = (a, z) => Object.assign({}, b, { rows: b.rows.slice(a, z) });
        } else if(b.t === 'callout' && Array.isArray(b.parts) && b.parts.length > 1){
          n = b.parts.length;
          montar = (a, z) => Object.assign({}, b, { parts: b.parts.slice(a, z) }, a > 0 ? { label: null, headline: null, text: null } : {});
        } else if(b.t === 'callout' && typeof b.text === 'string'){
          const w = b.text.split(' ');
          n = w.length;
          montar = (a, z) => Object.assign({}, b, { text: w.slice(a, z).join(' ') }, a > 0 ? { label: null, headline: null } : {});
        }
        if(!montar || n < 2) return null;
        let lo = 1, hi = n - 1, melhor = 0;
        while(lo <= hi){
          const mid = (lo + hi) >> 1;
          if(cabeBloco(montar(0, mid))){ melhor = mid; lo = mid + 1; } else { hi = mid - 1; }
        }
        if(!melhor) return null;
        return [novo(montar(0, melhor)), novo(montar(melhor, n))];
      };

      const ehIntro = (i) => { const lb = blocks[i]; return !!lb && (lb.t === 'sec' || (lb.t === 'p' && /:\**$/.test((lb.text || '').trim()) && (lb.text || '').length < 140)); };

      const fila = pages.map(l => l.slice());
      const saida = [];
      let guarda = 0;
      while(fila.length){
        if(++guarda > 20000) throw new Error('paginação não convergiu');
        let cur = fila.shift();
        let sobra = [];
        while(cur.length > 1 && !cabe(cur)) sobra.unshift(cur.pop());
        if(sobra.length){ while(cur.length > 1 && ehIntro(cur[cur.length - 1])) sobra.unshift(cur.pop()); }
        if(cur.length === 1 && !cabe(cur)){
          const partes = dividir(cur[0]);
          if(partes){ cur = [partes[0]]; sobra.unshift(partes[1]); }
        }
        saida.push(cur);
        if(sobra.length){ if(fila.length) fila[0] = sobra.concat(fila[0]); else fila.push(sobra); }
      }
      let cortes = 0;
      for(const l of saida) if(!cabe(l)) cortes++;
      sonda.remove();
      this.zsCortes = (this.zsCortes || 0) + cortes;
      return saida;
    }catch(err){
      if(window.console) console.error('[zs-paginador]', err);
      return pages;
    }
  }

`;

function patchPaginador(template) {
  const m = /localStorage\.setItem\('([A-Za-z0-9_]+_font)', this\.fontScale\)/.exec(template);
  if (!m) throw new Error('âncora não encontrada: chave de fonte no localStorage');
  const chave = m[1];
  let t = template;
  t = substituir(t, A_FIM_PAGINATE, "    meas.innerHTML='';\n    return this.zsAjustar(blocks, pages);\n  }");
  // buildPages passa a somar os cortes de TODOS os capítulos e a guardar o último tamanho de fonte sem corte.
  t = substituir(t, A_BUILDPAGES, '  buildPages(){\n    this.zsCortes = 0;\n    this.zsBuildOriginal();\n    if(!this.zsCortes) this.zsFonteOk = this.fontScale;\n  }\n\n  zsBuildOriginal(){\n');
  t = substituir(t, A_SETFONT, METODOS + A_SETFONT);
  t = substituir(t, A_REBUILD,
    '    this.buildPages();\n'
    + '    if(delta > 0 && this.zsCortes > 0 && this.zsFonteOk){\n'
    + '      this.fontScale = this.zsFonteOk;\n'
    + "      localStorage.setItem('" + chave + "', this.fontScale);\n"
    + "      document.documentElement.style.setProperty('--zs-fs', this.fontScale);\n"
    + '      this.buildPages();\n'
    + '    }\n'
    + '    let idx = 0;');
  return t;
}

module.exports = { patchPaginador };
