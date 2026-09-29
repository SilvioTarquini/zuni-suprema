# STATUS ZUNI SUPREMA

**Última atualização**: 29/09/2026 (frente Resend concluída e em produção; Pix removido da tela dos livros).

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
OpenAI (`text-embedding-3-small`) · MercadoPago · Resend (e-mail) · webhooks Make/WhatsApp.
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

**Pix nos Livros — ATUALIZADO em 29/09/2026 (decisão do usuário)**: os livros
lançam **só com cartão pelo Stripe**. O botão Pix foi removido de
`public/checkout-livro.html` (commit `0632897`; rodapé agora diz só "Cartão via
Stripe"). As rotas Pix/MercadoPago do backend (`POST /api/checkout/livro`, status,
webhook do MercadoPago) **seguem no código, intocadas** — só saíram da tela. O Pix
volta quando o Stripe liberar Pix na conta (mínimo 60 dias processando pagamentos,
ver acima): recolocar o botão e o seletor `selecionarMetodo` no HTML (comentário
deixado no lugar). Isso substitui a antiga "exceção temporária" de Pix em paralelo.

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

**Testes pós-rebase pendentes (29/09/2026)**: depois do rebase sobre o Resend o
`server.js` mesclou sem conflito, mas o fluxo de Livros/Stripe **não foi retestado**
(só `node --check`). Por decisão do usuário, os testes (compra simples, com
audiolivro, reenvio do webhook, cupom 100%, regressão do ZUNI Direciona, com
comprador `zunisuprema@gmail.com` e id de envio do Resend conferido no log) ficam
para **depois da remoção do serviço astro-numerológico**, para testar os e-mails já
sem o brinde.

**Achado de produção durante os testes — SendGrid com créditos esgotados (RESOLVIDO
em 29/09/2026 pela migração para Resend, ver frente abaixo)**: erro
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

## Frente concluída — Migração SendGrid → Resend (27–29/09/2026, EM PRODUÇÃO)

**Status: concluída e em produção.** O trial do SendGrid expirou em 13/08/2026 e
nenhum e-mail saía desde então. Substituído por Resend (SDK oficial).

- **Push do commit `e04a128` em 29/09/2026** (`git push origin fix/email-resend:main`,
  só a mudança de e-mail, isolada do Stripe). Deploy no Railway subiu às 19:05 UTC,
  log de inicialização sem erros.
- Módulo único `src/lib/email.js` (`enviarEmail({to, subject, html, attachments,
  tipo})`, nunca lança, devolve `{ sucesso, id, erro }`; falha loga `[EMAIL_FALHOU]
  tipo=<slug> destinatario=<email> erro=<mensagem>`, nunca token). As 5 funções de
  e-mail do domínio usam esse módulo. Remetente único em `RESEND_FROM_EMAIL`.
  `@sendgrid/mail` e `nodemailer` removidos do `package.json`.
- Domínio `zunisuprema.com.br` verificado no Resend (DKIM + DMARC no Registro.br).
  Variáveis `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO` (reply-to
  `zunisuprema@gmail.com`) no `.env` local e no Railway.
- Evidência: envio real local (acesso a livro e `sendEmail` com PDF) com ids
  retornados e confirmados na caixa do Gmail; falha forçada gerou `[EMAIL_FALHOU]`
  (422 `validation_error`); envio de produção via `railway run` com as variáveis do
  Railway, id `01a0ee91-be16-77a2-95b8-ea9456fe30fc`, retornou sucesso.
- Rebase dos 8 commits do Stripe sobre o novo `origin/main` feito em 29/09/2026:
  conflitos só em `.env.example`, `package.json` e `package-lock.json` (resolvidos
  mantendo Resend + Stripe); `server.js` mesclou sem conflito. **`main` local
  continua sem push** (Stripe aguarda o checklist de produção acima).
- Comentários "(SendGrid)" em `server.js` corrigidos (commit `ccb27ae`).

**Checklist do Stripe mantido** (ativar conta de produção, webhook de produção, 3
variáveis `STRIPE_*` no Railway, teste real com estorno — ver frente MercadoPago →
Stripe acima): nada dele foi feito nesta sessão, o `main` local segue sem push.
