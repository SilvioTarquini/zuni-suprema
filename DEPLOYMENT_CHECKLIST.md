# 🚀 Deployment Checklist — Sessões Extras

## Status Atual
- ✅ Código pushed para GitHub (branch `main`)
- ✅ Testes passando localmente
- ✅ Documentação completa
- ❌ Credenciais de PRODUÇÃO não configuradas
- ❌ Deployed em produção

---

## 📋 Checklist de Deployment

### 1. Preparação (HOJE)

- [ ] **Obter credenciais de PRODUÇÃO do MercadoPago**
  - Entrar em: https://www.mercadopago.com.br/admin
  - Ir para: Configurações → Credenciais
  - Copiar:
    - `Access Token` (começa com `APP_USR-`)
    - `Public Key` (começa com `APP_USR-`)
  
- [ ] **Atualizar `.env` com credenciais de PRODUÇÃO**
  ```bash
  MERCADOPAGO_TOKEN=APP_USR-<seu-token-production>
  MERCADOPAGO_PUBLIC_KEY=APP_USR-<sua-public-key-production>
  ```

- [ ] **Atualizar `FRONTEND_URL` se necessário**
  ```bash
  FRONTEND_URL=https://zuni-suprema.com.br  # (ou seu domínio)
  ```

- [ ] **Fazer commit com credenciais de produção**
  ```bash
  git add .env
  git commit -m "chore: credenciais de produção MercadoPago"
  git push
  ```

---

### 2. Deploy em Staging (RECOMENDADO)

Antes de produção, testar em staging (se disponível):

- [ ] **Deploy do código**
  ```bash
  # No seu servidor de staging
  git pull origin main
  npm install
  npm start
  ```

- [ ] **Verificar variáveis de ambiente**
  ```bash
  # Confirmar que .env foi carregado corretamente
  curl https://staging.zuni-suprema.com.br/api/mercadopago/public-key
  # Response deve mostrar public key de PRODUÇÃO (APP_USR-...)
  ```

- [ ] **Testar webhook**
  - Configurar MercadoPago para enviar webhooks para:
    ```
    https://staging.zuni-suprema.com.br/api/pagamento/webhook
    ```

- [ ] **Testar fluxo completo**
  1. POST `/api/checkout/sessoes-extras/preference`
  2. Receber link MercadoPago
  3. Fazer pagamento de teste
  4. Confirmar webhook recebido
  5. Verificar pacote criado no banco

- [ ] **Monitorar logs**
  ```bash
  # Verificar logs do webhook
  tail -f /var/log/zuni-suprema/server.log | grep WEBHOOK
  ```

---

### 3. Deploy em Produção

- [ ] **Backup do banco de dados**
  ```bash
  # Supabase já faz backup automático, mas confirmar
  # https://app.supabase.com → Seu projeto → Database → Backups
  ```

- [ ] **Deploy do código**
  ```bash
  # No seu servidor de produção
  git pull origin main
  npm install
  npm start
  # Ou via Docker/systemd, dependendo da setup
  ```

- [ ] **Verificar status da API**
  ```bash
  curl https://zuni-suprema.com.br/api/mercadopago/public-key
  # Response: {"publicKey":"APP_USR-..."}
  ```

- [ ] **Ativar webhook no MercadoPago**
  - Ir para: https://www.mercadopago.com.br/admin
  - Configurações → Notificações de IPN
  - Adicionar webhook URL:
    ```
    https://zuni-suprema.com.br/api/pagamento/webhook
    ```
  - Selecionar eventos:
    - ✅ order
    - ✅ payment

- [ ] **Teste com pagamento real (PEQUENO)**
  - Solicitar a você mesmo ou colega fazer 1 pagamento
  - Verificar:
    - ✅ Link MercadoPago funciona
    - ✅ Pagamento aprovado
    - ✅ Webhook recebido
    - ✅ Pacote criado no banco
    - ✅ Cliente vê créditos
    - ✅ Sessão consome crédito

- [ ] **Monitorar por 24h**
  - Verificar logs regularmente
  - Monitorar:
    - ✅ Nenhum erro 500
    - ✅ Webhooks sendo processados
    - ✅ Pacotes sendo criados
    - ✅ Clientes podem usar créditos

---

## 🔐 Segurança — Checklist

- [ ] **NUNCA commitar credenciais reais**
  - ✅ `.env` já está em `.gitignore`
  - ✅ Usar `git log` para verificar que nenhum token foi pushed

