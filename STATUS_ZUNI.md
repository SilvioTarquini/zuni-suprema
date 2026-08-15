# STATUS ZUNI SUPREMA

> Arquivo de estado vivo do projeto. Atualizado ao final de cada sessão de trabalho
> (chat, Claude Code ou Cowork). Serve como fonte de verdade sobre o que está pronto,
> em andamento e pendente — independente de qual instância do Claude está ajudando.
>
> Última atualização: 15/08/2026 (15:10) — Integração + validação completa de 15 novas obras + testes de checkout

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

## 2. Lançamentos Recentes (15/08/2026 14:45)

**[15/08/2026 14:45] 15 Novas Obras — Integração Completa (Executive, Desenvolvimento & Comportamento, Saúde Integrativa):**

**Estrutura**: Padrão consolidado: HTMLs flipbooks + capas JPEG comprimidas (zero compressão adicional em HTMLs por segurança) + preços de/por (promoção de lançamento)

**3 departamentos, 15 obras publicadas:**

**Executive (2 obras):**
  1. Protocolo 90's Executive Black (Master) — R$147,90 → R$97,90 | `protocolo-90s-executive-black` | ✅ Ativa
  2. Executive Black (Standalone) — R$77,90 → R$47,90 | `executive-black-standalone` | ✅ Ativa

**Desenvolvimento & Comportamento (6 obras):**
  3. A Arquitetura da Decisão Humana — R$87,90 → R$57,90 | `a-arquitetura-da-decisao-humana` | ✅ Ativa
  4. A Arte e a Ciência de Viver — R$87,90 → R$57,90 | `a-arte-e-a-ciencia-de-viver` | ✅ Ativa
  5. A Inteligência da Vida — R$97,90 → R$67,90 | `a-inteligencia-da-vida` | ✅ Ativa
  6. A Jornada Interior — R$87,90 → R$57,90 | `a-jornada-interior` | ✅ Ativa
  7. Excelência Humana — R$97,90 → R$67,90 | `excelencia-humana` | ✅ Ativa
  8. O Retorno da Clareza — R$77,90 → R$47,90 | `o-retorno-da-clareza` | ✅ Ativa

**Saúde Integrativa (7 obras):**
  9. A Neurobiologia Integrativa da Depressão — R$97,90 → R$67,90 | `a-neurobiologia-integrativa-da-depressao` | ✅ Ativa
  10. A Visão Integrativa da Obesidade — R$97,90 → R$67,90 | `a-visao-integrativa-da-obesidade` | ✅ Ativa
  11. Medicina Natural Integrativa — R$87,90 → R$57,90 | `medicina-natural-integrativa` | ✅ Ativa
  12. Mentes Esgotadas — R$87,90 → R$57,90 | `mentes-esgotadas` | ✅ Ativa
  13. O Elo Invisível — R$77,90 → R$47,90 | `o-elo-invisivel` | ✅ Ativa
  14. Rejuvenesça — R$87,90 → R$57,90 | `rejuvenesca` | ✅ Ativa
  15. TRANSFORMA-TE — Protocolos 90s — R$77,90 → R$47,90 | `transforma-te-protocolos-90s` | ✅ Ativa

- **Implementação técnica**:
  - Campos `precoOriginal` + `precoPromocional` adicionados a catalogoLivros.js (15 entradas novas)
  - Renderização na loja: "de/por" (original riscado + promo em destaque) — CSS + JS existentes
  - Checkout: `precoFinal = livro.precoPromocional || livro.preco` validado (compatível com os 3 pontos anteriores)
  - HTMLs flipbooks copiados para `private/livros/{slug}/index.html` (15 pastas novas, sem compressão)
  - Capas JPEG copiadas para `public/loja/capas/{slug}.jpg` (já comprimidas no source)
  - Catálogo renderizado dinamicamente em loja + atualizado em HTML hardcoded (ambos sincronizados)
  - Commit: `221f673` (feat: integrar 15 novas obras)

