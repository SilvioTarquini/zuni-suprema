# Review: Mapa Integrado - Dados e Fluxo

## 1. DADOS RETORNADOS DO TESTE

O módulo `calcularMapaNatal()` retorna um objeto JSON completo com:

### Estrutura Retornada

```json
{
  "sucesso": true,
  "nome": "Leonardo da Vinci",
  "dataNascimento": "1452-04-15",
  "horaNascimento": "14:30",
  "localNascimento": "Vinci, Itália",
  "coordenadas": {
    "latitude": 43.7873966,
    "longitude": 10.9271055
  },
  "mapaNatal": {
    "sol": {
      "sign": "Aries",
      "degree": 25.7,
      "fullDegree": 25.7
    },
    "lua": {
      "sign": "Scorpio",
      "degree": 24.6,
      "fullDegree": 234.6
    },
    "ascendente": { "sign": "Unknown", "degree": 0 },
    "mercurio": { "sign": "Aries", "degree": 7.8, "fullDegree": 7.8 },
    "venus": { "sign": "Taurus", "degree": 14.4, "fullDegree": 44.4 },
    "marte": { "sign": "Aquarius", "degree": 10, "fullDegree": 310 },
    "jupiter": { "sign": "Aquarius", "degree": 30, "fullDegree": 330 },
    "saturno": { "sign": "Libra", "degree": 14.7, "fullDegree": 194.7 },
    "urano": { "sign": "Cancer", "degree": 22, "fullDegree": 112 },
    "netuno": { "sign": "Libra", "degree": 0.4, "fullDegree": 180.4 },
    "plutao": { "sign": "Leo", "degree": 5.1, "fullDegree": 125.1 }
  },
  "casas": {
    "system": "P",
    "cusps": [ ... 12 cusps ...],
    "ascendant": 200.99822521846048,
    "mc": 115.37346954585593,
    "vertex": 49.073302300911465,
    "coAscWK": 226.75325226647914,
    "polarAsc": 46.75325226647912
  },
  "aspectos": [
    {
      "planet1": "Sun",
      "planet2": "Jupiter",
      "type": {
        "name": "Sextile",
        "symbol": "⚹",
        "angle": 60,
        "isMajor": true,
        "color": "#3366cc"
      },
      "exactAngle": 55.74,
      "orb": 4.26,
      "isApplying": false
    },
    // ... 15 aspectos calculados ...
  ],
  "creditsUsed": 5,
  "timestamp": "2026-07-21T18:14:03.364Z"
}
```

### Dados Inclusos

**Posições Planetárias:**
- ✅ 10 planetas (Sol, Lua, Mercúrio, Vênus, Marte, Júpiter, Saturno, Urano, Netuno, Plutão)
- ✅ Signo zodiacal e graus (precisão: 0.1°)
- ✅ Graus completos (0-360°)

**Casas Astrológicas:**
- ✅ 12 cusps (house system Placidus)
- ✅ Ascendente (Asc)
- ✅ Meio do Céu (MC)
- ✅ Vértex

**Aspectos Planetários:**
- ✅ 16 aspectos maiores (Sextile, Trine, Square, Opposition, Conjunction)
- ✅ Ângulo exato e orbe (margem de erro)
- ✅ Status aplicante/separante

**Coordenadas:**
- ✅ Latitude e Longitude do local de nascimento
- ✅ Obtidas via geocodificação automática

**Metadados:**
- ✅ Créditos utilizados: 5 (por mapa)
- ✅ Timestamp: ISO 8601

---

## 2. O QUE checkout-mapa-integrado.html FAZ

### Escopo Atual

**checkout-mapa-integrado.html é APENAS uma interface de coleta e pagamento.**

Ele NÃO está integrado ao chat do Mentor. O mapa fica exclusivamente na loja/checkout.

### Fluxo Passo-a-Passo

