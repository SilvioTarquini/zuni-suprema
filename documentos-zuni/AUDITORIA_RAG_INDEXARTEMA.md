# Auditoria do pipeline RAG — `indexarTema.js`, busca e fluxo do Mapa

**Data:** 20 de agosto de 2026
**Escopo:** levantamento do estado atual, sem alterações propostas ou aplicadas.

Documento consolidado a partir de duas rodadas de auditoria. A Parte I cobre o pipeline de indexação e a mecânica de busca; a Parte II cobre o fluxo dos produtos de mapa, o inventário de arquivos-fonte e os pipelines de escrita.

**Procedência das informações**

| Origem | Itens |
|---|---|
| Leitura literal do repositório (Claude Code) | Parte I: 1–5, 7 e colunas gravadas do 6. Parte II: 8, 9, 10, 11 |
| Consulta direta ao Postgres do Supabase (somente leitura) | Parte I: mecânica de busca do 6, índices e volumetria do anexo. Parte II: 12 |

A função `buscar_documentos_hibrido()` **não existe como código-fonte no repositório** — foi aplicada direto no Supabase e nunca commitada como migration. Sua definição neste documento veio de `pg_get_functiondef()`.

---

# PARTE I — Pipeline de indexação e busca

---

## 1. `MAX_PALAVRAS_POR_CHUNK`

`src/indexarTema.js:44`

```javascript
const MAX_PALAVRAS_POR_CHUNK = 2500;
```

---

## 2. `parseBlocos()`

`src/indexarTema.js:106-108`

```javascript
function parseBlocos(raw) {
  return parseBlocosDelimitador(raw) || parseBlocosColchetes(raw);
}
```

É um dispatcher entre dois formatos. As duas funções chamadas, completas:

`src/indexarTema.js:90-104` — `parseBlocosDelimitador`

```javascript
function parseBlocosDelimitador(raw) {
  const regex = /={3,}\s*TEMA:\s*(.+?)\s*={3,}/g;
  const marcadores = [];
  let m;
  while ((m = regex.exec(raw)) !== null) {
    marcadores.push({ tema: m[1].trim(), inicioMarcador: m.index, fimMarcador: m.index + m[0].length });
  }

  if (!marcadores.length) return null;

  return marcadores.map((marcador, i) => {
    const fimCorpo = i + 1 < marcadores.length ? marcadores[i + 1].inicioMarcador : raw.length;
    return { tema: marcador.tema, corpo: raw.slice(marcador.fimMarcador, fimCorpo).trim() };
  });
}
```

`src/indexarTema.js:54-88` — `parseBlocosColchetes`

```javascript
function parseBlocosColchetes(raw) {
  const segmentos = raw
    .split(/\n={5,}\n?/)
    .map(b => b.trim())
    .filter(Boolean);

  const blocos = [];

  segmentos.forEach((bloco, i) => {
    // Variante A (Volume IV): "[Título]\ncorpo" — o título inteiro fica dentro dos colchetes.
    const variantA = bloco.match(/^\[([^\]]+)\]\s*\n([\s\S]+)$/);
    if (variantA) {
      blocos.push({ tema: variantA[1].trim(), corpo: variantA[2].trim() });
      return;
    }

    // Variante B (Volume II): "[TEMA] Título\ncorpo" — "[TEMA]" é rótulo fixo, título vem depois.
    const variantB = bloco.match(/^\[TEMA\]\s+(.+?)\n([\s\S]+)$/);
    if (variantB) {
      blocos.push({ tema: variantB[1].trim(), corpo: variantB[2].trim() });
      return;
    }

    if (i === 0 || i === segmentos.length - 1) {
      // Primeiro/último segmento sem o formato esperado costuma ser
      // cabeçalho ou rodapé do arquivo (título da obra, "FIM DA BASE") —
      // ignora. Qualquer bloco no meio fora do padrão é erro real.
      return;
    }

    throw new Error(`Bloco fora do formato [TEMA] esperado:\n${bloco.slice(0, 80)}...`);
  });

  return blocos;
}
```

### Observações de comportamento (derivadas do código acima)

- **Formato A (`=== TEMA: ... ===`) tem precedência.** Se houver ao menos um marcador válido, o formato de colchetes nunca é avaliado.
- O delimitador aceita **três ou mais** sinais de igual e espaçamento livre em volta de `TEMA:` (`={3,}\s*TEMA:\s*`).
- **Todo texto anterior ao primeiro marcador é descartado em silêncio** — cabeçalhos, sumários e notas de versão desaparecem sem aviso.
- **Falha silenciosa de fronteira:** cada bloco vai de um marcador até o próximo. Um marcador com erro de digitação (`== TEMA:` com dois sinais, ou `TEMA :` com espaço antes dos dois-pontos) deixa de ser reconhecido, e seu conteúdo é anexado ao corpo do bloco anterior — sem erro e sem log. A única forma de detectar é comparar a contagem de blocos esperada com a devolvida por `parseBlocos()`.
- No formato de colchetes, o separador é `\n={5,}\n?` — **cinco ou mais** sinais, com quebra de linha antes. As duas variantes (`[Título]` e `[TEMA] Título`) são tratadas na mesma passagem.

