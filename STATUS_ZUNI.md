# STATUS ZUNI SUPREMA

**Última atualização**: 05/10/2026 — checkpoint comercial (validação ponta a ponta de livros, Universo Feminino, Experimente v1, refund/revogação; ver bloco "Checkpoint comercial 05/10/2026" abaixo). Seções seguintes datadas de 30/09/2026, fim do dia (Stripe em produção e validado com compra real; Leva 1 do chat no ar; leitor de livros adaptado ao celular — 32 livros; estorno e disputa revogam o acesso, com 5 eventos no webhook; Leva 2 do ZUNI Direciona pendente).

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

## Checkpoint comercial 05/10/2026 — Livros / Universo Feminino / Experimente (EM PRODUÇÃO)

> Bloco canônico da frente comercial iniciada após 30/09. Não registra dados pessoais, tokens,
> UUIDs, payment IDs nem segredos. Estado do código em `origin/main` = `0b81bd9`.

**PRIORIDADE ATUAL DA ZUNI: gerar a primeira venda externa e receita com os ativos já prontos.**
Novo trabalho técnico deve, de preferência, ajudar a vender, medir, entregar, converter,
aumentar valor percebido ou proteger o processo comercial. Evitar expansão técnica sem
necessidade comercial concreta. **Próximo movimento principal: campanha real para Universo
Feminino / Ela Tem Classe / Experimente, com Pinterest como primeiro canal** (ainda NÃO iniciada).

**1. Validação ponta a ponta do comércio de livros — PASS (05/10/2026).** Fluxo comprovado em
produção: Experimente → checkout → Stripe → pagamento → webhook → fulfillment → e-mail → acesso →
leitura → refund → webhook de estorno → revogação automática. Foi uma **compra interna real de
validação, não uma venda externa orgânica**. Produto: Ela Tem Classe, R$ 34,90, só livro (audiobook
adicional custa R$ 19,90), sem cupom, cartão, origem `universo-feminino` preservada em pedido e
metadata Stripe. Auditado read-only: 1 cobrança, 1 evento de conclusão, 1 fulfillment, 1 acesso, e-mail
entregue ao comprador, nenhuma duplicidade.

**2. Reembolso / revogação (comprovado).** Refund total reconhecido pelo Stripe, webhook
`charge.refunded` recebido e processado, acesso revogado automaticamente (~1 s), registro preservado
para auditoria, token revogado deixa de valer (`verificarAcesso`), sem nova cobrança nem novo
fulfillment. O fluxo de estorno envia um e-mail interno de aviso à caixa da ZUNI.

**3. Universo Feminino** — ambiente editorial/comercial temático (não só filtro de catálogo), em
produção em `/loja/universo-feminino/`. Obras: Ela Tem Classe, A Inteligência do Corpo Feminino,
Código Feminino, A Mulher que Permanece Inteira, Inesquecível (`inesquecivel-charme-feminino`).
Preços definidos no catálogo (fonte única: `src/lib/catalogoLivros.js`). Origem `universo-feminino`
(whitelist em `origemCompra.js`) vai para `payload.origem` e `metadata.origem`; é independente do
Pinterest e não altera preço/entrega.

**4. Experimente ZUNI v1** — em produção só para Ela Tem Classe: `/experimente/ela-tem-classe/`.
Amostra oficial do audiobook (~65 s, arquivo curto estático em `public/audio/amostras/`, separado do
integral), sem autoplay, player Ouvir/Pausar/Continuar/Parar/Recomeçar (Parar volta a 0:00; `pagehide`
pausa), trecho de leitura de 422 palavras, temas em lista editorial, CTA com preço vindo do catálogo e
origem preservada, nenhuma exposição do integral. **Fail-closed**: obra sem `amostraDisponivel` e
amostra aprovada em `src/lib/amostrasExperimente.js` responde 404 (as outras 4 do Universo Feminino).
**O TTS do navegador NÃO representa o audiobook oficial**; para obras com audiobook produzido,
preferir a amostra da versão oficial (TTS só como fallback/acessibilidade quando apropriado).
Nova obra no Experimente = aprovação editorial do trecho + (se houver audiobook) corte aprovado da
amostra, nunca texto/áudio integral.

