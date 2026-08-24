# RADAR DE OPORTUNIDADES — ZUNI SUPREMA

**Última atualização:** 20 de agosto de 2026
**Status:** registro estratégico. Nada aqui é para execução imediata.
**Janela de ativação prevista:** ~30 de agosto de 2026, após conclusão da estruturação em curso.

> Documento irmão do `STATUS_ZUNI.md`. Enquanto o `STATUS_ZUNI.md` registra **o que
> está feito e o que está pendente**, este arquivo registra **o que pode ser feito** —
> o horizonte de oportunidades validado por referência de mercado. Quando um item deste
> radar entrar em execução, ele deve ser movido para o `STATUS_ZUNI.md` e removido (ou
> marcado como migrado) daqui, para que os dois arquivos não divirjam.

---

## 0. Pré-condições que bloqueiam todo o resto

Nenhum item deste radar tem valor antes destes três. Registrado explicitamente para
evitar que o entusiasmo com o horizonte adie o gargalo real.

| # | Bloqueio | Por que bloqueia |
|---|----------|------------------|
| 1 | Teste de pagamento real com terceiro | Sem isso não há receita, e sem receita nenhuma hipótese deste documento é testável |
| 2 | Responsividade mobile não testada | O público-alvo destes produtos é majoritariamente mobile; tráfego pago em site quebrado é dinheiro queimado |
| 3 | Conversão provada em **um** produto | Validar Mapa do Amor com verba mínima antes de multiplicar catálogo |

**Princípio de sequenciamento:** validar antes de multiplicar. O risco atual do projeto
não é falta de ideias nem falta de conteúdo — é excesso de catálogo não validado.

---

## 1. Referências internacionais — o que já foi provado

### Astrotalk (Índia)
- Receita FY25 de Rs 1.214 crore, **+85% ano contra ano**.
- **~90% da receita vem de consultas ao vivo pagas por minuto.**
- Também opera cursos pagos, e-commerce de itens rituais e transmissões ao vivo.

**Lição aplicável:** conteúdo é isca, consulta é produto. O Mentor + Sessões Extras já
são a peça certa; a loja de e-books é o funil de entrada, não o negócio.

### Nebula / OBRIO (Ucrânia)
- Modelo híbrido: IA + astrólogos humanos reais no mesmo app.
- **+340% de engajamento após o lançamento do chat de IA.**
- Camada social/comunitária como diferencial.

**Lição aplicável:** a camada humana não compete com a IA — ela precifica acima dela.
Marketplace de consultores humanos sobre a base de IA é etapa futura viável.

### Co-Star (EUA)
- ~20 milhões de downloads; público Gen Z.
- Motor viral = **compatibilidade social**: adicionar amigos e ver sinastria gratuitamente.

**Lição aplicável:** cada usuário traz outro usuário para fornecer os próprios dados de
nascimento. Aquisição orgânica embutida no produto.

### CHANI (EUA)
- App de astrologia de **maior faturamento nos EUA no 1º trimestre de 2026**.
- Marca autoral forte + posicionamento ético e anti-tóxico + assinatura.

**Lição aplicável:** é a referência mais próxima da filosofia anti-manipulação da ZUNI.
Prova que posicionamento ético no topo de mercado é comercialmente superior, não inferior.

### The Pattern (EUA)
- Enquadramento em **psicologia profunda**, não em zodíaco.
- Vende para público que rejeitaria explicitamente "astrologia".

**Lição aplicável — possivelmente a mais importante do documento:** o repertório
junguiano/psicanalítico permite desesoterizar a linguagem e ampliar o público em ordem
de grandeza, sem alterar o conteúdo interpretativo.

### Melooha (Índia)
- Astrologia como **SaaS**; adquiriu a Munitalks para reforçar IA multilíngue.
- Vende o motor, não a leitura.

**Lição aplicável:** modelo direto para o white-label B2B2C (seção 4).

### AstroSage / GaneshaSpeaks (Índia)
- Idiomas regionais + versões de baixa banda para cidades tier 2 e 3.

**Lição aplicável:** equivalente brasileiro é interior + WhatsApp-first + baixo consumo
de dados.

### Contexto de mercado — Brasil
- Categoria Esoterismo e Ocultismo: **~+40% no Mercado Livre em 2025** (Nubimetrics).
- Varejo religioso e espiritual brasileiro: **R$ 21,5 bilhões/ano**.
- **Runas: ~+80% em um ano, com apenas ~10% dos vendedores Platinum** — demanda alta,
  concorrência qualificada baixa.
