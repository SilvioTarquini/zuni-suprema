# Testing Mapa Integrado Checkout

Guia para testar o checkout do Mapa Integrado localmente.

## Pré-requisitos

1. **Chave API do AstroWay** (obrigatório)
   - Configure em `.env`: `ASTROWAY_API_KEY=sua_chave`
   - Sem essa chave, o cálculo do mapa falhará

2. **Tokens do Mercado Pago** (já configurados)
   - `MERCADOPAGO_TOKEN` - Token de teste
   - `MERCADOPAGO_PUBLIC_KEY` - Chave pública de teste

3. **FRONTEND_URL** (já configurado)
   - `.env`: `FRONTEND_URL=http://localhost:3000`

## Iniciar Servidor

```bash
PORT=8080 npm start
```

O servidor inicia em `http://localhost:8080`

## Acessar Checkout

```
http://localhost:8080/checkout-mapa-integrado.html
```

## Preencher Formulário

### Dados Pessoais
- **Nome**: Leonardo da Vinci (qualquer nome)
- **Email**: teste@example.com
- **CPF**: 12345678901

### Data de Nascimento
- **Data**: 1452-04-15 (ou qualquer data)
- **Hora**: 14:30 (ou qualquer hora)
- **Local**: São Paulo (use cidades conhecidas)

### Método de Pagamento
- Escolha: **PIX (QR Code)** para teste local

## Fluxo de Teste

1. **Preencher formulário** → Clica "Calcular Mapa e Pagar"

2. **Cálculo do mapa** → Spinner aparece
   - Se erro: Verifica se ASTROWAY_API_KEY está correto
   - Se sucesso: Vê posições planetárias

3. **QR Code PIX** → Aparece código e imagem
   - QR Code é válido mas **não é real**
   - Para teste: apenas verifica os endpoints

4. **Verificar Pagamento** → Botão disponível
   - Em produção: consulta Mercado Pago
   - Em teste: pode simular pagamento com:
     ```bash
     curl -X POST http://localhost:8080/api/pagamento/webhook \
       -H "Content-Type: application/json" \
       -d '{
         "type": "order",
         "data": {
           "id": "seu_pedido_id"
         }
       }'
     ```

5. **Sucesso** → Vai para página de sucesso
   - Mostra mapa calculado
   - Botão "Ir para o Chat"

## Testando com cURL

### 1. Criar Checkout (PIX)

```bash
curl -X POST http://localhost:8080/api/checkout/mapa-integrado \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Leonardo da Vinci",
    "email": "leonardo@example.com",
    "cpf": "12345678901",
    "birthDate": "1452-04-15",
    "birthTime": "14:30",
    "birthLocation": "São Paulo",
    "birthNameFull": "Leonardo",
    "metodoPagamento": "pix"
  }'
```

**Resposta esperada:**
```json
{
  "sessionId": "uuid-xxx",
  "pedidoId": "123456789",
  "qrCodeText": "00020126580014br.gov.bcb.pix...",
  "qrCodeImage": "data:image/png;base64,...",
  "mapaNatal": {
    "sol": { "sign": "Aries", "degree": 25.5 },
    "lua": { "sign": "Gemini", "degree": 12.3 },
    ...
  }
}
```

**Erros possíveis:**
- `400`: Dados incompletos ou inválidos
- `400`: "Erro ao calcular mapa: ASTROWAY_API_KEY não configurado"
- `502`: Erro no Mercado Pago

### 2. Verificar Status do Pedido

```bash
curl http://localhost:8080/api/checkout/mapa-integrado/status/123456789
```

**Resposta:**
```json
{
  "pago": false  // ou true
}
```

### 3. Verificar Status da Sessão

```bash
curl http://localhost:8080/api/checkout/mapa-integrado/session-status/uuid-xxx
```

**Resposta:**
```json
{
  "pago": false  // ou true
}
```

### 4. Criar com Mercado Pago Web Checkout

```bash
curl -X POST http://localhost:8080/api/checkout/mapa-integrado/preference \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Leonardo da Vinci",
    "email": "leonardo@example.com",
    "cpf": "12345678901",
    "birthDate": "1452-04-15",
    "birthTime": "14:30",
    "birthLocation": "São Paulo",
    "birthNameFull": "Leonardo"
  }'
```

**Resposta esperada:**
```json
{
  "sessionId": "uuid-xxx",
  "init_point": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=..."
}
```

## Simulando Pagamento no Webhook

Após criar o pedido, simule o pagamento para marcar a sessão como paga:

```bash
# Primeiro, obtenha o pedidoId da resposta anterior
PEDIDO_ID="123456789"

# Simule o webhook do Mercado Pago
curl -X POST http://localhost:8080/api/pagamento/webhook \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"order\",
    \"data\": {
      \"id\": \"$PEDIDO_ID\",
      \"status\": \"approved\"
    }
  }"
```

Depois verifique o status:
```bash
curl http://localhost:8080/api/checkout/mapa-integrado/status/$PEDIDO_ID
```

Deve retornar `{"pago": true}`

## Verificando Logs

Procure por linhas no console com prefixo `[MAPA-INTEGRADO]`:

```
[MAPA-INTEGRADO] Calculando mapa para Leonardo da Vinci...
[MAPA-INTEGRADO] Mapa calculado com sucesso. Créditos: 5
[MAPA-INTEGRADO] Pedido criado: 123456789 (sessão: uuid-xxx)
```

## Erros Comuns

### "ASTROWAY_API_KEY não configurado"
- Verifique `.env` tem: `ASTROWAY_API_KEY=sua_chave`
- Reinicie o servidor após adicionar

### "Não foi possível geocodificar"
- Use cidades conhecidas: São Paulo, Rio de Janeiro, Curitiba, etc.
- Ou forneça latitude/longitude diretamente (futuro)

### "Erro ao gerar QR Code PIX"
- Verifique `MERCADOPAGO_TOKEN` está correto
- Mercado Pago está respondendo com erro

### "Data inválida"
- Formato deve ser: `YYYY-MM-DD` (ex: 1990-05-15)
- Hora deve ser: `HH:MM` (ex: 14:30)

## Testando Integração ao Chat

Após sucesso do checkout:

1. Copie o `sessionId` da resposta
2. Acesse: `http://localhost:8080/chat.html?sessionId=seu_session_id`
3. A sessão deve estar pronta para chat

Verificar se o `mapaNatal` está disponível na sessão para usar como contexto no Mentor.

## Checklist de Testes

- [ ] Formulário valida campos vazios
- [ ] Cálculo de mapa funciona com cidades conhecidas
- [ ] QR Code PIX é exibido corretamente
- [ ] Verificação automática funciona
- [ ] Status de pagamento retorna corretamente
- [ ] Redirecionamento para chat funciona
- [ ] Dados do mapa são armazenados na sessão
- [ ] Erros são exibidos com mensagens claras
- [ ] Mercado Pago Web Checkout funciona
- [ ] Webhook marca sessão como paga

## Próximos Testes

1. Integrar ao Mentor
   - Verificar se mapaNatal é injetado no SYSTEM_PROMPT
   - Testar se o chat usa os dados do mapa

2. Adicionar numerologia
   - Incluir cálculo de números do destino
   - Exibir no checkout

3. Analytics
   - Rastrear conversões
   - Monitorar taxa de erro