---

## 3. `expandirBlocosParaChunks()` e a cadeia do fallback

`src/indexarTema.js:184-205` — função pedida

```javascript
function expandirBlocosParaChunks(blocos, maxPalavras) {
  const chunks = [];

  blocos.forEach(bloco => {
    const totalPalavras = bloco.corpo.split(/\s+/).length;

    if (totalPalavras <= maxPalavras) {
      chunks.push({ titulo: bloco.tema, corpo: bloco.corpo });
      return;
    }

    const partes = dividirEmSubChunks(bloco.corpo, maxPalavras);
    partes.forEach((parte, i) => {
      chunks.push({
        titulo: `${bloco.tema} (parte ${i + 1}/${partes.length})`,
        corpo: parte
      });
    });
  });

  return chunks;
}
```

`src/indexarTema.js:115-150` — `dividirEmSubChunks`

```javascript
function dividirEmSubChunks(corpo, maxPalavras) {
  const paragrafos = corpo.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  const subChunks = [];
  let atual = [];
  let palavrasAtual = 0;

  for (const paragrafo of paragrafos) {
    const palavrasParagrafo = paragrafo.split(/\s+/).length;

    if (palavrasParagrafo > maxPalavras) {
      if (atual.length) {
        subChunks.push(atual.join('\n\n'));
        atual = [];
        palavrasAtual = 0;
      }
      subChunks.push(...dividirParagrafoPorFrase(paragrafo, maxPalavras));
      continue;
    }

    if (palavrasAtual > 0 && palavrasAtual + palavrasParagrafo > maxPalavras) {
      subChunks.push(atual.join('\n\n'));
      atual = [];
      palavrasAtual = 0;
    }

    atual.push(paragrafo);
    palavrasAtual += palavrasParagrafo;
  }

  if (atual.length) {
    subChunks.push(atual.join('\n\n'));
  }

  return subChunks;
}
```

`src/indexarTema.js:155-180` — fallback por frase

```javascript
function dividirParagrafoPorFrase(paragrafo, maxPalavras) {
  const frases = paragrafo.match(/[^.!?]+[.!?]+(\s|$)/g) || [paragrafo];

  const partes = [];
  let atual = [];
  let palavrasAtual = 0;

  for (const frase of frases) {
    const palavrasFrase = frase.split(/\s+/).length;

    if (palavrasAtual > 0 && palavrasAtual + palavrasFrase > maxPalavras) {
      partes.push(atual.join(''));
      atual = [];
      palavrasAtual = 0;
    }

    atual.push(frase);
    palavrasAtual += palavrasFrase;
  }

  if (atual.length) {
    partes.push(atual.join(''));
  }

  return partes;
}
```

### Observações de comportamento

- A divisão de parágrafos usa `/\n\s*\n/` — exige **linha em branco**. Texto com quebras simples é um parágrafo único para o script.
- O fallback por frase só é acionado quando um **único parágrafo** excede 2.500 palavras.
- A regex `/[^.!?]+[.!?]+(\s|$)/g` só captura trechos **terminados** em pontuação. Qualquer texto após o último ponto final do parágrafo é **descartado silenciosamente**. Ela também quebra em abreviações (`séc.`, `Dr.`, `p. ex.`). É um caminho a nunca acionar.
- Blocos subdivididos recebem o sufixo `(parte N/M)` no título.

---

## 4. Gravação na tabela `documentos`

`src/indexarTema.js:225-277`

```javascript
async function indexarTema(tema, arquivoPath) {
  if (!supabase) {
    throw new Error('SUPABASE_URL e SUPABASE_KEY devem estar configurados para usar o Supabase.');
  }

  const raw = fs.readFileSync(arquivoPath, 'utf8');
  const blocos = parseBlocos(raw);
  console.log(`Blocos encontrados no arquivo: ${blocos.length}`);

  const chunks = expandirBlocosParaChunks(blocos, MAX_PALAVRAS_POR_CHUNK);
  const divididos = chunks.length - blocos.length;
  if (divididos > 0) {
    console.log(`${divididos} sub-chunk(s) extra(s) gerado(s) a partir de blocos que excediam ${MAX_PALAVRAS_POR_CHUNK} palavras.`);
  }
  console.log(`Total de chunks a indexar: ${chunks.length}`);

  const fonte = path.basename(arquivoPath, '.txt');

  const { error: erroDelete } = await supabase.from('documentos').delete().eq('tema', tema);
  if (erroDelete) {
    throw new Error(`Falha ao limpar chunks anteriores deste tema: ${erroDelete.message}`);
  }

  const rows = [];
  for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
    const batch = chunks.slice(start, start + BATCH_SIZE);
    console.log(`Gerando embeddings ${start + 1}-${start + batch.length}...`);
    const embeddings = await gerarEmbeddingsBatch(batch.map(c => c.corpo));

    batch.forEach((c, i) => {
      rows.push({
        fonte,
        caminho: `${tema}/bloco-${start + i + 1}`,
        titulo: c.titulo,
        categoria: 'tema',
        corpo: c.corpo,
        tema: tema,
        embedding: embeddings[i]
      });
    });

    await sleep(DELAY_MS);
  }

  console.log(`Inserindo ${rows.length} chunks no Supabase...`);
  const { error } = await supabase.from('documentos').insert(rows);
  if (error) {
    throw new Error(`Falha ao inserir chunks: ${error.message}`);
  }

  console.log(`OK — ${rows.length} chunks indexados para tema="${tema}"`);
  return rows.length;
}
```