- Wellness espiritual no Brasil: ~US$ 56 mi (2023) → projeção de >US$ 140 mi até 2030
  (Grand View Research).
- Concorrentes incumbentes a monitorar: Personare, Astrolink, Astrocentro, iQuilibrio.

---

## 2. Agregar valor ao que já existe (custo marginal ~zero)

### 2.1 Livro Vivo
Cada e-book vendido entrega, junto ao PDF e ao token HMAC, uma sessão de Mentor
**restrita ao RAG daquela obra**. O livro passa a ser conversável.

- Reaproveita: token HMAC (7 dias), bases RAG já indexadas, Mentor existente.
- A construir: mapeamento `livroId → tema RAG` + escopo de sessão restrita.
- Efeito: reposiciona "PDF de R$29" como "obra com mentor acoplado".
- Nenhum concorrente brasileiro oferece isso hoje.

### 2.2 Audiobook em duas vozes (formato diálogo)
Usar `pt-BR-Wavenet-A` (feminina) e `pt-BR-Wavenet-B` (masculina) já configuradas para
gerar capítulos densos como **diálogo mentor/aprendiz** em vez de narração linear.

- Retenção muito superior à prosa narrada.
- Custo marginal zero — mesma cota gratuita do Google Cloud TTS.
- Exige camada de reescrita do texto em turnos (lote via Claude Code).
- Depende de: revalidação do padrão SSML na voz masculina (pendência já registrada).

### 2.3 Entrega serializada
Substituir o despejo integral por 14–21 doses via e-mail/WhatsApp, cada uma com um
prompt de aplicação prática.

- Taxa de conclusão sobe; quem conclui recompra.
- Reaproveita a infraestrutura de entrega existente + cron.

### 2.4 Três profundidades da mesma obra
Versões **Essencial / Completa / Iniciática** do mesmo manuscrito. Um conteúdo, três
produtos, três faixas de preço. As bases RAG já permitem gerar as reduções.

### 2.5 Questionário pós-checkout como produto
Hoje é apêndice. Se ao final gerar um **dossiê personalizado** cruzando respostas +
mapa + RAG, torna-se o pico de valor percebido da jornada e o gancho natural do upsell.

- Reaproveita: 50+ questionários já gerados, schema `respostas_questionario`,
  `catalogoQuestionarios.js`.

---

## 3. Motor astrológico próprio (decisão registrada)

**Decisão do usuário (20/08/2026):** o AstroWay serve apenas para cálculo; um sistema
próprio e autônomo é superior.

### Justificativa estratégica
Hoje o cálculo central de **todos** os produtos de astrologia depende de terceiro. Isso
é risco de negócio, não apenas custo:
- Dependência de disponibilidade e política de preços de terceiro.
- Teto de 5 créditos por mapa / ~10.000 por mês.
- Impede produtos de alto volume (calculadoras gratuitas, sinastria social gratuita,
  boletins mensais automatizados para toda a base de assinantes).

### Caminho técnico
- **Swiss Ephemeris** via pacote `swisseph` (Node) — cálculo local, ilimitado, sem
  crédito por mapa. Padrão de fato da indústria astrológica.
- Encapsular atrás da mesma interface de `lib/astro.js`, para que a troca seja
  transparente ao resto do sistema.
- Manter AstroWay temporariamente como fallback/validação cruzada durante a migração.
- Validar paridade de resultados contra mapas já gerados antes do corte.

### Efeito em cascata
A autonomia de cálculo é **pré-requisito** de: calculadoras gratuitas (4.4), sinastria
social gratuita (4.5), Assinatura Ciclos (5.1) e Retorno Solar (5.4). Por isso, subiu
de "otimização de custo" para **item estruturante do roadmap**.

### Convergência com a base integrativa em conclusão
A base ampliada de astrologia-numerologia em finalização, somada ao
`cabala_astrologia_integrativa_base_mentor.txt` (25 blocos), forma a camada
**interpretativa**. O Swiss Ephemeris forma a camada **determinística**. Juntas,
resolvem a inconsistência já diagnosticada — derivações estruturais deixam de ser
delegadas ao modelo de linguagem. Isso conversa diretamente com a recomendação já
registrada do `sintese.js` como camada de pré-computação.

---

## 4. Novos canais de venda

### 4.1 White-label / B2B2C — maior alavanca do documento
Licenciar o Mentor para terapeutas, astrólogos, coaches e nutricionistas: cada um com
RAG próprio sob a própria marca.

- Margem alta, CAC quase nulo, receita recorrente.
- Deixa de competir por atenção no varejo.
- A arquitetura atual (indexarTema.js + pgvector + tokens HMAC) já é multi-tenant em
  potencial.
