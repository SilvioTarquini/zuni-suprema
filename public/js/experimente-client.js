/**
 * Experimente ZUNI — Cliente JavaScript
 * Gerencia formulários, validações e chamadas aos endpoints
 */

// Estado da sessão
let estadoSessao = {
  codigoValidado: false,
  resultado: null
};

/**
 * Valida código-convite
 */
async function validarCodigo() {
  const codigo = document.getElementById('codigoInput').value.trim();
  const statusDiv = document.getElementById('codigoStatus');
  const moduloA = document.getElementById('modulo-numerologia');

  if (!codigo) {
    mostrarStatus(statusDiv, 'Por favor, insira um código.', 'error');
    return;
  }

  try {
    statusDiv.textContent = 'Validando...';
    statusDiv.className = 'codigo-status';

    const response = await fetch('/api/experimente-validar-codigo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo })
    });

    const data = await response.json();

    if (data.valido) {
      mostrarStatus(statusDiv, `✓ ${data.mensagem}`, 'success');
      estadoSessao.codigoValidado = true;

      // Desbloquear Módulo A
      moduloA.classList.remove('bloqueado');

      // Armazenar código para usar na captura
      sessionStorage.setItem('codigoAtivo', codigo);
    } else {
      mostrarStatus(statusDiv, `✗ ${data.mensagem}`, 'error');
      estadoSessao.codigoValidado = false;
    }
  } catch (err) {
    console.error('Erro ao validar código:', err);
    mostrarStatus(statusDiv, 'Erro ao validar código. Tente novamente.', 'error');
  }
}

/**
 * Calcula numerologia
 */
async function calcularNumerologia() {
  if (!estadoSessao.codigoValidado) {
    alert('Por favor, valide seu código-convite primeiro.');
    return;
  }

  const nomeCompleto = document.getElementById('nomeCompleto').value.trim();
  const dataNascimento = document.getElementById('dataNascimento').value;
  const loading = document.getElementById('loadingNumerologia');
  const resultado = document.getElementById('resultadoNumerologia');
  const emailSection = document.getElementById('emailSection');

  // Validações
  if (!nomeCompleto) {
    alert('Por favor, insira seu nome completo.');
    return;
  }

  if (!dataNascimento) {
    alert('Por favor, insira sua data de nascimento.');
    return;
  }

  // Validar formato de data
  const dataObj = new Date(dataNascimento);
  if (isNaN(dataObj.getTime())) {
    alert('Data de nascimento inválida.');
    return;
  }

  // Não permitir futuro
  if (dataObj > new Date()) {
    alert('A data de nascimento não pode ser no futuro.');
    return;
  }

  try {
    loading.classList.add('mostrar');
    resultado.classList.remove('mostrar');
    emailSection.classList.remove('mostrar');

    const response = await fetch('/api/experimente-calcular-numerologia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomeCompleto, dataNascimento })
    });

    if (!response.ok) {
      throw new Error(`Erro: ${response.status}`);
    }

    const data = await response.json();

    // Armazenar resultado na sessão
    estadoSessao.resultado = {
      nomeCompleto,
      dataNascimento,
      ...data
    };

    // Exibir resultado
    document.getElementById('caminhoDeVidaValor').textContent = data.caminhoDeVida;
    document.getElementById('caminhoDeVidaDesc').innerHTML =
      `<strong>Caminho de Vida ${data.caminhoDeVida}:</strong><br/>${data.caminhoDeVidaTexto || 'Número que define seu propósito.'}`;

    document.getElementById('essenciaValor').textContent = data.essencia;
    document.getElementById('essenciaDesc').innerHTML =
      `<strong>Essência ${data.essencia}:</strong><br/>${data.essenciaTexto || 'Sua energia fundamental.'}`;

    document.getElementById('ganhoTexto').textContent =
      data.gancho || 'Descubra mais sobre sua numerologia completa.';

    // Mostrar resultado e seção de e-mail
    loading.classList.remove('mostrar');
    resultado.classList.add('mostrar');
    emailSection.classList.add('mostrar');

    // Ativar botão de envio quando consentimento marcado
    atualizarEstadoBotaoEnvio();
  } catch (err) {
    console.error('Erro ao calcular numerologia:', err);
    loading.classList.remove('mostrar');
    alert('Erro ao calcular sua numerologia. Tente novamente.');
  }
}

/**
 * Atualiza estado do botão de envio baseado no consentimento
 */
function atualizarEstadoBotaoEnvio() {
  const email = document.getElementById('email').value.trim();
  const consentimento = document.getElementById('consentimento').checked;
  const btnEnviar = document.getElementById('btnEnviar');

  btnEnviar.disabled = !email || !consentimento;
}

/**
 * Event listeners para atualizar botão de envio
 */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('email').addEventListener('input', atualizarEstadoBotaoEnvio);
  document.getElementById('consentimento').addEventListener('change', atualizarEstadoBotaoEnvio);

  // Scroll suave e destaque de módulo ativo
  atualizarNavbarAtiva();
  window.addEventListener('scroll', atualizarNavbarAtiva);
});

/**
 * Envia resultado via e-mail
 */