**5. Política de acesso.** Produção aplica `LIVRO_ACESSO_DIAS=30` → **acesso online efetivo de 30
dias** (validado na compra real; o e-mail mostra a mesma data do banco). O código tem fallback de
7 dias se a variável faltar/for inválida. **Dívida de robustez**: tornar a regra de 30 dias
explícita/testada no código para evitar regressão silenciosa (não alterado).

**6. Pinterest.** Tag instrumentada no funil: Experimente = PageVisit (`load`+`page`); checkout = page /
AddToCart conforme implementação; Purchase (`checkout`) preparado para disparar após `pago:true`.
**`PINTEREST_PURCHASE = NOT_CONFIRMED`** — não confirmado diretamente na plataforma. Não bloqueia a
validade do fluxo comercial, mas **deve ser confirmado antes/durante o início do tráfego pago**.

**7. Privacidade.** A `return_url` do Stripe para livros não leva mais e-mail do comprador
(em produção). Dívidas conhecidas: alguns logs ainda podem conter e-mail; `?cupom=` na URL pode chegar
ao Pinterest no `page`. Sanear oportunamente.

**8. Download / cópia digital — NÃO implementado como política.** Hoje: leitura online funciona e a
interface do leitor oferece ações de download/impressão. A política futura pretendida (cópia digital
autorizada, permanente após download — conceito "Cópia Digital Certificada ZUNI Suprema", com Copy ID
anônimo) é **proposta futura, ainda a formalizar e reconciliar tecnicamente**. Não prometer PDF nem
download permanente na comunicação enquanto a entrega técnica não existir.

**9. Audiobook.** Arquitetura de entrega privada em **estágio piloto de produção**: só Ela Tem Classe usa
a configuração privada; as demais obras seguem legacy (detalhes e restrições nas notas de memória do
projeto; não expor caminhos privados, UUIDs de storage, URLs assinadas nem o mapa de migração). A
amostra pública do Experimente é separada do integral. **Audiobook standalone ainda NÃO existe como
produto independente** (hoje é adicional à compra do livro).

**10. MercadoPago — dívida operacional.** Permanece como legado/inativo em partes do sistema (ex.: botão
Pix). **Não remover agora.** Decisão: fazer antes uma auditoria de descomissionamento completo +
regressão total; só depois dela dizer "agora é seguro cancelar a conta comercial Mercado Pago" e
apagar variáveis/credenciais.

**Projetos estratégicos no radar (não iniciar agora):** ver `RADAR_OPORTUNIDADES.md` → seção 12.

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

**Testes pós-rebase — FEITOS em 30/09/2026** (servidor local `PORT=8091` + `stripe
listen` com a chave de teste do `.env`, cartão `4242…`, comprador
`zunisuprema@gmail.com`, já sem o brinde), todos passaram:
- Livro simples → e-mail `acesso-livro` id `01a0f309-089d-7118-8bd4-f1c7b4437cb1`.
- Livro + audiolivro → 2 linhas em `acessos_livros` (`livro` + `audiolivro`), e-mail
  id `01a0f309-7f2b-77ac-b3ac-24261b2eaea2`.
- Reenvio do mesmo evento do webhook → 1ª entrega processada (e-mail id
  `01a0f30a-10bd-71bd-9913-c1fbee8037be`), 2ª `já processado — ignorando reentrega`.
- Cupom 100% (com e sem audiolivro) → acesso direto, sem Stripe; e-mails ids
  `01a0f30a-8190-7960-8a61-728f58a965a9` e `01a0f30a-850f-79cb-b7fc-3b0a928bc88d`.
- Regressão ZUNI Direciona: checkout → webhook marca `chat-mentor` como paga →
  `questionario-selecao.html`; Pinterest com `value` 27,90.
- E-mails da Síntese (com cupom + PDF), acesso a livro (com audiolivro) e Sessões
  Extras enviados pelo Resend (ids `01a0f30c-a92d-719e-8ab4-a11ea6ac970e`,
  `01a0f30c-aa9e-722d-a886-5d80e7a258aa`, `01a0f30c-ab77-78ef-934e-b67e2e7de898`),
  HTML conferido: sem brinde nem menção a astrologia/numerologia.