Não há `upsert` em nenhum ponto do arquivo:

```
$ grep -n "upsert" src/indexarTema.js
(sem resultados)
```

---

## 5. Acumula ou substitui?

**Substitui.** A linha determinante:

`src/indexarTema.js:243`

```javascript
const { error: erroDelete } = await supabase.from('documentos').delete().eq('tema', tema);
```

O `DELETE ... WHERE tema = <tema>` roda **incondicionalmente**, no início de `indexarTema()`, antes do loop de embeddings (248-267) e do `insert(rows)` final (270). Não há checagem de existência nem merge. Rodar o script duas vezes com o mesmo tema — ainda que apontando para arquivos diferentes — apaga os chunks da execução anterior e insere apenas os da atual.

**Consequência operacional 1 — indexação por lotes é impossível no mesmo tema.** Sete arquivos indexados em sequência sob o mesmo nome de tema resultam apenas no conteúdo do sétimo. Para bases divididas em vários `.txt`, é preciso concatenar num arquivo único antes de rodar.

**Consequência operacional 2 — janela de perda de dados.** O `DELETE` ocorre *antes* das chamadas à API de embeddings. Se a API falhar no meio (rate limit, timeout, saldo), a base antiga já foi apagada e a nova não entrou: o tema fica vazio. Fazer dump da tabela antes de qualquer reindexação, enquanto o `DELETE` não for movido para imediatamente antes do `insert`.

**Consequência operacional 3 — `fonte` vem do nome do arquivo.** `path.basename(arquivoPath, '.txt')` é gravado em todas as linhas.

---

## 6. Colunas gravadas e o que participa da busca

### Colunas efetivamente gravadas

`src/indexarTema.js:255-263`

```javascript
rows.push({
  fonte,
  caminho: `${tema}/bloco-${start + i + 1}`,
  titulo: c.titulo,
  categoria: 'tema',
  corpo: c.corpo,
  tema: tema,
  embedding: embeddings[i]
});
```

→ `fonte`, `caminho`, `titulo`, `categoria` (fixo em `'tema'`), `corpo`, `tema`, `embedding`.

O embedding é gerado **exclusivamente a partir de `corpo`** — `gerarEmbeddingsBatch(batch.map(c => c.corpo))`, linha 253. O `titulo` não entra no vetor.

### A função de busca (obtida via `pg_get_functiondef`)

```sql
CREATE OR REPLACE FUNCTION public.buscar_documentos_hibrido(
  query_embedding vector,
  limite_tema integer DEFAULT 3,
  limite_geral integer DEFAULT 2,
  p_tema text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, fonte text, caminho text, titulo text, categoria text,
               corpo text, similaridade double precision, tema_doc text)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  IF p_tema IS NULL THEN
    RETURN QUERY
    SELECT
      d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
      1.0 / (1.0 + (d.embedding <-> query_embedding)) AS similaridade,
      d.tema
    FROM public.documentos d
    WHERE d.embedding IS NOT NULL
    ORDER BY d.embedding <-> query_embedding
    LIMIT (limite_tema + limite_geral);
  ELSE
    RETURN QUERY
    SELECT
      d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
      1.0 / (1.0 + (d.embedding <-> query_embedding)) AS similaridade,
      d.tema
    FROM public.documentos d
    WHERE d.embedding IS NOT NULL
      AND d.tema = p_tema
    ORDER BY d.embedding <-> query_embedding
    LIMIT limite_tema;

    RETURN QUERY
    SELECT
      d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
      1.0 / (1.0 + (d.embedding <-> query_embedding)) AS similaridade,
      d.tema
    FROM public.documentos d
    WHERE d.embedding IS NOT NULL
      AND d.tema IS DISTINCT FROM p_tema
    ORDER BY d.embedding <-> query_embedding
    LIMIT limite_geral;
  END IF;
END;
$function$
```

### Conclusões

**A função não é híbrida.** Não há `tsvector`, `ts_rank`, `ILIKE` nem reranking de qualquer espécie. É busca vetorial pura. O termo "híbrido" no nome refere-se apenas à mistura tema/geral — duas consultas vetoriais concatenadas.

| Coluna | Papel na busca |
|---|---|
| `embedding` | **Único** critério de ordenação (`<->`, distância L2) |
| `tema` | Filtro binário (`= p_tema` / `IS DISTINCT FROM p_tema`) |
| `titulo` | **Nenhum.** Gravado e retornado, nunca consultado |
| `fonte`, `caminho`, `categoria` | **Nenhum.** Apenas retornados |
| `corpo` | Indireto — é a fonte do embedding |

**O pool "geral" é `d.tema IS DISTINCT FROM p_tema`** — todo o restante da tabela, incluindo os registros com `tema` nulo. Não há filtro de afinidade.

