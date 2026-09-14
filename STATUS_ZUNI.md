# STATUS ZUNI SUPREMA

> Arquivo de estado vivo do projeto — só o que está no ar, aberto ou vigente agora.
> É o único arquivo que o skill `zuni-continuidade` lê por padrão no início de cada
> sessão. Atualizado ao final de cada sessão de trabalho (chat, Claude Code ou
> Cowork).
>
> **Separado em dois arquivos em 14/09/2026** porque o antigo `STATUS_ZUNI.md`
> tinha virado um log cronológico de meses (287 KB, lido inteiro a cada sessão,
> consumindo orçamento antes de qualquer trabalho começar). Todo o registro
> histórico — o que foi feito, quando, e por quê — está intacto em
> `STATUS_ZUNI_HISTORICO.md`. Nada foi apagado na separação, só reorganizado.
> Ninguém lê o histórico por padrão; é para consulta.
>
> **Critério para o que fica aqui**: estado atual (o que está no ar), pendência
> ainda aberta, prazo ativo, decisão que ainda vale, ou armadilha conhecida que
> ainda pode morder alguém. Assim que um item for resolvido/encerrado, ele migra
> para o histórico — nunca fica junto do estado atual.

---

## 1. Visão geral do projeto

ZUNI Suprema (zunisuprema.com.br) — plataforma em português que integra um Mentor de
IA (Claude API), uma livraria interativa ("livros vivos") e produtos personalizados de
astrologia/numerologia. Operada por um único fundador/desenvolvedor.

**Stack**: Node.js/Express no Railway · Supabase (pgvector) · Claude API · embeddings
OpenAI (`text-embedding-3-small`) · MercadoPago · SendGrid · webhooks Make/WhatsApp.
Deploy via `git push origin main`.

**Regra de processo fixa**: investigar → apresentar plano → aprovação explícita →
código → revisão linha a linha do código real (nunca resumo) → aprovação → aplicar
manualmente. Mudanças de banco são sempre manuais via Supabase SQL Editor.

---

## Radar de oportunidades

O arquivo `RADAR_OPORTUNIDADES.md` (raiz) registra o horizonte estratégico do projeto:
referências de mercado, canais de venda, produtos a criar e ferramentas. Enquanto o
`STATUS_ZUNI.md` registra o que **está feito** e o que está **pendente**, o radar
registra o que **pode ser feito**.

**Regra de migração**: quando um item do radar entrar em execução, ele é movido para a
seção correspondente do `STATUS_ZUNI.md` e marcado como migrado no radar. Os dois
arquivos nunca devem divergir sobre o mesmo item.

---

## Prazos e frentes ativas — autorização por sessão / RAG (aberto em 14/09/2026)

Extraído do registro completo do dia (bloco "14/09/2026" em `STATUS_ZUNI_HISTORICO.md`
→ Decisões estratégicas) — só a parte que ainda está aberta.

### ⚠ Prazo ativo: 15/09/2026 às 18h00

`AUTH_CORTE_TS = 1789506000000`. Quando esse instante passar, **toda requisição sem
token de sessão passa a receber 401**. A variável está no Railway e pode ser
empurrada sem deploy se os contadores ainda estiverem crescendo:

```
railway variables --set AUTH_CORTE_TS=<novo epoch ms>
```

Os dois números que dizem se é seguro deixar fechar:

```sql
select evento, chave, ocorrencias, ultima_em
from public.contadores_operacionais order by evento, chave;
```

`auth_legado` parando de crescer = todo mundo já manda token. `auth_negado` em zero =
ninguém sendo barrado.

### Pendências da mesma frente

1. **FASE B** da autorização — download com token de escopo `dl`.
2. **FASE C** — corte definitivo, quando `auth_legado` parar de crescer por 48h.
3. **Log de citação** — `citacoes_rag` foi criada (migração `create_citacoes_rag`)
   mas ainda não é alimentada; falta o código. Vai testar a hipótese sobre o peso
   real da ancoragem por tema (ver achado do teste de ponta a ponta no histórico).
