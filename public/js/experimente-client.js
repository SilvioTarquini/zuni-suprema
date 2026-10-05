/**
 * Experimente ZUNI — Cliente JavaScript
 * Chat de demonstração (Módulo C) e degustação de livro (Módulo D)
 */

/**
 * Scroll suave até um módulo
 */
function scrollToModule(moduloId, event) {
  event.preventDefault();
  const elemento = document.getElementById(moduloId);
  if (elemento) {
    elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * ─── MÓDULO C: CHAT DE DEMONSTRAÇÃO ───
 */

// Estado do chat
let estadoChat = {
  sessionId: null,
  historico: [],
  contador: 0,
  bloqueado: false,
  ultimaTroca: false
};

/**
 * Gera ou recupera sessionId do visitante
 */
function inicializarChat() {
  let sessionId = localStorage.getItem('experimente_chat_session_id');
  if (!sessionId) {
    sessionId = 'exp-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('experimente_chat_session_id', sessionId);
  }
  estadoChat.sessionId = sessionId;

  // Recuperar histórico de chat anterior
  const historico = sessionStorage.getItem(`chat_historico_${sessionId}`);
  const contador = sessionStorage.getItem(`chat_contador_${sessionId}`);

  if (historico) {
    estadoChat.historico = JSON.parse(historico);
    estadoChat.contador = parseInt(contador) || 0;
    renderizarHistoricoChat();
    atualizarContadorChat();
  }

  // Se bloqueado, desabilitar input
  if (estadoChat.contador >= 5) {
    estadoChat.bloqueado = true;
    document.getElementById('btnEnviarChat').disabled = true;
    document.getElementById('chatInput').disabled = true;
    document.getElementById('chatLimiteAtingido').style.display = 'block';
  }
}

/**
 * Renderiza todas as mensagens do histórico
 */
function renderizarHistoricoChat() {
  const historico = document.getElementById('chatHistorico');
  historico.innerHTML = '';

  if (estadoChat.historico.length === 0) {
    historico.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">Inicie uma conversa com o Mentor...</div>';
    return;
  }

  estadoChat.historico.forEach(msg => {
    const div = document.createElement('div');
    div.className = `chat-mensagem ${msg.role}`;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${msg.role}`;
    bubble.textContent = msg.texto;

    div.appendChild(bubble);
    historico.appendChild(div);
  });

  // Scroll para o final
  historico.scrollTop = historico.scrollHeight;
}

/**
 * Adiciona uma mensagem ao chat
 */
function adicionarMensagemChat(role, texto) {
  estadoChat.historico.push({ role, texto });
  sessionStorage.setItem(`chat_historico_${estadoChat.sessionId}`, JSON.stringify(estadoChat.historico));

  const historico = document.getElementById('chatHistorico');
  if (historico.innerHTML.includes('Inicie uma conversa')) {
    historico.innerHTML = '';
  }

  const div = document.createElement('div');
  div.className = `chat-mensagem ${role}`;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  bubble.textContent = texto;

  div.appendChild(bubble);
  historico.appendChild(div);

  historico.scrollTop = historico.scrollHeight;
}

/**
 * Atualiza contador de trocas
 */
function atualizarContadorChat() {
  document.getElementById('chatContador').textContent = `Trocas: ${estadoChat.contador}/5`;
}

/**
 * Envia mensagem para o Mentor
 */
async function enviarMensagemChat() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();

  if (!message) {
    alert('Por favor, escreva uma mensagem.');
    return;
  }

  if (estadoChat.bloqueado) {
    alert('Você atingiu o limite de 5 trocas. Volte amanhã ou conheça a Sessão Completa.');
    return;
  }

  // Desabilitar input e botão
  input.disabled = true;
  document.getElementById('btnEnviarChat').disabled = true;
  document.getElementById('chatLoading').style.display = 'block';

  try {
    // Adicionar mensagem do usuário ao histórico
    adicionarMensagemChat('user', message);
    input.value = '';

    // Chamar API
    const response = await fetch('/api/experimente-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId: estadoChat.sessionId
      })
    });

    const data = await response.json();

    if (data.bloqueado) {
      // Limite atingido
      estadoChat.bloqueado = true;
      estadoChat.contador = 5;
      document.getElementById('chatLoading').style.display = 'none';
      document.getElementById('chatLimiteAtingido').style.display = 'block';
      document.getElementById('chatStatus').textContent = data.mensagem;
      sessionStorage.setItem(`chat_contador_${estadoChat.sessionId}`, '5');
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao enviar mensagem');
    }

    // Adicionar resposta do Mentor
    adicionarMensagemChat('mentor', data.texto);

    // Atualizar contador
    const partes = data.contador.split('/');
    estadoChat.contador = parseInt(partes[0]);
    estadoChat.ultimaTroca = data.ultimaTroca;
    sessionStorage.setItem(`chat_contador_${estadoChat.sessionId}`, estadoChat.contador);
    atualizarContadorChat();

    // Se é última troca, mostrar CTA
    if (data.ultimaTroca) {
      document.getElementById('chatStatus').innerHTML = `
        ⭐ <strong>Última troca!</strong> Se este diálogo tocou fundo, conheça a
        <a href="https://www.zunisuprema.com.br/checkout" style="color: #d4af37; text-decoration: underline;">
          Sessão Completa do Mentor (R$ 27,90)
        </a>
      `;
    } else if (estadoChat.contador >= 5) {
      // Desabilitar para próxima tentativa
      input.disabled = true;
      document.getElementById('btnEnviarChat').disabled = true;
      document.getElementById('chatLimiteAtingido').style.display = 'block';
      document.getElementById('chatStatus').textContent = 'Limite atingido. Volte amanhã.';
    }

  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    document.getElementById('chatStatus').textContent = `❌ Erro: ${err.message}`;
  } finally {
    document.getElementById('chatLoading').style.display = 'none';
    input.disabled = false;
    document.getElementById('btnEnviarChat').disabled = false;
    input.focus();
  }
}

/**
 * Atualiza qual item da navbar está ativo baseado no scroll
 */
function atualizarNavbarAtiva() {
  const modulos = document.querySelectorAll('[data-modulo]');
  const navItems = document.querySelectorAll('.navbar-item');

  let moduloAtivo = null;
  let menorDistancia = Infinity;

  // Encontrar qual módulo está mais próximo do topo da viewport
  modulos.forEach(modulo => {
    const rect = modulo.getBoundingClientRect();
    const distancia = Math.abs(rect.top);

    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      moduloAtivo = modulo.getAttribute('data-modulo');
    }
  });

  // Remover classe active de todos e adicionar ao módulo ativo
  navItems.forEach(item => {
    item.classList.remove('active');
  });

  if (moduloAtivo) {
    const itemAtivo = document.querySelector(`.navbar-item[href="#modulo-${moduloAtivo}"]`);
    if (itemAtivo) {
      itemAtivo.classList.add('active');
    }
  }
}

/**
 * Abre WhatsApp da ZUNI
 */
function abrirWhatsappChat(event) {
  event.preventDefault();
  const numero = '5515996088895';
  const texto = encodeURIComponent('Olá! Vim da página Experimente ZUNI Suprema e gostaria de falar com a equipe.');
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.open(`https://wa.me/${numero}?text=${texto}`, '_blank', 'noopener,noreferrer');
  } else {
    window.open(`https://web.whatsapp.com/send?phone=${numero}&text=${texto}`, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Inicialização do Módulo D (degustação de livro)
 */
document.addEventListener('DOMContentLoaded', () => {
  // ═══════════════════════════════════════════════════════════════
  // Módulo D — Chat de Livro Vivo (Degustação)
  // ═══════════════════════════════════════════════════════════════

  const estadoLivroChat = {
    sessionId: sessionStorage.getItem('sessionId') || crypto.randomUUID(),
    historico: [],
    contador: 0,
    restantes: 5
  };

  if (!sessionStorage.getItem('sessionId')) {
    sessionStorage.setItem('sessionId', estadoLivroChat.sessionId);
  }

  function atualizarContadorLivroChat() {
    const contadorEl = document.getElementById('livro-restantes');
    if (contadorEl) {
      const LIMITE_TROCAS = 5;
      contadorEl.textContent = `Perguntas restantes: ${estadoLivroChat.restantes}/${LIMITE_TROCAS}`;
    }
  }

  function adicionarMensagemLivroChat(role, conteudo) {
    estadoLivroChat.historico.push({ role, content: conteudo });
    const historicoEl = document.getElementById('livro-chat-historico');
    if (historicoEl) {
      if (historicoEl.querySelector('p[style*="color: #999"]')) {
        historicoEl.innerHTML = '';
      }
      const msgDiv = document.createElement('div');
      msgDiv.style.marginBottom = '12px';
      msgDiv.style.padding = '10px';
      msgDiv.style.borderRadius = '4px';
      msgDiv.style.backgroundColor = role === 'user' ? '#e3f2fd' : '#f5f5f5';
      msgDiv.style.borderLeft = `3px solid ${role === 'user' ? '#1a1a3e' : '#d4af37'}`;
      const rotulo = document.createElement('strong');
      rotulo.style.color = role === 'user' ? '#1a1a3e' : '#666';
      rotulo.textContent = (role === 'user' ? 'Você' : 'Livro') + ':';
      msgDiv.appendChild(rotulo);
      msgDiv.appendChild(document.createTextNode(' ' + conteudo));
      historicoEl.appendChild(msgDiv);
      historicoEl.scrollTop = historicoEl.scrollHeight;
    }
  }

  async function enviarPerguntaLivro() {
    const input = document.getElementById('livro-pergunta');
    const mensagem = input.value.trim();

    if (!mensagem) return;

    if (estadoLivroChat.restantes <= 0) {
      document.getElementById('livro-mensagem-limite').style.display = 'block';
      return;
    }

    input.disabled = true;
    document.getElementById('livro-enviar').disabled = true;

    try {
      adicionarMensagemLivroChat('user', mensagem);
      input.value = '';

      const response = await fetch('/api/experimente-livro-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: estadoLivroChat.sessionId,
          pergunta: mensagem,
          historico: estadoLivroChat.historico
        })
      });

      const data = await response.json();

      if (data.bloqueado) {
        document.getElementById('livro-mensagem-limite').style.display = 'block';
        adicionarMensagemLivroChat('assistant', '⚠️ Você atingiu o limite de perguntas (5 por 24h). Adquira o volume completo para acesso ilimitado.');
        estadoLivroChat.restantes = 0;
        atualizarContadorLivroChat();
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar pergunta');
      }

      adicionarMensagemLivroChat('assistant', data.resposta);
      estadoLivroChat.restantes = data.restantes;
      atualizarContadorLivroChat();

      if (data.ultimaTroca) {
        const msgLimite = document.createElement('div');
        msgLimite.style.background = '#fff3cd';
        msgLimite.style.padding = '12px';
        msgLimite.style.borderRadius = '4px';
        msgLimite.style.marginTop = '12px';
        msgLimite.style.borderLeft = '3px solid #ffc107';
        msgLimite.style.color = '#856404';
        msgLimite.innerHTML = `<strong>⭐ Última pergunta!</strong> Adquira o volume completo para continuar conversando.`;
        document.getElementById('livro-chat-historico').appendChild(msgLimite);
      }

      if (data.restantes <= 0) {
        document.getElementById('livro-mensagem-limite').style.display = 'block';
      }
    } catch (err) {
      console.error('Erro ao enviar pergunta:', err);
      adicionarMensagemLivroChat('assistant', `❌ Erro: ${err.message}`);
    } finally {
      input.disabled = false;
      document.getElementById('livro-enviar').disabled = false;
      input.focus();
    }
  }

  function ouvirCapituloLivro() {
    const conteudo = document.getElementById('livro-conteudo')?.innerText || '';
    if (!conteudo || !window.speechSynthesis) {
      alert('Leitor de voz não está disponível neste navegador.');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      document.getElementById('btn-ouvir-capitulo').textContent = '🔊 Ouvir o Capítulo';
      document.getElementById('ouvindo-status').style.display = 'none';
      return;
    }

    const utterance = new SpeechSynthesisUtterance(conteudo);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      document.getElementById('btn-ouvir-capitulo').textContent = '⏹️ Pausar';
      document.getElementById('ouvindo-status').style.display = 'inline';
    };

    utterance.onend = () => {
      document.getElementById('btn-ouvir-capitulo').textContent = '🔊 Ouvir o Capítulo';
      document.getElementById('ouvindo-status').style.display = 'none';
    };

    window.speechSynthesis.speak(utterance);
  }

  // Inicializar eventos de Módulo D
  document.getElementById('livro-enviar')?.addEventListener('click', enviarPerguntaLivro);
  document.getElementById('livro-pergunta')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') enviarPerguntaLivro();
  });
  document.getElementById('btn-ouvir-capitulo')?.addEventListener('click', ouvirCapituloLivro);

  atualizarContadorLivroChat();

  // Inicializar chat
  inicializarChat();

  // Atualizar navbar ativa ao scroll
  window.addEventListener('scroll', atualizarNavbarAtiva);
});