async function enviarResultado() {
  if (!estadoSessao.resultado) {
    alert('Nenhum resultado calculado.');
    return;
  }

  const email = document.getElementById('email').value.trim();
  const consentimento = document.getElementById('consentimento').checked;

  if (!email || !consentimento) {
    alert('Por favor, insira seu e-mail e marque o consentimento.');
    return;
  }

  // Validação básica de e-mail
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('Por favor, insira um e-mail válido.');
    return;
  }

  const btnEnviar = document.getElementById('btnEnviar');
  const emailStatus = document.getElementById('emailStatus');
  const ofertaSection = document.getElementById('ofertaSection');

  try {
    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';

    const codigo = sessionStorage.getItem('codigoAtivo');

    const response = await fetch('/api/experimente-capturar-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nomeCompleto: estadoSessao.resultado.nomeCompleto,
        dataNascimento: estadoSessao.resultado.dataNascimento,
        email,
        caminhoDeVida: estadoSessao.resultado.caminhoDeVida,
        essencia: estadoSessao.resultado.essencia,
        interpretacao: estadoSessao.resultado.interpretacao,
        codigo
      })
    });

    const data = await response.json();

    if (data.sucesso) {
      mostrarStatus(emailStatus, '✓ E-mail enviado com sucesso! Confira sua caixa.', 'success');

      // Mostrar bloco de oferta
      ofertaSection.classList.add('mostrar');

      // Limpar formulário após sucesso
      setTimeout(() => {
        document.getElementById('email').value = '';
        document.getElementById('consentimento').checked = false;
        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Enviar Meu Resultado';
      }, 2000);
    } else {
      mostrarStatus(emailStatus, `✗ ${data.mensagem || 'Erro ao enviar e-mail'}`, 'error');
    }
  } catch (err) {
    console.error('Erro ao enviar resultado:', err);
    mostrarStatus(emailStatus, 'Erro ao enviar e-mail. Tente novamente.', 'error');
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar Meu Resultado';
  }
}

/**
 * Utilitário: mostra status em div
 */
function mostrarStatus(div, mensagem, tipo) {
  div.textContent = mensagem;
  div.className = `${tipo === 'error' ? 'codigo-status error' : 'codigo-status success'}`;
}

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
 * Calcula signo solar (Módulo B)
 */
async function calcularSignoSolar() {
  const dataNascimento = document.getElementById('dataNascimentoAstro').value;
  const loading = document.getElementById('loadingAstrologia');
  const resultado = document.getElementById('resultadoAstrologia');

  if (!dataNascimento) {
    alert('Por favor, insira sua data de nascimento.');
    return;
  }

  // Validar formato de data
  const dataObj = new Date(dataNascimento);
  if (isNaN(dataObj.getTime())) {
    alert('Data de nascimento inválida.');
    return;
  }

  // Não permitir futuro
  if (dataObj > new Date()) {
    alert('A data de nascimento não pode ser no futuro.');
    return;
  }

  try {
    loading.classList.add('mostrar');
    resultado.classList.remove('mostrar');

    const response = await fetch('/api/experimente-calcular-astrologia-b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataNascimento })
    });

    if (!response.ok) {
      throw new Error(`Erro: ${response.status}`);
    }

    const data = await response.json();

    // Exibir resultado
    document.getElementById('signoValor').textContent = `${data.signo.emoji} ${data.signo.nome}`;
    document.getElementById('signoDesc').innerHTML = data.interpretacao;
    document.getElementById('periodoDesc').textContent = data.signo.periodo;
    document.getElementById('ganhoAstroTexto').textContent = data.gancho;

    // Mostrar resultado
    loading.classList.remove('mostrar');
    resultado.classList.add('mostrar');
  } catch (err) {
    console.error('Erro ao calcular signo solar:', err);
    loading.classList.remove('mostrar');
    alert('Erro ao calcular seu signo. Tente novamente.');
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
    bubble.innerHTML = msg.role === 'mentor' ? msg.texto : msg.texto;

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
  bubble.innerHTML = role === 'mentor' ? texto : texto;

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

    // Log de consumo
    const custoReal = data.custo?.valor || 0;
    console.log(
      `[CHAT_DEMO] Troca ${estadoChat.contador}/5 | ` +
      `Tokens: ${data.tokens?.input} in + ${data.tokens?.output} out | ` +
      `Custo real: $${custoReal.toFixed(6)}`
    );

    // Se é última troca, mostrar CTA
    if (data.ultimaTroca) {
      document.getElementById('chatStatus').innerHTML = `
        ⭐ <strong>Última troca!</strong> Se este diálogo tocou fundo, conheça a
        <a href="https://zunisuprema.com.br/mentor" style="color: #d4af37; text-decoration: underline;">
          Sessão Completa do Mentor (R$ 29,90)
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
 * Permitir Enter para validar código e calcular numerologia
 */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('codigoInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') validarCodigo();
  });

  document.getElementById('dataNascimento')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') calcularNumerologia();
  });

  // Inicializar chat
  inicializarChat();

  // Atualizar navbar ativa ao scroll
  window.addEventListener('scroll', atualizarNavbarAtiva);
});