4. **Mapeamento de vocabulário** — 36 dos 43 temas do questionário não existem em
   `documentos.tema` (só 7 indexados). São 36 decisões editoriais via `grupos_tema`,
   não técnicas — fila ordenada por uso real:
   ```sql
   select tema, ocorrencias, ultima_em from public.temas_nao_resolvidos order by ocorrencias desc;
   ```
   **Verificar**: `ragIndexado: true` bloqueia a oferta dos outros 36 temas na UI ou
   é só informativo?
5. **Saneamento de chunk** — `depressao`, `namoro_conquista_romance`,
   `consequencias_causa_efeito` têm blocos de 14–16 mil caracteres, grandes demais.
6. Só depois dos itens acima, avaliar subir `total` de 5 para 8 em
   `buscar_documentos_ranqueado` (calibrado com 8, produção chama com 5).

### Bug separado a registrar

`sessions.created_at` está corrompido em alguns caminhos de escrita: 4 de 139 linhas
têm `created_at` posterior ao `updated_at` (uma delas +6h). O default `now()` do
banco grava UTC verdadeiro — o desvio vem de escrita explícita pela aplicação. Achar
os endpoints que gravam `created_at` explicitamente em vez de deixar o default. Afeta
qualquer lógica sobre idade de sessão.

**Armadilha conhecida**: o desvio de fuso observado em desenvolvimento **não é do
PostgREST** — é o `new Date()` do JS parseando `timestamp without time zone` como
hora local. Em `TZ=UTC` (Railway) o desvio é zero; em `TZ=America/Sao_Paulo` dá +3h.
Nunca calibre constante de tempo pela máquina local.

---

## Decisões estratégicas — registro completo

Todo o registro cumulativo de decisões estruturantes (um bloco datado por sessão,
mais recente no topo) está em `STATUS_ZUNI_HISTORICO.md`, seção "Decisões
estratégicas". Continua a mesma regra: sessões futuras adicionam blocos novos
datados no topo daquela seção — nunca criam seção nova. Se uma decisão de um bloco
antigo ainda estiver vigente ou tiver pendência aberta, ela também aparece aqui, no
STATUS_ZUNI.md, nas seções correspondentes (Pendências, Frentes ativas, Decisões
editoriais fixas).

---

## ZUNI Horizontes — obra "Tempo para Viver" (frente nova, aberta em 20/08/2026)

### Decisões fechadas
- Título: **Tempo para Viver** — subtítulo: *Guia de vida e bem-estar para uma
  maturidade em movimento*. Selo de coleção: ZUNI Horizontes. "Vida & Bem-Estar"
  permanece como categoria de catálogo, fora da capa.
- Extensão: Edição Completa, ~110.000 palavras (32 capítulos, 8 partes).
- Moldura: cosmologia iniciática **não** é framework primário nesta obra —
  restrita ao cap. 30. Voz "nós" mantida. Vale a separação em 6 níveis
  (evidência / institucional / campo / tradição / reflexão / proposta ZUNI).
- Sumário de 32 capítulos aprovado. Parte V renomeada para "O Mundo Que Convida"
  (o "ainda" carregava subtexto de condescendência).
- Protocolo de linguagem e acolhimento (item 2.1 do plano) é regra obrigatória
  de todos os capítulos e de todas as derivações.

### Em produção, funcionando
- Plano editorial completo (11 itens da entrega 1) — `zuni_horizontes_plano_editorial.md`
- Cap. 26 (Golpes, manipulação e desinformação) — capítulo-piloto, tom aprovado
- Cap. 24 (Autonomia digital: o celular como aliado)
- Cap. 14 (Solidão e presença)
- Cap. 06 (Continuar em movimento)
- Cada capítulo acompanha ficha de derivação editorial + ficha técnica ZHKE (YAML)
- Onda 1 do site coberta pelos 4 capítulos acima

