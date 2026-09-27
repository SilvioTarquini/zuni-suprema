# STATUS ZUNI SUPREMA

**Última atualização**: 27/09/2026 (frente Resend aberta — migração de e-mail).

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

## Frente ativa — Migração MercadoPago → Stripe (aberta em 24/09/2026)

Migração completa do MercadoPago para o Stripe, produto por produto — sem período de
paralelismo entre os dois no mesmo produto. Decisão de arquitetura: Stripe Checkout
embedded (`ui_mode: embedded_page`), pagamento avulso (`mode: payment`, sem
assinatura/recorrência), cartão + Pix quando disponível (Pix é por convite — conta
precisa de 60+ dias processando, confirmado pelo suporte Stripe em 24/09/2026, ainda
não habilitado). Planejamento feito com `stripe_implementation_planner` (plugin
oficial `stripe@claude-plugins-official`, MCP `https://mcp.stripe.com`, conta
`acct_1UJJvjJjHOfmKpTy` / "Área restrita de Zuni Suprema").

### Fase 1 — Sessão ZUNI (ZUNI Direciona): concluída localmente, **NÃO deployada**

Commit `a35bfc3` (branch `main`, local — **1 commit à frente de `origin/main`, sem
push**). Testado de ponta a ponta em modo de teste via Stripe CLI (`stripe listen`),
cartão `4242 4242 4242 4242`, com e sem cupom (30%: R$27,90→R$19,53, conferido também
no `amount_total` da Checkout Session pela API do Stripe).

- `POST /api/checkout/stripe-session` (novo) substitui `POST /api/checkout/preference`
  **só** para este produto — a rota antiga MercadoPago continua no código, intocada,
  para os outros 4 produtos.
- `POST /api/webhooks/stripe` (novo), assinatura verificada, idempotente por
  `stripe_session_id`, ramificado por `metadata.fulfillment_type` (só `'chat-mentor'`
  tratado nesta fase).
- `sessions` ganhou `stripe_session_id` e `valor_pago` (migração
  `005_sessions_stripe_fields.sql`, já aplicada no Supabase — RLS conferido, sem
  mudança de política).
- `checkout.html`: Stripe Checkout embedded montado dentro do card (sem redirect),
  paleta/copy/cupom/WhatsApp/tema preservados.
- `scripts/testar-checkout-stripe.js` (Playwright, versionado) — reaproveitável na
  Fase 2 (loja) como regressão.

**Push e deploy retidos deliberadamente — MOTIVO**: `public/checkout.html` já chama
`/api/checkout/stripe-session` em vez do fluxo MercadoPago. Se esse código subir para
produção antes de o Railway ter `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` e
`STRIPE_WEBHOOK_SECRET` **de produção**, o checkout do site quebra por completo — nem
o caminho antigo do MercadoPago responde mais, porque o front deixou de chamá-lo.

**Ordem obrigatória até produção** (nenhum passo pode ser pulado ou invertido —
válida também para Livros/Fase 2 abaixo, que depende das mesmas 3 variáveis;
conferido em produção no Railway em 27/09/2026: as três estão **ausentes** hoje,
`MERCADOPAGO_TOKEN` de produção presente e live):
1. Ativar a conta de produção da Stripe (verificação de dados e conta bancária) —
   gera as chaves `sk_live_`/`pk_live_`.
2. Cadastrar o webhook de produção no painel da Stripe apontando para
   `https://www.zunisuprema.com.br/api/webhooks/stripe` — gera um `whsec_` próprio,
   diferente do usado no teste local.