### Índice

```
documentos_pkey            UNIQUE btree (id)
documentos_embedding_idx   ivfflat (embedding) WITH (lists='100')
documentos_livro_id_idx    btree (livro_id)
documentos_tema_idx        btree (tema)
```

Com **1.472 linhas** na tabela e `lists=100`, cada partição guarda ~15 vetores. O `ivfflat.probes` padrão é **1**: cada consulta varre uma partição, ~1% da base. Aplicado o filtro `AND d.tema = p_tema` sobre esses candidatos, a consulta pode devolver **menos chunks que o `LIMIT`, ou nenhum**, mesmo havendo material pertinente no tema. Dimensionamento coerente para este volume ficaria entre 20 e 40 listas, ou troca por HNSW.

---

## 7. Escolha e roteamento do `tema`

`src/server.js:2539-2545` — o tema chega no corpo da requisição do questionário

```javascript
app.post('/api/questionario/salvar-respostas', async (req, res) => {
  try {
    const { sessionId, tema, respostas, pacoteId } = req.body;

    if (!sessionId || !tema || !respostas) {
      return res.status(400).json({ error: 'sessionId, tema e respostas são obrigatórios.' });
    }
```

`src/server.js:2590-2599` — é gravado na sessão

```javascript
    // ── ATUALIZAR SESSÃO COM TEMA ATIVO (Busca RAG Híbrida) ──
    // Isto permite que buscas RAG subsequentes sejam contextualizadas ao tema do questionário
    try {
      session.temaQuestionario = tema;
      await upsertSession(session);
      console.log(`[QUESTIONÁRIO] Sessão ${sessionId} atualizada com tema ativo: "${tema}"`);
    } catch (err) {
      console.error('[QUESTIONÁRIO] Erro ao atualizar tema da sessão:', err.message);
      // Não bloqueia — o questionário foi respondido, apenas o tema na sessão falhou
    }
```

`src/server.js:2292` — no chat do Mentor, é repassado à busca

```javascript
    const knowledge = await searchKnowledge(message, 5, session.temaQuestionario);
```

`src/server.js:758` — assinatura, com `tema` escalar

```javascript
async function searchKnowledge(query, limite = 5, tema = null) {
```

`src/server.js:780-793` — repasse ao RPC

```javascript
    if (tema) {
      // ── Busca Híbrida: Prioriza tema, complementa com conteúdo geral
      // Distribuição padrão: 60% para tema-específico, 40% para geral
      const limiteTema = Math.ceil(limite * 0.6);
      const limiteGeral = limite - limiteTema;

      console.log(`[RAG_HIBRIDO] Query: "${query}" | Tema: "${tema}" | Limite tema: ${limiteTema}, Limite geral: ${limiteGeral}`);

      rpcResult = await supabase.rpc('buscar_documentos_hibrido', {
        query_embedding: embedding,
        limite_tema: limiteTema,
        limite_geral: limiteGeral,
        p_tema: tema
      });
    } else {
```

### Uma consulta pode pesquisar mais de um tema?

**Não.** `tema` é declarado como valor único em `src/server.js:758` (`tema = null`), nunca como array, e é repassado como escalar em `p_tema: tema` (linha 792). Em nenhum ponto do fluxo — questionário → `session.temaQuestionario` → `searchKnowledge()` → `.rpc()` — há agregação ou iteração sobre múltiplos temas.

A única "mistura" é entre o tema único (60%, `limiteTema`) e o pool geral sem filtro (40%, `limiteGeral`) — nunca entre dois temas nomeados.

Com `limite = 5`: `limiteTema = Math.ceil(5 * 0.6) = 3` e `limiteGeral = 2`. **Teto de 3 chunks do tema por chamada.**

---

## Anexo — estado atual da tabela `documentos`

Total: **1.472 linhas**.

| tema | chunks | média (chars) | maior |
|---|---|---|---|
| *(nulo)* | 530 | 2.574 | 6.616 |
| obesidade | 410 | 963 | 1.693 |
| elegancia_charme_feminino | 174 | 1.274 | 5.013 |
| depressao | 79 | 14.343 | 19.218 |
| compreensao_da_vida_base_mentor | 60 | 3.314 | 7.836 |
| elegancia_presenca_masculina | 58 | 2.182 | 10.603 |
| namoro_conquista_romance | 52 | 15.844 | 20.102 |
| administracao_empresarial_inteligente | 40 | 900 | 1.091 |
| cabala_astrologia_numerologia_integrativa | 25 | 2.715 | 4.495 |
| sentimentos_adolescencia | 16 | 758 | 874 |
| educar_filhos | 14 | 815 | 895 |
| consequencias_causa_efeito | 12 | 14.282 | 17.505 |
| timidez_comunicacao | 2 | 5.560 | 5.727 |

**Não existem os temas `astrologia` nem `numerologia`.**

### Composição dos 530 registros sem tema

| fonte | categoria | chunks |
|---|---|---|
| documentos-zuni | *(nula)* | 278 |
| a_bussola_humana_base_mentor | livro | 86 |
| o_antidoto_base_mentor | livro | 80 |
| zuni_a_travessia_base_mentor | livro | 66 |
| os_bastidores_da_mente_base_mentor | livro | 12 |
| cap1-vol1-degustacao | livro | 8 |

