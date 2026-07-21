# Configuração da Integração AstroWay

Este documento explica como configurar e testar a integração com a API AstroWay para cálculos de mapas astrológicos e numerológicos.

## 1. Criar Conta Gratuita

1. Acesse [api.astroway.info/dashboard/sign-up](https://api.astroway.info/dashboard/sign-up)
2. Preencha o cadastro:
   - Email
   - Senha
   - Confirme a senha
3. Clique em "Sign Up"
4. Verifique seu email e confirme a conta

## 2. Obter Chave de API

1. Faça login no [Dashboard do AstroWay](https://api.astroway.info/dashboard)
2. No menu esquerdo, clique em "API Keys"
3. Copie sua chave de API (algo como: `sk_live_xxxxxxxxxxxxx`)

**Plano Gratuito:**
- 10.000 créditos/mês
- Cada mapa natal = ~5 créditos
- Cada cálculo numerológico = ~2 créditos

## 3. Configurar em Desenvolvimento

### .env Local

No arquivo `.env` local, atualize a variável:

```bash
ASTROWAY_API_KEY=sua_chave_api_aqui
```

**Importante:** Não commitar `.env` com a chave real!

### Testar Localmente

```bash
node scripts/testar-astro.js
```

Você verá:
```
✅ Conta conectada!
   Plano: free
   Créditos disponíveis: 10000/10000
   Próxima renovação: 2025-08-21

✅ Mapa natal calculado com sucesso!
   ☀️  Sol:       Aries (25°)
   🌙 Lua:       Aquarius (12°)
   ↑ Ascendente: Scorpio (18°)
   ...
```

## 4. Configurar em Produção (Railway)

1. Acesse o [Dashboard do Railway](https://railway.app)
2. Selecione o projeto `zuni-suprema`
3. Vá para "Variables"
4. Adicione nova variável:
   - **Key:** `ASTROWAY_API_KEY`
   - **Value:** Cole sua chave de API

5. Clique em "Add" e redeploy a aplicação

## 5. Estrutura do Módulo

### Arquivo Principal: `src/lib/astro.js`

Exporta 5 funções:

#### `calcularMapaNatal(dados)`
Calcula o mapa astrológico natal.

**Entrada:**
```javascript
{
  nome: "Silvio Tarquini",
  dataNascimento: "1990-05-15",
  horaNascimento: "14:30",
  localNascimento: "São Paulo"
}
```

**Saída (sucesso):**
```javascript
{
  sucesso: true,
  nome: "Silvio Tarquini",
  mapaNatal: {
    sol: { sign: "Taurus", degree: 25 },
    lua: { sign: "Virgo", degree: 12 },
    ascendente: { sign: "Leo", degree: 18 },
    // ... outros planetas
  },
  casas: [...],
  aspectos: [...],
  creditsUsed: 5,
  timestamp: "2025-07-21T14:30:00Z"
}
```

**Saída (erro):**
```javascript
{
  sucesso: false,
  erro: "Descrição do erro",
  dados: { nome: "...", dataNascimento: "..." }
}
```

#### `calcularNumerologia(nome, dataNascimento)`
Calcula números do destino.

**Entrada:**
```javascript
calcularNumerologia("Silvio Tarquini", "1990-05-15")
```

**Saída:**
```javascript
{
  sucesso: true,
  numerologia: {
    caminhoDeVida: 7,
    destino: 8,
    anoPersonal: 5,
    mesPersonal: 3,
    diaPersonal: 1
  },
  creditsUsed: 2
}
```

#### `verificarStatus()`
Verifica créditos e status da conta.

**Saída:**
```javascript
{
  sucesso: true,
  conta: {
    plano: "free",
    creditosDisponíveis: 9993,
    creditosTotais: 10000,
    creditosUsados: 7,
    dataRenovacao: "2025-08-21"
  }
}
```

#### `validarDadosNascimento(dados)`
Valida formato de entrada (uso interno).

#### `geocodificarLocal(localNascimento)`
Converte nome de cidade em coordenadas (uso interno).

## 6. Tratamento de Erros

O módulo trata automaticamente:

### `Erro: ASTROWAY_API_KEY não configurado`
- **Causa:** Variável de ambiente não definida
- **Solução:** Configure em `.env` ou no Railway

### `Erro: Autenticação falhou: chave API inválida`
- **Causa:** Chave digitada errada ou revogada
- **Solução:** Copie novamente do dashboard

### `Erro: Limite de créditos excedido`
- **Causa:** Excedeu 10.000 créditos/mês (plano gratuito)
- **Solução:** Aguarde renovação ou upgrade para plano pago

### `Erro: Dados de nascimento incompletos`
- **Causa:** Faltam campos obrigatórios
- **Solução:** Valide antes de chamar

### `Erro: Não foi possível geocodificar`
- **Causa:** Local não existe ou nome digitado errado
- **Solução:** Use cidade conhecida (São Paulo, Rio de Janeiro, etc.)

## 7. Geocodificação de Locais

O módulo usa:
1. **Base local:** Cidades brasileiras comuns (pré-configuradas, sem chamada HTTP)
2. **OpenStreetMap:** Para cidades não encontradas (geocodificação aberta)

Cidades pré-configuradas:
- São Paulo, Rio de Janeiro, Belo Horizonte
- Brasília, Curitiba, Salvador
- Fortaleza, Manaus, Recife
- Porto Alegre, Caieiras, Campinas

## 8. Usando no Checkout do Mapa Integrado

**Exemplo de integração futura:**

```javascript
const { calcularMapaNatal } = require('./lib/astro');

app.post('/api/checkout/mapa-integrado', async (req, res) => {
  const { nome, email, cpf, dataNascimento, horaNascimento, localNascimento } = req.body;

  // Calcular mapa
  const mapa = await calcularMapaNatal({
    nome,
    dataNascimento,
    horaNascimento,
    localNascimento
  });

  if (!mapa.sucesso) {
    return res.status(400).json({ error: mapa.erro });
  }

  // Salvar mapa no banco junto à sessão
  const session = {
    // ... dados de sessão
    mapaNatal: mapa.mapaNatal,
    creditsUsed: mapa.creditsUsed
  };

  // ... continuar checkout
});
```

## 9. Documentação da API AstroWay

- [API Reference](https://api.astroway.info/docs)
- [Pricing](https://api.astroway.info/pricing)
- [Status](https://status.astroway.info)

## 10. Notas de Desenvolvimento

- ✅ Módulo isolado e testável
- ✅ Sem dependências externas (usa `fetch` nativa do Node.js)
- ✅ Tratamento robusto de erros
- ✅ Geocodificação automática
- ✅ Pronto para integração ao checkout

**Não está integrado ainda ao:** checkout, Mentor, API pública

**Próximas tarefas:**
- [ ] Integrar ao checkout de Mapa Integrado
- [ ] Armazenar mapa natal no Supabase
- [ ] Usar contexto do mapa no Mentor
- [ ] Considerar cache de mapas
