// Renderizar PDF em imagens usando pdfjs-dist
const pdfjsLib = require('pdfjs-dist');
const fs = require('fs');
const path = require('path');
const canvas = require('canvas');

// Configurar canvas
pdfjsLib.GlobalWorkerOptions.workerSrc = require('pdfjs-dist/build/pdf.worker.js');

// Polyfill para Canvas no Node.js
const { createCanvas, Image } = canvas;

async function renderizarPDFEmImagens() {
  const pdfPath = path.join(__dirname, 'relatorio-juliana-mendes-v2-final.pdf');
  const outputDir = path.join(__dirname, 'imagens-juliana-v2');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  RENDERIZAÇÃO: PDF em Imagens                            ║');
  console.log('║  relatorio-juliana-mendes-v2-final.pdf → PNG             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Criar diretório de saída
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Carregar PDF
    const data = new Uint8Array(fs.readFileSync(pdfPath));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    console.log(`📄 PDF carregado: ${pdf.numPages} páginas\n`);

    // Renderizar cada página
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Renderizando página ${pageNum}/${pdf.numPages}...`);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 }); // Scale 2 para 150 DPI

      const cvs = createCanvas(viewport.width, viewport.height);
      const context = cvs.getContext('2d');

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Salvar como PNG
      const outputPath = path.join(outputDir, `pagina-${String(pageNum).padStart(2, '0')}.png`);
      const stream = fs.createWriteStream(outputPath);

      return new Promise((resolve, reject) => {
        cvs.pngStream()
          .pipe(stream)
          .on('finish', () => {
            const stats = fs.statSync(outputPath);
            console.log(`   ✅ Salvo: pagina-${String(pageNum).padStart(2, '0')}.png (${(stats.size / 1024).toFixed(1)} KB)`);

            if (pageNum === pdf.numPages) {
              console.log(`\n✨ Todas as ${pdf.numPages} páginas renderizadas\n`);
              console.log(`📁 Imagens salvas em: ${outputDir}\n`);
              resolve();
            }
          })
          .on('error', reject);
      });
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
    console.log('\n💡 Alternativa: Se pdfjs-dist falhar, use ferramenta externa:');
    console.log('   pdftoppm -jpeg -r 120 relatorio-juliana-mendes-v2-final.pdf pagina\n');
    process.exit(1);
  }
}

renderizarPDFEmImagens()
  .catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