### Material de astrologia e numerologia (dentro de `documentos-zuni`, `tema` nulo)

| arquivo de origem | chunks |
|---|---|
| vertical_numerologia_base_mentor.txt | 8 |
| vertical_astrologica_signos_expandida.txt | 5 |
| vertical_astrologica_base_mentor.txt | 4 |
| curadoria_astrologia_casas.txt | 2 |
| curadoria_astrologia_aspectos.txt | 1 |
| curadoria_astrologia_signos_temperamento.txt | 1 |
| amostra_curadoria_astrologia_planetas.txt | 1 |
| curadoria_astrologia_salvaguardas.txt | 1 |

15 chunks de astrologia, 8 de numerologia. Sem `tema` preenchido, são **inalcançáveis pelo filtro `d.tema = p_tema`** — só podem aparecer pela via do pool geral (40%), competindo com todo o restante da base.

### Diagnóstico da ingestão `documentos-zuni`

O ingestor não respeitou as fronteiras de bloco dos arquivos-fonte. O separador `==========` e os títulos `[...]` aparecem **literalmente dentro do texto vetorizado**, e vários chunks começam no meio de uma frase. Exemplos extraídos do banco:

- `estilos pessoais de iniciativa e autoafirmação. ========== [SEGUNDA CASA - RECURSOS E VALOR PROPRIO] A Segunda Casa representa…`
- `é quando esse brilho se torna mais verdadeiro. ========== [VIRGEM — TEMPERAMENTO] Virgem é habitualmente reduzido…`
- `está ligada às amizades, aos grupos e às causas coletivas…` (início de chunk)

O corte foi por tamanho bruto, ~5.000 caracteres, ignorando a marcação. Efeito sobre a recuperação: um único chunk carrega Virgem, Libra e Escorpião misturados — o vetor resultante é a média de três signos e não corresponde a nenhum deles isoladamente.

O `titulo` de todos os chunks de um mesmo arquivo é idêntico e derivado do nome do arquivo (ex.: `vertical numerologia base mentor`). Não há título por bloco.

**O conteúdo de origem, porém, está bem escrito e usa marcação compatível** com as variantes que `parseBlocosColchetes` já trata (`[ÁRIES — TEMPERAMENTO]`, `[SEGUNDA CASA - RECURSOS E VALOR PROPRIO]`, `[TEMA] Caminho de Vida 2`). Reindexar os `.txt` originais com `indexarTema.js` sob temas nomeados deve reconstituir as fronteiras corretas sem reescrita de conteúdo.

### Duplicação identificada

Quatro obras estão indexadas duas vezes, por pipelines distintos:

| obra | via `documentos-zuni` | via `categoria='livro'` |
|---|---|---|
| a_bussola_humana | 16 | 86 |
| o_antidoto | 17 | 80 |
| zuni_a_travessia | 11 | 66 |
| os_bastidores_da_mente | 6 | 12 |

Há também sobreposição temática: `depressao_base_conhecimento.txt` (nulo) contra o tema `depressao`; `charme_feminino_relacionamentos.txt` contra `elegancia_charme_feminino`; `timidez_origens_mecanismos.txt` e `timidez_inseguranca_autoconfianca.txt` contra `timidez_comunicacao`.

Como o pool geral é `tema IS DISTINCT FROM p_tema`, essa duplicação polui 40% de toda consulta do Mentor, em todos os temas.

### Granularidade fora do padrão atual

`namoro_conquista_romance` (~2.640 palavras de média, máximo ~3.350), `depressao` (~2.390 de média) e `consequencias_causa_efeito` (~2.380) estão acima do `MAX_PALAVRAS_POR_CHUNK = 2500` vigente — foram indexados quando a constante ainda era 4.000. `timidez_comunicacao`, com 2 chunks, sugere indexação interrompida.

---

---

# PARTE II — Fluxo dos produtos, arquivos-fonte e pipelines de escrita

---

## 8. Fluxo do Mapa Integrado e do Mapa do Amor

### Mapa do Amor — não existe

```
grep -rniE "mapa.{0,3}do.{0,3}amor" .
→ No files found
```

Não há rota, prompt ou qualquer referência no repositório. É construção do zero.

### Mapa Integrado — não consulta RAG

**A rota não chama `searchKnowledge()` em nenhum ponto.** As quatro ocorrências de `searchKnowledge` em `src/server.js` são: a definição (758) e chamadas em 2292 (`/api/chat` genérico), 2321/2328 (relatório dual mapa-astral + numerologia, que é outro produto) e 3393. Nenhuma dentro de `/api/checkout/mapa-integrado`, de `gerarRelatorioMapaIntegradoSeAplicavel()` ou de `generateReportText()` para `productType === 'mapa-integrado'`.

Seleção do system prompt — `src/server.js:829-833`

```javascript
    let systemPrompt = REPORT_PROMPT;
    if (session.productType === 'mapa-integrado') {
      systemPrompt = MAPA_INTEGRADO_PROMPT;
    }
```