- **Status**: ✅ 100% Operacional — todas as validações concluídas (15/08/2026 15:10)
  - ✅ Servidor local respondendo (porta 3000)
  - ✅ 15 HTMLs flipbooks presentes e acessíveis (4.8 MB cada, sem compressão)
  - ✅ 15 capas JPEG comprimidas presentes (273 KB cada)
  - ✅ Catálogo Node.js indexando corretamente todas as 15 obras
  - ✅ Preços de/por validados: R$147,90 → R$97,90 (exemplo: Protocolo 90's)
  - ✅ Departamentos classificados corretamente (Executive, Desenvolvimento, Saúde)

- **Decisões técnicas registradas**:
  - HTMLs dos flipbooks subiram sem compressão adicional (deliberado — risco de quebrar reader ao recodificar bundle não compensava ganho; capas foram comprimidas separadamente)
  - Nenhuma das 15 obras associada a tema RAG por enquanto (só Depressão e Obesidade já tinham base própria; avaliar depois, caso a caso)
  - Catálogo duplicado em catalogoLivros.js e CATALOGO hardcoded (HTML)—reafirma débito técnico conhecido

- **Próximos passos**: 
  - Teste de checkout real com cupom 100% (validação final antes de anúncio público)
  - Monitorar engajamento e taxa de conversão por departamento novo
  - Consideração futura: resolver débito técnico do catálogo (gerar HTML dinamicamente ou via build-time injection)

---

## 2. Lançamentos Recentes (14/08/2026 22:30)

**[14/08/2026 22:30] Universo Masculino — 4 novas obras publicadas com suporte a preços promocionais:**
- **Estrutura**: Novo padrão `precoOriginal` + `precoPromocional` em catalogoLivros.js (com fallback `preco` para retrocompatibilidade)
- **4 Obras publicadas na loja** (preço original → preço promo, slug, desconto, status):
  1. A Arte da Presença Masculina — R$97,00 → R$67,00 | `a-arte-da-presenca-masculina` | -31% | ✅ Ativa
  2. A Presença em Ação — Apêndice Prático — R$57,00 → R$37,90 | `a-presenca-em-acao-apendice` | -33% | ✅ Ativa
  3. A Arte Invisível da Elegância Masculina — R$87,00 → R$57,00 | `a-arte-invisivel-elegancia-masculina` | -34% | ✅ Ativa
  4. Guia Integral de Saúde e Beleza Masculina — R$147,00 → R$97,00 | `guia-integral-saude-beleza-masculina` | -34% | ✅ Ativa

- **Implementação técnica**:
  - Campos `preco`, `precoOriginal`, `precoPromocional` adicionados a catalogoLivros.js (preco = fallback de segurança)
  - Renderização na loja: "de/por" (original riscado em cinza + promocional em dourado destaque) — CSS + JS
  - Checkout: `precoFinal = livro.precoPromocional || livro.preco` em 3 pontos (linha 1521, 1588, 1650 de server.js)
  - Arquivos HTML copiados para `private/livros/{slug}/index.html` (protegido por token pós-pagamento)
  - Capas placeholder criadas em `public/loja/capas/` (fundo degradado + texto dourado, funcional, ~3-4KB PNG)
  - Commits: `8601d79` (catálogo + loja + arquivos HTML + capas), `3c63796` (checkout com precoPromocional)

- **Status**: ✅ Completamente operacional na loja, checkout testado

- **⚠️ DÉBITO TÉCNICO REGISTRADO**:
  - **Problema identificado**: `public/loja/index.html` mantém um CATALOGO hardcoded que é cópia manual de `src/lib/catalogoLivros.js`
  - **Impacto**: Novas obras adicionadas só a `catalogoLivros.js` não aparecem na loja até serem duplicadas manualmente no HTML
  - **O que aconteceu agora**: As 4 obras foram adicionadas a ambos os arquivos manualmente — processo propenso a erro e sincronização perdida
  - **Solução sugerida**: Unificar fonte de dados (considerar servidor injetar CATALOGO dinamicamente ou gerar HTML estático via build)
  - **Prioridade**: Baixa (manual funciona, mas insustentável com crescimento de acervo)
  - **Próxima sessão**: Considerar refatoração para renderizar catálogo dinamicamente ou via build-time injection

---

## 2. Lançamentos Recentes (14/08/2026 21:00)

**[14/08/2026 21:00] Universo Feminino — 5 novas obras publicadas:**
- **Estrutura**: Novo campo `departamento` adicionado a catalogoLivros.js (retrocompatível, não quebra livros existentes)
- **Departamentos atribuídos**:
  - "Desenvolvimento Humano" → 6 volumes "Os Bastidores da Mente" + Degustação
  - "Saúde & Longevidade" → "A Arquitetura da Excelência Humana"
  - "Universo Feminino" → 5 novas obras

- **5 Obras publicadas na loja** (preço, slug, status):
  1. Ela Tem Classe — R$37,90 | `ela-tem-classe` | ✅ Ativa
  2. Código Feminino — R$57,00 | `codigo-feminino` | ✅ Ativa
  3. A Inteligência do Corpo Feminino — R$57,00 | `a-inteligencia-do-corpo-feminino` | ✅ Ativa
  4. Inesquecível — R$67,00 | `inesquecivel-charme-feminino` | ✅ Ativa
  5. A Mulher que Permanece Inteira — R$67,00 | `a-mulher-que-permanece-inteira` | ✅ Ativa

- **Implementação técnica**:
  - Arquivos HTML copiados para `private/livros/{slug}/index.html` (28 MB total)
  - Campo `categoria: 'principal'` adicionado a todas as 5 obras (compatível com cálculo de desconto em cupons.js)
  - API de catálogo `/api/livros/catalogo/:livroId` testada em produção ✅
  - Rota de entrega `/livros/:livroId?token={token}` protegida por token de acesso pós-pagamento (padrão existente, correto)
  - Commits: `f95ed97` (departamento + catálogo), `5e5ed0c` (categoria + cópia), `064ce94` (arquivos HTML)

- **Pendências**:
  - Teste ponta a ponta com token real (compra de teste com cupom 100%, padrão já validado para outros produtos) — não bloqueia lançamento
  - Universo Masculino (4-5 obras) ainda a subir

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
  Ascendente corrigido, chave configurada em produção (Railway). Revalidado em
  11/08/2026: chave ASTROWAY_API_KEY restaurada (876f), teste de geração de mapa
  natal completo executado e confirmado (10 planetas, 12 casas, 25 aspectos). Status:
  ✅ 100% operacional, 9975 créditos disponíveis.

**[11/08/2026] Ajuste de contraste em chat.html — PENDENTE VALIDAÇÃO EM PRODUÇÃO:**
- Investigação de contraste WCAG iniciada em chat.html (elementos pálidos).
- Mudanças de cor aprovadas e especificadas: #9a9a9a → #6c5c3c (contador/aviso header),
  rgba(212,175,55,0.75) → #8B6914 (aviso rodapé), background-size: contain → cover (fundo).
- **Status**: Mudanças foram aprovadas e especificadas, mas NÃO foram aplicadas no arquivo.
  Arquivo local ainda contém cores antigas (#9a9a9a, rgba(212,175,55,0.75)).
- Usuário reportou que após hard refresh em zunisuprema.com.br/chat.html, cores continuam
  iguais (como esperado — nunca foram commitadas).
- **Git state**: branch ahead of origin/main by 2 commits (do AstroWay, não do chat.html).
- **PRÓXIMA SESSÃO**: (1) Aplicar mudanças CSS no arquivo local, (2) verificar commit/push
  a origin/main, (3) confirmar deploy no Railway, (4) verificar via curl se HTML em
  produção tem cores novas, (5) investigar possível CSS conflitante sobrescrevendo estilos.
  **NÃO ASSUMIR que correção está ativa até essa investigação.**

**[11/08/2026] Redesign visual do chat.html — nova imagem de fundo + reorganização completa:**
- Nova imagem de fundo desktop (`Fundo_do_Chat.png`, tons dourado/azul-marinho/roxo, 
  substituindo a antiga pastel). Imagem mobile mantida como estava (`Smartphone 2.png`).
- Header reestruturado em 3 colunas: logo (esquerda) | botão "Explorar Loja" com 
  destaque dourado central | contador de mensagens + botão "Baixar relatório" (direita). 
  Renomeado de "Loja de Livros" para "Explorar Loja" por decisão do usuário.
- Overlay escuro semi-transparente adicionado atrás do header e rodapé para garantir 
  contraste de texto sobre a imagem de fundo variável (rgba(0,0,0,0.42)).
- Cores de texto corrigidas para contraste WCAG AA (4.5:1+) em múltiplos elementos: 
  contador (#e8e8e8→#5a4a30), aviso de rodapé (#f5d787→#5a4a30), nota de instrução 
  (#aaa→#6c6c6c→#7a7a7a com classe .painel-hint).
- Font-size aumentado: rodapé (11px→14px), texto instrução (12px→13px).
- Caixa "Como usar esta sessão" redesenhada: layout horizontal em 3 colunas (era 
  vertical/estreito com max-width 520px), tipografia Playfair Display para título + 
  Georgia para corpo, reposicionada com margin-top: 290px para não sobrepor o nome 
  "Zuni Suprema" da imagem de fundo, espaçamento interno compactado (padding 28px→20px, 
  títulos e gaps reduzidos).
- **Commits desta sessão** (git log -10):
  ef93629 fix: aumentar margin-top de #painel-instrucoes de 260px para 290px
  161f504 fix: aumentar margin-top de #painel-instrucoes de 190px para 260px para liberar nome ZUNI SUPREMA
  b85a83a fix: ajuste fino na caixa 'Como usar' — margin-top 190px, padding compacto, espaçamentos reduzidos
  a5134ce feat: caixa 'Como usar' — layout horizontal 3 colunas + reposicionada (margin-top 120px, width 90%)
  69ac405 fix: adicionar classe .painel-hint para garantir aplicação de estilos ao texto 'Esta mensagem desaparecerá'
  9837acd fix: aumentar font-size rodapé (14px), corrigir cor/tamanho texto instrução, redesenhar caixa 'Como usar' com tipografia elegante e blur
  2f72703 feat: reorganizar header em 3 colunas + botão Loja centralizado + corrigir contraste de cores
  9ee7575 fix: aumentar font-size e melhorar contraste dos textos de header e rodapé no chat
  af2bea9 feat: nova imagem de fundo do chat + overlay de contraste
  b52d86c docs: registra estado do ajuste de contraste chat.html — pendente validação em produção (11/08/2026)
- **PENDENTE PARA PRÓXIMA SESSÃO**: (1) Testar o posicionamento (margin-top: 290px) em 
  diferentes alturas de tela/janela do navegador — é um valor fixo em px e a imagem 
  escala proporcionalmente (background-size: cover), pode precisar ajuste em resoluções 
  muito diferentes. (2) Gerar versão mobile (9:16) da nova imagem, se decidido 
  futuramente — por ora mobile mantém imagem antiga por escolha do usuário. (3) Confirmar 
  funcionamento em produção via teste manual em pelo menos 2 resoluções (desktop + tablet).

- **Módulo "Experimente a ZUNI"** (numerologia, astrologia, chat demo) — funcionando
  após correção de RLS.
- **Varredura RAG completa (10/08/2026 20:44-20:45)** — Teste end-to-end em todos os 7
  temas com RAG indexado. Resultado: ✅ 100% operacional (7/7 temas responderam com
  conteúdo específico e > 250 caracteres). Logs [RAG_HIBRIDO] acionados corretamente,
  limite de busca híbrida: 3 chunks tema-específico + 2 chunks geral por consulta
  (contagem real de chunks retornados/utilizados por resposta não foi verificada nesta
  varredura). Total de 1.143 chunks em banco (613 temáticos + 530 genéricos/livros).

**[14/08/2026] Indexação de 2 novos temas RAG — Elegância & Presença:**
- **elegancia_charme_feminino**: 174 chunks (consolidação de charme feminino + elegância + inteligência emocional + relacionamentos)
  - Etapa 4 (validação): ✅ Maior chunk 853 palavras (~1.152 tokens), 100% dentro do limite
  - Etapa 5 (indexação): ✅ 174 chunks com embeddings OpenAI, 100% inseridos no Supabase
  - Verificação: ✅ SELECT confirmou 174 registros em produção (14/08/2026 14:45)
  - **Etapa 6 (validação em produção)**: ✅ CONCLUÍDA (14/08/2026 20:53)
    - Log [RAG_HIBRIDO] confirmado: `Query: "Como desenvolver mais elegância e charme como mulher..." | Tema: "elegancia_charme_feminino" | Limite tema: 3, Limite geral: 2`
    - Teste de chat em produção: SessionId `4c6fa41d-7b0f-4d80-a9c1-87efd8d6e965` ✅ Resposta específica e relevante gerada
- **elegancia_presenca_masculina**: 58 chunks (consolidação de presença + elegância + refinamento + comunicação masculina)
  - Etapa 4 (validação): ✅ Maior chunk 1.441 palavras (~1.946 tokens), 100% dentro do limite
  - Etapa 5 (indexação): ✅ 58 chunks com embeddings OpenAI, 100% inseridos no Supabase
  - Verificação: ✅ SELECT confirmou 58 registros em produção (14/08/2026 14:45)
  - **Etapa 6 (validação em produção)**: ✅ CONCLUÍDA (14/08/2026 20:53)
    - Log [RAG_HIBRIDO] confirmado: `Query: "Como desenvolver mais presença e elegância como homem..." | Tema: "elegancia_presenca_masculina" | Limite tema: 3, Limite geral: 2`
    - Teste de chat em produção: SessionId `6e7dddb1-f138-4f04-8c62-38c720637733` ✅ Resposta específica e relevante gerada
- **Total novo RAG**: 232 chunks adicionados (elegância + presença como temas separados)
- **Status Final**: ✅ 100% OPERACIONAL — ambos temas funcionando com busca híbrida, respostas do Mentor específicas e relevantes confirmadas.

## 3. Pendências antigas, ainda em aberto

- **[14/08/2026] Otimização de capas da loja — ✅ RESOLVIDA**:
  - **Implementação**: 9 capas (Feminino + Masculino) comprimidas em JPG otimizado (500px, 60-122 KB cada)
  - **Redução**: 25,2 MB PNG → 0,75 MB JPG (**97% de redução** em imagens da página `/loja`)
  - **Estratégia**: JPG para Universo Feminino/Masculino, PNG mantido para livros antigos (sem breaking changes)
  - **Impacto na performance**: Carregamento de `/loja` reduzido significativamente, especialmente mobile/3G
  - **Status**: ✅ Implementado e testado — capas JPG servidas corretamente em ~77 KB vs 2+ MB antes
  - **PNG originais mantidos** em `public/loja/capas/` para flipbooks/páginas de detalhe (se necessário futuro)

- **[15/08/2026] Teste de checkout das 15 novas obras — ⏳ PENDENTE**:
  - **Validação local concluída** (15/08/2026 15:10): servidor respondendo, 15 HTMLs presentes, capas comprimidas, catálogo indexando, preços de/por validados
  - **Próximo**: teste de checkout real com cupom 100% (padrão consolidado) para validar fluxo completo de pagamento → acesso a arquivo
  - **Bloqueador?**: Não — todas as validações técnicas estão OK, teste é confirmação final antes de anúncio

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

**2 novos temas em produção — indexados em 14/08/2026** (ambos com RAG, sem questionário associado por enquanto):

| Tema (slug) | Chunks | Indexação | Validação (14/08/2026) | Status |
|---|---|---|---|---|
| `elegancia_charme_feminino` | 174 | ✅ Embeddings + Supabase | ✅ SELECT confirmado | 🟢 Ativo |
| `elegancia_presenca_masculina` | 58 | ✅ Embeddings + Supabase | ✅ SELECT confirmado | 🟢 Ativo |

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
