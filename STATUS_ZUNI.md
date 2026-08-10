# STATUS ZUNI SUPREMA

> Arquivo de estado vivo do projeto. Atualizado ao final de cada sessão de trabalho
> (chat, Claude Code ou Cowork). Serve como fonte de verdade sobre o que está pronto,
> em andamento e pendente — independente de qual instância do Claude está ajudando.
>
> Última atualização: 10/08/2026

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

## 2. Em produção, funcionando

- **Funil de cupom** (Mentor→loja e loja→checkout), validado ponta a ponta.
- **Sessões Extras** (pacote de 3 sessões, R$74,90), com memória de jornada isolada da
  sessão avulsa. Pendente apenas: 1 teste de pagamento real de terceiro.
- **Leitura em voz alta gratuita** nos 6 volumes de "Os Bastidores da Mente" (Web
  Speech API, substituindo ElevenLabs cancelado).
- **Vertical Astrológica** (35 blocos RAG, fonte Max Heindel/domínio público) —
  indexada, testada, 100% operacional. Registro simbólico, sem astrologia médica.
- **Vertical Numerologia** (42 blocos RAG) — indexada, testada, 100% operacional.
- **Campos de apresentação por obra na loja** (resumo curto + "+ LEIA MAIS").
- **RLS habilitado** em todas as tabelas do Supabase (checklist permanente desde
  28/07/2026 — sempre verificar em tabela nova).
- **lib/astro.js** (integração AstroWay) — validado com dados reais, bug do
  Ascendente corrigido, chave configurada em produção (Railway).
- **Módulo "Experimente a ZUNI"** (numerologia, astrologia, chat demo) — funcionando
  após correção de RLS.

## 3. Pendências antigas, ainda em aberto

- Teste de responsividade mobile (checkout → chat → relatório → WhatsApp) no
  celular real.
- Domínio raiz `zunisuprema.com.br` (sem www) ainda não resolve — solução definitiva
  é migrar nameservers para Cloudflare (não urgente).
- `www.zunisuprema.com.br` abrindo `checkout.html` na raiz em vez da landing page —
  investigar rota/index no `server.js`.
- Banner discreto na 8ª troca da sessão avulsa (oferecendo Sessões Extras, Mapa
  Integrado, obras) — planejado, não implementado.

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

**7 temas em produção com RAG híbrido, todos validados via log [RAG_HIBRIDO]** (status em 06/08/2026):

| Tema (slug) | Chunks | Questionário | ragIndexado | Validação [RAG_HIBRIDO] |
|---|---|---|---|---|
| `timidez_comunicacao` | 2 | ✅ 5 perguntas | true | ✅ Produção validado |
| `namoro_conquista_romance` | 52 | ✅ 5 perguntas | true | ✅ Produção validado |
| `administracao_empresarial_inteligente` | 40 | ✅ 5 perguntas | true | ✅ 06/08 via teste HTTP |
| `obesidade` | 410 | ✅ 5 perguntas | true | ✅ 06/08 via teste HTTP |
| `depressao` | 79 | ✅ 5 perguntas | true | ✅ 06/08 via teste HTTP |
| `sentimentos_adolescencia` | 16 | ✅ 5 perguntas | true | ✅ 06/08 via teste HTTP |
| `educar_filhos` | 14 | ✅ 5 perguntas | true | ✅ 06/08 via teste HTTP |

**Nota**: os 827 chunks originalmente documentados para timidez_comunicacao nunca foram de fato indexados — apenas 2 chunks reais existem no banco, confirmado por auditoria em 04-05/08/2026. A origem dos 827 permanece desconhecida.

**Mudanças realizadas em 06/08/2026:**
- Renomeados slugs no catálogo: `sentimentos_confusos` → `sentimentos_adolescencia`, 
  `adolescencia_dos_filhos` → `educar_filhos` (alinhamento com nomes no banco).
- Criado novo tema `administracao_empresarial_inteligente` no catálogo 
  (ausente, mas indexado no banco com 40 chunks).
- Adicionadas 5 perguntas estruturadas para cada um dos 5 temas novos.
- Marcados todos os 5 temas + os 2 anteriores com `ragIndexado: true`.
- Validação ponta a ponta: 5 sessões de teste via HTTP, confirmação em logs Railway 
  que cada tema dispara `[RAG_HIBRIDO]` com tema correto e limite apropriado 
  (Limite tema: 3, Limite geral: 2).

**[10/08/2026] Fase 1 — Expandir seletor para 43 temas + skip visível (CONCLUÍDA):**
- Seletor visual em questionario-selecao.html agora chama `/api/questionario/catalogo` (43 temas, não 7)
- Botão "Pular formulário" adicionado em questionario-triagem.html (form-buttons, sempre visível)
- Todos os 43 temas disponíveis para seleção (não apenas os com RAG indexado)
- Resposta A será genérica para os 36 temas sem base RAG — validar qualidade em produção
- Commit: `b7e4096` (feat: implementar Fase 1 do questionário — expandir seletor e skip visível)

**[10/08/2026] Fase 2 — Gatilho Resposta B no chat (CONCLUÍDA):**
- Modal de confirmação explícita implementado no chat.html ("📞 Falar com um profissional")
- Backend: `triggerMake()` disparado ao gerar Resposta B pela primeira vez (apenas)
- Idempotência garantida: 2ª chamada retorna cache sem re-disparar webhook
- Validação via teste de ponta a ponta: sessionId `16606ea1-cf1a-4c33-92d7-fc63c80255d8`
  - 1ª chamada: `cached: false`, triggerMake disparado (log: "Resposta B disparada ao WhatsApp")
  - 2ª chamada: `cached: true`, triggerMake não re-disparado
  - Supabase: 1 registro, sem duplicata
- Commit: `937cf32` (feat: implementar Fase 2 do questionário — gatilho Resposta B no chat)

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
de cada sessão de trabalho.
