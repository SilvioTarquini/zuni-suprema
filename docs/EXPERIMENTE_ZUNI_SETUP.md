# Experimente a ZUNI — Setup e Testes

## Status: Módulo A (Numerologia) + Código-convite ✅ Implementado

### O que foi implementado

1. **Lib de Numerologia** (`src/lib/numerologia.js`)
   - Cálculo pitagórico de Caminho de Vida
   - Cálculo de Número da Essência
   - Integração com base RAG (fallback: interpretações genéricas)

2. **Lib de Códigos-convite** (`src/lib/codigosExperimente.js`)
   - Validação server-side de códigos
   - Registro de acessos e métricas
   - CRUD para administração de códigos

3. **Lib de Captura de Leads** (`src/lib/capturasExperimente.js`)
   - Disparo de e-mails via SendGrid
   - Registro de capturas no banco de dados

4. **Landing HTML** (`public/experimente.html`)
   - Layout responsivo (desktop + mobile)
   - Design navy/dourado
   - Formulários de código-convite e numerologia

5. **JavaScript do Cliente** (`public/js/experimente-client.js`)
   - Validação de formulários
   - Chamadas aos endpoints
   - Gerenciamento de estado da sessão

6. **3 Endpoints REST**
   - `POST /api/experimente-validar-codigo` — valida código-convite
   - `POST /api/experimente-calcular-numerologia` — calcula Caminho de Vida + Essência
   - `POST /api/experimente-capturar-lead` — captura e-mail e dispara SendGrid
   - `GET /experimente` — serve a landing

7. **Tabelas Supabase**
   - `codigos_experimente` — códigos-convite com métricas
   - `acessos_experimente` — registro de acessos por IP (opcional)
   - `capturasExperimente` — leads capturados

---

## Instruções de Teste (Local)

### 1. Preparar ambiente

```bash
# Ativar venv
. .venv/Scripts/Activate.ps1

# Instalar dependências (se necessário)
npm install

# Verificar .env tem SENDGRID_API_KEY (opcional para testes locais)
```

### 2. Iniciar servidor

```bash
npm run dev
```

Server deve estar escutando em `http://localhost:8080`.

### 3. Acessar landing

Abra no navegador:
```
http://localhost:8080/experimente
```

### 4. Testes manuais

#### Teste A: Validar código-convite
1. Insira código `EXPERIMENTE` no campo "Seu Tíquete de Acesso"
2. Clique "Validar"
3. Esperado: ✓ Código válido! + Módulo A desbloqueado

#### Teste B: Calcular numerologia
1. Preencha "Nome Completo" (ex: "João Silva")
2. Preencha "Data de Nascimento" (ex: 1990-03-15)
3. Clique "Calcular Meu Perfil"
4. Esperado: Exibe Caminho de Vida + Essência + Interpretação

#### Teste C: Capturar lead (com SendGrid)
1. (Após cálculo) Preencha seu e-mail (ex: teste@example.com)
2. Marque checkbox de consentimento
3. Clique "Enviar Meu Resultado"
4. Esperado: 
   - ✓ E-mail enviado com sucesso!
   - E-mail recebido em sua caixa (se SENDGRID_API_KEY configurada)

#### Teste D: Bloco de oferta
- Após envio bem-sucedido, bloco amarelo ("Gostou? Aprofunde...") aparece
- Contém links para Mentor, Livros, Mapa Integrado

---

## Checklist de Validação (Antes de Deploy)

- [ ] Landing carrega em http://localhost:8080/experimente
- [ ] Código `EXPERIMENTE` valida corretamente
- [ ] Numerologia calcula Caminho de Vida e Essência
- [ ] E-mail é enviado (se SENDGRID_API_KEY ativo)
- [ ] Captura registra no Supabase (`capturasExperimente`)
- [ ] Métrica de acessos atualiza (`codigos_experimente.total_acessos`)
- [ ] Design é responsivo (testar em mobile)
- [ ] Não há erros de console (F12)
- [ ] Rate limiting funciona (curl 50+ requests rápido testa)

---

## Códigos de Teste Disponíveis

Inseridos na migração:

| Código | Validade | Origem | Status |
|--------|----------|--------|--------|
| `EXPERIMENTE` | 2026-08-21 | teste | ✅ ativo |
| `EXPERIMENTE-FB` | 2026-08-21 | facebook | ✅ ativo |
| `EXPERIMENTE-IG` | 2026-08-21 | instagram | ✅ ativo |

---

## Próximas Etapas (Módulos B, C, D)

### Módulo B (Astrologia — Signo Solar)
- Cálculo de signo solar em JavaScript (sem AstroWay)
- Base RAG astrológica (35 blocos)
- Custo: zero

### Módulo C (Chat Limitado — Mentor)
- Rota isolada `/api/experimente-chat`
- Limite de 3-5 trocas por IP
- Custo: Claude API (controlado por limite)

### Módulo D (Livro Vivo Degustação)
- Primeiro capítulo em versão pública
- Chat do livro com `livro_id` de degustação
- Reutiliza `/api/livro-chat`

---

## Isolamento Garantido

✅ **`/api/chat` (Mentor pago)**: intacto
✅ **SYSTEM_PROMPT**: intacto
✅ **`lib/astro.js` / AstroWay**: intacto (Módulo B terá signo solar próprio)
✅ **Checkout de livros/Mapa**: intacto
✅ **Fila de pendências mobile/pagamento**: não afetada

---

## Deploy

Conforme DEPLOY.md:

```bash
git add .
git commit -m "feat: Experimente a ZUNI — Módulo A (Numerologia) + Código-convite"
git push origin main
```

Railway fará redeploy automaticamente.

---

## Troubleshooting

**E-mail não enviado?**
- Verificar `SENDGRID_API_KEY` em `.env`
- Verificar `SENDGRID_FROM_EMAIL` (padrão: noreply@zunisuprema.com.br)
- Ver logs do console do servidor

**Código não valida?**
- Verificar se `SUPABASE_URL` e `SUPABASE_KEY` estão corretos
- Verificar se tabela `codigos_experimente` foi criada (via Supabase Studio)
- Verificar se código existe na tabela

**Design quebrado?**
- Limpar cache (Ctrl+Shift+R)
- Verificar se `public/experimente.html` foi criado
- Verificar se `public/js/experimente-client.js` foi criado

---

## Documentação Relacionada

- `docs/Especificacao_Experimente_a_ZUNI.md` — especificação completa
- `DEPLOY.md` — instruções de deploy
- `src/lib/numerologia.js` — lógica de cálculo
- `src/lib/codigosExperimente.js` — validação de códigos
- `src/lib/capturasExperimente.js` — SendGrid + banco

---

*Última atualização: 2026-07-21*
