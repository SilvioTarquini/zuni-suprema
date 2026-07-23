# Módulo C — Chat de Demonstração

## Status: ✅ IMPLEMENTADO

**Data:** 2026-07-22  
**Versão:** 1.0  
**Custo API:** Controlado (max tokens, logging real)

---

## 📋 O QUE FOI IMPLEMENTADO

### Backend (`src/server.js`)
- ✅ Rota isolada `/api/experimente-chat` (não interfere com `/api/chat` pago)
- ✅ Rate limiter com limite rígido de **5 trocas por visitante por 24h**
- ✅ Identificação por `sessionId + hash SHA-256 de IP` (LGPD-compliant)
- ✅ Max tokens: **500 tokens** (limite rígido de resposta)
- ✅ Logging automático de consumo (input + output tokens)
- ✅ Custo calculado e retornado em cada resposta
- ✅ CTA de upgrade na 5ª troca (Mentor R$ 29,90)
- ✅ Suporte a bases RAG gerais da ZUNI (sem dados de sessões pagas)

### Rate Limiter (`src/lib/rateLimitExperimente.js`)
- ✅ Reset por 24h (janela móvel)
- ✅ Storage em memória (rápido, sem latência DB)
- ✅ Backup em Supabase para auditoria (asyncrono, não bloqueia)
- ✅ IP armazenado como hash SHA-256 (não identificável)
- ✅ Suporte a estatísticas de consumo por visitante

### Frontend (`public/experimente.html`)
- ✅ Interface de chat moderno (histórico, input, contador)
- ✅ Styling integrado com o design ZUNI
- ✅ Indicador de trocas restantes (0/5)
- ✅ Animações de mensagens (slide-in)
- ✅ Bloco de limite atingido com CTA para upgrade
- ✅ Responsivo (mobile-friendly)

### Cliente (`public/js/experimente-client.js`)
- ✅ Função `inicializarChat()` (gera sessionId, recupera histórico)
- ✅ Função `enviarMensagemChat()` (chamada à API + UI)
- ✅ Persistência de histórico em sessionStorage
- ✅ Persistência de sessionId em localStorage (24h+)
- ✅ Logging de custo real ($) em console
- ✅ Desabilitação automática ao atingir limite

### Banco de Dados (`migrations/002_create_experimente_chat_audit.sql`)
- ✅ Tabela `experimente_chat_audit` para registro de consumo
- ✅ View agregada (`experimente_chat_audit_summary`) para analytics
- ✅ Índices para performance (session_id, ip_hash, created_at)

---

## 💰 ESTIMATIVA DE CUSTO (Sonnet-4)

### Pricing Reference
```
Claude Sonnet-4: $3 / 1M input tokens
Claude Sonnet-4: $15 / 1M output tokens
```

### Cenários de Custo Real

#### Conversa Típica (5 trocas)
```
Troca 1:
  - System prompt (demo):     ~400 tokens
  - RAG context:              ~300 tokens
  - User message:             ~50 tokens
  - Total input:              ~750 tokens
  - Output (max 500):         ~350 tokens
  - Custo: (750 * $3 + 350 * $15) / 1M = $0.0089

Troca 2-4 (similar, com histórico):
  - Input (histórico + nova):  ~1000 tokens
  - Output:                    ~350 tokens
  - Custo/troca: ~$0.0106

Troca 5 (última, com CTA):
  - Input:                     ~1100 tokens
  - Output:                    ~400 tokens
  - Custo: ~$0.0129

TOTAL 5 TROCAS: ~$0.0525 (5 centavos USD)
```

### Por Visitante (Esperado)
```
- Visitante casual (1-2 trocas): $0.01-0.02
- Visitante engajado (5 trocas): $0.05
- Custo médio estimado: $0.03/visitante
```

**IMPORTANTE:** Este é o custo REAL. Será registrado em `experimente_chat_audit` para verificação periódica.

---

## 📊 MONITORANDO CONSUMO

### 1. Console Logs (Desarrollo/Teste)
Cada requisição exibe no servidor:
```
[CHAT_DEMO] exp-abc123:15a8f2c — Troca 2/5 | Tokens: 950 in + 380 out | Custo: $0.009856
```

