'use strict';
// rag3/config.js — TODOS os parâmetros do Candidate RAG 3.0 num só lugar, para o benchmark poder compará-los.
// Nada aqui é dogma: os números vêm da auditoria RAG 2.0 e devem ser calibrados com dados reais.
const { mesclarConfig } = require('./util');

const CANDIDATE_CONFIG = Object.freeze({
  versao: 'rag3-c1',
  planner: {
    modo: 'deterministic',        // 'deterministic' | 'model-assisted' (futuro; hoje exige função injetada)
    maxConceitos: 3,              // 2–3 subconsultas conceituais
    turnosDeHistorico: 3,         // quantas falas anteriores do USUÁRIO entram no plano
    pesoHistorico: 0.5,
    pesoTema: 0.3,                // o tema do questionário é sinal secundário
    mensagemCurtaPalavras: 6,     // abaixo disso, a mensagem é tratada como continuação (anáfora)
    incluirSubconsultaLiteral: true,
    maxCharsLiteral: 300
  },
  recuperacao: {
    candidatosPorSubconsulta: 25, // ~20–30 candidatos iniciais por subconsulta (busca GLOBAL)
    maxBlocosFinais: 7,           // ~6–8 blocos
    tetoPorFonte: 3,
    tetoPorTitulo: 1,             // "parte 1/2" e "parte 2/2" contam como o mesmo título
    jaccardQuaseDuplicata: 0.82,
    bonusTema: 0.03,              // tema = bônus, nunca filtro
    bonusMultiConceito: 0.02,     // bloco que responde a mais de um conceito
    reservaPorConceito: true      // 1º passe garante o melhor bloco de cada conceito antes de preencher
  },
  limiares: {
    calibrado: false,             // PROVISÓRIO até a calibração com embeddings reais (ver calibration.js)
    encontrado: 0.55,             // similaridade 1/(1+L2) do melhor bloco para status "found"
    fraco: 0.47,                  // abaixo disso o bloco nem entra; entre fraco e encontrado = "weak"
    minBlocosParaEncontrado: 2
  },
  contexto: {
    maxCharsPorBloco: 2200,
    maxCharsTotal: 12000,
    minCharsPorBlocoNoOrcamento: 600
  },
  provedores: {
    anthropic: { modelo: 'claude-sonnet-4-6', maxTokensSaida: 1400 },
    openai: { modelo: null, maxTokensSaida: 1400 } // o modelo da OpenAI deve ser escolhido na autorização do benchmark pago
  },
  recomendacao: {
    maxObras: 2,
    indiceMinimoDeTurno: 3,       // nunca na 1ª/2ª resposta
    minBlocosComProveniencia: 2,
    pontuacaoMinima: 0.9
  }
});

function validarConfig(c) {
  const erros = [];
  const num = (v, nome, min, max) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) erros.push(`${nome} fora de [${min}, ${max}]`); };
  num(c.planner.maxConceitos, 'planner.maxConceitos', 1, 4);
  num(c.recuperacao.candidatosPorSubconsulta, 'recuperacao.candidatosPorSubconsulta', 5, 100);
  num(c.recuperacao.maxBlocosFinais, 'recuperacao.maxBlocosFinais', 1, 12);
  num(c.recuperacao.tetoPorFonte, 'recuperacao.tetoPorFonte', 1, 12);
  num(c.recuperacao.tetoPorTitulo, 'recuperacao.tetoPorTitulo', 1, 6);
  num(c.limiares.fraco, 'limiares.fraco', 0, 1);
  num(c.limiares.encontrado, 'limiares.encontrado', 0, 1);
  if (c.limiares.fraco > c.limiares.encontrado) erros.push('limiares.fraco deve ser <= limiares.encontrado');
  num(c.contexto.maxCharsPorBloco, 'contexto.maxCharsPorBloco', 300, 20000);
  num(c.contexto.maxCharsTotal, 'contexto.maxCharsTotal', 1000, 60000);
  num(c.recomendacao.maxObras, 'recomendacao.maxObras', 0, 2);
  if (erros.length) throw new Error('RAG3_CONFIG_INVALIDA: ' + erros.join('; '));
  return c;
}

function resolverConfig(sobre) { return validarConfig(mesclarConfig(CANDIDATE_CONFIG, sobre)); }

module.exports = { CANDIDATE_CONFIG, resolverConfig, validarConfig };
