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
const express = require('express');
const router = express.Router();
const { verificarAcesso } = require('../lib/acessoLivros');

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
router.get('/livros/:livroId', exigirAcesso, (req, res) => {
  const { livroId } = req.params;
  res.sendFile(path.join(CONTEUDO_LIVROS_DIR, livroId, 'index.html'));
});

module.exports = router;
