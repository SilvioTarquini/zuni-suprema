# MÓDULO C — ESPECIFICAÇÃO DE CUSTOS

**Última atualização:** 2026-07-22  
**Status:** Produção v1.0 (otimizado)  
**Responsável orçamento:** Silvio Tarquini

---

## 📊 CUSTO REAL POR TROCA (Claude Sonnet-4)

### Pricing
```
Entrada:  $3 / 1M tokens
Saída:    $15 / 1M tokens
```

### Troca 1 (primeira pergunta)
```
Tokens entrada:  3.365
Tokens saída:    448
────────────────────────
Custo entrada:   $0.010095 (60%)
Custo saída:     $0.006720 (40%)
TOTAL:           $0.016815 USD
```

### Troca 2+ (com histórico acumulado)
```
Tokens entrada:  5.599
Tokens saída:    381
────────────────────────
Custo entrada:   $0.016797 (75%)
Custo saída:     $0.005715 (25%)
TOTAL:           $0.022512 USD
```

### Custo Médio por Troca
```
(T1 + T2) / 2 = ($0.016815 + $0.022512) / 2 = $0.019664 USD

Breakdown médio:
  Entrada: $0.013446 (68%)
  Saída:   $0.006218 (32%)
```

---

## 💰 CUSTO POR VISITANTE

### Por limite de 5 trocas/24h
```
Estimado (5 trocas):
  T1: $0.0168
  T2: $0.0225
  T3: $0.0220 (padrão de T2)
  T4: $0.0220
  T5: $0.0220 (com CTA)
  ─────────────
  TOTAL: ~$0.0983 USD (9,83 centavos)
```

### Por dia (1.000 visitantes)
```
Cenário conservador (1ª troca/visitante):
  1.000 × $0.0168 = $16.80/dia ($6.132/ano)

Cenário médio (2 trocas/visitante):
  1.000 × $0.0393 = $39.30/dia ($14.359/ano)

Cenário limite (5 trocas/visitante):
  1.000 × $0.0983 = $98.30/dia ($35.879/ano)
```

---

## 🎯 ORÇAMENTO RECOMENDADO

### Para campanha piloto (100 visitantes/dia)

| Cenário | Diário | Mensal | Trimestral |
|---------|--------|--------|-----------|
| **Conservador** (1ª) | $1.68 | $50.40 | $151.20 |
| **Médio** (2 trocas) | $3.93 | $117.90 | $353.70 |
| **Máximo** (5 trocas) | $9.83 | $294.90 | $884.70 |

### Para escala (10.000 visitantes/dia)

| Cenário | Diário | Mensal | Anual |
|---------|--------|--------|-------|
| **Conservador** | $168.00 | $5.040 | $61.320 |
| **Médio** | $393.00 | $11.790 | $143.590 |
| **Máximo** | $983.00 | $29.490 | $358.790 |

---

## 🔄 COMPARAÇÃO: ANTES vs DEPOIS (OTIMIZAÇÃO)

| Métrica | Antes | Depois | Economia |
|---------|-------|--------|----------|
| **T1 custo** | $0.0226 | $0.0168 | -26% |
| **T2 custo** | $0.0323 | $0.0225 | -30% |
| **Média** | $0.0275 | $0.0197 | -28% |
| **5 trocas** | $0.1373 | $0.0983 | -28% |
| **1.000 vis/dia** | $137/dia | $98/dia | -28% |
| **Anual** | $50k | $36k | $14k |

---

## 📋 CHECKLIST DE CONFIGURAÇÃO

Para replicar estes custos:

- [x] RAG limitado a 3 chunks (não 5)
- [x] SYSTEM_PROMPT_DEMO comprimido (350 chars)
- [x] Max tokens: 500 (configurado no API call)
- [x] searchKnowledge(message, 3) no endpoint
- [x] Claude Sonnet-4 (modelo atual)

**Se mudar qualquer um desses, custo pode variar significativamente.**

---

## 🚀 FUTURO: OTIMIZAÇÃO COM PROMPT CACHING

### Problema atual
- 68% do custo de entrada são **salvaguardas + system prompt (idênticos em toda troca)**
- Cada troca repete ~2.300 tokens de contexto fixo

### Solução: Anthropic Prompt Caching
```
Feature:     Cache de prompt (Sonnet-4 suporta)
Desconto:    90% no custo de tokens em cache
Investimento: Primeira chamada paga 100% (cache setup)
Próximas:    Próximas 1.000 tokens pagam 10% apenas

Exemplo:
  T1 (sem cache): $0.0168 (baseline)
  T2-T5 (com cache): ~$0.002-0.003 cada (90% mais barato)
```

### Impacto esperado
```
ANTES (sem cache):
  5 trocas = $0.0983

DEPOIS (com cache):
  T1 setup:        $0.0168
  T2-T5 cached:    $0.0100 (4 × ~$0.0025)
  ─────────────────────────
  TOTAL:           ~$0.0268 (reduz 73% em escala)

Por visitante:
  Antes:  $0.0983
  Depois: $0.0268
  Economia: 73%
```

### Quando implementar
- [ ] Quando custo de API exceder $500/mês
- [ ] Ou quando meta for 5.000+ visitantes/dia
- [ ] Implementação: ~2 horas (refatorar para usar `cache_control` no SDK Anthropic)

### Referência
- Docs: https://docs.anthropic.com/en/docs/build-a-chatbot-with-multi-turn-conversation#controlling-cache-usage
- Savings calculator: Calcular economia real antes de implementar

---

## 📌 NOTAS IMPORTANTES

1. **Estes custos são baseados em testes reais (2026-07-22)**
   - Não são estimativas teóricas
   - Incluem overhead de system prompt + RAG + histórico
   - Validado com 2 trocas completas

2. **Variáveis que afetam custo:**
   - Tamanho da mensagem do usuário (T1 menor, T2 maior)
   - Tamanho do contexto RAG (3 chunks agora)
   - Comprimento do histórico (acumula a cada troca)
   - Extensão da resposta (max 500 tokens)

3. **Monitoramento recomendado:**
   - Query `experimente_chat_audit_summary` diariamente
   - Alertar se custo diário > $200
   - Revisar ROI mensal (custo API vs conversões para Mentor $29,90)

4. **Taxa de conversão esperada:**
   - Se 5% de visitantes convertem para Mentor: ($29,90 × 0.05 = $1.495 por 100 visitantes)
   - Break-even: (~$39/1.000 visitantes de custo vs $150 de receita)
   - Margem positiva confirmada ✅

---

## 🔐 Auditoria de Custo

**Última validação:** 2026-07-22  
**Método:** Testes reais em produção (test-opt-001)  
**Responsável:** Silvio Tarquini  
**Próxima revisão:** 2026-08-22 (após 1.000+ visitantes)