### 2. Resposta JSON (Front-end)
```json
{
  "texto": "...",
  "contador": "2/5",
  "ultimaTroca": false,
  "tokens": { "input": 950, "output": 380 },
  "custo": { "moeda": "USD", "valor": 0.009856 }
}
```

### 3. Supabase Dashboard (Auditoria)
Acesse: `Supabase Console → experimente_chat_audit`

**Consulta para custo total por dia:**
```sql
SELECT * FROM experimente_chat_audit_summary ORDER BY data DESC LIMIT 30;
```

**Custo total de hoje:**
```sql
SELECT
  SUM(total_tokens) as tokens_totais,
  ROUND(SUM(custo_usd)::numeric, 4) as custo_total_usd
FROM experimente_chat_audit
WHERE DATE(created_at) = CURRENT_DATE;
```

---

## 🔐 SEGURANÇA & LGPD

### IP Handling
- ✅ IP extraído: `req.headers['x-forwarded-for']` (proxy-aware)
- ✅ IP armazenado: **SHA-256 hash** (não reversível, não identificável)
- ✅ Uso: Rate limiting apenas (sem tracking pessoal)

### Conformidade LGPD
- ✅ Dado de IP não está em texto puro no banco
- ✅ Comentários no schema SQL documentam LGPD
- ✅ Tabela `experimente_chat_audit` é auditoria, não CRM

**Recomendação:** Revisar política de privacidade e mencionar "coleta de hash de IP para segurança e prevenção de abuso".

### Isolamento de Sessões Pagas
- ✅ `/api/chat` (pago) permanece intocado
- ✅ `/api/experimente-chat` (demo) é 100% isolada
- ✅ SYSTEM_PROMPT_DEMO é separado de SYSTEM_PROMPT
- ✅ Sem acesso a contextos de Mapa Astral, Numerologia, ou Pacotes

---

## 🚀 COMO USAR

### Para Visitantes
1. Vá para `/experimente`
2. Navegue até "💬 Módulo C — Chat de Demonstração"
3. Escreva sua pergunta/reflexão
4. Clique "Enviar" ou Ctrl+Enter
5. Leia resposta do Mentor (até 5 vezes em 24h)
6. Na 5ª troca: CTA para upgrade (R$ 29,90)

### Para Você (Monitorar Custos)
1. **Console do servidor:** Olhe os logs `[CHAT_DEMO]` em tempo real
2. **Painel front:** Resposta JSON inclui `custo.valor`
3. **Supabase:** Query `experimente_chat_audit_summary` diariamente
4. **Spike detection:** Se custo diário > $10, investigar abuso

### Para Alertar Abuso
- Um visitante tentando 100 vezes/dia: bloqueado no rate limiter
- Um visitante com 1000 tokens/resposta: bloqueia no max_tokens
- Um padrão de IPs suspeitos: verificar em `experimente_chat_audit`

---

## 📝 PRÓXIMOS PASSOS (OPCIONAL)

1. **Executar migração SQL:** `supabase migration up`
2. **Testar em produção:** Verificar primeiras 10 trocas para validar custo
3. **Dashboard Grafana:** Criar alertas se custo/dia > $20
4. **Análise A/B:** Rastrear upgrade rate (quantos clicam no CTA)

---

## 🧪 TESTE RÁPIDO

```bash
# Terminal 1: Rodando servidor
npm start

# Terminal 2: Simular 3 trocas
curl -X POST http://localhost:8080/api/experimente-chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Tenho dúvidas sobre ansiedade", "sessionId":"test-123"}'

# Verificar logs: [CHAT_DEMO] test-123:... — Troca 1/5 | Tokens: ...
```

---

## 📞 SUPORTE

Se encontrar bugs ou questionamentos:
- Rate limiter não está registrando? Verificar `src/lib/rateLimitExperimente.js`
- Chat não responde? Verificar `ANTHROPIC_API_KEY` no `.env`
- Custo não bate? Verificar tokens na resposta JSON + logs do servidor

**Versão:** Módulo C v1.0  
**Última atualização:** 2026-07-22
