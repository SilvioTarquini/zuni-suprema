# STATUS ZUNI SUPREMA

> Arquivo de estado vivo do projeto. Atualizado ao final de cada sessão de trabalho
> (chat, Claude Code ou Cowork). Serve como fonte de verdade sobre o que está pronto,
> em andamento e pendente — independente de qual instância do Claude está ajudando.
>
> Última atualização: 19/08/2026 (noite) — Universo Feminino completo: as 5 obras (Ela Tem Classe, Código Feminino, A Inteligência do Corpo Feminino, Inesquecível, A Mulher que Permanece Inteira) têm audiobook ativo em produção. Preço do audiobook generalizado por obra (`precoAudiobook`). Falta apenas teste de pagamento real via webhook e o piloto de recalibração de voz antes do Universo Masculino.

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

## 2. Lançamentos Recentes (18/08/2026 22:15)

**[18/08/2026 22:15] ✅ FASE 1 CONCLUÍDA — Pipeline de Audiolivros 100% Pronto para Produção:**

**Status Final**: 🟢 100% OPERACIONAL — Vol. I com audiolivro definitivo em produção

**O que foi finalizado nesta sessão (após validação auditiva):**

**Melhorias de Qualidade Implementadas:**

1. **Normalização de Maiúsculas** ✅
   - Problema: Palavras inteiramente em MAIÚSCULAS (ZUNI, CÉREBRO, AMÍGDALA) soletradas letra por letra
   - Solução: Função `normalizarMaiusculas()` em audiolivroGenerator.js
   - Detecção: Palavras 2+ caracteres em maiúsculas (incluindo acentuadas: Á, É, Í, Ó, Ú, Ç, Ã, Õ)
   - Conversão: ZUNI → Zuni, CÉREBRO → Cérebro, AMÍGDALA → Amígdala
   - Escopo: Aplicado apenas ao SSML, arquivo-fonte preservado
   - Validação: ✅ Teste de 32s aprovado auditivamente

2. **Suporte a Voz Variável por Departamento** ✅
   - Novo: Mapeamento MAPEAMENTO_VOZ_POR_DEPARTAMENTO em catalogoLivros.js
   - Universo Masculino → pt-BR-Wavenet-B (voz masculina grave)
   - Demais departamentos → pt-BR-Wavenet-A (voz feminina padrão)
   - Função: obterVozPadraoParaDepartamento(departamento) exportada
   - Integração: gerarAudioComAPI() já aceita parâmetro `voz`
   - Validação: ✅ Teste com Wavenet-B (39s) aprovado auditivamente

**Versão Definitiva de Produção — Vol. I (✅ CONCLUÍDA 18/08/2026 22:35):**
- ✅ Gerado com todas as correções (sanitização + normalização + duração real via ffprobe)
- Nome arquivo: `os-bastidores-vol1/os-bastidores-vol1.mp3` (definitivo, sem "-teste")
- Tamanho real: 6.47 MB
- Duração real: 28m16s (via FFmpeg)
- Chunks: 6 (4.3–4.7 KB SSML cada)
- Tempo processamento: 146.7s (24.4s por chunk — pipeline completo: síntese + concat + upload)
- Catálogo: `audiobookDisponivel` marcado `true` ✅
- Ação pós-geração concluída: Atualizado `audiobookUrl` e marcar `audiobookDisponivel: true` ✅
- **URL Pública**: `https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/os-bastidores-vol1/os-bastidores-vol1.mp3`

**Limpeza de Bucket (✅ CONCLUÍDA 18/08/2026 22:36):**
- ✅ Removidos 4/4 arquivos de teste do Supabase Storage:
  - os-bastidores-vol1-teste ✅
  - identidade-autoestima-teste ✅
  - teste-normalizacao-maiusculas ✅
  - teste-voz-masculina ✅
- Script executado: `scripts/limpar-testes-supabase.js` ✅

**Resumo de Testes Realizados (nesta sessão):**
| Teste | Entrada | Saída | Duração | Status |
|---|---|---|---|---|
| Vol. I Inicial | 24.5 KB | 6.65 MB | 28m24s | ✅ Teste piloto |
| Vol. II (Identidade) | 3.7 KB | 1.00 MB | 4m21s | ✅ Generalização |
| Normalização Maiúsculas | 0.4 KB | 0.12 MB | 32s | ✅ Aprovado |
| Voz Masculina (B) | 0.5 KB | 0.15 MB | 39s | ✅ Aprovado |
| Vol. I Produção Final | 24.5 KB | 6.47 MB | 28m16s | ✅ Pronto |

**Scripts Operacionais Desenvolvidos:**
- `src/lib/audiolivroGenerator.js` — Motor de geração (funções normalizarMaiusculas, obterDuracaoMp3)
- `scripts/gerar-audiolivro.js` — CLI generalizável (aceita arquivo + slug)
- `scripts/validar-audiolivro.js` — Validação com ffprobe
- `scripts/criar-bucket-audiolivros.js` — Setup infraestrutura
- `scripts/detectar-padrao-repeticao.js` — Validação de padrões antes de gerar
- `scripts/mapear-sanitizacoes-timeline.js` — Timeline de pausas SSML
- `scripts/mapear-sanitizacoes-arquivo.js` — Auditoria para qualquer arquivo
- `scripts/testar-normalizacao-maiusculas.js` — Teste isolado de maiúsculas
- `scripts/testar-voz-masculina.js` — Teste isolado de voz masculina
- `scripts/limpar-testes-supabase.js` — Limpeza de bucket (now played)

**Decisões de Arquitetura Confirmadas:**
1. 1 arquivo MP3 único por obra (não por capítulo)
2. SSML simplificado (tags <speak></speak> básicos + sanitização)
3. Sanitização automática de sequências repetidas (===> pausa)
4. Normalização de maiúsculas automática
5. Voz por departamento (padrão configurable, sem overhead)
6. Duração calculada via ffprobe (não estimativa)
7. Overhead SSML: 300 bytes (para cobrir Tags + substituições)

**Métricas Finais:**
- Custo por obra: ~$0.0001 (24.559 chars × $0.000004/char)
- Performance: ~16.5s por chunk (síntese + concat + upload)
- Escalabilidade: Testada de 3.7 KB a 24.5 KB
- Qualidade: ✅ Aprovada auditivamente (maiúsculas, voz, pausas naturais)

**Fase 2 — Entrega via Token HMAC (✅ COMPLETA E TESTADA 18/08/2026 23:10):**

