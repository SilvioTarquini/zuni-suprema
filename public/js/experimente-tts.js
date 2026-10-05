// Leitura em voz alta do trecho (Experimente ZUNI) com a voz do navegador (Web Speech API).
// Custo zero: nenhuma requisição de rede, nenhum arquivo de áudio. Isolado da página para ser testado em Node.
//
// Estados: 'parado' | 'falando' | 'pausado'
//
// Pausar não usa speechSynthesis.pause(): em vários Android/Chrome ele é ignorado ou trava. Em vez disso
// cancela a fala e guarda o índice do trecho atual; "Continuar" recomeça a partir dele. O texto é falado
// em pedaços curtos (frases) — utterances longas são cortadas pelo Chrome depois de alguns segundos.
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ZuniExperimenteTTS = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {

  const MAX_PEDACO = 220;

  // Divide em pedaços falados: frases, e quebra frases muito longas em vírgulas/espaços.
  function dividirEmPedacos(texto) {
    const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
    if (!limpo) return [];
    const frases = limpo.match(/[^.!?…]+[.!?…]*["”')\]]*\s*/g) || [limpo];
    const pedacos = [];
    for (let frase of frases) {
      frase = frase.trim();
      while (frase.length > MAX_PEDACO) {
        let corte = frase.lastIndexOf(',', MAX_PEDACO);
        if (corte < 60) corte = frase.lastIndexOf(' ', MAX_PEDACO);
        if (corte < 1) corte = MAX_PEDACO;
        pedacos.push(frase.slice(0, corte + 1).trim());
        frase = frase.slice(corte + 1).trim();
      }
      if (frase) pedacos.push(frase);
    }
    return pedacos;
  }

  function escolherVoz(vozes) {
    const lista = Array.from(vozes || []);
    const ptBR = lista.filter((v) => /^pt[-_]BR$/i.test(v.lang));
    const pt = lista.filter((v) => /^pt/i.test(v.lang));
    const preferida = (arr) => arr.find((v) => v.localService) || arr[0] || null;
    return { voz: preferida(ptBR) || preferida(pt), ptDisponivel: ptBR.length > 0 || pt.length > 0 };
  }

  // synth: window.speechSynthesis; Utterance: SpeechSynthesisUtterance; onEstado({estado, ptDisponivel, indice, total})
  function criarLeitor({ synth, Utterance, texto, onEstado }) {
    const suportado = Boolean(synth && Utterance);
    const pedacos = dividirEmPedacos(texto);
    let estado = 'parado';
    let indice = 0;
    let geracao = 0; // invalida callbacks de falas canceladas
    let ptDisponivel = true;

    function avisar() {
      if (typeof onEstado === 'function') {
        try { onEstado({ estado, ptDisponivel, indice, total: pedacos.length }); } catch (e) {}
      }
    }

    function falarAPartirDe(i) {
      if (!suportado || !pedacos.length) return;
      const minha = ++geracao;
      indice = i;
      estado = 'falando';
      avisar();
      try { synth.cancel(); } catch (e) {}
      const { voz, ptDisponivel: pt } = escolherVoz(typeof synth.getVoices === 'function' ? synth.getVoices() : []);
      ptDisponivel = pt;

      const proximo = () => {
        if (minha !== geracao) return;
        if (indice >= pedacos.length) { estado = 'parado'; indice = 0; avisar(); return; }
        const u = new Utterance(pedacos[indice]);
        u.lang = 'pt-BR';
        if (voz) u.voice = voz;
        u.rate = 1;
        u.onend = () => { if (minha !== geracao) return; indice += 1; proximo(); };
        u.onerror = () => { if (minha !== geracao) return; estado = 'parado'; indice = 0; avisar(); };
        avisar();
        try { synth.speak(u); } catch (e) { estado = 'parado'; indice = 0; avisar(); }
      };
      proximo();
    }

    return {
      suportado,
      estado: () => estado,
      iniciar() { if (estado === 'parado') falarAPartirDe(0); },
      pausar() {
        if (estado !== 'falando') return;
        geracao += 1; // descarta o onend do pedaço cancelado
        try { synth.cancel(); } catch (e) {}
        estado = 'pausado';
        avisar();
      },
      continuar() { if (estado === 'pausado') falarAPartirDe(indice); },
      parar() {
        geracao += 1;
        try { if (synth) synth.cancel(); } catch (e) {}
        const mudou = estado !== 'parado';
        estado = 'parado';
        indice = 0;
        if (mudou) avisar();
      }
    };
  }

  return { criarLeitor, dividirEmPedacos, escolherVoz };
});
