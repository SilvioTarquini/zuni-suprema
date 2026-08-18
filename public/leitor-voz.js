/**
 * Leitor de Voz com Web Speech API
 * Lê textos em voz alta usando síntese nativa do navegador
 * Suporta: seções de livro (modo legacy), texto livre, ou arquivo remoto
 */

class LeitorDeVoz {
  constructor(opcoes = {}) {
    const synth = window.speechSynthesis;
    const SpeechSynthesisUtterance = window.SpeechSynthesisUtterance || window.webkitSpeechSynthesisUtterance;

    this.suportado = !!(synth && SpeechSynthesisUtterance);
    this.speechSynthesis = synth;
    this.SpeechSynthesisUtterance = SpeechSynthesisUtterance;

    this.utterance = null;
    this.emFala = false;
    this.pausado = false;
    this.botaoAtivo = null;

    // Parâmetros opcionais
    this.textoFonte = opcoes.textoFonte || null;
    this.container = opcoes.container || null;
    this.onIniciar = opcoes.onIniciar || null;
    this.onFinalizar = opcoes.onFinalizar || null;
  }

  async inicializar() {
    if (!this.suportado) {
      console.log('Web Speech API não suportada neste navegador');
      return;
    }

    // Modo 1: Inicializar com seções de heading (compatibilidade com modo antigo)
    const conteudo = document.querySelector('.conteudo-livro');
    if (conteudo) {
      this._inicializarComSecoes(conteudo);
      return;
    }

    // Modo 2: Se textoFonte foi fornecido, buscar e inicializar
    if (this.textoFonte) {
      await this._buscarEInicializar();
    }
  }