- Zero `[EMAIL_FALHOU]` no log. **Não testado**: o relatório do ZUNI Direciona de
  ponta a ponta (chat real até o fim + Claude + Make) — a rota de teste dispara o
  webhook real do Make, então só o envio do e-mail foi exercitado.
Os scripts `testar-checkout-livro-stripe.js` (não clica mais no seletor de método) e
`testar-idempotencia-webhook-livro.js` (aceita `--email=`) foram ajustados.
**Achado (RESOLVIDO em 30/09/2026)**: o log `[CUPOM] Possível uso concorrente detectado
para <código>` imprimia o código do cupom em claro (e o `/api/validar-cupom`, o
Mapa Integrado e o erro ao marcar cupom também). Agora todos os logs de cupom usam
`mascararCodigo()` (`lib/cupons.js`): só os 3 primeiros caracteres + `***`. Cupom de
teste 100% **rotacionado**: novo cupom id 14 (`campanha`, 100%, sem teto, 16
caracteres, `expira_em` 2026-12-31), validado no fluxo de livro (com e sem
audiolivro) com o servidor já logando mascarado — 0 ocorrências do código no log;
só então o antigo (id 13) foi encerrado (`expira_em = now()`, 30/09/2026 16:45 UTC),
confirmado que deixou de ser aceito. O código novo foi informado só na conversa,
**não está em arquivo nem commit**.

**E-mail da Síntese (30/09/2026)**: `**…**` literais trocados por `<strong>` (Síntese
e Dossiê) e "sua sessão com o Mentor ZUNI Suprema" → "sua sessão de orientação do ZUNI
Direciona" (nada mais mudou). Validade do cupom de 30% no e-mail = 7 dias a partir da
criação (`DIAS_VALIDADE_CUPOM_SESSAO`, `lib/cupons.js:31`, gravada em
`cupons_desconto.expira_em`); o "01/10" visto no teste era o cupom fictício de 1 dia
do script de teste. O "quadro branco" no fim do e-mail de teste era, muito
provavelmente, a miniatura do PDF de teste em branco no Gmail. **Ainda com nome
antigo (não alterado, sem pedido)**: assunto "seu Chat Mentor ZUNI está pronto" e
anexo `chat-mentor-zuni.pdf`; o corpo do e-mail não usa `<p>` (as linhas se juntam).

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

**Frente Stripe — RESOLVIDA em 30/09/2026**: Fase 1 (ZUNI Direciona) e Fase 2 (Livros, só cartão) estão em produção e foram validadas com compra real; ver "Estado ao encerrar 30/09/2026".

---

## Estado ao encerrar 30/09/2026 — em produção e pendências

**Em produção (Railway, `origin/main` = `main` local):**
- **Stripe (ZUNI Direciona + Livros, só cartão)**: no ar desde o push de 30/09 (`9533eb8`,
  16:55 UTC). Os itens do checklist abaixo foram resolvidos: chave `rk_live_` com
  Checkout Sessions = Escrever (conferido pelo usuário no painel), endpoint de produção
  assina exatamente os 3 eventos e o `whsec_` do Railway é o dele, conta com Pagamentos
  e Payouts ativos e sem tarefas pendentes. **Compra real feita pelo usuário nos dois
  produtos**: livro "A Presença em Ação" (R$ 37,90) e sessão do ZUNI Direciona
  (R$ 27,90, chat completo, Síntese em PDF, e-mails recebidos). Conferido nos logs e no
  banco: webhook processou os dois (livro 17:04 UTC, sessão 17:07 UTC), e-mails pelo
  Resend com id (`acesso-livro` `01a0f346-5e48-746b-9ec5-60acb8297e5f`,
  `sintese-relatorio` `01a0f371-1ac2-74bc-a48e-a5f04c20cb52`), `relatorio_gerado = true`.
