// renderMarkdownToPDF V2 — REESCRITA DO ZERO
// Abordagem simples e confiável usando continued: true

function renderMarkdownToPDF(doc, texto, opcoes = {}) {
  const fontSize = opcoes.fontSize || 11;
  const lineGap = opcoes.lineGap || 5;
  const maxWidth = opcoes.maxWidth || 500;

  const linhas = texto.split('\n');

  linhas.forEach((linha) => {
    // Linha vazia: apenas espaço
    if (linha.trim() === '') {
      doc.moveDown(0.3);
      return;
    }

    // Linha divisória (---)
    if (linha.trim() === '---') {
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.5);
      return;
    }

    // Títulos: # PARTE, #, ##, ###
    if (linha.startsWith('# PARTE ')) {
      doc.moveDown(1);
      const titulo = linha.replace(/^# PARTE /, '').trim();
      doc.fontSize(18).font('Helvetica-Bold').text(titulo, { width: maxWidth });
      doc.fontSize(fontSize).font('Helvetica');
      doc.moveDown(0.5);
      return;
    }

    if (linha.startsWith('# ')) {
      doc.moveDown(1);
      const titulo = linha.replace(/^# /, '').trim();
      doc.fontSize(16).font('Helvetica-Bold').text(titulo, { width: maxWidth });
      doc.fontSize(fontSize).font('Helvetica');
      doc.moveDown(0.5);
      return;
    }

    if (linha.startsWith('## ')) {
      doc.moveDown(0.5);
      const titulo = linha.replace(/^## /, '').trim();
      doc.fontSize(13).font('Helvetica-Bold').text(titulo, { width: maxWidth });
      doc.fontSize(fontSize).font('Helvetica');
      doc.moveDown(0.3);
      return;
    }

    if (linha.startsWith('### ')) {
      doc.moveDown(0.5);
      const titulo = linha.replace(/^### /, '').trim();
      doc.fontSize(12).font('Helvetica-Bold').text(titulo, { width: maxWidth });
      doc.fontSize(fontSize).font('Helvetica');
      doc.moveDown(0.3);
      return;
    }

    // Parágrafo normal: processar markdown (negrito, itálico) e renderizar
    doc.fontSize(fontSize);
    renderParrafoComFormatacao(doc, linha, maxWidth, lineGap);
    doc.moveDown(0.3);
  });
}

// Renderizar um parágrafo com segmentos de negrito/itálico
// Técnica: extrair segmentos, chamar doc.text() para cada um com continued: true (exceto último)
function renderParrafoComFormatacao(doc, texto, maxWidth, lineGap) {
  // Passo 1: Extrair segmentos com seus tipos (normal, negrito, itálico)
  const segmentos = extrairSegmentos(texto);

  if (segmentos.length === 0) {
    // Nenhuma formatação: renderizar como normal
    doc.font('Helvetica');
    doc.text(texto, { width: maxWidth, lineGap });
    return;
  }

  // Passo 2: Renderizar cada segmento com fonte apropriada
  // Técnica PDFKit: continued: true mantém o cursor na mesma posição,
  // permitindo que o próximo doc.text() continue na mesma linha/parágrafo
  segmentos.forEach((seg, idx) => {
    // Aplicar fonte apropriada
    switch (seg.tipo) {
      case 'negrito':
        doc.font('Helvetica-Bold');
        break;
      case 'italico':
        doc.font('Helvetica-Oblique');
        break;
      default:
        doc.font('Helvetica');
    }

    // Determinar se é o último segmento
    const ehUltimo = idx === segmentos.length - 1;

    // Renderizar com continued: true para manter fluxo, EXCETO no último
    doc.text(seg.texto, {
      continued: !ehUltimo,  // true para todos EXCETO o último
      width: maxWidth,
      lineGap
    });
  });

  // Reset para font normal após parágrafo
  doc.font('Helvetica');
}

// Extrair segmentos com tipos de formatação
// Retorna array de { texto, tipo } onde tipo é 'normal', 'negrito', ou 'italico'
function extrairSegmentos(linha) {
  const segmentos = [];

  // Substituir **negrito** por placeholder, e armazenar conteúdo
  const boldMarkers = [];
  let processado = linha.replace(/\*\*([^*]|\*(?!\*))+?\*\*/g, (match) => {
    boldMarkers.push(match.slice(2, -2)); // Remover ** das extremidades
    return `§BOLD${boldMarkers.length - 1}§`;
  });

  // Substituir *itálico* por placeholder (fazer depois do negrito)
  const italicMarkers = [];
  processado = processado.replace(/\*([^*]+?)\*/g, (match) => {
    italicMarkers.push(match.slice(1, -1)); // Remover * das extremidades
    return `§ITALIC${italicMarkers.length - 1}§`;
  });

  // Parsear placeholders e reconstruir segmentos
  const regex = /§(BOLD|ITALIC)(\d+)§/g;
  let ultimoIndex = 0;
  let match;

  while ((match = regex.exec(processado)) !== null) {
    // Texto antes do marcador (normal)
    if (match.index > ultimoIndex) {
      const texto = processado.slice(ultimoIndex, match.index);
      if (texto) {
        segmentos.push({ texto, tipo: 'normal' });
      }
    }

    // Conteúdo formatado (negrito ou itálico)
    const tipo = match[1]; // 'BOLD' ou 'ITALIC'
    const idx = parseInt(match[2]);
    const conteudo = tipo === 'BOLD' ? boldMarkers[idx] : italicMarkers[idx];

    segmentos.push({
      texto: conteudo,
      tipo: tipo === 'BOLD' ? 'negrito' : 'italico'
    });

    ultimoIndex = match.index + match[0].length;
  }

  // Restante do texto após último marcador (normal)
  if (ultimoIndex < processado.length) {
    const texto = processado.slice(ultimoIndex);
    if (texto) {
      segmentos.push({ texto, tipo: 'normal' });
    }
  }

  return segmentos;
}

module.exports = { renderMarkdownToPDF };