  _inicializarComSecoes(conteudo) {
    const secoes = conteudo.querySelectorAll('h2, h3');

    secoes.forEach((secao, index) => {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '12px';
      wrapper.style.marginBottom = '12px';

      const botao = document.createElement('button');
      botao.className = 'btn-ouvir-capitulo';
      botao.innerHTML = '🔊 Ouvir';
      botao.dataset.secaoIndex = index;
      botao.style.cssText = `
        font-size: 0.75rem;
        padding: 6px 12px;
        background: rgba(184, 150, 62, 0.2);
        border: 1px solid var(--dourado);
        color: var(--dourado-suave);
        border-radius: 4px;
        cursor: pointer;
        font-family: Arial, sans-serif;
        font-weight: bold;
        transition: all 0.2s ease;
        white-space: nowrap;
      `;

      botao.addEventListener('mouseenter', () => {
        botao.style.background = 'var(--dourado)';
        botao.style.color = '#0f0f0f';
      });

      botao.addEventListener('mouseleave', () => {
        if (this.botaoAtivo !== botao) {
          botao.style.background = 'rgba(184, 150, 62, 0.2)';
          botao.style.color = 'var(--dourado-suave)';
        }
      });

      botao.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleLeitura(secao, botao, index);
      });

      secao.parentNode.insertBefore(wrapper, secao);
      wrapper.appendChild(botao);
      wrapper.appendChild(secao);
    });

    console.log('✅ Leitor de voz inicializado (modo seções)');
  }

  async _buscarEInicializar() {
    try {
      const res = await fetch(this.textoFonte);
      if (!res.ok) throw new Error(`Erro ao buscar texto: ${res.status}`);
      const texto = await res.text();
      this.texto = texto;
      console.log('✅ Texto carregado para leitura em voz alta');
    } catch (err) {
      console.error('Erro ao buscar texto para leitura:', err);
    }
  }

  extrairTextoSecao(elemento) {
    let conteudo = '';
    let node = elemento.nextSibling;
    const nivelAtual = parseInt(elemento.tagName[1]);

    while (node) {
      if (node.nodeType === 1) {
        const tagName = node.tagName;
        if ((tagName === 'H2' || tagName === 'H3') && node !== elemento) {
          const nivelProximo = parseInt(tagName[1]);
          if (nivelProximo <= nivelAtual) break;
        }

        if (tagName.match(/^H[2-3]$/)) {
          node = node.nextSibling;
          continue;
        }

        if (node.textContent && node.offsetParent !== null) {
          conteudo += node.textContent.trim() + ' ';
        }
      }
      node = node.nextSibling;
    }

    const titulo = elemento.textContent.trim();
    return `${titulo}. ${conteudo.trim()}`;
  }

  toggleLeitura(elemento, botao, index) {
    if (this.emFala) {
      if (this.botaoAtivo === botao) {
        if (this.pausado) {
          this.resumir(botao);
        } else {
          this.pausar(botao);
        }
      } else {
        this.parar();
        this.iniciarLeitura(elemento, botao);
      }
    } else {
      this.iniciarLeitura(elemento, botao);
    }
  }

  iniciarLeitura(elementoOuTexto, botao = null) {
    let texto;

    // Se recebeu um elemento, extrair o texto da seção
    if (elementoOuTexto instanceof HTMLElement) {
      texto = this.extrairTextoSecao(elementoOuTexto);
    } else {
      // Caso contrário, tratá-lo como texto puro
      texto = elementoOuTexto;
    }

    if (!texto || !texto.trim()) {
      console.log('Nenhum texto para ler');
      return;
    }

    this.botaoAtivo = botao;
    this.emFala = true;
    this.pausado = false;

    if (botao) {
      botao.innerHTML = '⏸ Pausar';
      botao.style.background = 'var(--dourado)';
      botao.style.color = '#0f0f0f';
    }

    this.utterance = new this.SpeechSynthesisUtterance(texto);
    this.utterance.lang = 'pt-BR';
    this.utterance.rate = 1.0;
    this.utterance.pitch = 1.0;
    this.utterance.volume = 1.0;

    const vozes = this.speechSynthesis.getVoices();
    const vozPt = vozes.find(v => v.lang.startsWith('pt'));
    if (vozPt) {
      this.utterance.voice = vozPt;
    }

    this.utterance.onend = () => {
      this.emFala = false;
      this.pausado = false;
      if (botao) {
        botao.innerHTML = '🔊 Ouvir';
        botao.style.background = 'rgba(184, 150, 62, 0.2)';
        botao.style.color = 'var(--dourado-suave)';
      }
      this.botaoAtivo = null;
      if (this.onFinalizar) this.onFinalizar();
    };

    this.utterance.onerror = (e) => {
      console.error('Erro ao ler:', e);
      this.parar();
    };

    this.speechSynthesis.cancel();
    this.speechSynthesis.speak(this.utterance);
    if (this.onIniciar) this.onIniciar();
  }

  pausar(botao = null) {
    if (!this.emFala) return;
    this.speechSynthesis.pause();
    this.pausado = true;
    if (botao) botao.innerHTML = '▶ Retomar';
  }

  resumir(botao = null) {
    if (!this.emFala) return;
    this.speechSynthesis.resume();
    this.pausado = false;
    if (botao) botao.innerHTML = '⏸ Pausar';
  }

  parar() {
    if (this.botaoAtivo) {
      this.botaoAtivo.innerHTML = '🔊 Ouvir';
      this.botaoAtivo.style.background = 'rgba(184, 150, 62, 0.2)';
      this.botaoAtivo.style.color = 'var(--dourado-suave)';
    }
    this.speechSynthesis.cancel();
    this.emFala = false;
    this.pausado = false;
    this.botaoAtivo = null;
  }

  estaFalando() {
    return this.emFala;
  }

  estaPausado() {
    return this.pausado;
  }
}

// Auto-inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const leitor = new LeitorDeVoz();
    leitor.inicializar();
    window.leitorDeVoz = leitor;
  });
} else {
  const leitor = new LeitorDeVoz();
  leitor.inicializar();
  window.leitorDeVoz = leitor;
}