- Referência: modelo Melooha.
- **Este é o teto real do negócio.** Varejo B2C financia; B2B2C escala.

### 4.2 Assinatura — modelo hoje ausente
R$19,90–29,90/mês: Mentor liberado + **Boletim de Ciclos** mensal personalizado
(trânsitos + ano/mês pessoal).

- Gerado por Railway Cron sobre motor próprio de efemérides; custo marginal ~zero.
- Converte ticket avulso em receita previsível.
- Referência de mercado: freemium detém ~45% da categoria de apps de astrologia.

### 4.3 WhatsApp como canal nativo
No Brasil, **2 em cada 5 compras online de bens de consumo já passam pelo WhatsApp**.

- Ferramentas: Evolution API ou WhatsApp Cloud API.
- Fricção menor que qualquer site — e contorna parcialmente o problema de
  responsividade mobile.
- Serve simultaneamente como canal de venda, entrega e recompra.

### 4.4 Amazon KDP + Google Play Books
Catálogo pronto e ocioso.
- KDP aceita narração por IA (Virtual Voice) e print-on-demand.
- Descoberta orgânica com intenção de compra, sem tráfego pago.
- Livro físico constrói autoridade — e autoridade eleva a conversão de todo o resto.
- Atenção: Audible/ACX **não** aceita narração sintética; KDP Virtual Voice aceita.

### 4.5 Presente (gifting)
Mapa ou relatório como presente, com card impresso e entrega agendada para a data.
- Aniversário é o gatilho de compra mais previsível do nicho.
- Gera um segundo comprador sem novo custo de aquisição.

### 4.6 Afiliados (Kiwify / Hotmart)
Já mapeado na estratégia paralela sob o pseudônimo Christian Germain. Forma mais rápida
de vender sem gastar em mídia enquanto o site amadurece.

### 4.7 Marketplace de consultores humanos (etapa posterior)
Camada humana sobre a base de IA, modelo Astrotalk/Nebula. Só faz sentido com volume
de demanda já estabelecido.

---

## 5. Produtos a criar

Ordenados por retorno sobre esforço. Todos reaproveitam ativos existentes.

### 5.1 Assinatura "Ciclos" — prioridade máxima
Boletim mensal personalizado (trânsitos + ano/mês pessoal), automatizado por cron.
Receita recorrente, custo marginal próximo de zero.
**Depende de:** motor próprio de efemérides (seção 3).

### 5.2 Mapa Vocacional / Profissional — R$97–147
Astrologia + numerologia + RAG `administracao_empresarial_inteligente`.
Nicho menos saturado que amor, ticket maior, e abre porta B2B.

### 5.3 Mapa Pais e Filhos
Maior disposição emocional a pagar do mercado — pai compra para o filho o que não
compra para si. RAGs `educar_filhos` e `sentimentos_adolescencia` já indexadas.

### 5.4 Retorno Solar anual
Recorrência natural sem mecânica de assinatura: cada cliente compra uma vez por ano, no
aniversário. Gatilho de venda automático e previsível.

### 5.5 Sinastria social gratuita
Comparação livre entre duas pessoas. Loop viral do Co-Star: cada usuário traz outro
para fornecer os próprios dados. Upsell natural para o Mapa do Amor.

### 5.6 Diário Integrativo
Journaling em que cada entrada é lida pelo Mentor contra o mapa da pessoa.
Máquina de retenção. Encaixa no VITA como camada longitudinal.

### 5.7 Formação em Leitura Integrativa — R$497–1.997
Curso a partir do compêndio de 25 blocos. Curso é o maior ticket do mercado brasileiro
de infoprodutos, e a base didática já existe. Astrotalk também opera cursos pagos.

### 5.8 Oráculo / baralho físico ZUNI
Cada carta com QR que abre a leitura correspondente no Mentor. Ponte física→digital,
em categoria com demanda crescente e concorrência qualificada fraca no Mercado Livre.

---

## 6. VITA como recipiente, não como produto isolado

**Reformulação conceitual registrada.**

Manter o VITA como produto independente (repo/domínio/checkout próprios, conforme já
decidido) permanece válido — mas o papel arquitetural dele deve ser maior:

> A Roda Vital (6 pilares, 0–100) como **pontuação longitudinal que conecta todos os
> produtos**. Comprou uma obra → respondeu o questionário → o score se move → o sistema
> recomenda o próximo passo.

**Razão:** isso converte um catálogo em um sistema. Catálogo se copia; sistema não.
O dado longitudinal do usuário é o único ativo que nenhum concorrente pode replicar,
porque é acumulado no tempo.

