---
name: zuni-rag-tema
description: Pipeline completo para preparar e indexar uma nova base RAG por tema no Mentor ZUNI Suprema (zunisuprema.com.br) — usado sempre que o usuário trouxer documentos-fonte (.docx, .pdf, .txt) para compor um novo tema do questionário pós-checkout, pedir para "curar material para o RAG", "montar a base do Mentor para X", ou "indexar um tema novo". Cobre triagem de conteúdo, remoção de bastidores de conversa com IA embutidos nos arquivos, formatação para o parser de indexarTema.js, e verificação de limites de tokens de embedding antes de indexar. Use também quando o usuário mencionar arquivos "vertical_*_base_mentor.txt" ou pedir para validar se um .txt está pronto para o indexarTema.js.
---

# Pipeline de curadoria e indexação de tema RAG — ZUNI Suprema

Este skill documenta o processo desenvolvido e validado para transformar um lote de
documentos-fonte (obras, guias, PDFs) em uma base RAG indexável por tema, usada pela
função `buscar_documentos_hibrido()` do Mentor.

O processo tem quatro etapas sequenciais. Nunca pule para indexação sem completar
as três primeiras — cada uma existe porque um problema real apareceu ao pulá-la.

## Etapa 1 — Triagem de conteúdo (por arquivo)

Para cada arquivo-fonte enviado, leia o conteúdo real (nunca avalie só pelo nome do
arquivo) e classifique:

- **Aproveitável, pronto**: conteúdo real, bem escrito, aderente ao tema.
- **Aproveitável, precisa de limpeza**: contém bastidores de conversa com IA
  embutidos no meio do texto (ver Etapa 2).
- **Fora de escopo**: quando o conteúdo entra em posologia farmacológica, doses de
  suplementos/hormônios, fórmulas magistrais com quantidades específicas — isso viola
  a regra editorial fixa do projeto (fitoterápicos sem quantidade são aceitáveis em
  obras publicadas, mas nunca em respostas de API/Mentor). Descarte esses arquivos ou
  sinalize claramente o motivo.
- **Esqueleto/duplicata**: arquivos que são só um sumário sem corpo de texto, ou
  cópias idênticas de um arquivo já avaliado (rode um diff de parágrafos antes de
  assumir que dois arquivos com nomes parecidos são diferentes).

Sempre confirme decisões de escopo ambíguas com o usuário antes de descartar — o que
parece "fora do tema" pode ser intencional (ex.: o usuário pode querer manter conteúdo
adjacente por ser "tema recorrente").

## Etapa 2 — Remoção de bastidores de conversa com IA

Muitos documentos de origem carregam, junto com o conteúdo real, trechos deixados de
uma conversa anterior com um assistente de IA que ajudou a escrever a obra: brainstorm
de título/subtítulo, autoavaliação da obra, sugestões de marketing/capa, despedidas e
agradecimentos. Isso **não é conteúdo do livro** e não deve entrar no RAG.

### Como localizar

1. Veja os parágrafos iniciais e finais do documento primeiro — é onde esses blocos
   mais aparecem (antes do sumário oficial, ou depois do encerramento/sinopse).
2. Busque por marcadores característicos: "Perfeito.", "Quer que eu", "Posso ajustar",
   "Sinceramente:" / "Honestamente:" seguido de avaliação, "Opção 1" / "Opção 2" (para
   títulos ou conceitos de capa), "Parabéns pela visão", "GRATIDÃO", menções a "funil",
   "upsell", "obra complementar", "próximo passo ideal".
3. Um único marcador não confirma um bloco — sempre leia o contexto ao redor (10-20
   parágrafos antes/depois) para achar a fronteira exata: onde o bastidor começa e onde
   o conteúdo real recomeça (geralmente um título de capítulo, "SUMÁRIO", "PREFÁCIO").
4. Um documento pode ter mais de um bloco de bastidor (início E fim, ou até um bloco de
   transição no meio). Não pare na primeira ocorrência — varra o documento inteiro.
5. Depois de remover, sempre rode uma segunda varredura por marcadores no arquivo já
   limpo para confirmar que não sobrou resíduo.

### Como remover (via Code/Cowork, com python-docx)

Nunca edite manualmente por adivinhação de texto — extraia os parágrafos por índice,
confirme os limites exatos primeiro, depois remova os elementos XML correspondentes:

```python
import docx
d = docx.Document('arquivo.docx')
paras = d.paragraphs
# confirme os índices exatos antes de remover (view around the boundary)
to_remove_idx = list(range(INICIO, FIM + 1))
for i in to_remove_idx:
    paras[i]._element.getparent().remove(paras[i]._element)
d.save('arquivo_LIMPO.docx')
```

## Etapa 3 — Formatação para o parser de indexarTema.js