```
┌─────────────────────────────────────────────────────┐
│  1. Usuário acessa: /checkout-mapa-integrado.html  │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  2. Preenche formulário HTML                        │
│     - Nome, Email, CPF                              │
│     - Data/Hora/Local de nascimento                 │
│     - Seleciona método de pagamento                 │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  3. Clica "Calcular Mapa e Pagar"                   │
│     → JavaScript valida formulário (local)          │
│     → Mostra spinner "Calculando..."                │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  4. Faz requisição HTTP POST                        │
│     → POST /api/checkout/mapa-integrado             │
│     → Envia dados de nascimento                     │
│     → Backend chama calcularMapaNatal()             │
│     → Backend cria pedido no Mercado Pago           │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  5. Backend retorna resposta                        │
│     - sessionId (novo)                              │
│     - pedidoId (Mercado Pago)                       │
│     - qrCodeText (PIX)                              │
│     - qrCodeImage (base64)                          │
│     - mapaNatal (posições planetárias)              │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  6. Frontend exibe mapa natal                       │
│     - Mostra Sol, Lua, Mercúrio, Vênus, etc        │
│     - Mostra QR Code PIX                           │
│     - Mostra código para copiar                     │
└─────────────────────────────────────────────────────┘
                         ↓
        ┌────────────────┴────────────────┐
        ↓                                 ↓
   ┌─────────────┐            ┌──────────────────┐
   │ PIX (5 seg) │            │ Cartão (Redirect)│
   └─────────────┘            └──────────────────┘
        ↓                             ↓
   Escaneia QR Code        Redireciona para
   ou copia código         Mercado Pago web
        ↓                             ↓
   Pagamento local         Pagamento externo
        ↓                             ↓
   └────────────────┬────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  7. Verifica pagamento a cada 5 segundos            │
│     → GET /api/checkout/mapa-integrado/status      │
│     → Webhook Mercado Pago marca como pago         │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│  8. Sucesso - Mostra tela de conclusão             │
│     - Exibe mapa confirmado                         │
│     - Botão "Ir para o Chat"                        │
│     - Redireciona para /chat.html?sessionId=xxx    │
└─────────────────────────────────────────────────────┘
```

### O que Acontece em Cada Etapa

#### Etapa 1: Carregamento
- Verifica URL para saber se é retorno de Mercado Pago
- Se sim, mostra spinner e verifica status

#### Etapa 2: Formulário (Frontend)
- Validação básica do HTML5 (`required`, `type="date"`, `type="email"`)
- Não chama backend ainda
- Usuário preenche tudo localmente

#### Etapa 3: Submissão (Frontend)
- Valida CPF (11 dígitos)
- Escolhe PIX ou Cartão
- Decide qual função chamar

#### Etapa 4: Requisição HTTP
**Opção A - PIX:**
```
POST /api/checkout/mapa-integrado
{
  name: "...",
  email: "...",
  cpf: "...",
  birthDate: "1990-05-15",
  birthTime: "14:30",
  birthLocation: "São Paulo",
  birthNameFull: "...",
  metodoPagamento: "pix"
}
```

**Opção B - Cartão:**
```
POST /api/checkout/mapa-integrado/preference
{
  name, email, cpf, birthDate, birthTime, birthLocation, birthNameFull
}
```

#### Etapa 5-6: Backend Processa

**No servidor (server.js):**

```javascript
1. Valida entrada
2. Chama calcularMapaNatal() via astro.js
   - Se erro: retorna 400 com mensagem
   - Se sucesso: continua
3. Cria sessão no Supabase com:
   - sessionId (UUID)
   - Dados pessoais
   - mapaNatal (completo)
   - coordenadas
   - creditsUsed: 5
   - paid: false
4. Cria pedido no Mercado Pago (R$ 49,90)
5. Retorna ao frontend:
   - sessionId
   - pedidoId
   - qrCode
   - mapaNatal (para exibir)
```

#### Etapa 7-8: Pagamento

**PIX:**
- Verifica status a cada 5 segundos
- Webhook Mercado Pago marca pedido como pago
- Webhook atualiza sessão: `paid: true`
- Frontend navega para sucesso

