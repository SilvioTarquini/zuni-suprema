// routes/livros.js
//
// Montado em src/server.js:
//   const livrosRouter = require('./routes/livros');
//   app.use('/', livrosRouter);
//
// O conteúdo real de cada livro NÃO fica em public/ — public/ é servido
// estaticamente por express.static, sem qualquer verificação de token, então
// qualquer arquivo ali dentro é acessível diretamente por URL. O conteúdo
// pago fica em private/livros/, fora da árvore servida estaticamente, e só é
// entregue através da rota abaixo, depois de exigirAcesso() validar o token:
//   private/livros/<livroId>/index.html    -> HTML do livro (ler, baixar e imprimir já embutidos)
//
// public/livros/_acesso-expirado.html é a única coisa que continua em
// public/, pois não é conteúdo pago — só a página exibida quando o token é
// inválido ou expirou.
//
// Cada HTML de livro deve ler o token da própria URL (query string) e
// manter esse token nos links/ações internas da página
// (ver template em private/livros/_template/index.html).

const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const router = express.Router();
const { verificarAcesso } = require('../lib/acessoLivros');
const { buscarLivro } = require('../lib/catalogoLivros');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const CONTEUDO_LIVROS_DIR = path.join(__dirname, '..', '..', 'private', 'livros');
const PAGINA_ACESSO_EXPIRADO = path.join(PUBLIC_DIR, 'livros', '_acesso-expirado.html');

const LIVRO_ID_VALIDO = /^[a-zA-Z0-9_-]+$/;

// Vitrine: pública, sem necessidade de token
router.use('/loja', express.static(path.join(PUBLIC_DIR, 'loja')));

// Middleware: exige token válido (?token=xxxx) para qualquer rota /livros/:livroId/*
async function exigirAcesso(req, res, next) {
  const { livroId } = req.params;
  const token = req.query.token;

  if (!LIVRO_ID_VALIDO.test(livroId)) {
    return res.status(400).send('Identificador de livro inválido.');
  }

  try {
    const acesso = await verificarAcesso(token, livroId);

    if (!acesso) {
      return res.status(403).sendFile(PAGINA_ACESSO_EXPIRADO);
    }

    req.acessoLivro = acesso;
    next();
  } catch (err) {
    console.error('Erro em exigirAcesso:', err.message);
    return res.status(500).send('Erro ao verificar o acesso. Tente novamente em instantes.');
  }
}

// Leitura na tela (HTML do livro, com ler/baixar/imprimir embutidos)
router.get('/livros/:livroId', exigirAcesso, async (req, res) => {
  const { livroId } = req.params;

  try {
    // Buscar metadata do livro
    const livro = buscarLivro(livroId);

    // Ler o arquivo HTML
    const htmlPath = path.join(CONTEUDO_LIVROS_DIR, livroId, 'index.html');
    let html = await fs.readFile(htmlPath, 'utf8');

    // Se o livro tiver textoFonteParaLeitura e ainda não tiver o script de leitura em voz alta
    if (livro && livro.textoFonteParaLeitura && !html.includes('window.livroLeituraPorVoz')) {
      const scriptLeitura = `
<script>
  window.livroLeituraPorVoz = {
    textoFonte: '${livro.textoFonteParaLeitura}'
  };

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.conteudo-livro, main, [role="main"]');
    if (!container) return;

    const botaoOuvir = document.createElement('button');
    botaoOuvir.id = 'btn-ouvir-livro-completo';
    botaoOuvir.innerHTML = '🔊 Ouvir Livro Completo';
    botaoOuvir.style.cssText = \`
      font-size: 0.9rem;
      padding: 10px 16px;
      background: rgba(184, 150, 62, 0.2);
      border: 1px solid var(--dourado);
      color: var(--dourado-suave);
      border-radius: 4px;
      cursor: pointer;
      font-family: Arial, sans-serif;
      font-weight: bold;
      transition: all 0.2s ease;
      white-space: nowrap;
      display: inline-block;
      margin-bottom: 20px;
    \`;

    botaoOuvir.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!window.leitorDeVoz) {
        console.error('Leitor de voz não inicializado');
        return;
      }

      if (window.leitorDeVoz.estaFalando()) {
        if (window.leitorDeVoz.estaPausado()) {
          window.leitorDeVoz.resumir(botaoOuvir);
        } else {
          window.leitorDeVoz.pausar(botaoOuvir);
        }
        return;
      }

      try {
        const res = await fetch(window.livroLeituraPorVoz.textoFonte);
        if (!res.ok) throw new Error('Erro ao buscar texto');
        const texto = await res.text();
        window.leitorDeVoz.iniciarLeitura(texto, botaoOuvir);
      } catch (err) {
        console.error('Erro ao buscar texto para leitura:', err);
        botaoOuvir.innerHTML = '❌ Erro ao carregar texto';
        setTimeout(() => {
          botaoOuvir.innerHTML = '🔊 Ouvir Livro Completo';
        }, 2000);
      }
    });

    container.parentNode.insertBefore(botaoOuvir, container);
  });
</script>
`;
      // Injetar o script antes da tag </body>
      html = html.replace('</body>', scriptLeitura + '</body>');
    }

    res.send(html);
  } catch (err) {
    console.error('Erro ao servir livro:', err.message);
    return res.status(500).send('Erro ao carregar o livro. Tente novamente em instantes.');
  }
});

// Acesso ao audiolivro: redireciona para URL pública do Supabase se token válido
router.get('/audiolivros/:livroId', exigirAcesso, async (req, res) => {
  const { livroId } = req.params;

  try {
    const livro = buscarLivro(livroId);
    if (!livro || !livro.audiobookUrl) {
      return res.status(404).sendFile(PAGINA_ACESSO_EXPIRADO);
    }

    // Redireciona para a URL pública do audiolivro no Supabase
    return res.redirect(livro.audiobookUrl);
  } catch (err) {
    console.error('Erro ao servir audiolivro:', err.message);
    return res.status(500).send('Erro ao acessar o audiolivro. Tente novamente em instantes.');
  }
});

module.exports = router;
