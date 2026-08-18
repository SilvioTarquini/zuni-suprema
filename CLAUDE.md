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

## Convenções observadas

- Nomes de função e variável em português (`calcularMapaNatal`, `validarCupom`, `criarPedidoPendente`), mesmo com o resto do código em inglês/JS padrão.
- Testes de endpoint geralmente feitos com `curl` local (`http://localhost:PORT/...`) antes de subir para produção.
- Commits em português, prefixo convencional (`feat:`, `fix:`, `docs:`, `test:`, `deps:`).