**Integrações naturais:** questionários pós-checkout (já construídos), Diário
Integrativo (5.6), Assinatura Ciclos (5.1), recomendação de próxima obra na loja.

---

## 7. Sistema de consulta empresarial por camadas (em desenvolvimento)

Registrado como frente ativa. Pontos de convergência com este radar:

- **RAG existente:** `administracao_empresarial_inteligente` (40 blocos) já indexado.
- **Convergência com 4.1:** a arquitetura por camadas do produto empresarial é
  provavelmente a mesma arquitetura multi-tenant necessária para o white-label. Vale
  projetar as duas juntas em vez de resolver o mesmo problema duas vezes.
- **Convergência com 5.2:** o Mapa Vocacional/Profissional é a ponte natural entre a
  linha empresarial e a linha astrológica — mesmo público, ticket alto, entrada B2B.
- **Convergência com 6:** a lógica de camadas e a lógica de pontuação por pilares do
  VITA são o mesmo padrão aplicado a contextos diferentes (indivíduo × organização).
- **Questionários empresariais:** ainda pendentes de redação (item já no
  `STATUS_ZUNI.md`); são o insumo direto deste produto.

---

## 8. Orgânico — o que ainda produz resultado real

### 8.1 GEO/AEO — janela de vantagem estrutural
Dados que sustentam a aposta:
- Tráfego vindo de plataformas de IA **converte 4,4× melhor** que o orgânico clássico
  (ainda <1% do volume total).
- Estudo Princeton/IIT Delhi (KDD 2024): densidade de palavra-chave teve efeito
  **mínimo**; os maiores ganhos vieram de **citar fontes, incluir estatísticas e trazer
  autoridade**. Ganho de visibilidade de até 40% em benchmark de 10 mil consultas.
- **Efeito equalizador:** fontes mal posicionadas no ranking tradicional tiveram ganhos
  proporcionalmente maiores após otimização.
- Porém: **~75% das menções em AI Overview vêm de sites já no Top 10 orgânico** — o SEO
  técnico continua sendo fundação obrigatória.

**Por que isso favorece especificamente a ZUNI:** o estilo de escrita já é denso,
estruturado e fundamentado. É exatamente o perfil que os modelos citam. Conteúdo raso
de volume, que domina o nicho esotérico, perde nesse jogo.