- **Leva 1 do chat — push `737a410` em 30/09/2026, 18:25 UTC** (deploy no ar 18:27 UTC,
  log de inicialização sem erro; `/checkout.html` e `/chat.html` 200 em produção):
  - renderizador de markdown **seguro** (`public/js/markdown-seguro.js`): escapa tudo
    antes de formatar e só gera `p, br, strong, em, ul, ol, li, hr`; o chat usa
    `addMsg` (IA pelo renderizador, cliente por `textContent`) e `addMsgHtml` (só
    modelos internos confiáveis, valores dinâmicos por `escaparHtml`); a Resposta A do
    questionário passa pelo mesmo caminho. Fechou a brecha do `innerHTML` cru.
    Testado com 17 payloads maliciosos (unitário) e no navegador (nada executou).
  - CSS da borda do balão da IA corrigido (`chat.html`, valor inválido `#btn-microfonergba`).
  - botão dourado "📚 Loja" no cabeçalho do chat (estilo dos botões da loja, 44px).
  - `checkout.html`: "Cartão ou Pix." → "Pagamento com cartão." (+ comentários de código).
- **E-mail da Síntese**: assunto "{nome}, sua Síntese ZUNI Direciona está pronta" e anexo
  `sintese-zuni-direciona.pdf`; negrito em HTML; nomenclatura ZUNI Direciona.
- **`LIVRO_ACESSO_DIAS=30` criado no Railway pelo usuário** (conferido em 30/09: valor
  `30`). O código lê a variável certo (`acessoLivros.js:25`) e o e-mail de acesso mostra a
  data calculada a partir dela. Vale só para acessos **novos**; acessos já criados
  (inclusive a compra real do usuário) seguem com 7 dias.

**Leva 2 — PENDENTE (aprovada, ainda não implementada):**
1. **Aviso de clique no WhatsApp**: novo `POST /api/whatsapp-clique` (token da sessão como
   o `/api/chat`; `origem` = `ajuda` | `flutuante` | `pos-encaminhamento`); log com marcador
   `[WHATSAPP_CLIQUE]` (referência de 8 caracteres + origem + data/hora de Brasília, sem
   nome/e-mail/token); e-mail pelo Resend (`enviarEmail`, tipo `whatsapp-clique`) para
   zunisuprema@gmail.com com referência, origem, data/hora, tema e tipo do produto; no
   máximo 1 e-mail por sessão a cada 10 minutos; contador `registrarContadorWhatsapp('clique')`;
   `fetch` com `keepalive` sem bloquear a abertura do WhatsApp. O e-mail diz "clicou", não
   "enviou a mensagem". Cobre os 3 pontos de entrada: "Ajuda" do cabeçalho, botão
   flutuante (após o modal) e botão da mensagem de encaminhamento.
2. **Remover o disparo para o Make** (decisão do usuário: não usa o Make). Em produção a
   variável `MAKE_WEBHOOK_URL` nem existe e o log mostra `MAKE_WEBHOOK_URL não configurado —
   trigger ignorado` a cada relatório. Remover `triggerMake` e o log, **sem afetar** o envio
   da Síntese por e-mail nem o registro do WhatsApp (`registrarContadorWhatsapp`).
3. **`LIVRO_ACESSO_DIAS` inválido ou ausente cai para 7 dias** sem quebrar a gravação do
   acesso (hoje `abc` vira `NaN` e a gravação falha).
4. **Data do e-mail de acesso no fuso `America/Sao_Paulo`** (hoje usa o fuso do servidor,
   UTC, e à noite no horário de Brasília pode aparecer um dia adiantada).

**Aguardando aprovação de texto do usuário (nada no prompt muda sem o OK):**
- `welcomeMessage` (`server.js`, `/api/sessao/iniciar`, endpoint que nenhuma tela chama):
  "bem-vindo(a) ao Mentor ZUNI Suprema" → "bem-vindo(a) ao ZUNI Direciona".
- `REPORT_PROMPT`: linha 573 "…Dossiê da Sessão do Chat Mentor ZUNI…" → "…do ZUNI
  Direciona…"; linha 616 "mencione que veio do Chat Mentor ZUNI" → "…veio do ZUNI
  Direciona" (essa é a frase impressa no fim da Síntese).