O script `indexarTema.js` (adaptado de `indexarLivro.js`) só reconhece dois formatos
de bloco em um `.txt`. **Sempre confirme o formato real do arquivo antes de assumir**
— documentos diferentes do mesmo lote podem usar formatos diferentes entre si.

### Formato A — delimitador (preferido para bases novas, sintetizadas por você)

```
=== TEMA: Nome do Bloco ===
corpo do bloco...
=== TEMA: Próximo Bloco ===
corpo...
```

### Formato B — colchetes, variante com separador único (mais comum em fontes antigas)

```
[Título do Bloco]
==========
corpo do bloco até o próximo título...

[Próximo Título]
==========
corpo...
```

### Formato B2 — colchetes, variante com separador duplo (existe em alguns arquivos
"vertical_*" mais antigos — cada bloco é fechado por separador dos dois lados)

```
[Título do Bloco]
==========
corpo...
==========

[Próximo Título]
==========
corpo...
==========
```

**Cuidado**: os formatos B e B2 usam a mesma sintaxe de separador (`==========`), mas
com posição diferente, e são incompatíveis entre si no parser padrão. Um arquivo B2
processado com a lógica de B falha silenciosamente ou gera blocos vazios/errados.
Sempre teste a extração antes de indexar (ver Etapa 4).

Se o arquivo-fonte não estiver em nenhum desses formatos (por exemplo, é um `.docx`
de prosa corrida sem marcação), monte você mesmo os blocos no Formato A, dividindo por
capítulo ou seção lógica da obra.

## Etapa 4 — Verificação de limite de tokens antes de indexar

O modelo de embedding (`text-embedding-3-small`) tem limite rígido de 8.191 tokens por
chamada. Um bloco de texto corrido (uma obra inteira sem divisão interna) facilmente
excede isso — já aconteceu com blocos de até 36.000 palavras (~49.000 tokens
estimados), que quebrariam a chamada de API se enviados como estão.

**Antes de indexar, sempre**:

1. Calcule a contagem de palavras de cada bloco (`corpo.split(/\s+/).length`).
2. Estime tokens como `palavras * 1.35` (aproximação razoável para português).
3. Qualquer bloco acima de ~4.000 palavras (~5.400 tokens estimados) deve ser
   sub-dividido, respeitando fronteiras de parágrafo (nunca cortar uma frase ao meio).
   O `indexarTema.js` já faz isso automaticamente via `expandirBlocosParaChunks()`
   com `MAX_PALAVRAS_POR_CHUNK = 4000` — mas sempre rode o teste abaixo para confirmar
   que nenhum chunk final ainda excede o limite, especialmente se um único parágrafo
   isolado for anormalmente longo.
4. **Teste o parser real antes de rodar a indexação de verdade.** Nunca confie em uma
   reimplementação própria da lógica de parsing — use as funções exportadas do
   `indexarTema.js` (`parseBlocos`, `expandirBlocosParaChunks`) para simular a
   extração e contar blocos/chunks/tamanhos, sem tocar no Supabase:

```javascript
const { parseBlocos, expandirBlocosParaChunks } = require('./src/indexarTema.js');
const fs = require('fs');
const raw = fs.readFileSync('caminho/do/arquivo.txt', 'utf8');
const blocos = parseBlocos(raw);
const chunks = expandirBlocosParaChunks(blocos, 4000);
const maior = Math.max(...chunks.map(c => c.corpo.split(/\s+/).length));
console.log(blocos.length, 'blocos ->', chunks.length, 'chunks | maior:', maior, 'palavras');
```

Se `parseBlocos` lançar erro ("Bloco fora do formato [TEMA] esperado"), o arquivo não
está em nenhum dos formatos aceitos — volte à Etapa 3.

## Etapa 5 — Indexação real

Só depois de confirmar as quatro etapas acima, rode (na raiz do projeto, não dentro de
`src/`, porque o script depende do `.env` na raiz):

```
node src/indexarTema.js <nome_do_tema> <caminho/do/arquivo.txt>
```

O nome do tema deve seguir o padrão já usado no projeto: minúsculo, sem acento, sem
espaço, underscore no lugar de espaço (ex.: `namoro_conquista_romance`,
`sentimentos_adolescencia`). Esse valor é gravado na coluna `tema` da tabela
`documentos` e usado depois para direcionar as perguntas do questionário pós-checkout
àquele tema específico.

Depois de rodar, valide no Railway procurando pelo log `[RAG_HIBRIDO]` para confirmar
que a busca híbrida está de fato recuperando chunks do novo tema.

## Regra de processo do projeto (sempre respeitar)

Investigar → apresentar plano → aprovação explícita → código → revisão linha a linha
do código real (nunca resumo/checklist) → aprovação → aplicar manualmente. Mudanças de
banco de dados são sempre manuais via Supabase SQL Editor, nunca automatizadas sem
pedido explícito. Nunca assuma que um arquivo com nome parecido a outro já avaliado
tem o mesmo conteúdo — confira, ou rode um diff.