**Aplicação no Portal Editorial (já no roadmap):**
- **Pesquisa de prompts, não de palavras-chave.** Mapear perguntas conversacionais
  reais ("o que significa o número 7 na numerologia cabalística", "diferença entre
  karma e destino").
- Formato *answer-first*: resposta direta no primeiro parágrafo, desenvolvimento depois.
- Schema JSON-LD: `Article`, `FAQPage`, `Product`.
- `llms.txt` na raiz; robots.txt liberado para OAI-SearchBot, GPTBot, Google-Extended.
- Auditoria mensal de citação: 10–15 perguntas estratégicas em ChatGPT, Gemini,
  Perplexity e Claude; documentar menções. Primeiras evidências em 3–6 meses;
  share of voice relevante em 12–18 meses.

### 8.2 Calculadoras gratuitas — maior ativo orgânico do nicho
Numerologia do nome, ano pessoal, mapa simplificado.
- Gera backlinks e citações em IA.
- **Captura data de nascimento** — o insumo de todos os produtos pagos. O lead magnet
  é o próprio dado.
- Personare e Astrolink construíram audiência inteira sobre isso.
- **Depende de:** motor próprio de efemérides (custo por cálculo precisa ser zero).

### 8.3 Sinastria gratuita
Ver 5.5. Aquisição embutida no produto.

### 8.4 Pinterest (canal primário já definido)
Funciona como buscador, não como feed — meia-vida de meses por pin. Conteúdo esotérico
e de desenvolvimento pessoal tem desempenho historicamente forte na plataforma.

### 8.5 YouTube + podcast
Capítulos narrados pelo próprio pipeline TTS viram canal de YouTube: marketing de
audiobook a custo zero, reaproveitando arquivos já gerados.

### 8.6 Comunidade WhatsApp / Telegram
Boletim semanal gratuito. Canal de recompra mais barato disponível no Brasil.

### 8.7 Conteúdo de comunidade (Reddit, fóruns, Quora em PT)
LLMs atribuem peso alto a conteúdo de comunidade na hora de citar. Presença consistente
e não promocional em espaços de discussão do nicho alimenta o GEO.

---

## 9. Ferramentas e infraestrutura

### Prioritárias
| Ferramenta | Função | Justificativa |
|---|---|---|
| `swisseph` (Swiss Ephemeris) | Efemérides locais | Remove dependência e teto do AstroWay; habilita produtos gratuitos e de alto volume |
| n8n auto-hospedado (Railway) | Orquestração | WhatsApp, e-mail, cron, webhooks sem código dedicado por fluxo |
| Evolution API / WhatsApp Cloud API | Canal WhatsApp | Mentor nativo no canal dominante do Brasil |
| PostHog | Analytics + session replay | Ver onde o checkout quebra, em vez de deduzir |
| Typebot | Captura conversacional | Converte muito mais que formulário para dados de nascimento |

### Complementares
| Ferramenta | Função |
|---|---|
| Metabase sobre Supabase | Dashboards em vez de SQL avulso |
| Sentry | Rastreamento de erros em produção |
| Cloudflare | Resolve pendência de DNS (CNAME raiz) + CDN + Turnstile anti-bot |
| Pix direto (Asaas / Efí) | Taxa menor que MercadoPago, liquidação instantânea |
| Google TTS Chirp3-HD | Testar antes de escalar audiobooks — superior às WaveNet; **verificar disponibilidade em pt-BR** |
| Canva / Gamma (MCPs já conectados) | Produção de criativos em escala para Pinterest |
| ElevenLabs (opcional) | Clonagem da voz do autor para título carro-chefe apenas |

---

## 10. Riscos e contrapontos registrados

1. **Excesso de catálogo não validado.** 24+ títulos, 8+ bases RAG, vários produtos —
   nenhum com conversão provada em tráfego pago real. O gargalo é validação, não
   produção.
2. **Diluição de marca.** Saúde integrativa e astrologia sob a mesma marca pode reduzir
   credibilidade junto ao público de saúde. A separação via pseudônimo Christian
   Germain já mitiga parcialmente; vale decisão explícita antes de escalar.
3. **Conformidade.** A regra permanente já vigente — sem fórmulas, dosagens ou condutas
   clínicas nas respostas da API — deve ser reafirmada em cada novo produto, sobretudo
   nos de saúde e nos empresariais.
4. **Dependência de terceiros no cálculo.** Endereçada pela seção 3.
5. **Débito técnico conhecido.** `public/loja/index.html` mantém catálogo duplicado
   separado de `catalogoLivros.js` — novos livros exigem edição em dois lugares. Deve
   ser resolvido antes de qualquer expansão significativa de catálogo.
6. **Regra de evidência real permanece válida** para tudo neste documento: nenhum item
   é considerado concluído sem saída literal (curl, SQL, log do Railway). Checklists de
   ✅ não são prova.

---

## 11. Sequência recomendada

| Fase | Ação | Desbloqueia |
|---|---|---|
| **0** | Teste de pagamento real + responsividade mobile | Tudo |
| **1** | Provar conversão em **um** produto (Mapa do Amor), verba mínima no Pinterest | Decisão de escalar ou pivotar |
| **2** | Migrar cálculo para Swiss Ephemeris | Calculadoras gratuitas, sinastria grátis, Ciclos, Retorno Solar |
| **3** | Calculadoras gratuitas + sinastria gratuita | Motor orgânico e captura de dados |
| **4** | Assinatura Ciclos | Receita recorrente |
| **5** | VITA como camada longitudinal + consulta empresarial por camadas | Sistema, não catálogo |
| **6** | White-label B2B2C | Teto real do negócio |

O Livro Vivo (2.1) e o audiobook em duas vozes (2.2) podem ser executados em paralelo a
partir da Fase 1 — custo marginal quase nulo e efeito imediato sobre valor percebido.

---

## Registro de origem

Levantamento estratégico conduzido em 20/08/2026, com pesquisa de mercado sobre
referências internacionais (Astrotalk, Nebula/OBRIO, Co-Star, CHANI, The Pattern,
Melooha, AstroSage), dados do mercado esotérico brasileiro (Nubimetrics, Grand View
Research, Sebrae) e estudos de GEO/AEO (Aggarwal et al., Princeton/IIT Delhi, KDD 2024;
Similarweb; HubSpot 2026).

**Decisões do usuário registradas nesta sessão:**
- AstroWay permanece apenas como fonte de cálculo; sistema próprio e autônomo é o
  caminho definido.
- Base ampliada de astrologia-numerologia em conclusão abre novas possibilidades de
  produto — a serem cruzadas com este radar quando finalizada.
- VITA e sistema de consulta empresarial por camadas entram como frentes de
  desenvolvimento paralelas a estas oportunidades.
- Janela de ativação: aproximadamente 10 dias a partir de 20/08/2026.