**Cartão:**
- Redireciona para Mercado Pago
- Volta com auto_return ou callback
- Mesmo fluxo do PIX a partir daqui

#### Etapa 8: Redirecionamento

```javascript
window.location.href = `/chat.html?sessionId=${sessionId}`;
```

- Usuário vai para chat
- Chat usa sessionId para buscar dados
- **Mapa NÃO é usado no Mentor** (escopo atual)

---

## 3. ISOLAMENTO: MAPA NÃO VAI PARA O MENTOR

### Confirmação de Escopo

**O mapa fica APENAS na loja:**
- ✅ Calculado no checkout (`/api/checkout/mapa-integrado`)
- ✅ Armazenado na sessão (banco de dados)
- ✅ Exibido no HTML do checkout (antes do pagamento)
- ✅ NÃO injetado no `SYSTEM_PROMPT` do Mentor
- ✅ NÃO disponível nas rotas de chat (`/api/chat`)
- ✅ NÃO influencia a resposta do Mentor

### Arquivo de Sessão

```json
{
  sessionId: "uuid",
  paid: false,          // ← true após pagamento
  mapaNatal: { ... },   // ← Armazenado aqui
  history: [],          // ← Usado pelo chat
  productType: "mapa-integrado",
  counter: 0
}
```

**Observação:** O mapa está no banco mas NÃO é usado pelo Mentor.
Se quisermos usar depois, seria necessário modificar:
1. `SYSTEM_PROMPT` (no server.js)
2. Rotas de chat (para buscar `session.mapaNatal`)
3. Documentação do cliente

---

## 4. O QUE NÃO ESTÁ IMPLEMENTADO

❌ Numerologia (endpoint não existe em AstroWay ainda)
❌ Integração com Mentor (escopo fora do checkout)
❌ Página de apresentação do produto
❌ Analytics/tracking
❌ Cache de mapas

---

## 5. PREÇO E CRÉDITOS

- **Preço ao usuário:** R$ 49,90
- **Créditos AstroWay:** 5 por mapa
- **Plano gratuito:** 10.000 créditos/mês
- **Capacidade:** ~2.000 mapas/mês (~66/dia)

---

## 6. FLUXO DE ERROS

**Erro de Cálculo:**
```
POST /api/checkout/mapa-integrado → 400
{ error: "Não foi possível geocodificar..." }
Frontend: mostra erro, volta ao formulário
Nenhum pagamento foi criado
```

**Erro de Pagamento:**
```
POST /api/checkout/mapa-integrado → 502
{ error: "Erro ao criar pedido no Mercado Pago" }
Frontend: mostra erro
Sessão criada mas sem pedido
```

**Sessão sem Pagamento:**
```
GET /api/checkout/mapa-integrado/status/pedidoId → 200
{ pago: false }
Frontend: continua aguardando
```

---

## 7. TABELA RESUMIDA

| Item | Status | Localização |
|------|--------|------------|
| Cálculo do mapa | ✅ Pronto | `calcularMapaNatal()` |
| Armazenamento | ✅ Pronto | Sessão Supabase |
| PIX | ✅ Pronto | checkout-mapa-integrado.html |
| Cartão (Mercado Pago) | ✅ Pronto | checkout-mapa-integrado.html |
| Exibição no checkout | ✅ Pronto | HTML após cálculo |
| Redirecionamento para chat | ✅ Pronto | Após sucesso |
| Integração com Mentor | ❌ Não | (Escopo fora) |
| Numerologia | ❌ Não | (API não tem endpoint) |

---

## Conclusão

**checkout-mapa-integrado.html é uma página de COLETA + PAGAMENTO, não integração com Mentor.**

O mapa é:
- Calculado quando necessário
- Armazenado no banco
- Exibido como "prévia" antes do pagamento
- Completamente isolado do chat

Se no futuro quisermos usar o mapa no Mentor, será uma mudança separada que modifica rotas de chat + SYSTEM_PROMPT. Hoje, o mapa é um "produto independente" da loja.
