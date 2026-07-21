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
});