- [ ] **HTTPS habilitado**
  - Webhook URL DEVE ser HTTPS
  - MercadoPago não aceita HTTP em produção

- [ ] **Validações de webhook**
  - ✅ Verificar se pagamento é "approved"
  - ✅ Verificar se external_reference é válido
  - ✅ Verificar se email está no banco

- [ ] **Logs de segurança**
  - Verificar logs de erro
  - Alertar se webhook falha

---

## 📊 Monitoramento — Post-Deployment

### Métricas para monitorar:

```bash
# 1. Taxa de conversão
SELECT COUNT(*) FROM creditos_sessao 
WHERE DATE(criado_em) = TODAY()

# 2. Taxa de erro do webhook
SELECT COUNT(*) FROM webhook_logs 
WHERE status != 200 
AND DATE(criado_em) = TODAY()

# 3. Créditos consumidos
SELECT COUNT(*) FROM creditos_sessao 
WHERE creditos_restantes < creditos_iniciais 
AND DATE(criado_em) = TODAY()

# 4. Pacotes expirados
SELECT COUNT(*) FROM creditos_sessao 
WHERE expira_em < NOW() 
AND ativo = true
```

### Alertas para configurar:

- ❌ Webhook failure rate > 5%
- ❌ API response time > 2s
- ❌ Database connection errors
- ❌ MercadoPago API errors

---

## 🛠️ Troubleshooting Rápido

### Problema: Webhook não está sendo chamado

**Solução:**
1. Verificar se URL está registrada em https://www.mercadopago.com.br/admin
2. Verificar se URL é HTTPS e pública
3. Verificar logs do servidor: `tail -f /var/log/server.log | grep WEBHOOK`
4. Testar webhook manualmente:
   ```bash
   curl -X POST https://zuni-suprema.com.br/api/pagamento/webhook \
     -H "Content-Type: application/json" \
     -d '{"type":"order","data":{"id":"123"}}'
   ```

### Problema: Pacote não foi criado

**Solução:**
1. Verificar se webhook foi recebido (logs)
2. Verificar se external_reference começa com "se"
3. Verificar se pagamento tem status "approved"
4. Verificar BD: `SELECT * FROM pedidos_sessoes_extras_pendentes WHERE referencia LIKE 'se%'`

### Problema: Cliente não vê memória na 2ª sessão

**Solução:**
1. Verificar se pacote está ativo: `SELECT * FROM creditos_sessao WHERE email = 'cliente@email.com'`
2. Verificar se resumo foi salvo: `SELECT * FROM resumos_sessoes WHERE email = 'cliente@email.com'`
3. Verificar logs: `tail -f /var/log/server.log | grep "CREDITOS\|MEMORIA"`

---

## 📞 Contatos

### MercadoPago Support
- Email: support@mercadopago.com.br
- Chat: https://www.mercadopago.com.br/support

### Supabase Support
- Email: support@supabase.com
- Docs: https://supabase.com/docs

---

## 🎯 Timeline Recomendado

| Fase | Timeline | Ação |
|------|----------|------|
| **Prep** | Hoje (2h) | Obter credenciais, atualizar .env |
| **Staging** | Amanhã (4h) | Deploy, testes, monitorar |
| **Produção** | Dia seguinte (2h) | Deploy final, teste real |
| **Monitorar** | Próximos 7 dias | Verificar logs, métricas |

---

## ✅ Pronto para Deploy?

Responda SIM para todos:

- [ ] Credenciais de PRODUÇÃO obtidas?
- [ ] `.env` atualizado?
- [ ] Código em main branch?
- [ ] Testes passando localmente?
- [ ] Webhook URL registrada no MercadoPago?
- [ ] HTTPS habilitado?
- [ ] Banco de dados com tabelas criadas?

Se SIM em todos: **VOCÊ ESTÁ PRONTO PARA DEPLOY!** 🚀

---

## 📝 Notas

- ⚠️ Certifique-se de usar credenciais de PRODUÇÃO (não sandbox)
- ⚠️ Webhook URL DEVE ser HTTPS
- ⚠️ NUNCA commitar `.env` com credenciais reais
- ⚠️ Backup do banco antes de deploy
- ✅ Testes com pagamento real antes de avisar clientes

---

**Status:** Aguardando credenciais de produção  
**Próximo passo:** Seção 1 deste checklist
