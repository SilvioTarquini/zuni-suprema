# 🎯 Deploy Sessões Extras — Informação Crítica

## ✅ RESUMO EXECUTIVO

**NÃO é preciso NENHUMA credencial nova!**

"Sessões Extras" usa as **MESMAS credenciais de MercadoPago** que já processam:
- ✅ Pagamentos de Livros
- ✅ Pagamentos de Sessão Avulsa

---

## 🔍 Verificação Técnica

### Arquitetura de Credenciais

```
.env
  ↓
MERCADOPAGO_TOKEN ────→ mpClient (criado 1x em server.js linha 21)
MERCADOPAGO_PUBLIC_KEY   ↑
                         ├─→ Livros (prefixo "lv")
                         ├─→ Sessão Avulsa (sem prefixo)
                         └─→ Sessões Extras (prefixo "se")
```

### Como funciona:

**Em `src/server.js` (linha 21-22):**
```javascript
const mpClient = process.env.MERCADOPAGO_TOKEN
  ? new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_TOKEN })
  : null;
```

Uma única instância `mpClient` é criada e reutilizada por TODOS os produtos.

### Endpoints que usam a mesma conta:

| Produto | Endpoint | Status |
|---------|----------|--------|
| Livros | `POST /api/checkout/livro/preference` | ✅ Produção |
| Sessão Avulsa | `POST /api/checkout/preference` | ✅ Produção |
| Sessões Extras | `POST /api/checkout/sessoes-extras/preference` | ✅ Pronto |

---

## 📋 O que fazer antes de Deploy

### 1. Confirmar que `.env` tem credenciais de PRODUÇÃO

```bash
# Local do arquivo
~/.zuni-suprema/.env  # ou seu local de produção

# Deve conter:
MERCADOPAGO_TOKEN=APP_USR-<seu-token-production>  # (não TEST-...)
MERCADOPAGO_PUBLIC_KEY=APP_USR-<sua-public-key-production>
```

### 2. Confirmar que webhook está registrado

MercadoPago Dashboard → Configurações → Notificações de IPN

Deve ter:
```
POST https://zuni-suprema.com.br/api/pagamento/webhook
```

Este webhook processa:
- ✅ Pagamentos de Livros
- ✅ Pagamentos de Sessão Avulsa
- ✅ Pagamentos de Sessões Extras

### 3. Pronto para Deploy

Basta fazer pull do código:
```bash
git pull origin main
npm install
npm restart  # ou systemctl restart zuni-suprema
```

Nada de novo precisa ser configurado! ✅

---

## 🎯 O que muda após deploy

### Novo endpoint ativo:
```
POST /api/checkout/sessoes-extras/preference
```

### Novo fluxo de pagamento:
```
Cliente → MercadoPago → Webhook → Tabela "creditos_sessao" → 3 créditos criados
```

### Novo produto na conta MercadoPago:
- Nome: "Sessões Extras"
- Preço: R$ 74,90
- Descrição: "3 sessões com continuidade de jornada"
- External Reference: Começa com "se" (para diferençar de livros "lv")

---

## 🔒 Segurança

### ✅ O que está protegido:

1. **Isolamento de produtos** via `external_reference`:
   - Livro: `lv` + hex
   - Sessão Avulsa: sem prefixo (histórico)
   - Sessões Extras: `se` + hex

2. **Credenciais**:
   - `.env` está em `.gitignore` ✅
   - Nunca foi commitado ✅
   - Seguro em produção ✅

3. **Webhook**:
   - Verifica se pagamento é "approved"
   - Verifica se `external_reference` é válido
   - Cria pacote apenas se tudo ok

---

## ⚡ Deploy Checklist (Rápido)

- [ ] Confirmar `.env` tem token de PRODUÇÃO (não sandbox)
- [ ] Confirmar webhook está registrado no MercadoPago
- [ ] Pull `git pull origin main`
- [ ] `npm install` (se houver mudanças em dependencies)
- [ ] Restart aplicação
- [ ] Testar: `curl https://zuni-suprema.com.br/api/mercadopago/public-key`
- [ ] Testar com 1 pagamento real de teste

✅ Pronto! Sessões Extras começará a receber pagamentos automaticamente.

---

## 📊 O que vai aparecer no MercadoPago

Depois de alguns pagamentos, você verá:

### No Dashboard MercadoPago:
```
Movimentação Recent:
├─ R$ 19,90 — Livro: "Os Bastidores da Mente 1"
├─ R$ 29,90 — Sessão Avulsa
├─ R$ 74,90 — Sessões Extras ← NEW!
├─ R$ 74,90 — Sessões Extras
└─ ...
```

### No banco de dados (Supabase):
```
creditos_sessao:
├─ email: cliente1@email.com, créditos: 3 (novo pacote)
├─ email: cliente1@email.com, créditos: 2 (anterior, parcialmente usado)
└─ email: cliente2@email.com, créditos: 3 (novo pacote)
```

---

## 🚀 Timeline

| Quando | O que fazer | Tempo |
|--------|-----------|-------|
| Hoje | Confirmar .env tem credenciais | 5 min |
| Hoje | Pull do código | 5 min |
| Hoje | Restart servidor | 2 min |
| Hoje | Testar 1 pagamento | 10 min |
| **Total** | **Pronto para Produção!** | **~20 min** |

---

## 🎉 Resultado Final

✅ **Mesma conta MercadoPago**  
✅ **Mesma aplicação MercadoPago**  
✅ **Mesmas credenciais**  
✅ **Novo produto Sessões Extras (R$74,90)**  
✅ **Webhook processa tudo automaticamente**  
✅ **Nada novo para configurar**  

---

## ❓ FAQ

**P: E se as credenciais estiverem vencidas?**  
R: Vai dar erro no MercadoPago. Nesse caso, regenerar token em https://www.mercadopago.com.br/admin

**P: Preciso de conta MercadoPago separada?**  
R: Não! A mesma conta processa tudo.

**P: Os clientes veem que é MercadoPago?**  
R: Sim, mas é a mesma experiência que livros e sessão avulsa.

**P: Posso cancelar Sessões Extras depois?**  
R: Sim! Basta remover o endpoint. Creditos já criados continuam válidos.

---

## 📞 Próximas Ações

1. ✅ Confirmar credenciais em produção
2. ✅ Fazer pull do código
3. ✅ Restart servidor
4. ✅ **PRONTO!**

Sessões Extras entra em produção automaticamente! 🎯
