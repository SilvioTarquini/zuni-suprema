# rag3 — Candidate RAG 3.0 (fase C1, LOCAL-ONLY)

Candidato em paralelo ao pipeline de produção do ZUNI Direciona. **Nenhuma rota pública usa este módulo** e `src/server.js` não foi alterado.

```
RETRIEVAL ZUNI  →  ZUNI KNOWLEDGE PACK  →  GENERATION PROVIDER (OpenAI | Claude)
(planner + busca híbrida + proveniência)   (texto único)           (só interpreta e redige)
```

A ZUNI controla recuperação, conhecimento, proveniência, política editorial, regras de segurança, catálogo e recomendação comercial.
O modelo só redige.

| Arquivo | Papel |
|---|---|
| `config.js` | todos os parâmetros do Candidate (comparáveis no benchmark); limiares **provisórios**, `calibrado:false` |
| `conceptLexicon.js`, `queryPlanner.js` | planner determinístico multi-conceito (interface `QueryPlanner`; modo "model-assisted" preparado, sem LLM) |
| `vectorStore.js`, `embedder.js` | contratos de busca (somente leitura) e de embedding; `OpenAIEmbedder` é bloqueado pela trava paga |
| `retrieval.js` | `retrieveZuniKnowledge`: busca global, fusão, dedupe, tetos por fonte/título, limiar found/weak/none, controle de tamanho |
| `knowledgePack.js` | representação única entregue aos dois providers (mesmo hash) |
| `editorialPolicy.js` | política editorial única (hash) + baselines |
| `generation.js`, `providers.js` | requisição neutra, payloads OpenAI/Anthropic, equivalência, erros sanitizados |
| `provenance.js`, `bookRecommendation.js` | fonte→obra e recomendação determinística (título/preço/URL do catálogo) |
| `privacyLogger.js` | logs sem PII (lista de campos permitidos) e linhas no formato `citacoes_rag` (sem gravar) |
| `currentAdapter.js` | reproduz o pipeline atual (variante D) lendo o `server.js` apenas como texto |
| `benchmark/*` | dataset sintético, runner (dry-run), rubrica cega, custo, calibração |

Trava de segurança: nenhuma chamada paga acontece sem `RAG3_ALLOW_PAID_CALLS=I_AUTHORIZE_PAID_CALLS` **e** confirmação de custo **e** transportes injetados.

Testes: `node scripts/testar-rag3-candidate.js` · Plano/estimativa: `node scripts/rag3-benchmark.js --plan`.

## C2-B — bateria final (preparada, NÃO executada)

- Casos: c04, c09, c11, c13, c14, c15 (preservados) + c16–c19 (crise conjugal, aproximação amorosa, autoestima/evitação, baixa familiaridade técnica). 10 casos × 4 variantes = 40 gerações. Os casos da C2-A (c01, c02, c07, c08, c10, c12) não se repetem; c03, c05 e c06 foram substituídos por redundância.
- Rubrica: 13 dimensões (0–5, incluindo `adequacao_ao_nivel_do_usuario`, válida para todos os casos) + `ai_like_style_penalty` e `evasion_penalty` (0 a −2).
- Critério ZUNI de excelência (só avaliação, nunca prompt): "Uma resposta ZUNI excepcional não é necessariamente a que demonstra mais conhecimento. É aquela que compreende melhor o que está acontecendo, utiliza o conhecimento pertinente, percebe fatores importantes que podem não ter sido explicitados e explica de maneira que aquela pessoa consiga realmente aproveitar."
- Os campos do dataset (`safety_notes`, `knowledge_expected`…) são só de avaliação humana e não entram em nenhuma requisição; testado em `scripts/testar-rag3-c2b.js`.
- Execução exige autorização explícita (`RAG3_C2B_EXECUCAO_AUTORIZADA`, `--executar`, teto `RAG3_C2B_TETO_USD`). A BLIND_KEY só é criada durante a execução autorizada.