**Implementação:**
- ✅ Checkbox "Adicionar audiolivro" no checkout HTML (preço placeholder R$17,90)
- ✅ Endpoints de checkout adaptados para `audiolivroIncluido` (somam preço)
- ✅ Tabela `pedidos_livros_pendentes`: coluna `audiolivro_incluido` adicionada
- ✅ Tabela `acessos_livros`: coluna `tipo_produto` adicionada para diferenciar produtos
- ✅ Criação de token separado para audiolivro (idempotente via `payment_id-audiolivro`)
- ✅ Email de entrega com link de audiolivro (quando incluído)
- ✅ Rota `/audiolivros/:livroId?token=xxxx` com validação completa
- ✅ Redirecionamento para Supabase Storage

**Design Corrigido (descompasso de livroId resolvido):**
- Token armazenado: `livro_id` puro (sem sufixo) + `tipo_produto='audiolivro'`
- Validação: middleware compara `livro_id` + `tipo_produto` corretamente
- Link no email: `/audiolivros/{livroId}?token=xxx` (sem sufixo)
- Fluxo: consistente com PDFs (mesma tabela, mesma validação)

**Teste End-to-End ✅ 100% PASSOU (18/08/2026 23:10):**
```
1. ✅ Token criado com tipo_produto='audiolivro' (validade 7 dias)
2. ✅ GET /audiolivros/{livroId}?token=valid → 302 redirect
3. ✅ Redirect → https://yirxjunmjfnajotcnywc.supabase.co/storage/...
4. ✅ GET sem token → 403 Forbidden
5. ✅ GET token inválido → 403 Forbidden
```

**Decisões Finais:**
- Modelo: Produto separado (checkbox no checkout, +R$17,90)
- Validade: 7 dias (padrão dos PDFs)
- Entrega: 302 redirect para Supabase (sem tracking)
- Armazenamento: tabela `acessos_livros` com `tipo_produto` para diferenciação

**Pendências para Próxima Sessão (19/08/2026):**

**Preço do Audiobook:**
- ✅ Mudança R$17,90 → R$14,90 **APLICADA E EM PRODUÇÃO** (19/08/2026)
  - Commit `728fe8a` (fix: reduzir preço do audiolivro de R$17,90 para R$14,90)
  - Alterado em 4 pontos: `public/checkout-livro.html` (display do checkbox + variável JS) e `src/server.js` (2 endpoints: `/api/checkout/livro/preference` e `/api/checkout/livro`)
  - Push feito para `origin/main` (`40c2a01..728fe8a`) — deploy automático via Railway

**Teste de Pagamento Real:**
- ⏳ Webhook MercadoPago: ainda não foi testado com pagamento real
- ⏳ Necessário: cartão/Pix de terceiro para validar integração completa
- ⏳ O que falta testar: pagamento processado → webhook → token gerado → email enviado → acesso ao audiolivro

**Próximos Audiolivros — 11 Obras Candidatas Levantadas:**

PRIORIDADE 1 - Universo Feminino: Ela Tem Classe (pronto, charme_feminino_relacionamentos.txt, 9.2 KB), Inesquecível (pronto, mesmo arquivo), Código Feminino (arquivo-fonte não confirmado), A Inteligência do Corpo Feminino (arquivo-fonte não confirmado), A Mulher que Permanece Inteira (arquivo-fonte não confirmado).

PRIORIDADE 2 - Universo Masculino: A Arte da Presença Masculina (pronto, presenca_masculina_autoestima_relacionamentos.txt, 9.4 KB), Guia Integral de Saúde e Beleza Masculina (pronto, saude_masculina_integrativa.txt, 10.2 KB), A Presença em Ação — Apêndice (arquivo-fonte não confirmado), A Arte Invisível da Elegância Masculina (arquivo-fonte não confirmado).

PRIORIDADE 3 - Adolescência & Pais: Além do Que Você Vê (pronto, desenvolvimento_humano_adolescencia.txt, 8.7 KB), Além do Que Você Sente (pronto, adolescencia_desenvolvimento_integral.txt, 8.5 KB).

**PENDÊNCIA CRÍTICA — CONFIRMADA em 19/08/2026: os arquivos-fonte marcados "pronto" NÃO são texto integral.**

Verificação feita (leitura completa dos 5 arquivos .txt + comparação com os flipbooks HTML reais):

1. **Os 5 arquivos-fonte "prontos"** (`charme_feminino_relacionamentos.txt`, `presenca_masculina_autoestima_relacionamentos.txt`, `saude_masculina_integrativa.txt`, `desenvolvimento_humano_adolescencia.txt`, `adolescencia_desenvolvimento_integral.txt`) são **documentos RAG para o Mentor IA**, não texto de livro. Todos têm cabeçalho "Documento preparado para banco vetorial" e terminam com seção "PARA A ORIENTAÇÃO ZUNI SUPREMA" (instruções de como o Mentor deve aconselhar clientes) — conteúdo de chatbot, não de audiolivro vendável.

2. **Achado mais grave — o próprio Vol. I já vendido usa a mesma fonte RAG.** O flipbook real de "Os Bastidores da Mente Vol. I" (`private/livros/os-bastidores-da-mente-1-.../index.html`) contém **~17.887 palavras** de prosa integral. O audiolivro pago já em produção (R$14,90, 28m16s, commit `993edef`) foi gerado a partir de `os_bastidores_da_mente_base_mentor.txt` — **apenas ~3.941 palavras (~22% do livro real)**. Ou seja, o "arquivo íntegro de referência" usado como padrão de comparação não é íntegro — é o mesmo tipo de resumo RAG dos outros 5, só que já vendido a clientes reais. **Isso é uma pendência de correção, não só de planejamento futuro.**

3. **Os flipbooks reais das 6 obras "prontas"** existem (`private/livros/{slug}/index.html`, 3.5–14 MB cada) mas são bundles visuais (tipo Canva/SVG), sem texto extraível diretamente — não há forma trivial de puxar a prosa integral deles para gerar áudio. É necessário localizar o manuscrito/fonte original de cada obra (fora de `documentos-zuni/`, que é só base RAG) antes de gerar qualquer audiolivro pago.

4. **As 5 obras "não confirmadas"** (Código Feminino, A Inteligência do Corpo Feminino, A Mulher que Permanece Inteira, A Presença em Ação — Apêndice, A Arte Invisível da Elegância Masculina): busca em `documentos-zuni/` por conteúdo correspondente ao resumo de cada obra no catálogo **não encontrou nenhum arquivo com correspondência clara**. Não há candidato a confundir por nome — a busca por temas (hormonal/sexualidade feminina, inchaço/metabolismo, exercícios/desafio 21 dias, elegância/refinamento masculino) não convergiu em nenhum arquivo dedicado.

**ATUALIZAÇÃO 19/08/2026 — Manuscritos íntegros LOCALIZADOS para todas as 11 obras (Vol. I + 10 candidatas).**

Ação imediata tomada: `audiobookDisponivel: false` para Vol. I aplicado em produção (commit `66e897d`, deploy feito). Verificado no Supabase (`acessos_livros`, `tipo_produto='audiolivro'`): **0 clientes reais compraram** — único registro é o teste E2E interno (`teste@e2e.com`). Sem incidente de cliente afetado.

