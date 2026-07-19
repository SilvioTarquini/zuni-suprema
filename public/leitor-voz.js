/**
 * Leitor de Voz com Web Speech API
 * Lê capítulos/seções de livros em voz alta usando síntese nativa do navegador
 * Sem custos, sem API keys, funciona offline
 */

class LeitorDeVoz {
  constructor() {
    // Verificar suporte
    const synth = window.speechSynthesis;
    const SpeechSynthesisUtterance = window.SpeechSynthesisUtterance || window.webkitSpeechSynthesisUtterance;

    this.suportado = !!(synth && SpeechSynthesisUtterance);
    this.speechSynthesis = synth;
    this.SpeechSynthesisUtterance = SpeechSynthesisUtterance;

    this.utterance = null;
    this.emFala = false;
    this.pausado = false;
    this.botaoAtivo = null;
  }

  inicializar() {
    if (!this.suportado) {
      console.log('Web Speech API não suportada neste navegador');
      return;
    }

    // Encontrar todos os h2 e h3 no conteúdo do livro
    const conteudo = document.querySelector('.conteudo-livro');
    if (!conteudo) return;

    const secoes = conteudo.querySelectorAll('h2, h3');

    secoes.forEach((secao, index) => {
      // Criar wrapper com o botão
      const wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.gap = '12px';
      wrapper.style.marginBottom = '12px';

      // Botão de ouvir
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

      // Inserir antes do h2/h3
      secao.parentNode.insertBefore(wrapper, secao);
      wrapper.appendChild(botao);
      wrapper.appendChild(secao);
    });

    console.log('✅ Leitor de voz inicializado');
  }

  extrairTextoSecao(elemento) {
    // Encontrar o próximo h2/h3 ou fim do conteúdo
    let conteudo = '';
    let node = elemento.nextSibling;
    const nivelAtual = parseInt(elemento.tagName[1]);

    while (node) {
      // Se encontrar outro heading do mesmo nível ou maior, parar
      if (node.nodeType === 1) { // Element node
        const tagName = node.tagName;
        if ((tagName === 'H2' || tagName === 'H3') && node !== elemento) {
          const nivelProximo = parseInt(tagName[1]);
          if (nivelProximo <= nivelAtual) break;
        }

        // Incluir texto do elemento
        if (tagName.match(/^H[2-3]$/)) {
          // Pular se for heading (já extraído)
          node = node.nextSibling;
          continue;
        }

        if (node.textContent && node.offsetParent !== null) { // Visible element
          conteudo += node.textContent.trim() + ' ';
        }
      }
      node = node.nextSibling;
    }

    // Incluir o título do elemento
    const titulo = elemento.textContent.trim();
    return `${titulo}. ${conteudo.trim()}`;
  }

  toggleLeitura(elemento, botao, index) {
    // Se já está falando
    if (this.emFala) {
      if (this.botaoAtivo === botao) {
        // Mesmo botão: alternar pause/resume
        if (this.pausado) {
          this.resumir(botao);
        } else {
          this.pausar(botao);
        }
      } else {
        // Botão diferente: parar e começar novo
        this.parar();
        this.iniciarLeitura(elemento, botao);
      }
    } else {
      // Não está falando: começar
      this.iniciarLeitura(elemento, botao);
    }
  }

  iniciarLeitura(elemento, botao) {
    const texto = this.extrairTextoSecao(elemento);

    if (!texto.trim()) {
      console.log('Nenhum texto para ler');
      return;
    }

    this.botaoAtivo = botao;
    this.emFala = true;
    this.pausado = false;

    // Atualizar botão
    botao.innerHTML = '⏸ Pausar';
    botao.style.background = 'var(--dourado)';
    botao.style.color = '#0f0f0f';

    // Criar utterance
    this.utterance = new this.SpeechSynthesisUtterance(texto);
    this.utterance.lang = 'pt-BR';
    this.utterance.rate = 1.0;
    this.utterance.pitch = 1.0;
    this.utterance.volume = 1.0;

    // Encontrar voz em português
    const vozes = this.speechSynthesis.getVoices();
    const vozPt = voizes.find(v => v.lang.startsWith('pt'));
    if (vozPt) {
      this.utterance.voice = vozPt;
    }

    // Callbacks
    this.utterance.onend = () => {
      this.emFala = false;
      this.pausado = false;
      botao.innerHTML = '🔊 Ouvir';
      botao.style.background = 'rgba(184, 150, 62, 0.2)';
      botao.style.color = 'var(--dourado-suave)';
      this.botaoAtivo = null;
    };

    this.utterance.onerror = (e) => {
      console.error('Erro ao ler:', e);
      this.parar();
    };

    // Iniciar síntese
    this.speechSynthesis.cancel(); // Cancelar qualquer fala anterior
    this.speechSynthesis.speak(this.utterance);
  }

  pausar(botao) {
    if (!this.emFala) return;

    this.speechSynthesis.pause();
    this.pausado = true;
    botao.innerHTML = '▶ Retomar';
  }

  resumir(botao) {
    if (!this.emFala) return;

    this.speechSynthesis.resume();
    this.pausado = false;
    botao.innerHTML = '⏸ Pausar';
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
}

// Auto-inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const leitor = new LeitorDeVoz();
    leitor.inicializar();
    window.leitorDeVoz = leitor; // Expor globalmente para debug
  });
} else {
  const leitor = new LeitorDeVoz();
  leitor.inicializar();
  window.leitorDeVoz = leitor;
}