3. Criar as três variáveis (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET`) no Railway com os valores de produção.
4. Só então push e deploy.
5. Compra real do próprio usuário — nos dois produtos (Sessão ZUNI e um Livro),
   com estorno pelo painel da Stripe.

**Aviso (27/09/2026)**: os 5 commits desta frente (Fase 1 + Fase 2/Livros) estão
todos no mesmo `main`, sem fronteira de deploy entre eles — um push hoje sobe os
dois de uma vez. Sem as 3 variáveis acima em produção, `stripeClient` fica `null`
e **o checkout do ZUNI Direciona fica 100% fora do ar** (o `checkout.html` só
chama a rota Stripe, sem fallback MercadoPago/Pix — nenhum cliente consegue
comprar, de nenhuma forma). Livros é mais tolerante: o botão Cartão falha (500
"Stripe não configurado"), mas o **Pix continua funcionando** via MercadoPago
(rota intocada). Sessões Extras, Mapa Astral e Mapa Integrado não são afetados
(fora desta frente).

**MercadoPago não deve ser removido ainda**: as chaves do MercadoPago permanecem no
Railway e no `.env`, e a conta do MercadoPago não deve ser fechada, até que (a) a
conta Stripe de produção esteja ativa, (b) a Fase 2 (loja) esteja no ar, e (c) uma
venda real tenha passado pelo Stripe. Hoje o MercadoPago ainda é o único meio de
receber pagamento em produção — nenhum outro produto pode ficar sem meio de
pagamento funcionando.

### Fase 2 (aberta em 27/09/2026) — escopo restrito a Livros

**Mudança de escopo**: Mapa Astral e Mapa Integrado saem desta frente. Ficam de fora
até o novo serviço Astro-Num (RAG exclusivo de astrologia/numerologia, ainda em
curadoria) estar pronto — vão ganhar checkout próprio nessa ocasião, substituindo o
atual por completo (não é migração de gateway isolada). **Não mexer no código desses
dois produtos até lá** — checkout MercadoPago atual continua como está, sem link
público.

**Fase 2 restrita a Livros (decisão de 27/09/2026)**: Sessões Extras sai da fila —
**produto descontinuado**, não só adiado. Motivo: nenhuma página em `public/`
aciona `POST /api/checkout/sessoes-extras/preference` hoje — o "onde vender" nunca
foi resolvido (banner da 8ª troca planejado, nunca implementado), então não havia
de fato produto ativo para migrar. Código (`src/lib/pedidosSessoesExtras.js`,
`src/lib/creditosSessao.js`, rotas `/api/checkout/sessoes-extras/*` e
`/api/sessoes-extras/*`, tabelas `pedidos_sessoes_extras_pendentes` e
`creditos_sessao`, e-mail `enviarEmailConfirmacaoSessoesExtras`) **não foi apagado**
— fica no repo sem uso, para o caso de o produto ser retomado no futuro com um
canal de venda definido. Verificação de textos voltados ao cliente (27/09/2026):
nada em `public/` oferece o produto ativamente — só a página de confirmação
(`sessoes-extras-confirmacao.html`) e o e-mail de confirmação existem, ambos
órfãos (sem link de entrada); `SYSTEM_PROMPT` do ZUNI Direciona e `public/chat.js`
não mencionam o produto.

Arquitetura genérica desta fase (para produto novo ser só uma entrada em tabela de
preços + um `case` no webhook): tabela de preços/config no servidor (preço nunca
aceito do front), rota de criação de Checkout Session parametrizada por
`fulfillment_type`, tabela genérica de pedido pendente (substitui as tabelas
ad-hoc por produto), webhook único `/api/webhooks/stripe` com um `case` novo por
produto.

**Pix nos Livros — exceção temporária documentada**: Pix no Stripe Brasil é só por
convite (mínimo 60 dias processando pagamentos na conta — ver acima). Migração dos
Livros: cartão vai para Stripe, **Pix continua via MercadoPago em paralelo** (rota
`POST /api/checkout/livro` intocada) até o Stripe habilitar Pix nesta conta. Única
exceção deliberada à regra de "sem paralelismo por produto" desta frente.

### Livros (cartão via Stripe) — concluído localmente, testado, **NÃO deployado** (27/09/2026)

Commits `ff51be2`, `0d7f698`, `251d2dd` (branch `main`, local — sem push, mesmo
motivo do checklist acima). Testado em modo de teste (Stripe CLI `stripe listen` +
Playwright, cartão `4242 4242 4242 4242`), evidência conferida direto no banco:

- Compra simples (sem cupom, sem audiolivro): `checkout_pedidos_pendentes`
  processado, `acessos_livros` com 1 linha, e-mail disparado (ver pendência
  SendGrid abaixo).
- Compra com audiolivro incluído: `resultado.tokenAudiolivro` preenchido, 2 linhas
  em `acessos_livros` (`tipo_produto` `livro` e `audiolivro`).
- Reenvio do mesmo evento do webhook (livro simples e com audiolivro): idempotente
  — log `já processado — ignorando reentrega`, nenhuma linha duplicada.
- Cupom `TEST100`: acesso liberado direto (mesma função de fulfillment do
  webhook), sem passar pelo Stripe (`stripe_session_id: null`).
- Regressão do chat-mentor (Fase 1): fluxo completo continua idêntico após a
  refatoração do webhook (extração da lógica de fulfillment por
  `fulfillment_type` antes de tocar em `sessions`).
- Botão Pix de `checkout-livro.html`: código confirmado intocado por `git diff`
  (a chamada funcional ao MercadoPago não foi testada — bloqueio 403
  `PolicyAgent` do sandbox MP, não relacionado ao código; decisão do usuário foi
  não investigar).

**Achado de produção durante os testes — SendGrid com créditos esgotados**: erro
`Maximum credits exceeded` reproduzido em 27/09/2026 ao testar o envio do e-mail
de acesso. A `SENDGRID_API_KEY` local é **a mesma** usada em produção no Railway
(hash conferido). **Afeta todos os e-mails transacionais do projeto, não só
Livros** — a chave só tem permissão de envio (não dá para checar a cota via API,
`/v3/user/credits` devolve 403). Ação do usuário: verificar o painel do SendGrid.
Corrigido no código (commit `251d2dd`): `enviarEmailAcessoLivro` trata o próprio
erro do SendGrid e devolvia `false` sem log próprio — tanto o fulfillment Stripe
quanto o Pix/MercadoPago agora logam `[LIVRO_EMAIL_FALHOU]` quando isso acontece
(o acesso já é concedido antes do e-mail, então a falha de e-mail nunca bloqueia
o acesso — só fica sem alerta antes desse fix).

**As 3 pendências de decisão foram resolvidas em 27/09/2026:**

1. **Cupom + audiolivro — RESOLVIDO**: desconto incide sobre o TOTAL (livro +
   audiolivro), respeitando `teto_reais` quando existir. Unificado numa única
   função (`calcularPrecoFinalLivro`, `src/server.js`), usada pelas 3 rotas
   (Stripe e as duas MercadoPago) — nunca mais podem divergir entre si. Testado
   com evidência: cupom parcial `ZUNI30` (30%, teto R$15) + audiolivro
   (57,90+34,90=92,80) → `precoFinal=77,80` idêntico nas rotas Stripe
   (`valor_pago` no Supabase) e MercadoPago (log da rota, já que a chamada real à
   API do MP segue bloqueada pelo mesmo 403 `PolicyAgent` do sandbox, não
   investigado por decisão do usuário); cupom 100% + audiolivro → total zero,
   atalho sem Stripe, 2 linhas em `acessos_livros` (`livro` + `audiolivro`).
2. **Destino do `TEST100` — RESOLVIDO**: substituído por um novo cupom de teste
   (código aleatório de 16 caracteres, `percentual: 100`, `teto_reais: null`,
   `expira_em: 2026-12-31`), testado e funcionando no fluxo de livro antes da
   troca. `TEST100` foi encerrado (`expira_em` setado para o momento da troca,
   27/09/2026 — confirmado que deixou de ser aceito). O código do novo cupom **não
   está neste arquivo nem em nenhum commit** — foi informado só na conversa,
   conforme pedido. `test-cupom.js`/`test-cupom2.js` (scripts pré-existentes, não
   desta frente) atualizados para aceitar o código por argumento em vez de
   `TEST100` fixo. Nota: `public/checkout-mapa-integrado.html` ainda tem
   `placeholder="Ex: TEST100"` no campo de cupom — cosmético, página fora de
   escopo (Mapa Astral/Mapa Integrado), não alterado.
3. **Sessões Extras — RESOLVIDO**: descontinuado, ver acima.

**Limpeza pendente**: dados de teste (e-mails `@example.com`) ficaram em
`acessos_livros` e `checkout_pedidos_pendentes` — limpeza combinada para depois,
não feita ainda.

- Ver em "Pendências antigas, ainda em aberto": `GET /api/checkout/session-status`
  mascarando erro 500 como "não pago" — achado durante o teste da Fase 1.
- **Solicitar acesso ao Pix no suporte do Stripe** — pendência aberta em 27/09/2026,
  pré-requisito para fechar a exceção acima e para o Pix de Livros/futuro Astro-Num.
- Decomissionar o MercadoPago por completo (`mpClient`, `Preference`, rotas e webhook
  antigos) só depois que todos os produtos estiverem migrados **e** o Stripe tiver
  Pix habilitado (senão perde-se o meio de pagamento Pix por completo).

### Pendências do futuro serviço Astro-Num (Mapa Astral / Mapa Integrado — fora da Fase 2)

Achados durante o levantamento de 27/09/2026, a resolver quando esse serviço for
reconstruído com checkout próprio — não corrigir no código atual do MercadoPago:

- **Bug de preço no Mapa Astral**: `POST /api/checkout/mapa-astral` e
  `POST /api/checkout/mapa-astral/preference` (`src/server.js`) sempre cobram
  R$29,90, mesmo quando o front (`checkout-mapa-astral.html?type=numerologia-astral`)
  exibe R$49,90 para a variante "Mapa Astral + Numerologia". Correção prevista:
  preço resolvido no servidor por variante/`productType`, nunca fixo.
- **Mapa Integrado consome créditos AstroWay antes da confirmação de pagamento**:
  `calcularMapaNatal(...)` roda de forma síncrona dentro de
  `POST /api/checkout/mapa-integrado` e `.../preference`, antes de qualquer
  cobrança — se o cliente desistir, o crédito pago já foi gasto. Correção prevista:
  gravar os dados de nascimento num pedido pendente antes do pagamento e só rodar
  o cálculo depois da confirmação via webhook, com falha pós-pagamento visível em
  log (caso raro de o cálculo falhar depois que o cliente já pagou).
- **Pix**: Mapa Astral usa Pix direto via MercadoPago hoje (`POST /api/checkout/mapa-astral`),
  mesma exceção temporária que os Livros vão ter — resolve junto quando o Stripe
  habilitar Pix.
- **Webhook do Mapa Integrado provavelmente morto**: `gerarRelatorioMapaIntegradoSeAplicavel`
  (`src/server.js`) só age se `referencia.startsWith('mi')`, mas o `sessionId` do
  Mapa Integrado é gerado com `uuidv4()` puro, sem prefixo `mi` — a condição
  provavelmente nunca é verdadeira em produção. Investigar se a geração do
  relatório já acontece por outro caminho (sob demanda, igual ao Mapa Astral) antes
  de assumir que esse webhook é a via real de entrega.

**Frente Stripe — sem mudança nesta sessão**: os 7 commits locais (Fase 1 + Fase 2)
seguem aguardando a ativação da conta Stripe em produção (ver checklist acima).

---

## Frente ativa — Migração SendGrid → Resend (aberta em 27/09/2026)

**Urgente e independente do Stripe**: o trial do SendGrid expirou em 13/08/2026 —
desde então **nenhum e-mail do site é enviado** (acesso a livros, síntese/dossiê do
ZUNI Direciona, brinde astro+numerologia, resultado da degustação "Experimente
ZUNI", confirmação de Sessões Extras). Decisão: substituir por Resend (SDK oficial,
plano gratuito), não SMTP — devolve `id` do envio estruturado e erro explícito, o
que SMTP não daria de forma limpa.

**Implementado e commitado, branch `fix/email-resend`** (1 commit, `e04a128`, a
partir de `origin/main` — **sem push**): módulo único `src/lib/email.js`
(`enviarEmail({to, subject, html, attachments, tipo})`, nunca lança, sempre devolve
`{ sucesso, id, erro }`, falha loga `[EMAIL_FALHOU] tipo=<slug> destinatario=<email>
erro=<mensagem>`, nunca token). As 5 funções de e-mail do domínio (`sendEmail`,
`enviarEmailAcessoLivro`, `enviarEmailConfirmacaoSessoesExtras` em `src/server.js`;
`enviarResultadoNumerologia` em `src/lib/capturasExperimente.js`;
`enviarBrindeEmail` em `src/lib/brinde.js`) foram refatoradas para usar esse módulo
— mesmo nome/assinatura, sem quebrar quem já as chama. Remetente unificado em
`RESEND_FROM_EMAIL` (removidos os dois fallbacks hardcoded divergentes que
existiam). `@sendgrid/mail` e `nodemailer` (nunca usado em nenhum lugar do código)
removidos do `package.json`.

**DNS já publicado**: domínio `zunisuprema.com.br` cadastrado no Resend, registros
DKIM (2 CNAME) e DMARC adicionados no Registro.br em 27/09/2026 — **aguardando
verificação**.

**Próximos passos, nesta ordem exata**:
1. Confirmar domínio verificado no painel do Resend.
2. Usuário cria a API Key no Resend e coloca `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
   e `RESEND_REPLY_TO` no `.env` local (reply-to definido: `zunisuprema@gmail.com`,
   a caixa que já recebia respostas antes, via o remetente antigo do SendGrid).
3. Teste real: envio de sucesso com `id` retornado pela API do Resend + teste de
   falha com o log `[EMAIL_FALHOU]` — evidência literal dos dois.
4. Usuário cria as mesmas 3 variáveis no Railway (produção).
5. Push de `fix/email-resend` para `main` (`git push origin fix/email-resend:main`)
   — só a mudança de e-mail vai para produção, isolada do Stripe.
6. Rebase do `main` local (7 commits do Stripe) sobre a nova produção
   (`git rebase origin/main`) — **conflito esperado em `src/server.js`**, porque os
   commits do Stripe também tocaram `sendEmail`/`enviarEmailAcessoLivro` (logs
   `[LIVRO_EMAIL_FALHOU]`); resolver manualmente, linha a linha, antes de seguir.

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
- ~~Sessões Extras~~ — **descontinuado em 27/09/2026**, ver "Frente ativa — Migração
  MercadoPago → Stripe" abaixo. Não estava de fato em produção: nenhuma página em
  `public/` aciona o checkout, código permanece no repo sem uso.
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
  **Atualização (24/09/2026)**: no fluxo novo Stripe da Sessão ZUNI (ver migração
  MercadoPago→Stripe abaixo), o transporte do `?tema=` já está corrigido — vai até
  `POST /api/checkout/stripe-session`, sobrevive ao `return_url` do Stripe e chega
  em `/questionario-selecao.html?sessionId=<id>&tema=<tema>`, testado de ponta a
  ponta. **A parte que falta é só o mapeamento** tema→questionário em si (decisão de
  produto, deliberadamente não tomada nesta fase). O fluxo MercadoPago (ainda ativo
  nos outros 4 produtos) continua com o bug original, sem transporte de tema.

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
  **Atualização (24/09/2026)**: resolvido para o fluxo novo Stripe da Sessão ZUNI —
  `valor_pago` é persistido em `sessions` na criação da Checkout Session e devolvido
  por `GET /api/checkout/session-status/:sessionId` (`{ pago, token, valor }`); o
  pixel agora dispara com o valor real, testado com cupom de 30% (27,90→19,53,
  conferido também no `amount_total` da Checkout Session no Stripe). O fluxo
  MercadoPago (outros 4 produtos, intocado nesta fase) continua com o valor fixo.

- **[24/09/2026] `GET /api/checkout/session-status/:sessionId` mascara erro de
  servidor como "não pago" — PENDÊNCIA**: o handler devolve `{ pago: false }` tanto
  quando a sessão genuinamente não está paga quanto quando qualquer coisa lança
  dentro do `try` (ex.: `gerarTokenSessao` falhando por `SESSION_TOKEN_SECRET`
  ausente — foi exatamente assim que esse bug apareceu, durante o teste da Fase 1
  do Stripe: a sessão já estava `paid: true` no Supabase, mas o endpoint respondia
  500 com corpo `{"pago":false}`, indistinguível de "cliente ainda não pagou" pro
  front, que ficava preso no polling até estourar os 3 minutos). Não corrigido
  ainda — decisão explícita de registrar e seguir. Corrigir exige diferenciar
  erro real (5xx com corpo próprio) de "ainda não pago" (200 com `pago:false`) no
  `catch` de `src/server.js` (rota introduzida em `/api/checkout/preference`,
  compartilhada pelo fluxo Stripe novo).

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