Busca expandida fora do repositório Git (`C:\Users\Silvio\Documents\1 - Obras Novas\1 - Obras Na Loja\`) encontrou os manuscritos `.docx` originais de todas as 11 obras — pasta espelha exatamente a estrutura dos slugs do catálogo, com `.docx` (manuscrito), `.html` (flipbook visual) e capa lado a lado por obra:

| Obra | Manuscrito `.docx` localizado | Palavras (texto integral) | RAG usado até agora (referência) |
|---|---|---|---|
| **Vol. I — Os Bastidores da Mente** | `Os Bastidores da Mente - 6 Vol/Volume I.../Os Bastidores da Mente.docx` | **23.442** | ~3.941 (22% — audiolivro atual incompleto) |
| Ela Tem Classe | `Flerte Mulheres/Ela Tem Classe.../2 - Elegância Feminina - Revisada e Completa.docx` | 4.373 | RAG genérico não específico p/ esta obra |
| Inesquecível | `Flerte Mulheres/Inesquecível & Arte.../Charme Feminino - Revisada e Completa.docx` | 15.444 | `charme_feminino_relacionamentos.txt` (~1.500) |
| Código Feminino | `Flerte Mulheres/Código Feminino.../Codigo Feminino.docx` | 8.822 | não havia RAG localizado |
| A Inteligência do Corpo Feminino | `Flerte Mulheres/Inteligencia do Corpo.../A Inteligência do Corpo Feminino.docx` | 14.017 | não havia RAG localizado |
| A Mulher que Permanece Inteira | `Flerte Mulheres/Mulher Permanece Inteira.../Mulher Inteira.docx` | 17.663 | não havia RAG localizado |
| A Arte da Presença Masculina | `Flerte Homens/A Arte da Presença Masculina/A Arte da Presença Masculina.docx` | 13.483 | `presenca_masculina_autoestima_relacionamentos.txt` (~1.600) |
| A Presença em Ação — Apêndice | `Flerte Homens/A Presença em Ação/Apêndice - A Presença em Ação.docx` | 1.748 (esperado — é apêndice de exercícios) | não havia RAG localizado |
| A Arte Invisível da Elegância Masculina | `Flerte Homens/A Arte da Elegância Masculina/Arte da Elegância Masculina.docx` | 2.862 | não havia RAG localizado |
| Guia Integral de Saúde e Beleza Masculina | `Flerte Homens/Saúde e Beleza Masculina/Guia Integral Saúde Beleza Masculina.docx` | 6.966 | `saude_masculina_integrativa.txt` (~1.700) |
| Além do Que Você Vê (pais) | `Educação Pais e Adolescentes/Pais/Além do que você vê.docx` | 49.234 (termina "FIM DA OBRA II") | `desenvolvimento_humano_adolescencia.txt` (~1.460) |
| Além do Que Você Sente (adolescentes) | `Educação Pais e Adolescentes/Adolescentes/Além do que você sente.docx` | 57.639 (termina "FIM DA OBRA I") | `adolescencia_desenvolvimento_integral.txt` (~1.430) |

Validação de cada `.docx`: todos abrem com título/subtítulo da obra, muitos com "Sumário" e capítulos numerados, e os de maior porte terminam explicitamente em "FIM DA OBRA". Estrutura de prosa corrida, sem seção de instrução ao Mentor (ausente o padrão RAG "PARA A ORIENTAÇÃO ZUNI SUPREMA").

**Nota**: "Ela Tem Classe" no `.docx` interno se chama "A Arte da Elegância Feminina Moderna" (título de trabalho ≠ título comercial) — confirmado pelo casamento entre nome da pasta, HTML do flipbook (`Ela Tem Classe - Zuni Suprema.html`) e slug do catálogo; não é um arquivo trocado.

**Status**: arquivos-fonte corretos identificados e documentados para as 11 obras.

**ATUALIZAÇÃO 19/08/2026 — Vol. I regenerado e reativado. Pipeline de pausas SSML consolidado (v5).**

**Pipeline de sanitização — versão final validada** (`src/lib/audiolivroGenerator.js`):
- `colapsarLetrasEspacadas()`: nova função, roda antes da normalização de maiúsculas. Corrige branding espaçado manualmente (ex.: "Z U N I S U P R E M A" → "Zuni Suprema"), que o TTS soletrava letra por letra.
- Pausas de parágrafo (`\n{2,}`): migradas de `<break time="600ms"/>` (soou "engasgado/cortado" em teste auditivo) para **`<break strength="medium"/>`** — aprovado após comparação A/B (v3 400ms vs v4 strength=medium). Motor de síntese calibra a pausa organicamente em vez de silêncio cronometrado fixo.
- Separadores/símbolos decorativos (`===`, `✦✧★☆❖`): migrados de `500ms` fixo para **`<break strength="strong"/>`** — testado contra `x-strong`, `strong` escolhido como padrão (ajustável).
- `dividirEmChunks()`: corrigido para estimar o tamanho real do SSML por parágrafo a partir da tag de pausa configurada (não mais `'\n\n'` cru) — bug encontrado durante os testes: chunk de vários parágrafos estourava os 5000 bytes da API porque o custo real da tag (~27+ bytes) não era contabilizado corretamente.
- **⚠️ Calibração feita só na voz feminina (`pt-BR-Wavenet-A`)**. Antes de aplicar em qualquer obra do Universo Masculino (voz `pt-BR-Wavenet-B`), gerar piloto curto nessa voz e validar auditivamente de novo — não assumir que os mesmos valores de `strength` soam igualmente bem.

**Vol. I — regenerado com manuscrito íntegro (19/08/2026):**
- Fonte: `.docx` completo (23.442 palavras / 138.197 caracteres), localizado em `C:\Users\Silvio\Documents\1 - Obras Novas\1 - Obras Na Loja\Os Bastidores da Mente - 6 Vol\Volume I - Os Bastidores\Os Bastidores da Mente.docx` — substitui o resumo RAG usado antes (~22% do conteúdo real).
- 36 chunks, pipeline v5 completo, voz `pt-BR-Wavenet-A`.
- Resultado: 36.06 MB, **2h37m34s** (vs. 28m16s da versão antiga incompleta).
- Upload feito para o mesmo objeto Supabase (`audiolivros/os-bastidores-vol1/os-bastidores-vol1.mp3`), sobrescrevendo o arquivo antigo.
- Validado auditivamente pelo usuário (início/meio/fim) antes da reativação.
- `audiobookDisponivel: true` reaplicado — commit `60071d4`, deploy feito (`66e897d..60071d4`).

**Nota de processo**: a regeneração de produção do Vol. I rodou direto via `gerarAudiolivro()` (upload automático ao Supabase) em vez de gerar localmente primeiro para validação, como foi feito nos pilotos do Apêndice. Não houve problema porque `audiobookDisponivel` permaneceu `false` durante todo o processo (sem venda ativa), mas o padrão correto para os próximos títulos é: gerar local → validar auditivamente → só então rodar `gerarAudiolivro()` com upload.

**Próximo passo autorizado**: nenhum ainda. Aguardando decisão do usuário sobre iniciar produção dos demais 9 títulos (10 candidatas menos o Apêndice já validado em piloto) — com o alerta de recalibração obrigatória para vozes do Universo Masculino.

---

**FECHAMENTO DO CICLO — 19/08/2026 (00:50):**

**O que estava errado e foi corrigido:**
- Áudio pago do Vol. I (R$14,90, já vendido publicamente) estava sendo gerado a partir de um resumo RAG de ~3.941 palavras — cerca de 22% do conteúdo real do livro (23.442 palavras). Um cliente que comprasse receberia uma versão incompleta vendida como obra integral.
- Verificado no Supabase antes de qualquer correção: **0 clientes reais haviam comprado** (só existia 1 registro de teste E2E interno). Sem incidente, correção pré-lançamento.

**O que está pronto agora:**
- ✅ Vol. I regenerado a partir do manuscrito `.docx` completo (23.442 palavras), localizado fora do repositório em `Documents\1 - Obras Novas\1 - Obras Na Loja\Os Bastidores da Mente - 6 Vol\`.
- ✅ Pipeline de sanitização/pausas SSML consolidado e validado auditivamente (voz feminina `pt-BR-Wavenet-A`):
  - Pausa entre parágrafos: `<break strength="medium"/>` (testado contra 600ms fixo, 400ms fixo e strength=medium — strength ganhou por soar mais orgânico).
  - Pausa em separadores/símbolos decorativos (`===`, `✦✧★☆❖`): `<break strength="strong"/>` (testado contra x-strong).
  - Bug de chunking corrigido (estouro de 5000 bytes da API quando o texto tinha muitos parágrafos) — chunking agora estima o tamanho real do SSML, não do texto cru.
  - Nova sanitização para branding com letras espaçadas manualmente (ex.: "Z U N I S U P R E M A").
- ✅ `audiobookDisponivel: true` reaplicado para o Vol. I — validado auditivamente pelo usuário (início/meio/fim) antes da reativação. Commit `60071d4`, deploy em produção.
- ✅ Preço do audiobook ajustado de R$17,90 para R$14,90 em todos os pontos do checkout (commit `728fe8a`).

**O que continua pendente (não bloqueia a venda, mas falta validar):**
- ⏳ **Teste de pagamento real via webhook MercadoPago** para o audiobook — ainda não foi feito nenhum teste ponta a ponta com pagamento de verdade (cartão/Pix real) cobrindo o fluxo audiobook: pagamento → webhook → token gerado → e-mail enviado → acesso liberado ao MP3. O teste E2E existente (`teste@e2e.com`) validou a lógica de token/acesso, não o pagamento real.
- ⏳ Recalibração do pipeline de pausas para voz masculina (`pt-BR-Wavenet-B`) — obrigatória antes de processar qualquer obra do Universo Masculino, não assumir que `strength="medium"/"strong"` soa igual nessa voz.
- ⏳ Produção dos outros 9 títulos candidatos (dos 10 localizados, só o Apêndice foi validado em piloto) — aguardando autorização explícita para começar.

---

**PÓS-FECHAMENTO — 19/08/2026: Selo de audiobook na loja.**

- **Problema identificado**: `audiobookDisponivel` já existia no catálogo e no checkout, mas o card da obra em `public/loja/index.html` não sinalizava a existência do audiobook antes do clique — quem navegava a loja só descobria a opção depois de entrar no checkout.
- **Implementado**: selo `🎧 Audiobook disponível · +R$ 14,90` no card, renderizado condicionalmente a partir do mesmo campo `livro.audiobookDisponivel` já retornado por `/api/livros` (sem nova rota, sem novo dado). Some/aparece automaticamente por obra, sem alterar layout das demais.
- **Validação técnica antes do deploy**: subida local do servidor confirmando que `/api/livros` retorna `audiobookDisponivel: true` só para o Vol. I; nenhuma quebra de sintaxe/layout.
- **Commit**: `39f1b9e` (feat: selo de audiobook no card da loja).
- **Deploy**: confirmado via `railway logs --service zuni-suprema` — container reiniciado limpo, sem erros, servidor respondendo.
- **Validação visual em produção**: confirmada pelo usuário, ao vivo na loja publicada, após o deploy.
- **Status**: ✅ 100% concluído e validado.

**Próximos Passos (Ordem a Decidir):**
1. Confirmar/localizar arquivos-fonte para 3 obras incertas
2. Adicionar `textoFonteParaLeitura` ao catalogoLivros.js para cada obra
3. Gerar audiolivros na ordem decidida (prioridade 1 → 2 → 3)
4. Testar webhook MercadoPago com pagamento real
5. Definir preço final do audiobook (mudar de R$17,90 se necessário)

**Status Vol. I Atualmente:**
- ✅ `audiobookDisponivel: true` (definitiva, pronto para venda)
- ✅ `audiobookUrl` apontando para arquivo de produção (6.47 MB, 28m16s)
- ✅ Checkout: checkbox funcional, preço somado
- ✅ Entrega: token gerado, validado, redirecionado (100% testado)

---

## 2. Lançamentos Recentes (19/08/2026 noite) — Universo Feminino completo (5/5 obras com audiobook)

**Marco**: as 5 obras do departamento "Universo Feminino" têm audiobook ativo em produção, todas validadas auditivamente (início/meio/fim) pelo usuário antes da publicação, seguindo a disciplina consolidada: gerar local → validar → só então subir + ativar no catálogo.

| Obra | Palavras (manuscrito) | Cobertura extração | Duração áudio | Commit de ativação |
|---|---|---|---|---|
| Ela Tem Classe | 4.373 | 93.5% | 29m44s | (sessão anterior) |
| Código Feminino | 8.822 | 96.2% | 65m57s | `6a135d8` |
| A Inteligência do Corpo Feminino | 14.017 | 99.2% | 95m1s | `93225d4` |
| Inesquecível | 15.444 | 98.3% | 105m50s | `93225d4` |
| A Mulher que Permanece Inteira | 17.663 | 97.7% | 124m2s | `81d11c0` |

**Preço generalizado por obra**: campo `precoAudiobook` adicionado a `catalogoLivros.js` (commit `5ec9bac`), substituindo o valor fixo de R$14,90 hardcoded em 3 lugares (`checkout-livro.html` + 2 endpoints de `server.js`, além do endpoint `/api/livros/catalogo/:livroId`). Todas as 5 obras atualmente com `precoAudiobook: 14.90`, mas agora ajustável por obra sem tocar em código.

**Pipeline de extração de texto (`scripts/extrair-texto-docx.js`) testado contra 3 variações reais de manuscrito**:
1. **Heading nativo do Word** (Ela Tem Classe, Código Feminino, A Inteligência do Corpo Feminino, Inesquecível) — Sumário detectado automaticamente via bloco "Sumário" + próximo `<h1-3>`, excisão de faixa (não corte simples do início — necessário porque "Os Bastidores da Mente" tem conteúdo real, a "Apresentação", ANTES do Sumário no manuscrito).
2. **Negrito manual sem heading nativo** (série "Os Bastidores da Mente") — fallback via parágrafo 100% em negrito batendo "CAPÍTULO 1 —".
3. **Listas aninhadas sem heading nenhum** (A Mulher que Permanece Inteira) — script automático não detectou (Sumário chamado "SUMÁRIO OFICIAL", capítulos em `<ul><li><ul><li>` em vez de heading, "Capítulo N:" com dois-pontos em vez de "—"). Tratado manualmente: cobertura calculada do mesmo jeito (97.7%), 39/39 capítulos confirmados sem lacunas antes de gerar áudio. **Não foi generalizado no script** — três convenções diferentes já cobertas é o suficiente por ora; um quarto formato deve ser tratado caso a caso, não forçado em heurística única.

**Bug encontrado e corrigido nesta sessão** (nunca afetou áudio de produção): a primeira versão do `extrair-texto-docx.js` só capturava `<p>`/`<h1-3>`, descartando `<ul>`/`<ol>`/`<table>` — teria cortado ~22% de "Os Bastidores da Mente" (209 itens de lista + 1 tabela) se usado para gerar produção. Corrigido antes de qualquer uso real; o áudio de Vol. I já vendido usou extração de texto puro (sem essa falha). Checagem de cobertura (`extrair-texto-docx.js` compara contra `mammoth.extractRawText`) ficou permanente no script como rede de segurança contra regressão futura.

**Vol. I — decisão registrada**: o Sumário (1m26s) continua sendo lido em voz alta no áudio já vendido. Confirmado por escuta pelo usuário. Decisão explícita: não é prioridade de correção — incômodo de escuta, não perda de conteúdo. Não regenerar sem pedido explícito.

**Piloto de recalibração de voz masculina — ✅ CONCLUÍDO E APROVADO (19/08/2026 noite)**: piloto de 1m20s gerado com `pt-BR-Wavenet-B` usando os mesmos parâmetros de pausa já validados na voz feminina (`strength="medium"` entre parágrafos, `strength="strong"` em separadores decorativos ===/✦✧★☆❖). Aprovado sem necessidade de ajuste — calibração generaliza para as duas vozes. Universo Masculino liberado para produção.

---

## 2. Lançamentos Recentes (18/08/2026 19:45)

**[18/08/2026 19:45] ✅ PIPELINE DE AUDIOLIVROS PAGOS — Teste Piloto Concluído:**

**Status Final**: 🟢 100% OPERACIONAL — Produção e armazenamento funcionando

**O que foi construído:**

**1. Módulo de Geração Completo (`src/lib/audiolivroGenerator.js`):**
- ✅ Função `dividirEmChunks()` — chunking inteligente respeitando limite 5000 bytes (com overhead SSML)
- ✅ Função `gerarSSML()` — SSML simplificado (<speak> tags básicos)
- ✅ Função `gerarAudioComAPI()` — chamada à Google Cloud Text-to-Speech (pt-BR-Wavenet-A)
- ✅ Função `concatenarComFFmpeg()` — merge de múltiplos MP3 em arquivo único
- ✅ Função `uploadParaSupabase()` — upload para bucket `audiolivros` no Supabase Storage
- ✅ Função `gerarAudiolivro()` — orquestração completa do pipeline

**2. Dependências Instaladas:**
- ✅ `@google-cloud/text-to-speech` — SDK Google Cloud Text-to-Speech
- ✅ `fluent-ffmpeg` — wrapper Node.js para FFmpeg
- ✅ `ffmpeg-static` + `ffprobe-static` — binários bundlados

**3. Infraestrutura Supabase:**
- ✅ Bucket `audiolivros` criado (público, MIME type audio/mpeg)
- ✅ Política de acesso verificada (público, sem RLS no bucket)

**4. Teste Piloto — "Os Bastidores da Mente Vol. I":**
- Entrada: 24.559 caracteres (~3.941 palavras), texto-fonte de `/documentos-zuni/os_bastidores_da_mente_base_mentor.txt`
- Chunking: 6 chunks (4.6–4.9 KB cada com SSML, respeitando limite 5000 bytes)
- Síntese: ✅ Todos os 6 chunks sintetizados pela API Google Cloud
  - Chunk 1: 4.557 chars → 2.68 MB MP3
  - Chunk 2: 4.804 chars → 2.78 MB MP3
  - Chunk 3: 4.813 chars → 2.66 MB MP3
  - Chunk 4: 4.453 chars → 2.54 MB MP3
  - Chunk 5: 4.530 chars → 2.54 MB MP3
  - Chunk 6: 1.391 chars → 0.74 MB MP3
- Concatenação: ✅ FFmpeg merge bem-sucedido
- Saída final: **6.65 MB MP3 único, ~158 segundos (~2m38s)**
- Upload: ✅ Para `audiolivros/os-bastidores-vol1-teste/os-bastidores-vol1-teste.mp3`
- URL Pública: `https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/os-bastidores-vol1-teste/os-bastidores-vol1-teste.mp3`

**5. Performance e Custo:**
- Tempo total: **104.6 segundos** (1m44s)
  - Tempo por chunk síntese: ~17.4s (inclui latência da API)
  - Concatenação: ~5s
  - Upload: ~10s
- **Custo estimado**: 24.559 caracteres × $0.000004/char (Google Cloud TTS) ≈ $0.000098 (menos de 1 centavo)
- Escalabilidade: Obra de 500 KB levaria ~20 min, obra de 1 MB levaria ~40 min

**6. Integração com Catálogo:**
- ✅ Campos novos adicionados a `catalogoLivros.js`:
  - `audiobookUrl`: URL pública do arquivo MP3
  - `audiobookDisponivel`: boolean para ativar/desativar audiobook por obra
- ✅ Vol. I agora contém:
  ```
  audiobookUrl: 'https://yirxjunmjfnajotcnywc.supabase.co/storage/v1/object/public/audiolivros/os-bastidores-vol1-teste/os-bastidores-vol1-teste.mp3',
  audiobookDisponivel: true
  ```

**7. Scripts de Suporte:**
- ✅ `scripts/gerar-audiolivro-piloto.js` — teste com Vol. I
- ✅ `scripts/criar-bucket-audiolivros.js` — setup do bucket
- ✅ `scripts/validar-audiolivro.js` — download e validação de arquivo gerado

**Validação Técnica:**
- ✅ Autenticação Google Cloud via ADC (Application Default Credentials)
- ✅ SSML dentro do limite 5000 bytes (4.6–4.9 KB observados)
- ✅ FFmpeg concatenação sem erros
- ✅ Upload Supabase bem-sucedido
- ✅ URL pública acessível (200 OK)
- ✅ Arquivo MP3 válido (metadados legíveis)

**Decisões Registradas:**
1. **1 arquivo único vs. múltiplos**: Escolhido 1 MP3 por obra para simplificar entrega e gerenciamento
2. **SSML simples**: Tags <speak></speak> apenas, sem prosódia sofisticada (mantém arquivo menor)
3. **Voz Wavenet-A**: Testada, natural, português pt-BR nativo
4. **MP3 vs. WAV**: MP3 (6.65 MB vs. ~30 MB WAV) — qualidade audível mantida
5. **Entrega**: Não integrada ao checkout NESTA FASE (pendência intencional)

**Próximos Passos (PENDENTES — Fase 2):**
1. Entrega via token HMAC no checkout (similar ao PDF dos flipbooks)
2. Teste real de pagamento com audiobook incluído na compra
3. E-mail/WhatsApp de entrega com link de download
4. Estender pipeline a outras 5 obras piloto (testar escalabilidade)
5. Monitorar custo real em produção (chargebacks, quotas Google Cloud)

**Commit**: Pendente — aguardando aprovação de próximas etapas

---

## 2. Lançamentos Recentes (18/08/2026 17:30)

**[18/08/2026 17:30] ✅ CONCLUSÃO — Generalização de leitura por voz + Push para Produção + Segurança:**

**Status Final**: 🟢 100% OPERACIONAL EM PRODUÇÃO

**O que foi concluído nesta sessão:**

**Tarefa Principal — Generalizar Leitura por Voz:**
- ✅ 5 passos implementados e validados (unificar catálogo, campo de texto-fonte, componentizar leitor, renderização condicional, validações)
- ✅ 4 validações técnicas realizadas (catálogo, arquivo, injeção, componente)
- ✅ Estrutura pronta para expandir a qualquer obra via `textoFonteParaLeitura`
- ✅ Compatível com 39 obras do catálogo, sem breaking changes

**Push para Produção:**
- ✅ 4 commits enviados com sucesso para GitHub (e532d98, 414fad0, 64b1257, 06f7582)
- ✅ GitHub secret-scanning desbloqueado
- ✅ Secrets hardcoded removidos do histórico

**Segurança e Credenciais:**
- ✅ SUPABASE_KEY rotacionada (chave ANTIGA: `sb_secret_ccnCiDVYGz...`, chave NOVA: `sb_secret_3XyWR4g5L...`)
- ✅ .env local atualizado com chave NOVA
- ✅ Railway sincronizado com chave NOVA
- ✅ Conexão Supabase testada e validada com chave NOVA
- ✅ Chave ANTIGA removida de todos os arquivos de código
- ✅ .env protegido no .gitignore

**Resultado**:
- 🟢 Código em produção
- 🟢 Credenciais seguras (chave NOVA + antiga rotacionada)
- 🟢 Railway sincronizado
- 🟢 Próximo deploy levará recurso automaticamente para produção

---

**[18/08/2026 16:30] Generalização de leitura por voz (Web Speech API) para todas as obras:**

**Problema resolvido**: Recurso de leitura em voz alta estava hardcoded apenas para os 6 volumes de "Os Bastidores da Mente". Impossível adicionar a qualquer outra obra sem copiar código específico para cada flipbook.

**Solução implementada** (5 etapas completadas):

**1. Unificar catálogo:**
  - ✅ Adicionada rota `/api/livros` que retorna catálogo completo dinamicamente (Nova rota em server.js:1516)
  - ✅ Migrado `public/loja/index.html` para consumir catálogo via fetch (`/api/livros`)
  - ✅ Eliminada duplicação: catálogo hardcoded removido do HTML (era mantido em 2 locais)
  - ✅ HTML renderiza dinamicamente — qualquer novo livro em catalogoLivros.js aparece automaticamente na loja

**2. Adicionar campo de texto-fonte:**
  - ✅ Campo `textoFonteParaLeitura` adicionado a catalogoLivros.js (linha 18-19, 24-25, 34-35, 42-43, 50-51, 58-59)
  - ✅ Preenchido para os 6 volumes de "Os Bastidores da Mente": `/documentos-zuni/os_bastidores_da_mente_base_mentor.txt`
  - ✅ Reutiliza arquivo consolidado (não duplica conteúdo) — mesmo arquivo serve para leitura e RAG

**3. Componentizar leitor Web Speech API:**
  - ✅ Classe `LeitorDeVoz` refatorada (public/leitor-voz.js linhas 7-196)
  - ✅ Novo: aceita `textoFonte` como parâmetro (não depende de `.conteudo-livro`)
  - ✅ Novo: modo texto livre (`iniciarLeitura(texto, botao)`) além do modo seções legado
  - ✅ Novo: callbacks `onIniciar`/`onFinalizar` para integração com UI
  - ✅ Novo: métodos públicos `estaFalando()` e `estaPausado()` para queries de estado
  - ✅ Backward-compatible: modo seções (headings) continua funcionando para flipbooks antigos

**4. Renderização condicional automática:**
  - ✅ Rota `/livros/:livroId` agora inspeciona `textoFonteParaLeitura` (src/routes/livros.js linhas 65-115)
  - ✅ Se preenchido, injeta dinamicamente botão "🔊 Ouvir Livro Completo" (não modifica arquivos de livro)
  - ✅ Botão renderizado automaticamente: novo livro + campo preenchido = recurso ativado sem código extra
  - ✅ Fetch remoto do texto: não duplica conteúdo em cada flipbook

**5. Estrutura pronta para validação:**
  - ✅ Compatível com 39 obras do catálogo (todos os livros existentes)
  - ✅ Sem breaking changes: volumes antigos continuam funcionando
  - ✅ Fácil expansão: adicionar `textoFonteParaLeitura` a qualquer obra ativa o recurso

**Tecnicalidades:**
  - Injeção dinâmica de script no HTML (inline, sem modificação de arquivo)
  - Fetch local do arquivo de texto (reutiliza arquivo existente)
  - Fallback elegante: botão não aparece se `textoFonteParaLeitura` não preenchido
  - Compatibilidade cross-browser: Web Speech API (suporta ~95% dos navegadores modernos)

**Commit**: `29e1a1c` (feat: generalizar leitura por voz para todas as obras)

**Próximos passos (se necessário):**
1. Validar em produção: testar 3+ obras (Volume I Bastidores, uma obra do Universo Feminino, uma do Executive)
2. Monitorar se botão "Ouvir" aparece corretamente em obras com `textoFonteParaLeitura` preenchido
3. Coletar feedback sobre velocidade/qualidade de síntese de voz (ajustável via `utterance.rate`)
4. Audiobook pago (WaveNet/Google Cloud): requer credencial de serviço — depende de aprovação/orçamento

---

## 2. Lançamentos Recentes (18/08/2026 13:00)

**[18/08/2026 13:00] Livro "CONSEQUÊNCIAS — Edição Essencial" publicado + 2 temas RAG indexados:**

**1 Nova Obra publicada na loja:**
- **Consequências — Edição Essencial** — R$37,90 | `consequencias-edicao-essencial` | Saúde Integrativa | ✅ Ativa
  - Capa: JPEG comprimida (120 KB, padrão consolidado)
  - Flipbook: HTML self-contained (1.5 MB, pronto para acesso pós-pagamento)
  - Sinopse: Reescrita com base em arquivo .md real da obra (não genérica)
    - Resumo: "O intervalo entre a decisão de hoje e a consequência de amanhã — como reconhecer, a tempo, os pontos onde ainda é possível interromper a cascata que silenciosamente constrói a trajetória."
    - Descrição: Cobre 40 capítulos em 5 partes sobre hábitos, preço adiado, compensação do corpo e oportunidades de mudança.
  - Departamento: Saúde Integrativa (consolidado com outras 7 obras do departamento)
  - Status: ✅ 100% operacional — API, loja, catálogo e flipbook testados

- **Implementação técnica**:
  - Triagem do arquivo .md completada (sem resíduos de conversa com IA detectados)
  - Sinopse & descrição extraídas do conteúdo real (2-3 frases de gancho + parágrafo completo)
  - Entrada adicionada a `catalogoLivros.js` (slug, preço, departamento, capa, sinopse, descrição)
  - Catálogo duplicado em `public/loja/index.html` atualizado (sincronização manual)
  - Array `novasObras` atualizado para destaque (resolução automática de .jpg)
  - Deploy validado: API retorna metadados corretos, loja renderiza obra corretamente
  - Commit: `d455e95` (docs: reescrever sinopse e descrição com base em conteúdo real)

**2 Novos temas RAG indexados:**

| Tema | Chunks | Blocos | Validação | Status |
|---|---|---|---|---|
| `cabala_astrologia_numerologia_integrativa` | 25 | 25 temas estruturados | ✅ Contagem real: 25 chunks, IDs verificados | 🟢 Ativo |
| `consequencias_causa_efeito` | 12 | 5 blocos + 7 sub-chunks | ✅ Contagem real: 12 chunks, sem duplicação | 🟢 Ativo |

- **Detalhes da indexação**:
  - **cabala_astrologia_numerologia_integrativa** (71 KB, ~8000 palavras):
    - Cobertura: 18 temas principais incluindo Sephiroth, Pilares, Mundos, Caminhos, Números 1-9, Números Mestres, Signos, Planetas, Casas, Aspectos, Temperamentos, Psicologia Profunda, Ética Interpretativa
    - Sub-chunking: Não necessário (blocos bem dimensionados)
    - Triagem: ✅ Sem resíduos de IA, totalmente coerente
    - Verificação pós-indexação: ✅ SELECT confirmou 25 registros em Supabase, IDs únicos, títulos corretos

  - **consequencias_causa_efeito** (174 KB, ~20000 palavras):
    - Cobertura: Parte I (6 capítulos sobre acúmulo, preço adiado, normalização) + Parte II (11+ capítulos sobre hábitos: sedentarismo, alimentação, água, sono, estresse, tabaco, álcool, drogas, automedicação, prazer/compulsão)
    - Sub-chunking: ✅ 7 sub-chunks automáticos gerados (blocos >2500 palavras divididos por frase)
    - Triagem: ✅ Sem resíduos de IA, texto didático e coerente
    - Verificação pós-indexação: ✅ SELECT confirmou 12 registros em Supabase, distribuição de partes verificada (Parte I: 2 chunks, Parte II: 10 chunks)

- **Proteção contra duplicação verificada**:
  - ✅ Código de indexarTema.js contém `delete().eq('tema', tema)` ANTES de INSERT (linha 243)
  - ✅ Teste: Ambos temas indexados 1x, contagem final exata (não duplicada)
  - ⚠️ **Débito técnico identificado**: Sem aviso/confirmação antes de sobrescrever um tema já existente
    - Risco: Baixo (delete é silencioso, mas seguro)
    - Opção A (recomendada): Adicionar warning antes de sobrescrever (5 linhas de código)
    - Opção B: Flag `--force` explícita (mais seguro, mais verboso)
    - **Decisão**: Registrado como débito técnico baixo — considerar proteção em refactor futuro

- **Total novo RAG**: 37 chunks adicionados (25 + 12)
- **Status final**: ✅ 100% OPERACIONAL — ambos temas disponíveis para busca híbrida do Mentor
- **Commit**: `2c49010` (docs: indexar dois novos temas na base RAG do Mentor ZUNI)

---

## 2. Lançamentos Recentes (17/08/2026 14:30)

**[17/08/2026 14:30] 5 Novas Obras — Lote "Subir para a loja" (Desenvolvimento & Comportamento + novo Negócios & Tecnologia):**

**Estrutura**: Padrão consolidado: HTMLs flipbooks + capas JPEG comprimidas + preços de/por (promoção de lançamento)

**2 departamentos, 5 obras publicadas:**

**Desenvolvimento & Comportamento (3 obras — extensão do departamento existente):**
  1. Além do Que Você Vê (guia para pais/responsáveis de adolescentes, série "Bastidores da Mente" Obra II) — R$77,90 → R$47,90 | `alem-do-que-voce-ve` | ✅ Ativa
  2. Além do Que Você Sente (guia para adolescentes, série "Bastidores da Mente" Obra I, par da obra acima) — R$77,90 → R$47,90 | `alem-do-que-voce-sente` | ✅ Ativa
  3. O Caminho da Consciência (desenvolvimento humano/cosmologia esotérica) — R$87,90 → R$57,90 | `o-caminho-da-consciencia` | ✅ Ativa

**Negócios & Tecnologia (2 obras — novo departamento):**
  4. Inteligência Artificial — Volume 1 (fundamentos, para negócios) — R$87,90 → R$57,90 | `inteligencia-artificial-volume-1` | ✅ Ativa
  5. Empresas Inteligentes — Volume 2 (aplicação prática, sequência do Vol. 1) — R$87,90 → R$57,90 | `empresas-inteligentes-volume-2` | ✅ Ativa

- **Implementação técnica**:
  - 5 entradas novas adicionadas a `catalogoLivros.js` com campos `precoOriginal` + `precoPromocional` + `departamento`
  - CATALOGO em `public/loja/index.html` atualizado com 5 novas obras
  - Array `novasObras` em `public/loja/index.html` atualizado (resolução automática de extensão .jpg para capas)
  - HTMLs flipbooks copiados para `private/livros/{slug}/index.html` (5 pastas novas)
  - Capas JPEG copiadas para `public/loja/capas/{slug}.jpg` (formato .jpg, padrão das novas obras)
  - Commit: `5aa87b8` (feat: integrar 5 novas obras na loja ZUNI Suprema)

- **Status**: ✅ 100% Operacional — todas as validações concluídas (17/08/2026 14:30)
  - ✅ Servidor local respondendo (porta 3000)
  - ✅ 5 HTMLs flipbooks presentes e acessíveis
  - ✅ 5 capas JPEG comprimidas presentes
  - ✅ Catálogo Node.js indexando corretamente todas as 5 obras
  - ✅ Preços de/por validados: R$77,90 → R$47,90 e R$87,90 → R$57,90
  - ✅ Novos departamentos classificados corretamente (Desenvolvimento & Comportamento, Negócios & Tecnologia)

- **Nota de conteúdo**:
  - As duas obras da série "Bastidores da Mente" (pais e adolescentes — "Além do Que Você Vê" e "Além do Que Você Sente") tratam de temas sensíveis de forma responsável e protetiva: controle em relacionamentos, ciúme, pressão por imagens íntimas, com orientação explícita para buscar adulto de confiança nos pontos que exigem.
  - Conteúdo revisado antes da publicação.
  - **Pendência editorial (não bloqueia produção)**: Avaliar se a página de produto dessas duas obras precisa de aviso de faixa etária/parental — decisão editorial, não técnica.

- **Nota técnica**:
  - Um arquivo HTML anterior de "Além do Que Você Sente" estava corrompido (dependia de módulo JS externo `pages-adolescentes.js` não exportado). Foi refeito e resubido com sucesso nesta sessão.

- **Resumo de expansão do catálogo**:
  - Catálogo geral agora tem **4 departamentos além dos originais**: Executive, Desenvolvimento & Comportamento, Saúde Integrativa, Negócios & Tecnologia
  - **Total de 20 obras novas publicadas nas últimas 2 sessões**: 15 do primeiro grande lote (15/08) + 5 deste (17/08)
  - Departamento "Desenvolvimento & Comportamento" expandido de 6 para 9 obras
  - Departamento "Negócios & Tecnologia" criado (novo, 2 obras)

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

- **[15/08/2026] Testes de checkout das 15 novas obras — ⏳ PARCIALMENTE VALIDADO**:
  
  **Teste 1 — Local com simulação (15/08/2026 15:15):**
  - ✅ Obra encontrada no catálogo (catalogoLivros.js)
  - ✅ Preço promocional aplicado corretamente (R$47,90)
  - ✅ HTML flipbook presente e acessível (4.20 MB)
  - ✅ Capa JPEG comprimida presente (332 KB)
  - ✅ Requisição POST a `/api/checkout/livro` processada
  - ✅ Preços validados (de/por funcionando)
  
  **Teste 2 — Em produção com cupom TEST100 (15/08/2026 15:20):**
  - Obra testada: "O Elo Invisível" (R$47,90)
  - Cupom utilizado: TEST100 (100% desconto, existente no banco)
  - ✅ Cupom validado e aplicado (desconto 100% = R$0,00)
  - ❌ MercadoPago rejeita pedidos de R$0,00 (limitação esperada)
  - **Limitação identificada**: Cupom 100% não pode ser processado via MercadoPago (valor zero não é aceito)
  - **Solução**: Teste real de pagamento requer cupom com desconto parcial OU pagamento com valor > R$0,00
  
  **Status final:**
  - ✅ Fluxo de checkout funciona (até o ponto do MercadoPago)
  - ✅ Cálculo de preço com cupom funciona
  - ❌ **PENDENTE: Validação real de pagamento com valor > R$0,00** (com cartão/Pix real ou cupom parcial)
  - ❌ **PENDENTE: Validação de liberação de acesso ao flipbook pós-pagamento**
  - ❌ **PENDENTE: Validação de e-mail/WhatsApp de entrega**
  
  **Nota importante**: Este teste valida a lógica de checkout e cálculo de preço, mas **NÃO valida a integração real com gateway de pagamento** (processamento de pagamento, webhook de confirmação, liberação de acesso), pois cupom 100% pula a etapa de pagamento no MercadoPago.

- **[15/08/2026] Validação real de pagamento das 15 novas obras — ⏳ PENDENTE (não-bloqueador)**:
  - **Motivo da pausa**: MercadoPago não permite que o mesmo titular da conta seja simultaneamente comprador e vendedor. Precisa-se de cartão/Pix de uma **pessoa diferente** para rodar o teste real.
  - **Status da pendência**: Ainda aberta, mas **NÃO é bloqueador técnico** — é questão de disponibilidade de meio de pagamento de terceiro. Todo o resto (integração, catálogo, preços, checkout) já está 100% validado.
  - **O que falta validar** (quando houver cartão/Pix de terceiro):
    1. Pagamento processado com sucesso no MercadoPago (com valor > R$0,00)
    2. Webhook de confirmação dispara corretamente
    3. Acesso ao HTML do flipbook liberado após confirmação
    4. E-mail com link de acesso chega corretamente
    5. WhatsApp de entrega é disparado (se configurado)
  - **Obra a testar**: "O Elo Invisível" (R$47,90) — checkout em https://www.zunisuprema.com.br/loja/
  - **Próximo passo**: Quando cartão/Pix de terceiro estiver disponível, fazer 1 compra real em produção, validar fluxo end-to-end, confirmar resultado
  - **Nota importante**: Tudo o mais (integração técnica das 15 obras, catálogo, preços, arquivos, fluxo de checkout até a etapa de pagamento) já foi validado e testado em local + produção. Quando retomarmos, será apenas a confirmação final do pagamento e entrega.

- Teste de responsividade mobile (checkout → chat → relatório → WhatsApp) no
  celular real.
- Domínio raiz `zunisuprema.com.br` (sem www) ainda não resolve — solução definitiva
  é migrar nameservers para Cloudflare (não urgente).
- `www.zunisuprema.com.br` abrindo `checkout.html` na raiz em vez da landing page —
  investigar rota/index no `server.js`.
- Banner discreto na 8ª troca da sessão avulsa (oferecendo Sessões Extras, Mapa
  Integrado, obras) — planejado, não implementado.
- **Audiobook pago (Google Cloud WaveNet)**: estrutura de leitura por voz generalizada pronta. Aguarda: (1) credencial de serviço do Google Cloud, (2) aprovação de orçamento para custos de síntese premium.

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
