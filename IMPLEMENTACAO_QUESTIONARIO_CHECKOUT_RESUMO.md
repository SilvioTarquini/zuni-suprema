# Implementação: Questionário no Fluxo Real de Checkout

## ✅ Concluído

Todas as etapas de código foram implementadas. O questionário está pronto para aparecer no fluxo real de checkout (Sessão Avulsa e Sessões Extras).

### Arquivos Criados/Modificados

#### Novo
- `public/sessoes-extras-confirmacao.html` — página de confirmação pós-pagamento (Sessões Extras)
- `migrations/001_questionario_pacote_fields.sql` — schema updates

#### Modificado
- `public/checkout.html` — 2 redirecionamentos alterados (cartão e PIX)
- `public/questionario-triagem.html` — aceita `pacoteId` opcional
- `src/server.js` — novo endpoint + atualização do endpoint de salvar respostas + correção de e-mail
- `src/lib/creditosSessao.js` — nova função `marcarQuestionarioRespondido()`

### O Que Mudou

#### 1️⃣ Sessão Avulsa (Mapa Integrativo, R$ 29,90)
**Antes:** checkout → confirmação pagamento → `/chat.html?sessionId=...` (direto ao chat)  
**Agora:** checkout → confirmação pagamento → `/questionario/timidez_comunicacao?sessionId=...` → chat.html

- Cliente pode "pular esta etapa" → vai direto ao chat (como antes)
- Cliente responde → Resposta A aparece no chat + `fromQuestionnaire=true`

#### 2️⃣ Sessões Extras (Pacote 3 sessões, R$ 74,90)
**Antes:** webhook confirma pagamento → e-mail com link quebrado `/mentor`; cliente não consegue acessar chat  
**Agora:** webhook → e-mail → `sessoes-extras-confirmacao.html` → verifica pacote → pede questionário (1ª vez) → chat

- Nova página `sessoes-extras-confirmacao.html` com polling (aguarda confirmação de pagamento)
- Novo endpoint `/api/sessoes-extras/iniciar-sessao` cria sessão a partir do email
- Marca no banco que o pacote respondeu ao questionário
- Sessões 2 e 3 do pacote pulam direto para chat (sem repetir questionário)

---

## ⏳ Próximos Passos (Você)

### 1. Executar Migrações de Banco
Rode o SQL em `migrations/001_questionario_pacote_fields.sql` no painel Supabase:
```sql
-- Copie o conteúdo do arquivo e execute no SQL Editor do Supabase
```

### 2. Testar Tudo (Etapa 5 — Crucial!)

#### Teste A: Sessão Avulsa com PIX
1. Acesse `https://www.zunisuprema.com.br/checkout`
2. Preencha dados, escolha **PIX**
3. Pague pelo QR Code (use dados de teste se disponível)
4. Confirme que você é redirecionado para `/questionario/timidez_comunicacao`
5. **Teste 5a:** Clique "Pular esta etapa"
   - ✓ Deve ir para chat.html normalmente
6. **Teste 5b:** Responda todas as 5 perguntas, clique "Enviar"
   - ✓ Deve ir para chat.html com Resposta A visível
   - ✓ Clique no botão WhatsApp e veja se diz "Fale com nossa equipe — responda como profissional"

#### Teste B: Sessão Avulsa com Cartão
1. Acesse `https://www.zunisuprema.com.br/checkout`
2. Preencha dados, escolha **Cartão**
3. Complete o pagamento (testes com Mercado Pago)
4. Redireciona de volta para checkout com `?sessionId=...&status=retorno`
5. Polling deve aguardar confirmação
6. Quando confirmado, redireciona para questionário
7. Mesmos testes A5a e 5b

#### Teste C: Sessões Extras (1ª sessão com questionário)
1. Acesse `https://www.zunisuprema.com.br/checkout` (ou página de venda de Sessões Extras se existir)
2. Compre um pacote de Sessões Extras
3. Após pagamento confirmado, Mercado Pago redireciona para `sessoes-extras-confirmacao.html?status=aprovado`
4. Página deve mostrar "Pagamento Confirmado!" e botão "Iniciar Minha Primeira Sessão →"
5. Clique no botão
   - ✓ Deve criar uma sessão para o cliente
   - ✓ Se é a 1ª vez, redireciona para `/questionario/timidez_comunicacao?sessionId=...&pacoteId=...`
6. **Teste 5c:** Responda e envie
   - ✓ Deve ir para chat.html com Resposta A

#### Teste D: Sessões Extras (2ª e 3ª sessões — SEM questionário)
1. Após teste 5c, você ainda tem 2 créditos no pacote
2. Saia do chat, volte à página inicial
3. Clique em "Iniciar Sessão" (ou acesso de Sessões Extras)
4. Vai para `sessoes-extras-confirmacao.html` de novo
5. Clique "Iniciar Minha Primeira Sessão →"
   - ✓ Desta vez, deve ir **direto** para chat.html (SEM questionário, porque já respondeu)

---

## 🚨 Problemas Esperados & Troubleshooting

### "Erro ao criar sessão em Sessões Extras"
- ✓ Verifique se a migração do banco foi executada
- ✓ Verifique se o endpoint `/api/sessoes-extras/iniciar-sessao` está no servidor (reload/reinicio)

### "Questionário não carrega em chat, vejo blank page"
- ✓ Verifique se `/questionario/timidez_comunicacao` rota existe (getRouter em server.js:610)
- ✓ Verifique console do browser por erros JavaScript

### "Questionário aparece 2x em Sessões Extras (na 2ª sessão também)"
- ✓ Verifique se a migração foi executada e coluna `questionario_respondido` existe
- ✓ Verifique se `marcarQuestionarioRespondido()` está sendo chamada

### "Link do e-mail aponta para página em branco"
- ✓ Verifique se `public/sessoes-extras-confirmacao.html` foi criado
- ✓ Verifique se o path está correto no `back_urls` do Mercado Pago

---

## 📋 Checklist de Validação

- [ ] Migrações SQL executadas (2 colunas novas no banco)
- [ ] Teste A: Sessão Avulsa PIX → Pular funcionando
- [ ] Teste A: Sessão Avulsa PIX → Responder funcionando + Resposta A visível
- [ ] Teste B: Sessão Avulsa Cartão → Questionário e chat funcionando
- [ ] Teste C: Sessões Extras → Primeira sessão com questionário
- [ ] Teste D: Sessões Extras → Segunda sessão SEM questionário repetido
- [ ] Botão WhatsApp ajustado quando vindo de questionário
- [ ] Nenhum erro no console do browser ou logs do servidor

---

## ✋ Quando Testar Completo

Só após todos os testes acima passarem, avise e farei:
1. Remoção da flag `testQuestionario=true` de `chat.html`
2. Commit final
3. Push para produção

**Sua confirmação = "Pronto, pode remover a flag!" ou relatar issues encontradas**

---

## 📌 Importante: Primeira Exposição a Clientes Reais

⚠️ **Esta é a primeira vez que um cliente REAL (não teste manual com flag) vai passar por este fluxo.** Os testes acima são críticos. Se houver qualquer problema que descobrir depois do push, será visível a clientes.

Faça com cuidado e teste tudo bem.
