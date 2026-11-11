// scripts/lote/limpeza.js
//
// "T": a limpeza de TEXTO versionada. Lê obras-lote/remocoes/<slug>.json (blocos inteiros a remover, com o texto literal)
// e aplica sobre o modelo extraído. A remoção só é aceita se for verificável:
//   - cada trecho da lista precisa existir como bloco inteiro no texto de origem (senão a lista está desatualizada);
//   - depois da limpeza, nenhum trecho da lista pode continuar existindo.
// Um arquivo com "remocoes": [] significa "obra revisada, nada a remover" (fica registrado no repositório).

const fs = require('fs');
const path = require('path');
const { textoDoBloco } = require('./extrairLivro');
const { norm, PASTA_REMOCOES } = require('./residuos');

function carregarRemocoes(slug, pasta = PASTA_REMOCOES) {
  const arq = path.join(pasta, `${slug}.json`);
  if (!fs.existsSync(arq)) return { existe: false, remocoes: [], secoesRemovidas: [] };
  const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
  if (j.slug !== slug) throw new Error(`${arq}: slug do arquivo (${j.slug}) ≠ ${slug}`);
  return { existe: true, remocoes: j.remocoes || [], secoesRemovidas: j.secoesRemovidas || [], jaAplicadoNoStaging: !!j.jaAplicadoNoStaging };
}

// Devolve { modelo, removidos } sem alterar o modelo recebido. Lança se a lista não bater com o texto.
// `secoesRemovidas`: títulos de seções removidas por inteiro (decisão editorial registrada no arquivo de remoções).
// `tolerante` (jaAplicadoNoStaging): a cópia de _staging já foi limpa antes (Máscara para o Controle, 05/11); item ausente é aceito,
// mas a segunda verificação continua valendo — nenhum trecho da lista pode existir no texto final.
function aplicarRemocoes(modelo, remocoes, secoesRemovidas = [], { tolerante = false } = {}) {
  const copia = { ...modelo, secoes: modelo.secoes.map((s) => ({ ...s, blocos: [...s.blocos] })) };
  let removidos = 0;
  for (const titulo of secoesRemovidas) {
    const i = copia.secoes.findIndex((s) => s.titulo === titulo);
    if (i < 0) { if (tolerante) continue; throw new Error(`seção a remover não encontrada (lista desatualizada?): "${titulo}"`); }
    removidos += copia.secoes[i].blocos.length;
    copia.secoes.splice(i, 1);
  }
  for (const r of remocoes) {
    const alvo = norm(r.trecho);
    let achou = false;
    for (const s of copia.secoes) {
      const i = s.blocos.findIndex((b) => norm(textoDoBloco(b)) === alvo);
      if (i >= 0) { s.blocos.splice(i, 1); removidos++; achou = true; break; }
    }
    if (!achou && !tolerante) throw new Error(`remoção não encontrada no texto (lista desatualizada?): "${r.trecho.slice(0, 70)}"`);
  }
  for (const r of remocoes) {
    const alvo = norm(r.trecho);
    for (const s of copia.secoes) {
      if (s.blocos.some((b) => norm(textoDoBloco(b)) === alvo)) throw new Error(`trecho ainda presente depois da limpeza: "${r.trecho.slice(0, 70)}"`);
    }
  }
  return { modelo: copia, removidos };
}

module.exports = { carregarRemocoes, aplicarRemocoes };
