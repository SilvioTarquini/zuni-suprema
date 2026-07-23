# MELHORIAS FUTURAS — MÓDULO C (Chat de Demonstração)

**Data de registro:** 2026-07-22  
**Prioridade:** Média (implementar quando escala exigir)

---

## 🎯 OTIMIZAÇÃO 1: Prompt Caching (Anthropic)

### Problema
- 68% do custo de entrada provém de **conteúdo repetido em cada troca**
- System prompt (~350 chars = 1.500 tokens)
- Salvaguardas éticas (~1.200 tokens)
- Total fixo por troca: ~2.300 tokens idênticos

### Solução: Prompt Caching
Anthropic oferece cache de prompt nativo no Sonnet-4:
- **Primeira troca (T1):** Paga 100% do custo (setup)
- **Trocas T2-T5:** Pagam apenas **10% do custo de tokens em cache**
- **Cache válido por:** 5 minutos (suficiente para conversa de 5 trocas)

### Impacto Financeiro

```
CUSTO ATUAL (sem cache):
  T1: $0.0168 (entrada: $0.0101)
  T2: $0.0225 (entrada: $0.0168)
  T3: $0.0220 (entrada: ~$0.0167)
  T4: $0.0220 (entrada: ~$0.0167)
  T5: $0.0220 (entrada: ~$0.0167)
  ─────────────────────────────
  TOTAL 5 trocas: $0.0983

CUSTO COM CACHE:
  T1 (setup):      $0.0168 (sem cache)
  T2-T5 (cached):  ~$0.0025 cada × 4 = $0.0100
  ─────────────────────────────────────
  TOTAL 5 trocas:  $0.0268

ECONOMIA: $0.0715 por visitante (-73%)
```

### Para 1.000 visitantes/dia
```
Sem cache:  1.000 × $0.0983 = $98.30/dia
Com cache:  1.000 × $0.0268 = $26.80/dia
─────────────────────────────
ECONOMIA:   $71.50/dia (~$26k/ano)
```

---

## 🔧 Como Implementar (Roadmap)

### Fase 1: Setup (~2 horas)
1. Atualizar SDK Anthropic para versão com cache suporte
2. Modificar `/api/experimente-chat` para incluir `cache_control`
3. Testar com token counting

### Fase 2: Validação (~1 hora)
1. Rodar 5 trocas e validar custo reduzido
2. Confirmar respostas idênticas (não há degradação)
3. Monitorar duração de cache

### Código de Exemplo
```javascript
// Antes
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 500,
  system: SYSTEM_PROMPT_DEMO,
  messages: messagesParaClaude
});

// Depois (com cache)
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 500,
  system: [{
    type: 'text',
    text: SYSTEM_PROMPT_DEMO,
    cache_control: { type: 'ephemeral' }  // ← Cache por 5 min
  }],
  messages: messagesParaClaude
});
```

### Prerequisitos
- [x] Sonnet-4 (já usando)
- [ ] Atualizar SDK Anthropic (versão 0.38+)
- [ ] Revisar documentação: https://docs.anthropic.com/en/docs/build-a-chatbot-with-multi-turn-conversation#controlling-cache-usage

---

## 📊 Gatilho para Implementação

**Implementar quando:**

| Condição | Ação |
|----------|------|
| Visitantes/dia > 5.000 | Avaliar ROI ($26k/ano de economia) |
| Custo API > $500/mês | Implementar imediatamente |
| Conversão para Mentor < 3% | Implementar para reduzir CAC |

---

## 🔍 Alternativas Consideradas

### 1. Reduzir max_tokens de 500 para 250
- **Impacto:** -20% de saída (menos economia que cache)
- **Risco:** Respostas truncadas, qualidade menor
- **Decisão:** Não recomendado

### 2. Usar modelo mais barato (Haiku)
- **Impacto:** -70% no custo total
- **Risco:** Qualidade inadequada para Mentor demo
- **Decisão:** Não recomendado (compromete conversão)

### 3. Prompt caching ✅ RECOMENDADO
- **Impacto:** -73% na entrada (maior economia)
- **Risco:** Mínimo (cache é nativo da API)
- **Benefício:** Mantém qualidade, reduz custo drasticamente

---

## ✅ Checklist de Implementação

Quando decidir implementar:

- [ ] Atualizar Anthropic SDK para versão com cache
- [ ] Refatorar endpoint para usar `cache_control`
- [ ] Testes: 5 trocas, validar custo na resposta
- [ ] Validar `usage.cache_creation_input_tokens` e `cache_read_input_tokens`
- [ ] Documentar novo custo real em `MODULO_C_ESPECIFICACAO_CUSTOS.md`
- [ ] Alertar em logs: "[CACHE] T2-T5 usando cache de prompt"
- [ ] Monitorar taxa de cache hits (goal: >80% após T2)

---

## 📚 Referências

- **Anthropic Docs:** https://docs.anthropic.com/en/docs/build-a-chatbot-with-multi-turn-conversation#controlling-cache-usage
- **Pricing with Cache:** https://www.anthropic.com/pricing/claude
- **Token Counting:** Usar `anthropic.count_tokens()` para validar

---

## 📝 Notas

- **Cache TTL:** 5 minutos (janela de reset do rate limiter é 24h, mas cache é por sessão de 5 min)
- **Compatibilidade:** Sonnet-4 (v4-6 suporta desde dezembro 2024)
- **Tracking:** Adicionar log `cache_read_input_tokens` na resposta JSON para auditoria

---

**Status:** Aprovado para roadmap futuro  
**Responsável:** Silvio Tarquini  
**Revisão:** Quando atingir 5.000+ visitantes/dia