Abertura do prompt — `src/server.js:331`

```javascript
const MAPA_INTEGRADO_PROMPT = `Você é o sistema de geração do Mapa Integrado ZUNI Suprema — relatório astrológico e numerológico personalizado.
```

Montagem do `userContent` — `src/server.js:837-877, 881-883`

```javascript
    if (session.productType === 'mapa-integrado') {
      userContent = `Nome: ${session.name}\nEmail: ${session.email}\n\nContexto (o que a pessoa buscava ao solicitar seu mapa):\n${historico}`;
    } else {
      ...
    }

    if (session.mapaNatal) {
      const mapa = session.mapaNatal;
      ...
      const dadosAstrais = `\n\n--- DADOS ASTROLÓGICOS CALCULADOS ---
Ascendente: ${mapa.ascendente?.sign} ${mapa.ascendente?.degree}°
Sol: ${mapa.sol?.sign} ${mapa.sol?.degree}°
Lua: ${mapa.lua?.sign} ${mapa.lua?.degree}°
Mercúrio: ${mapa.mercurio?.sign} ${mapa.mercurio?.degree}°
Vênus: ${mapa.venus?.sign} ${mapa.venus?.degree}°
Marte: ${mapa.marte?.sign} ${mapa.marte?.degree}°
Júpiter: ${mapa.jupiter?.sign} ${mapa.jupiter?.degree}°
Saturno: ${mapa.saturno?.sign} ${mapa.saturno?.degree}°
Urano: ${mapa.urano?.sign} ${mapa.urano?.degree}°
Netuno: ${mapa.netuno?.sign} ${mapa.netuno?.degree}°
Plutão: ${mapa.plutao?.sign} ${mapa.plutao?.degree}°`;

      userContent += dadosAstrais;

      if (session.casas && Array.isArray(session.casas) && session.casas.length > 0) {
        userContent += `\n\nCasas Astrológicas:\n${session.casas.map((c, i) => `Casa ${i + 1}: ${c.sign || 'desconhecida'} ${c.degree || 0}°`).join('\n')}`;
      }

      if (session.aspectos && Array.isArray(session.aspectos) && session.aspectos.length > 0) {
        userContent += `\n\nAspectos Principais:\n${session.aspectos.map(a => `${a.planet1} ${a.aspect} ${a.planet2} (${a.orb}°)`).join('\n')}`;
      }
    }

    if (session.includeNumerology) {
      if (session.productType === 'mapa-integrado') {
        userContent += `\n\nNumerologia (baseada em ${session.birthNameFull || session.name}):\nCaminho de Vida: ${session.caminhoDeVida}`;
        userContent += `\nEssência: ${session.essencia}`;
      }
```

**Dados que alimentam o prompt:** `session.mapaNatal`, `session.casas` e `session.aspectos`, saídas de `calcularMapaNatal` (`src/server.js:2969-2974`); `session.caminhoDeVida` e `session.essencia`, saídas de `calcularCaminhoDeVida` e `calcularEssencia` (`src/server.js:2984-2985`); `session.name`, `session.email` e o histórico do checkout. **Nenhum fragmento de RAG.**

### Duas lacunas estruturais no prompt

**Os planetas não têm casa.** Cada planeta é enviado com signo e grau; as casas vão em lista separada, com signo e grau da cúspide. Em nenhum ponto se declara que o Sol está na Sexta Casa. A associação planeta→casa teria de ser inferida pelo modelo por comparação de graus — operação que ele executa de forma inconsistente. Na prática, a leitura por casa não se sustenta.

**A numerologia entrega dois números.** Apenas `caminhoDeVida` e `essencia`. Não há número de expressão, motivação, impressão, dia natalício, maturidade, ano pessoal, pináculos, desafios, lições ou dívidas cármicas.

**Consequência:** sem RAG e com entrada estrutural incompleta, o modelo escreve a partir de conhecimento geral sobre poucos pontos. Corresponde ao sintoma relatado nas gerações de teste — texto curto, genérico, cobrindo poucos itens. A causa está na montagem do prompt, não na recuperação.

---

## 9. Arquivos `.txt` de astrologia, numerologia, cabala e mapa integrativo

Todos em `documentos-zuni/`. Nenhum usa o Formato A (`=== TEMA: ... ===`).

| arquivo | bytes | palavras | formato |
|---|---|---|---|
| vertical_numerologia_base_mentor.txt | 32.515 | 5.093 | Colchetes variante B (`[TEMA] Título`) + `==========` |
| vertical_astrologica_signos_expandida.txt | 20.589 | 3.274 | Colchetes variante A (`[Título]`) + `==========` |
| vertical_astrologica_base_mentor.txt | 12.166 | 1.832 | Colchetes variante A + `==========` |
| curadoria_astrologia_casas.txt | 5.240 | 820 | Colchetes variante A + `==========` |
| amostra_curadoria_astrologia_planetas.txt | 3.064 | 476 | Colchetes variante A + `==========` |
| curadoria_astrologia_aspectos.txt | 2.648 | 377 | Colchetes variante A + `==========` |
| curadoria_astrologia_salvaguardas.txt | 1.214 | 159 | Colchetes variante A + `==========` |

**Total: ~12.031 palavras.**

### Duplicação interna

`amostra_curadoria_astrologia_planetas.txt` e `curadoria_astrologia_salvaguardas.txt` contêm texto idêntico, palavra por palavra, a blocos que também estão dentro de `vertical_astrologica_base_mentor.txt` (blocos "SIMBOLISMO DOS PLANETAS", "SOL", "LUA", "ASCENDENTE", "SALVAGUARDAS"). São drafts de curadoria incorporados ao arquivo consolidado.

Confirmado por consulta ao banco: **ambos estão indexados separadamente** (1 chunk cada), além de o mesmo texto constar no consolidado. São vetores duplicados competindo entre si.

### Falsos positivos

Quatro arquivos citam "Mapa Integrativo" apenas como marca ou rodapé, sem serem bases de astrologia: `mapa_de_valores.txt:64`, `longevidade_celular_coracao_diabetes.txt:370`, `longevidade_celular_envelhecimento_saudavel.txt` e `mente_pensamento_carater_consciencia.txt`.

### Cabala — sem arquivo-fonte

```
grep -rniE "cabal[aá]" documentos-zuni/
→ No matches found
```

O tema `cabala_astrologia_numerologia_integrativa` existe no banco com 25 chunks, mas **não tinha arquivo-fonte no repositório**. O conteúdo existia apenas dentro do Postgres — e seria destruído por qualquer execução de `indexarTema.js` com esse nome de tema, dado o `DELETE` da linha 243.

**Salvaguarda executada:** os 25 blocos foram extraídos do banco e reconstituídos como `cabala_astrologia_numerologia_integrativa_base_mentor.txt`, no Formato A — 25 blocos, 10.209 palavras, 72.366 bytes. Nenhum bloco excede 800 palavras, portanto a reindexação reproduziria os mesmos 25 chunks sem subdivisão.

**Atenção ao guardá-lo:** `src/indexar.js` indexa a pasta `documentos-zuni/` inteira. Se o arquivo for salvo ali e alguém executar esse script, o compêndio será indexado uma segunda vez com `tema` nulo, em paralelo aos 25 chunks corretos.

---

## 10. Pipelines que escrevem em `documentos`

Existem **três** pontos de escrita no repositório inteiro — dois `DELETE` e um `UPSERT`. Nenhum `UPDATE`.

```
src/indexarTema.js:243:   supabase.from('documentos').delete().eq('tema', tema);
src/indexarLivro.js:121:  supabase.from('documentos').delete().eq('livro_id', livroId);
src/indexar.js:230:       supabaseClient.from('documentos').upsert(batch, { onConflict: ['id'] });
```

Os demais arquivos com `.from('documentos')` fazem apenas `.select(...)`: `check_chunks_distribution.js`, `verify-index.js`, `test_admin_query.js`, `query_chunks.js`, `query_admin_empresa.js`, `scratchpad/verificar-chunks.js` e `src/lib/astrologia-b.js:100`.

### `src/indexarTema.js:255-263`

```javascript
      rows.push({
        fonte,
        caminho: `${tema}/bloco-${start + i + 1}`,
        titulo: c.titulo,
        categoria: 'tema',
        corpo: c.corpo,
        tema: tema,
        embedding: embeddings[i]
      });
```

`tema`: sim. `livro_id`: não. `categoria`: fixo `'tema'`.

### `src/indexarLivro.js:132-142`

```javascript
      rows.push({
        fonte,
        caminho: `${livroId}/tema-${start + i + 1}`,
        titulo: b.tema,
        categoria: 'livro',
        corpo: b.corpo,
        livro_id: livroId,
        embedding: embeddings[i]
      });
```

`tema`: **não**. `livro_id`: sim. `categoria`: fixo `'livro'`. Limpeza por `livro_id` na linha 121.

### `src/indexar.js:191-199`

```javascript
          rows.push({
            id,
            fonte: DOCUMENT_SOURCE,
            caminho: relativePath,
            titulo,
            categoria: categoria === '.' ? null : categoria,
            corpo,
            embedding
          });
```

Com `DOCUMENT_SOURCE = 'documentos-zuni'` (`src/indexar.js:15`) e `categoria` derivada de `path.dirname(relativePath)` (linha 171), convertida para `null` quando o arquivo está na raiz da pasta (linha 196).

`tema`: **não**. `livro_id`: **não**.

### Respostas diretas

**Qual gerou `fonte='documentos-zuni'`?** `src/indexar.js`. A `categoria` nula decorre de os arquivos estarem soltos na raiz de `documentos-zuni/`, sem subpasta — `path.dirname()` retorna `'.'`, convertido para `null`.

**Quais preenchem `tema`?** Somente `indexarTema.js`. Os outros dois deixam nulo — origem dos 530 registros sem tema.

**Outros DELETE/UPDATE/UPSERT?** Dois além do da linha 243: `indexarLivro.js:121` (delete por `livro_id`) e `indexar.js:230` (upsert por `id`).

### Risco específico do `indexar.js`

É o único que usa `upsert` sem `delete` prévio. **Chunks órfãos nunca são removidos:** se um arquivo-fonte encolhe ou é apagado, os chunks antigos permanecem indefinidamente. É a mecânica que explica o acúmulo de 278 registros e a convivência de drafts duplicados com o arquivo consolidado.

---

## 11. Modelo de embedding

**Não há variável de ambiente.**

```
grep -n "EMBEDDING" .env.example
→ No matches found
```

O nome está hard-coded como literal em seis pontos independentes, sem constante compartilhada:

| arquivo | linha |
|---|---|
| src/indexarTema.js | 37 — `const EMBEDDING_MODEL = 'text-embedding-3-small';` |
| src/indexarLivro.js | 24 — idem |
| src/indexar.js | 18 — idem |
| src/server.js | 767 — `model: 'text-embedding-3-small',` (inline, em `searchKnowledge`) |
| src/routes/livroChat.js | 77 — inline |
| src/routes/experimenteLivroChat.js | 75 — inline |

`gerarEmbeddingsBatch()` — idêntica em `indexarTema.js:207-223` e `indexarLivro.js:92-108`:

```javascript
async function gerarEmbeddingsBatch(textos) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: textos })
  });

  if (!resp.ok) {
    throw new Error(`Falha ao gerar embeddings (status ${resp.status}): ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.data.map(item => item.embedding);
}
```

`src/indexar.js` usa `requestOpenAIEmbeddings()` (96-126) e `batchGetEmbeddings()` (128-145, com retry exponencial), enviando o mesmo `model: EMBEDDING_MODEL` (linha 105) ao mesmo endpoint (linha 19).

**Dimensão armazenada:** `vector(1536)`, confirmada no schema. Consistente com `text-embedding-3-small`.

**Consistência:** todos os seis pontos usam o mesmo modelo. Os vetores são comparáveis entre si — não há pipeline com modelo divergente. Como é literal e não configurável, não há risco de divergência por ambiente. Em contrapartida, trocar de modelo exige editar seis arquivos e recriar a coluna se a dimensão mudar.

### Estrutura completa da tabela

| coluna | tipo | nulo? |
|---|---|---|
| id | uuid | não |
| fonte | text | não |
| caminho | text | não |
| titulo | text | sim |
| corpo | text | não |
| categoria | text | sim |
| criado_em | timestamptz | não |
| embedding | vector(1536) | sim |
| livro_id | text | sim |
| tema | text | sim |

---

## 12. Dependências — é possível criar tabela e RPC próprias?

**Sim, sem quebrar o Mentor.** Levantamento feito no banco, já que a camada SQL não está versionada.

### Objetos que dependem de `documentos`

| objeto | tipo | filtro |
|---|---|---|
| `buscar_documentos` | function | nenhum — vetorial pura sobre toda a tabela |
| `buscar_documentos_hibrido` | function | `tema` |
| `match_documents_livro` | function | `livro_id` |

```sql
CREATE OR REPLACE FUNCTION public.match_documents_livro(
  query_embedding vector, match_count integer DEFAULT 5, p_livro_id text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, fonte text, caminho text, titulo text, categoria text, corpo text, similaridade double precision)
 LANGUAGE sql
 STABLE
AS $function$
SELECT
  id, fonte, caminho, titulo, categoria, corpo,
  1.0 / (1.0 + (embedding <-> query_embedding)) AS similaridade
FROM public.documentos
WHERE embedding IS NOT NULL
  AND livro_id = p_livro_id
ORDER BY embedding <-> query_embedding
LIMIT match_count;
$function$
```

Confirma que os 252 chunks com `categoria='livro'` pertencem ao fluxo de chat dentro dos livros, isolados por `livro_id`.

### Ausência de acoplamento estrutural

Consulta a `pg_views`, `pg_constraint` (por `confrelid`) e `pg_trigger`: **nenhuma view, foreign key ou trigger** referencia `documentos`. As três funções acima são as únicas dependências.

### Conclusão

Uma tabela `documentos_astro` com função RPC dedicada não afeta nada do sistema atual. O Mentor continua chamando `buscar_documentos_hibrido` sobre `documentos`, sem conhecimento da outra tabela. Isso permitiria, sem tocar no fluxo existente:

- Isolar o `DELETE ... WHERE tema` das bases do Mentor
- Eliminar o pool geral de 40% (`tema IS DISTINCT FROM p_tema`) na busca do Mapa
- Dimensionar o índice para o volume da base nova, sem alterar o índice compartilhado

### Ponto de atenção — RLS

```
relrowsecurity = true
relforcerowsecurity = false
policies = (nenhuma)
```

RLS está habilitado sem policies definidas. Funciona porque o servidor usa service key, que ignora RLS. Qualquer acesso por anon key retorna vazio. Uma tabela nova precisa nascer com a mesma configuração, sob pena de comportamento divergente e silencioso.

---

## Estado das pendências

Todas as pendências da Parte I foram respondidas na Parte II. Nenhum item permanece em aberto.

Nenhuma alteração foi proposta ou aplicada em código, arquivos ou banco de dados. Este documento registra apenas o estado observado. A única ação executada foi a extração somente-leitura do compêndio de cabala do banco para arquivo, descrita no item 9.
