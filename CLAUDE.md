# Zuni Suprema

Backend Node/Express de uma plataforma de autoconhecimento: mapas astrológicos, numerologia, e-books com chat via IA, sessões extras pagas e cápsulas de conteúdo entregues por e-mail/voz.

## Stack

- **Servidor**: Express (`src/server.js` — monólito grande, ~1800+ linhas, com rotas inline além das roteadas via `src/routes/`)
- **Banco**: Supabase (Postgres). Migrations em `migrations/*.sql`.
- **IA**: Anthropic SDK e Google Generative AI (Gemini) para os chats dos livros e cálculos interpretativos.
- **Voz**: ElevenLabs.
- **Pagamentos**: MercadoPago (checkout de livros, mapa astral, sessões extras).
- **E-mail**: SendGrid.
- **Deploy**: Railway (projeto `zuni-suprema`).

## Estrutura

- `src/server.js` — ponto de entrada, a maior parte das rotas de checkout/questionário/brinde estão aqui.
- `src/routes/` — `livros.js`, `livroChat.js`, `experimenteLivroChat.js`.
- `src/lib/` — lógica de domínio: astrologia (`astro.js`, `astrologia-b.js`, `calculosAstrologicos.js`), numerologia (`numerologia.js`), cupons, créditos de sessão, memória de sessões de chat, acesso a livros, rate limiting do "experimente".
- `public/` — HTML/JS servidos direto (chat, checkout, questionários, loja).
- `private/livros/` — conteúdo de e-books protegido por token de acesso.
- `migrations/` — SQL aplicado manualmente/via Supabase.
- `docs/` — notas de setup pontuais (AstroWay, Experimente Zuni, testes do Mapa Integrado).

## Rodando localmente

```bash
npm start          # node src/server.js, porta padrão 3000 (via .env PORT)
npm run dev         # nodemon
```

Variáveis de ambiente em `.env` (ver `.env.example` para a lista completa — chaves de Anthropic, Gemini, Supabase, ElevenLabs, MercadoPago, SendGrid, webhook do Make).

Para rodar múltiplas instâncias de teste em paralelo, o padrão usado neste projeto é `PORT=8091 node src/server.js` etc. Para matar processos node presos no Windows: `taskkill //F //IM node.exe //T`.

## Deploy

Via Railway, projeto `zuni-suprema`. Checagens de rotina:

```bash
railway status
railway logs --service zuni-suprema
railway variable list --project zuni-suprema
```

`railway variable set` muda segredos em produção — nunca rodar sem confirmação explícita.

## Pipeline de audiolivros

Geração de audiolivros pagos (Google Cloud TTS) a partir de manuscritos `.docx`. Peças:

- `scripts/extrair-texto-docx.js` — extrai o corpo real do manuscrito (mammoth), descartando
  título/Sumário automaticamente.
- `scripts/gerar-audiolivro-local.js` — roda o pipeline (chunking + SSML + síntese +
  concatenação) e salva o MP3 **local**, sem subir para o Supabase.
- `src/lib/audiolivroGenerator.js` — motor do pipeline (chunking, SSML v5, upload).

**Regra fixa: a seção de Sumário/Índice do manuscrito é sempre removida antes de gerar
áudio.** Motivo: no `.docx` bruto os números de página costumam ficar colados ao texto do
Sumário (ex.: "Introdução3", "Capítulo 1 — ...5"), e o TTS lê isso de forma incompreensível.
`extrair-texto-docx.js` já faz essa remoção automaticamente (heading semântico do Word
como marcador do início do conteúdo real, com fallback para negrito manual em manuscritos
sem heading nativo) — não pular essa etapa nem assumir que o texto bruto já está limpo.

**Disciplina de produção (não pular etapas):**
1. Gerar localmente com `gerar-audiolivro-local.js` (sem upload).
2. Validar auditivamente (início, meio, fim — e transições entre partes, se houver mais de
   uma) — aprovação explícita do usuário antes de seguir.
3. Só então subir para o Supabase e ligar `audiobookUrl` (obra em parte única) ou
   `audiobookPartes` (obra dividida — ver abaixo) + `audiobookDisponivel: true` +
   `precoAudiobook` em `catalogoLivros.js`.

**Obras longas: divisão em partes alinhada por capítulo (desde 19/08/2026).** O Supabase
Storage tem limite de tamanho por objeto (~50MB no plano padrão). `dividirEmChunks()` força
quebra de chunk a cada início de capítulo (regex `Capítulo\s+\d+`, cobre "Capítulo N —",
"Capítulo N:", "Capítulo N" sozinho) — isso garante que nenhum chunk atravesse dois
capítulos, pré-requisito para `agruparChunksEmPartes()` fechar cada parte sempre em
fronteira de capítulo completo (nunca no meio), buscando ~40MB por parte (config
`LIMITE_BYTES_POR_PARTE`/`LIMITE_SEGUNDOS_POR_PARTE` em `audiolivroGenerator.js`) — exceto
quando um único capítulo já excede o limite sozinho, caso em que a parte fica maior mesmo
(preferível a cortar errado).
- **Importante**: o agrupamento usa a **duração** de cada chunk, não o tamanho em bytes.
  `concatenarComFFmpeg()` recodifica a saída (64kbps de síntese → ~32kbps no arquivo
  concatenado, confirmado empiricamente), então bytes de chunks isolados não são somáveis
  linearmente para prever o tamanho do arquivo final.
- Obra em 1 parte só: `audiobookUrl` (string), comportamento idêntico ao de sempre.
- Obra em 2+ partes: `audiobookPartes` (array de URLs), **sem** `audiobookUrl` — os dois
  campos são mutuamente exclusivos. A rota `/audiolivros/:livroId` (`src/routes/livros.js`)
  detecta automaticamente e mostra uma página listando as partes em vez do redirect direto.
  Nada no checkout, preço ou e-mail de entrega precisa mudar (o e-mail já linka pra rota da
  aplicação, não pro arquivo).

Calibração de pausas (`strength="medium"` entre parágrafos, `strength="strong"` em
separadores decorativos) validada tanto na voz feminina `pt-BR-Wavenet-A` quanto na
masculina `pt-BR-Wavenet-B` (piloto de 1m20s, aprovado 19/08/2026 — mesmos parâmetros,
sem necessidade de ajuste). Se uma terceira voz for usada no futuro, repetir o piloto
antes de produção — não assumir que a calibração generaliza sem validar.

## Convenções observadas

- Nomes de função e variável em português (`calcularMapaNatal`, `validarCupom`, `criarPedidoPendente`), mesmo com o resto do código em inglês/JS padrão.
- Testes de endpoint geralmente feitos com `curl` local (`http://localhost:PORT/...`) antes de subir para produção.
- Commits em português, prefixo convencional (`feat:`, `fix:`, `docs:`, `test:`, `deps:`).
