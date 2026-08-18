# Etapa 6 — Remover Flag de Teste (APÓS testes da Etapa 5)

## O que fazer

Após validar que os questionários aparecem corretamente no fluxo real (Etapa 5), remover as 3 linhas abaixo de `public/chat.html`:

**Linha 462:**
```javascript
const testQuestionario = params.get('testQuestionario') === 'true';
```

**Linhas 465–467 (comentário TODO):**
```javascript
// Redireciona para questionário se ?testQuestionario=true
// TODO: Piloto fixo em timidez_comunicacao. Quando outros temas entrarem em produção,
// extrair tema da sessão ou produto para enviar via URL (?tema=...)
```

**Linhas 468–470 (bloco if):**
```javascript
if (testQuestionario && !fromQuestionnaire) {
  window.location.href = `/questionario-triagem.html?sessionId=${sessionId}`;
}
```

## Importante

- ✅ MANTENHA toda a lógica de `fromQuestionnaire` — ela ainda é necessária para:
  - Injetar a Resposta A ao voltar do questionário (linhas 494–502)
  - Ajustar o botão WhatsApp com label profissional (linhas 623–629)
  - Fire-and-forget da Resposta B ao clicar WhatsApp (linhas 604–610)

- ✅ Faça isso como um **novo commit** com mensagem clara:
  ```
  feat: ativar questionário no fluxo real de checkout (remover flag testQuestionario)
  
  Questionários agora aparecem para todos os clientes que completam:
  - Checkout de Sessão Avulsa (Mapa Integrativo, R$ 29,90)
  - Checkout de Sessões Extras (3 sessões, R$ 74,90)
  
  Tema fixo: timidez_comunicacao (único com RAG indexada)
  Opção de pular: mantida, cliente nunca é forçado
  Questionário repetição: marcado como respondido no pacote, não repete nas sessões 2-3
  ```

## Cronograma

1. Você testa (Etapa 5) ✓
2. Você aprova ou corrige issues encontradas
3. Eu removo a flag (Etapa 6)
4. Commit + push para produção
5. **Clientes reais começam a passar pelo fluxo**

Pronto para testar!