### Regras permanentes criadas nesta frente
- Nenhum produto ZUNI — Companheiro incluído — pode ser posicionado como
  substituto de convívio humano. Toda peça aponta para contato real.
- Cap. 14 não se monetiza isoladamente (sem produto unitário sobre solidão).
- Comunidade ligada ao cap. 14 exige moderação humana treinada, com
  encaminhamento de sinais de sofrimento grave.
- Toda demonstração audiovisual de exercício exige profissional habilitado em
  cena e apoio visível. Sem séries, cargas ou repetições-alvo.
- Nenhuma estatística sem fonte e data verificadas na própria redação.
  Os 4 capítulos estão marcados `sem_estatisticas: true`, exceto a recomendação
  institucional da OMS 2020 no cap. 6, rotulada como tal.

### Pendências
1. Redigir os 28 capítulos restantes (onda 2: caps. 23, 11, 2, 10).
2. Criar tema RAG `zuni_horizontes` — exportar em Formato A para `indexarTema.js`.
3. Definir se o ZHKE consome as fichas técnicas YAML direto ou via conversão.
4. Verificações pendentes registradas nas fichas: nomenclatura do bloqueio de
   consignado no Meu INSS (cap. 26), prazos do MED (cap. 26), nomes de menus
   Android/iOS antes de gravar vídeos (cap. 24), vigência das diretrizes da OMS
   (cap. 6), programas municipais antes de citar nominalmente (caps. 6 e 14).
5. Decidir repositório: mesmo repo do ZUNI Suprema ou separado.
6. Site ZUNI Horizontes — base já constituída, integrar os 4 capítulos.

## 2. Em produção, funcionando

- **Funil de cupom** (Mentor→loja e loja→checkout), validado ponta a ponta.
- **Sessões Extras** (pacote de 3 sessões, R$74,90), com memória de jornada isolada da
  sessão avulsa. Pendente apenas: 1 teste de pagamento real de terceiro.
- **4 volumes de "Os Bastidores da Mente"** — indexados em RAG (252 chunks), à venda na
  loja, com chat/Mentor integrado. Leitura em voz alta gratuita (Web Speech API).
  - Vol. I "A Origem de Todo Bem e de Todo Mal" — 20 chunks (3.8%)
  - Vol. II "O Antídoto" — 80 chunks (15.1%)
  - Vol. III "A Bússola Humana" — 86 chunks (16.2%)
  - Vol. IV "A Travessia" — 66 chunks (12.5%)
- **Vertical Astrológica** (35 blocos RAG, fonte Max Heindel/domínio público) —
  indexada, testada, 100% operacional. Registro simbólico, sem astrologia médica.
- **Vertical Numerologia** (42 blocos RAG) — indexada, testada, 100% operacional.
- **Campos de apresentação por obra na loja** (resumo curto + "+ LEIA MAIS").
- **RLS habilitado** em todas as tabelas do Supabase (checklist permanente desde
  28/07/2026 — sempre verificar em tabela nova).
- **lib/astro.js** (integração AstroWay) — validado com dados reais, bug do
  Ascendente corrigido, chave configurada em produção (Railway). Revalidado em
  11/08/2026: chave ASTROWAY_API_KEY restaurada (876f), teste de geração de mapa
  natal completo executado e confirmado (10 planetas, 12 casas, 25 aspectos). Status:
  ✅ 100% operacional, 9975 créditos disponíveis.

- **Módulo "Experimente a ZUNI"** (numerologia, astrologia, chat demo) — funcionando
  após correção de RLS.
- **Varredura RAG completa (10/08/2026 20:44-20:45)** — Teste end-to-end em todos os 7
  temas com RAG indexado. Resultado: ✅ 100% operacional (7/7 temas responderam com
  conteúdo específico e > 250 caracteres). Logs [RAG_HIBRIDO] acionados corretamente,
  limite de busca híbrida: 3 chunks tema-específico + 2 chunks geral por consulta
  (contagem real de chunks retornados/utilizados por resposta não foi verificada nesta
  varredura). Total de 1.143 chunks em banco (613 temáticos + 530 genéricos/livros).