- Prompt da Resposta A (`questionarioTimidez.js:23` e `:37`): hoje pede "a mensagem de
  abertura do Mentor ZUNI" e o modelo devolve um título ("Mensagem de Abertura — Mentor
  ZUNI"; em 6 de 13 respostas guardadas começa com `#`, em 5 contém "Mensagem de
  Abertura"). Proposta: "primeira fala do Mentor ZUNI… Não use título, cabeçalho nem
  formatação Markdown (sem #, ** ou ---): comece direto na saudação, em texto corrido."
- Regra confirmada pelo usuário: **"Mentor ZUNI" é o nome oficial da interface
  conversacional e permanece** (rótulo das mensagens, painel "Como usar", janela da
  Síntese, questionários). Só muda onde "Mentor" aparece como nome do PRODUTO. O subtítulo
  "Chat Mentor ZUNI" da capa do PDF não aparece em produto ativo: não mexer.

**Testes pendentes do usuário** (não dá para fazer daqui): abrir uma **sessão real do ZUNI
Direciona usando o cupom de teste** e conferir (a) o markdown renderizado nas respostas
(títulos, negrito, listas, filete; nada de `#`, `**`, `---` crus), (b) o botão dourado
"📚 Loja" no cabeçalho (desktop e celular), (c) o **botão do WhatsApp da mensagem de
encaminhamento** ("Abrir conversa no WhatsApp") — a única parte da Leva 1 que não foi
exercitada no teste de navegador (a rota simulada devolveu erro).

**Achados da compra real (30/09/2026, noite) — RESOLVIDOS e no ar:**
1. **Leitor de livros no celular — NO AR (rodadas 1 e 2).** Causa: o leitor flipbook
   (embutido nos bundles de `private/livros/*/index.html`) sempre mostrava as duas
   páginas e encolhia tudo para caber (escala 0,37 a 390px ⇒ texto de ~5,8px); a barra de
   controles (~500px) estourava a tela; A+ funcionava mas era imperceptível sob essa
   escala. Viewport e zoom por pinça já estavam corretos. Correção: patch central no
   servidor (`src/lib/leitorMobile.js`, usado em `routes/livros.js`), cache em memória por
   livroId + mtime; se uma âncora não for encontrada, entrega o livro ORIGINAL e loga
   `[LEITOR_PATCH_FALHOU]`. HTML sem bundle (Bastidores) segue intocado, sem log.
   - **Rodada 1** (deploy `c1ab5e83`, commit `458dfe7`): 25 livros do leitor do apêndice
     (motor A: página única abaixo de 820px de largura ou 500px de altura, barra em duas
     linhas abaixo de 760px, A+/A− até 1,6, deslize).
   - **Rodada 2** (deploy `be8c4f4c`, commit `0111fd0`): mais 7 livros — motor B
     (`a-inteligencia-da-vida`, `a-neurobiologia-integrativa-da-depressao`,
     `a-visao-integrativa-da-obesidade`; `leitorMobileMotorB.js`), motor C
     (`inesquecivel-charme-feminino`: escala por variável CSS; A+/A− viram zoom, pois no
     original eram inertes mesmo no desktop), motor D (`a-arquitetura-da-decisao-humana`:
     folhas A4 na largura da tela; `leitorMobileMotoresCD.js`) e os 2 flipbooks
     `arquitetura-excelencia-humana-ii` e `consequencias-edicao-essencial` (motor A, JSON do
     bundle na mesma linha do marcador). Total: 32 livros com patch; 6 Bastidores sem.
   - **Validação**: Chromium emulando celular (390, 430, deitado 844×390, desktop), sem
     botão cortado nem overflow. Em produção só o apêndice foi aberto (único token de
     teste); os demais foram testados localmente com o mesmo código. **Não testado**:
     iPhone/Safari reais e pinch-zoom real.
   - **Limites conhecidos**: no motor D, zoom em janelas de 820–1100px pode vazar na
     horizontal (como já era); o celular deitado no motor D usa o layout de desktop.
2. **Estorno não revogava o acesso — NO AR** (commit `175027a`, deploy `ab3920a4`).
   `src/lib/estornoStripe.js`: trata `charge.refunded` (só estorno total; parcial só avisa)
   e `charge.dispute.created`; acha o pedido por `payment_intent` →
   `checkout.sessions.list`; revoga `acessos_livros` (livro + audiolivro) e `sessions` (ZUNI
   Direciona: `paid=false` + `estornado_em`) sem apagar registros; log
   `[ESTORNO_ACESSO_REVOGADO]` (também `[ESTORNO_PARCIAL]`, `[ESTORNO_SEM_PEDIDO]`,
   `[ESTORNO_SEM_EFEITO]`) e e-mail de aviso para zunisuprema@gmail.com. Migração
   `007_revogacao_acessos_estorno.sql` (`revogado_em`, `motivo_revogacao`,
   `estornado_em`) **aplicada em produção**. `verificarAcesso` rejeita token revogado; uma
   reentrega de `checkout.session.completed` após o estorno não reativa a sessão.
   - **Webhook de produção do Stripe agora com 5 eventos**: `checkout.session.completed`,
     `…async_payment_succeeded`, `…async_payment_failed`, `charge.refunded`,
     `charge.dispute.created` (os 2 últimos acrescentados pelo usuário em 30/09).
   - **Teste de ponta a ponta (Stripe CLI, modo de teste, zunisuprema@gmail.com)**:
     livro + audiolivro estornado ⇒ 2 linhas revogadas e tokens passam a 403; ZUNI
     Direciona estornado ⇒ `paid=false`, `/api/chat` 403; reentrega do estorno ⇒
     `[ESTORNO_SEM_EFEITO]` sem novo e-mail; `checkout.session.completed` reentregue
     depois ⇒ ignorado; `charge.dispute.created` via `stripe trigger` ⇒ tratado
     (`[ESTORNO_SEM_PEDIDO]`, pois o trigger não cria Checkout Session).
     **Não testado**: disputa real sobre pedido nosso (mesmo caminho do estorno, só muda
     o motivo; coberto no teste com Stripe falso, `scripts/testar-estorno-stripe.js`).
   - **Limites**: não alcança quem já baixou o livro ou tem a página aberta; disputa ganha
     não restaura o acesso sozinha (reativação manual); uma gravação de sessão com dados
     antigos no instante exato do estorno pode sobrescrever `paid=false` (o guard cobre só
     sessões já lidas com `estornado_em`).
   - **As duas compras reais de teste de 30/09 (livro "A Presença em Ação" e sessão do
     ZUNI Direciona) foram revogadas manualmente pelo usuário**
     (`acessos_livros.revogado_em`, `sessions.estornado_em` preenchidos).
   - Linhas de teste do estorno ficaram no banco como revogadas (livro
     `alem-do-que-voce-sente` + 1 sessão, comprador zunisuprema@gmail.com) — entram na
     limpeza de dados de teste.

## Pendências para amanhã (01/10/2026)

1. **Reformatar "Inesquecível Charme Feminino" no modelo padrão** (o mesmo leitor do
   apêndice / motor A). **O arquivo será substituído pelo usuário** — aguardar a entrega
   antes de mexer. Hoje o livro roda no motor C
   (`private/livros/inesquecivel-charme-feminino/`), com o patch de celular; ao entrar no
   modelo padrão passa a valer o motor A e o ramo C do patch fica sem uso para esse livro.
2. **Frente do Livro-Vivo em todas as obras e audiolivros** — a definir/planejar (escopo
   dado pelo usuário: todas as obras e os audiolivros; seguir a regra de processo:
   investigar → plano → aprovação → código).
3. **Leva 2 do ZUNI Direciona** (aprovada, não implementada — detalhes no bloco "Leva 2 —
   PENDENTE", acima): aviso de clique no WhatsApp (`POST /api/whatsapp-clique`, e-mail
   limitado a 1 por sessão a cada 10 min); remoção do disparo para o Make
   (`triggerMake`); fallback de 7 dias quando `LIVRO_ACESSO_DIAS` for inválido ou ausente
   (hoje `abc` vira `NaN` e a gravação do acesso falha); data do e-mail de acesso no fuso
   `America/Sao_Paulo`.
4. **Textos de prompt aguardando aprovação do usuário** (nada no prompt muda sem o OK —
   bloco "Aguardando aprovação de texto", acima): `welcomeMessage`; duas linhas do
   `REPORT_PROMPT` (573 e 616: "Chat Mentor ZUNI" → "ZUNI Direciona"); prompt da Resposta A
   em `questionarioTimidez.js` (sem título nem Markdown). "Mentor ZUNI" permanece como nome
   da interface conversacional.
5. **Testes pendentes do usuário**: sessão real do ZUNI Direciona com o cupom de teste
   (markdown renderizado, botão dourado "📚 Loja", botão do WhatsApp da mensagem de
   encaminhamento) e abrir alguns dos 32 livros no celular real.

**Pendências futuras registradas em 30/09/2026:**
- **Unificar os leitores de livro** num único código: hoje há 4 motores de flipbook
  copiados em ~33 bundles de vários MB; o patch de celular é um remendo central, não a
  solução definitiva.
- **Segurança — URL pública do MP3 do audiolivro**: `audiobookUrl`/`audiobookPartes`
  são URLs públicas do Supabase Storage; o acesso é checado na rota
  `/audiolivros/:livroId`, mas quem já tiver a URL continua ouvindo/baixando mesmo depois
  de expirar o acesso ou de um estorno. Corrigir com bucket privado + URL assinada de
  curta duração.

**Pendências que continuam abertas (não bloqueiam nada):** `MAKE_WEBHOOK_URL` (vira
remoção, acima); rota antiga do MercadoPago segue no código sem tela; webhook do
MercadoPago sem `x-signature`; `GET /api/checkout/session-status` mascara 500 como
"não pago"; `chat.html` não retoma sessão após F5; `?tema=` do checkout não chega ao
produto; limpeza dos dados de teste em `acessos_livros`/`checkout_pedidos_pendentes`
(inclui linhas com `zunisuprema@gmail.com`); capa do PDF da Síntese segue em vetor
(`CAPA_SINTESE_EM_IMAGEM = false`; o JPG atual é um mockup de livro, não serve em
tela cheia, e a arte será refeita); `capa-pdf.jpg` ("Mapa Integrativo") sem uso.

---

## Checklist pré-push do Stripe (30/09/2026) — RESOLVIDO, ver bloco acima

`main` local está 20+ commits à frente de `origin/main`; o push (`git push origin
main`) sobe **tudo junto**: Stripe Fase 1 (ZUNI Direciona) + Fase 2 (Livros, só
cartão) + remoção do serviço astro-numerológico/Pix da tela + logs de cupom
mascarados + ajustes do e-mail da Síntese. O Resend já está em produção (`e04a128`).

**Pronto**
- Código testado em modo de teste (Stripe CLI, cartão 4242) **depois** do rebase:
  livro simples, com audiolivro, reenvio do webhook, cupom 100%, regressão do ZUNI
  Direciona, e-mails sem brinde pelo Resend (ids no bloco "Testes pós-rebase").
- Webhook compatível com a API `2026-08-26.dahlia`: o pacote `stripe` 22.6.2 usa
  essa mesma versão por padrão (o cliente não fixa `apiVersion`); campos lidos:
  `event.type`, `data.object.{id, payment_status, client_reference_id, metadata.*}`.
- Variáveis no Railway (conferido 30/09, só nomes/prefixos): `STRIPE_PUBLISHABLE_KEY`
  `pk_live_`, `STRIPE_SECRET_KEY` **`rk_live_`** (chave restrita), `STRIPE_WEBHOOK_SECRET`
  `whsec_`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_REPLY_TO`, `FRONTEND_URL`.
  O `.env` local continua com as chaves de **teste**.
- Logs de cupom mascarados; cupom de teste rotacionado; Pix e astro-numerologia fora
  da tela; e-mail da Síntese ajustado.

**Falta / a confirmar antes (ou logo depois) do push**
1. **Permissões da chave restrita `rk_live_`**: o código só chama
   `checkout.sessions.create` (2 pontos) e `webhooks.constructEvent` (local, sem
   API). A chave precisa de *Checkout Sessions: Write*; sem isso o checkout dá 500
   em produção. Não dá para ver daqui — só a compra real confirma.
2. **Endpoint de produção no painel**: confirmar que assina os 3 eventos
   (`checkout.session.completed`, `…async_payment_succeeded`, `…async_payment_failed`)
   e que o `whsec_` do Railway é o **desse** endpoint (não o do `stripe listen`).
   Informado pelo usuário, não verificado por mim.
3. **Conta Stripe de produção** ativa e com cobranças habilitadas (as chaves live
   sugerem que sim; não verificado).
4. **Compra real pós-deploy**, nos dois produtos (Sessão ZUNI e 1 Livro) com estorno
   pelo painel, conferindo no log de produção `[STRIPE-WEBHOOK] … processado` e
   `[EMAIL] … id=`. **Nunca testado**: ZUNI Direciona de ponta a ponta (chat até o
   fim + relatório + Make).
5. **Sem Pix** em nenhum produto até o Stripe liberar; MercadoPago segue no código e
   no Railway (não remover — ver seção da Fase 1).
6. **Plano de volta**: se o checkout falhar em produção, reverter o push
   (`git revert` dos commits) ou reimplantar o deploy anterior no Railway; as
   variáveis não precisam mudar.
7. Limpeza dos dados de teste em `acessos_livros`/`checkout_pedidos_pendentes`
   (agora também linhas com `zunisuprema@gmail.com`) — combinada para depois.
8. Pendências abertas que **não** bloqueiam o push: webhook do MercadoPago sem
   `x-signature`; `GET /api/checkout/session-status` mascara 500; `chat.html` não
   retoma sessão; `?tema=` do checkout não chega ao produto.

---

## Decisão de 30/09/2026 — serviço astro-numerológico FORA DO AR

**Decisão do usuário**: todo o serviço astro-numerológico atual sai do ar e será
**refeito do zero sobre um novo RAG, em outro formato**. No ar ficam só os serviços
essenciais: **loja de livros e ZUNI Direciona, pagamento só por cartão via Stripe**.
Desativado, **não excluído**: código de backend e tabelas mantidos.

O que saiu (commits locais no `main`, **sem push** — sobem junto com o deploy do Stripe):
- **Brinde "Estudo Integrativo"**: bloco "Presente para você" removido dos 3 e-mails
  (acesso a livro, Síntese do ZUNI Direciona, Sessões Extras).
- **Redirect 302 → `/loja/`**: `/brinde`, `/brinde.html`, `/checkout-mapa-astral.html`,
  `/checkout-mapa-integrado.html` (middleware em `src/server.js` antes das rotas e do
  `express.static`).
- **410 `{"error":"Serviço em breve."}`**: `POST /api/checkout/mapa-astral[/preference|/test]`,
  `POST /api/checkout/mapa-integrado[/preference]` e todo `/api/brinde/*`.
- **Mantidos de propósito**: webhook do MercadoPago (pagamentos já em andamento) e os
  GET de status dos checkouts; rotas `/api/experimente-*` de numerologia/astrologia/
  lead (sem tela que as chame); `lib/brinde.js`, `astro.js`, `numerologia.js` etc.
- **`experimente.html`**: removidos módulos A e B, itens da navbar, tíquete de
  código-convite (só destravava o módulo A), botão "Mapa Integrado" da sidebar, bloco
  de oferta e textos de rodapé; `experimente-client.js` limpo. Ficam o Módulo C (chat
  de demonstração) e o D (degustação de livro); `#modulo-livro` segue funcionando e o
  link da loja ("Ler grátis + conversar") abre a degustação.
- **Loja**: card "Mapa Integrado ZUNI" e a seção "Serviços Complementares" removidos.
- **`SYSTEM_PROMPT` do Mentor**: só a menção "ao Mapa Integrado" saiu (linha da
  instrução sobre botões). Antes: "…aos Livros Vivos, ao Mapa Integrado ou à equipe
  multidisciplinar…" → depois: "…aos Livros Vivos ou à equipe multidisciplinar…".
- **Verificado** (local, 30/09): redirects 302 e 410 conforme acima; `/loja/`,
  `/experimente.html`, `checkout-livro.html` e `checkout.html` seguem 200; sem erro de
  JS em `experimente.html`; `#modulo-livro` visível após o clique vindo da loja.

**Pendências dessa decisão**: (a) o e-mail de resultado de numerologia
(`capturasExperimente.js`) ainda leva botão para `checkout-mapa-integrado.html` — sem
tela que o dispare, mas o link agora cairia na loja; limpar quando o serviço novo
for desenhado. (b) o backlog "Mapa Integrado / família de mapas" (seção 5) e as
pendências do futuro serviço Astro-Num passam a depender do novo RAG.

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
