# STATUS ZUNI SUPREMA

> Arquivo de estado vivo do projeto. Atualizado ao final de cada sessão de trabalho
> (chat, Claude Code ou Cowork). Serve como fonte de verdade sobre o que está pronto,
> em andamento e pendente — independente de qual instância do Claude está ajudando.
>
> Última atualização: 10/08/2026 (20:50) — Varredura completa de RAG concluída

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
  Ascendente corrigido, chave configurada em produção (Railway).
- **Módulo "Experimente a ZUNI"** (numerologia, astrologia, chat demo) — funcionando
  após correção de RLS.
- **Varredura RAG completa (10/08/2026 20:44-20:45)** — Teste end-to-end em todos os 7
  temas com RAG indexado. Resultado: ✅ 100% operacional (7/7 temas responderam com
  conteúdo específico e > 250 caracteres). Logs [RAG_HIBRIDO] acionados corretamente,
  limite de busca híbrida: 3 chunks tema-específico + 2 chunks geral por consulta
  (contagem real de chunks retornados/utilizados por resposta não foi verificada nesta
  varredura). Total de 1.143 chunks em banco (613 temáticos + 530 genéricos/livros).

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

**Evidência de logs RAG capturada**: Todos os 7 temas confirmados com log [RAG_HIBRIDO] do servidor (linha 785 de server.js), incluindo tema identificado e limites de busca. Logs brutos revisados em sessão 10/08/2026 20:44-20:45.

**Nota sobre `timidez_comunicacao`**: Apenas 2 chunks reais indexados no banco (confirmado em 04-05/08 e revalidado em 10/08). A discrepância com os 827 chunks originalmente documentados permanece sem explicação. Base funcional mas minimal — reindexação recomendada se expandir cobertura do tema.

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

**Mudanças em 10/08/2026 (20:50) — Varredura completa de RAG:**
- Varredura completa executada: consultado Supabase, criadas 7 sessões de teste,
  executado end-to-end no `/api/chat` com sessionId real e tema_questionario específico.
- Todas as respostas analisadas para conteúdo temático (> 250 caracteres confirmados).
- Composição dos 530 chunks "genéricos" (sem tema específico) confirmada:
  - Vol. I (20 chunks), Vol. II (80), Vol. III (86), Vol. IV (66), Geral (278)
  - Todos os 4 volumes estão **publicados e à venda** na loja.
- Timestamp de execução: 10/08/2026 entre 20:44:30 e 20:45:31 (horário de Brasília).

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