## 3. Pendências antigas, ainda em aberto

- **[04/09/2026] `chat.html` não retoma sessão — PRIORIDADE ALTA**: recarregar a
  página (F5, ou reabrir a aba com o mesmo `sessionId` na URL) zera o estado da UI
  (histórico de mensagens, contador de trocas, `productType`) mesmo com a sessão
  intacta no banco — por exemplo, na mensagem 8 de 15. Não existe nenhuma chamada
  de carregamento que restaure estado a partir do `sessionId`: levantamento
  completo de `fetch(`/`DOMContentLoaded`/`load` em `public/chat.html` (feito
  durante a sessão de rename do checkout do Mentor → ZUNI Direciona) confirmou que
  só o redirect de `testQuestionario` roda automaticamente; `contador` sempre
  inicializa em `0`. Numa sessão paga de até 15 trocas, com tráfego majoritariamente
  mobile, isso é perda visível da conversa por um F5 acidental. **Sintoma menor do
  mesmo problema**: o botão "Baixar relatório" do header nasce `disabled` (mudança
  de 04/09/2026, para não expor o nome errado da entrega — "Dossiê" vs "Síntese
  ZUNI Direciona" — antes da 1ª resposta) e só reabilita quando chega uma resposta
  nova de `/api/chat`; numa sessão retomada por reload, o botão fica desabilitado
  até o usuário mandar mensagem de novo, mesmo a sessão já estando avançada. Não
  implementado ainda — corrigir exige endpoint novo para restaurar
  histórico/contador/`productType` a partir do `sessionId` no carregamento da
  página. **Nota (07/09/2026)**: a compra real de ponta a ponta agendada para
  08/09 vai exercitar exatamente isso — o teste inclui recarregar a página no meio
  da conversa. Se a retomada continuar quebrada, priorizar a correção logo após.

- **[07/09/2026] O `?tema=` do checkout não chega ao produto — ALTA PRIORIDADE
  (antes de escalar tráfego pago)**: `?tema=` só troca manchete/abertura de
  `checkout.html` client-side (`aplicarTemaDaURL()`). Não vai para
  `POST /api/checkout/preference` nem para o redirect pós-pagamento — os 3 redirects
  vão para `/questionario-selecao.html?sessionId=<id>`, tela genérica com 8
  categorias e ~40 questionários. O comprador que clicou num anúncio de "estresse"
  não é levado ao questionário de estresse; escolhe do zero no ponto de maior
  atrito do funil. Corrigir: propagar o tema do checkout (via sessão ou querystring)
  até `questionario-selecao.html` / `/questionario/<tema>`, mapeando as 4 chaves do
  `TEMAS` do checkout para questionários reais do catálogo (`estresse` já existe;
  `clareza`, `adolescentes`, `relacionamentos` precisam de escolha de destino).

- **[11/09/2026] Valor da conversão do Pinterest com cupom — PENDÊNCIA (não
  urgente)**: o evento `pintrk('track', 'checkout')` reporta `value` fixo `29.90`.
  Com cupom aplicado, o valor real pago é menor e o retorno reportado ao Pinterest
  fica inflado. Trocar por `precoAtual` **não resolve**: a URL de retorno do MP
  (`src/server.js:2140-2141`) não carrega `?cupom=`, a página recarrega e
  `precoAtual` volta ao default `29.90` no momento do disparo. Correção real exige
  persistir o preço final (`unitPrice`, `src/server.js:2091-2099`) em `sessions`
  no momento da criação da preferência, e expor esse valor em
  `GET /api/checkout/session-status/:sessionId` (hoje devolve só `{ pago }`). Sem
  urgência — nenhuma campanha ativa usa cupom.

- **[07/09/2026] Webhook do MercadoPago não valida `x-signature` — PENDÊNCIA DE
  SEGURANÇA**: `app.post('/api/pagamento/webhook')` (`src/server.js:2168`) aceita
  qualquer POST — não lê nem verifica o header `x-signature`/`x-request-id` (esquema
  HMAC recomendado pelo MP), não há segredo em URL/body, middleware global é só
  `cors()` + `express.json()`. **A assinatura secreta já foi gerada no painel do MP
  hoje** (ao cadastrar o webhook em produção), mas ainda não é usada pelo código.
  Risco limitado — o status de pagamento vem de uma consulta server-to-server à API
  do MP (`marcarPagoSeAprovado`), não do corpo forjado, e é idempotente; o pior caso
  é enumeração de IDs / replay de um pagamento genuinamente aprovado cujo
  `external_reference` bata com uma sessão pendente. Ainda assim é lacuna frente à
  prática recomendada. Corrigir exige nova env (o secret do painel) + validação
  HMAC do `x-signature` no início do handler.

- **[07/09/2026] `notification_url` não é enviado na criação da preferência —
  PENDÊNCIA**: nenhuma das 5 chamadas `preference.create` do `src/server.js` passa
  `notification_url`. Hoje (08/09 em diante) a entrega do webhook depende só da
  config do painel do MP — que foi cadastrada em 07/09. Adicionar
  `notification_url: 'https://www.zunisuprema.com.br/api/pagamento/webhook'` ao
  `body` da preferência em `POST /api/checkout/preference` dá redundância (notifica
  por preferência além da config global) e garante o destino certo mesmo se a config
  do painel for alterada/perdida. Não conflita com nada. `back_urls` já existe nessa
  preferência, montado a partir de `process.env.FRONTEND_URL`.

- **[08/09/2026] Compra real de ponta a ponta por terceiro — BLOQUEADOR**: agendada
  para 08/09. Outra pessoa faz uma compra real pelo celular, em produção, do
  checkout até receber a Síntese. Inclui **recarregar a página no meio da conversa**
  (teste da retomada de sessão em `chat.html` — ver primeiro item desta seção).
  Antes: confirmar no painel do MP que o webhook está ativo em produção. Durante:
  acompanhar `railway logs --http` (o app é quase mudo no caminho feliz — só
  `[WEBHOOK] Pagamento confirmado`, `[QUESTIONÁRIO] …`, `[RAG_*] …`, `Email enviado
  para …` aparecem no log de aplicação) e a linha da sessão em `sessions`
  (`paid` false→true no webhook; `trocas` +2 por troca; `relatorio_gerado` true no
  fim). Até isso passar, o funil ZUNI Direciona não está validado ponta a ponta.

- **[07/09/2026] Capa da Síntese em imagem — arte a regenerar antes de ligar a
  flag**: `CAPA_SINTESE_EM_IMAGEM` está em `false`; a canalização
  (`generatePdf` → `doc.image(capa-sintese-zuni-direciona.jpg, full-bleed A4)`) está
  pronta e testada. A arte atual (`public/capa-sintese-zuni-direciona.jpg`) será
  **regenerada** antes de ligar: grafia "ZUNI" em versal, incluir a linha "A Ciência
  da Excelência Humana", mockup 3D em vez de capa chapada, 127 DPI. Quando a nova
  arte entrar, trocar o JPG e a flag para `true` num commit só.

- Teste de responsividade mobile (checkout → chat → relatório → WhatsApp) no
  celular real.
- Domínio raiz `zunisuprema.com.br` (sem www) ainda não resolve — solução definitiva
  é migrar nameservers para Cloudflare (não urgente).
- `www.zunisuprema.com.br` abrindo `checkout.html` na raiz em vez da landing page —
  investigar rota/index no `server.js`.
- Banner discreto na 8ª troca da sessão avulsa (oferecendo Sessões Extras, Mapa
  Integrado, obras) — planejado, não implementado.
- **Audiobook pago (Google Cloud WaveNet)**: estrutura de leitura por voz generalizada pronta. Aguarda: (1) credencial de serviço do Google Cloud, (2) aprovação de orçamento para custos de síntese premium.

- Decisão de produto pendente: se a degustação deve ter presença própria na loja além
  da faixa `.faixa-mentor`.
- Script de extração (`extrair-texto-docx.js`) não reconhece um quarto formato de
  capítulo (número solto em linha, sem heading nativo nem "CAPÍTULO N —" em negrito) —
  tratado manualmente no Guia Integral de Saúde e Beleza Masculina. Generalizar.

- Base RAG `vida_madura_bem_estar.txt` pronta (120 blocos, obra "Tempo para Viver"
  Versão 1), aguardando Etapa 4 e indexação.

- **Validação real de pagamento das obras avulsas da loja com cartão/Pix de
  terceiro** — ainda não feita (motivo: MercadoPago não aceita o mesmo titular como
  comprador e vendedor). Não é bloqueador técnico — toda a integração, catálogo,
  preços e checkout até a etapa de pagamento já foram validados. Falta: pagamento
  processado com valor > R$0, webhook de confirmação, acesso ao flipbook liberado,
  e-mail de entrega. Distinta da "compra real de ponta a ponta" do Mentor (item
  acima) — é o mesmo tipo de teste, produto diferente. Detalhe do teste parcial
  (15/08/2026) em `STATUS_ZUNI_HISTORICO.md`.

## 4. Frente ativa — Questionários pós-checkout + bases RAG por tema

**Conceito**: formulário curto opcional entre checkout e chat, por tema. Gera duas
saídas: (A) mensagem de abertura do Mentor para o cliente, (B) resumo técnico interno
para a equipe (8 profissionais), sem linguagem de diagnóstico, só acessado se o
cliente pedir encaminhamento humano.

**Infraestrutura de indexação por tema** (`indexarTema.js`, adaptado de
`indexarLivro.js`): grava a coluna `tema` no INSERT (não via UPDATE posterior). Testado
e validado contra o parser real. Sub-chunking automático para blocos que excedem o
limite de tokens do embedding (`text-embedding-3-small`, 8.191 tokens) — ver skill
`zuni-rag-tema` para o pipeline completo de curadoria.

**7 temas em produção com RAG híbrido, validados via varredura completa** (10/08/2026 20:44-20:45):

| Tema (slug) | Chunks | Questionário | Validação (10/08/2026) | Resposta (chars) |
|---|---|---|---|---|
| `timidez_comunicacao` | 2 | ✅ 5 perguntas | ✅ Teste real OK | 268 |
| `namoro_conquista_romance` | 52 | ✅ 5 perguntas | ✅ Teste real OK | 1526 |
| `administracao_empresarial_inteligente` | 40 | ✅ 5 perguntas | ✅ Teste real OK | 431 |
| `obesidade` | 410 | ✅ 5 perguntas | ✅ Teste real OK | 1513 |
| `depressao` | 79 | ✅ 5 perguntas | ✅ Teste real OK | 1251 |
| `sentimentos_adolescencia` | 16 | ✅ 5 perguntas | ✅ Teste real OK | 399 |
| `educar_filhos` | 14 | ✅ 5 perguntas | ✅ Teste real OK | 425 |

**2 novos temas em produção — indexados em 14/08/2026** (ambos com RAG, sem questionário associado por enquanto):

| Tema (slug) | Chunks | Indexação | Validação (14/08/2026) | Status |
|---|---|---|---|---|
| `elegancia_charme_feminino` | 174 | ✅ Embeddings + Supabase | ✅ SELECT confirmado | 🟢 Ativo |
| `elegancia_presenca_masculina` | 58 | ✅ Embeddings + Supabase | ✅ SELECT confirmado | 🟢 Ativo |

**1 novo tema em produção — indexado em 17/08/2026** (com RAG, sem questionário associado por enquanto):

| Tema (slug) | Chunks | Indexação | Validação (17/08/2026) | Status |
|---|---|---|---|---|
| `compreensao_da_vida_base_mentor` | 60 | ✅ Embeddings + Supabase | ✅ SELECT confirmado + 60 chunks inseridos | 🟢 Ativo |

- **Detalhes da indexação de `compreensao_da_vida_base_mentor`** (17/08/2026):
  - Fonte: arquivo "compreensao_da_vida_base_mentor.txt" validado (1351 linhas, 60 blocos temáticos)
  - Validação pré-indexação: ✅ Formato correto, chunks <= 2500 palavras, sem artefatos de conversa com IA
  - Tipo: Tema NOVO (não existia anteriormente no Supabase)
  - Embeddings: ✅ 60 chunks processados via OpenAI `text-embedding-3-small`
  - Ingestão: ✅ Todos os 60 chunks inseridos em `public.documentos` com coluna `tema` preenchida
  - Verificação: ✅ SELECT confirmou 60 registros em produção (17/08/2026 14:15)
  - Status: 🟢 100% Operacional

**Evidência de logs RAG capturada**: Todos os 7 temas confirmados com log [RAG_HIBRIDO] do servidor (linha 785 de server.js), incluindo tema identificado e limites de busca. Logs brutos revisados em sessão 10/08/2026 20:44-20:45.

**Nota sobre `timidez_comunicacao`**: Apenas 2 chunks reais indexados no banco (confirmado em 04-05/08 e revalidado em 10/08). A discrepância com os 827 chunks originalmente documentados permanece sem explicação. Base funcional mas minimal — reindexação recomendada se expandir cobertura do tema.

**Próximos passos (se necessário):**
1. Monitorar uso em produção: quais temas os clientes escolhem, taxa de abandono.
2. A/B testing: avaliar se os 5 novos temas mantêm engajamento equivalente aos 2 pilotos.
3. Decidir se os outros 35 temas recebem questionário próprio ou ficam como conhecimento geral.

## 5. Backlog priorizado (aguardando a frente ativa fechar)

Em ordem aproximada de intenção manifestada, sem data definida:
1. Mapa Integrado (astrologia+numerologia) — checkout próprio, exclusivo da loja,
   nunca dentro do chat do Mentor.
2. Dossiê Integrativo / família de mapas derivados (Relacionamentos via sinastria,
   Empresarial, Ciclos de Vida, Pais e Filhos).
3. Portal Editorial (artigos SEO, 2-3/semana via Railway Cron, aprovação humana
   obrigatória nas primeiras fases).
4. Gatilho de reajuste de preço quando o volume de consultas/mês atingir ~150.

## 6. Decisões editoriais fixas (nunca revisitar sem motivo forte)

- Fórmulas fitoterápicas/ortomoleculares/homeopáticas: podem aparecer em **obras**
  (sem quantidade/posologia), nunca em respostas de **API** (Mentor, Dossiê, relatórios).
- Astrologia: registro simbólico apenas — sem astrologia médica (associação
  planeta-órgão-doença).
- Mentor: evitar terminologia técnica/fisiológica (cortisol, sistema límbico etc.)
  mesmo quando precisa — preferir explicações diretas e cotidianas, frases curtas.
- Serviços de astrologia/numerologia/Tarot: exclusivos da loja com checkout próprio,
  nunca funcionalidade dentro do chat do Mentor.

---

## Como manter este arquivo atualizado

Ver skill `zuni-continuidade` para o processo de leitura/atualização no início e fim
de cada sessão de trabalho. Este arquivo (`STATUS_ZUNI.md`) é o único lido por
padrão — mantenha-o só com estado atual. Quando um item aqui for resolvido/encerrado,
mova o texto para `STATUS_ZUNI_HISTORICO.md` (seção "Decisões estratégicas", bloco
datado no topo) em vez de apagá-lo.

