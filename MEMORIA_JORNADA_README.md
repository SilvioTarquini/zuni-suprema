# 🧠 Memória de Jornada do Mentor

Sistema de continuidade de jornada do Mentor ZUNI Suprema que salva resumos curtos de cada sessão para enriquecer futuras conversas. **Desativado por padrão** até que o plano de assinatura seja definido.

## Como Funciona

### 1. Geração de Resumo (Background)
Ao final de cada sessão do Mentor:
- Um resumo curto (2-3 frases) é gerado via Claude
- Temas tratados, pontos-chave e encaminhamentos são extraídos
- Salvo no banco com o email do cliente

### 2. Injeção de Contexto (Sob Flag)
Quando o cliente retorna (mesmo email) em nova sessão:
- Se `MEMORIA_JORNADA_ATIVA=true`, resumos anteriores são buscados
- Contexto é injetado no SYSTEM_PROMPT do Mentor
- Continuidade de jornada é preservada sem citar explicitamente

### 3. Comportamento Padrão (Flag Desligada)
- Resumos continuam sendo gerados e salvos
- Mas NÃO são injetados no prompt
- Sistema funciona exatamente como hoje

## Instalação

### 1. Criar a Tabela no Supabase

Acesse seu projeto no [Supabase Dashboard](https://app.supabase.com) e execute este SQL no **SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS resumos_sessoes (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR NOT NULL,
  session_id UUID NOT NULL,
  resumo TEXT NOT NULL,
  temas VARCHAR DEFAULT NULL,
  data_sessao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resumos_email ON resumos_sessoes(email);
CREATE INDEX IF NOT EXISTS idx_resumos_data ON resumos_sessoes(data_sessao DESC);
CREATE INDEX IF NOT EXISTS idx_resumos_session ON resumos_sessoes(session_id);
```

### 2. Verificar Ambiente

Seu `.env` já tem as variáveis necessárias:
```
SUPABASE_URL=...
SUPABASE_KEY=...
ANTHROPIC_API_KEY=...
```

Confirme que `MEMORIA_JORNADA_ATIVA` está ausente ou `false`:
```
# .env (padrão)
MEMORIA_JORNADA_ATIVA=false
```

### 3. Iniciar o Servidor

```bash
# Desativado (padrão)
npm start
# Ou explicitamente:
# MEMORIA_JORNADA_ATIVA=false npm start

# Ativado (quando pronto)
# MEMORIA_JORNADA_ATIVA=true npm start
```

## Ativação

Quando o plano de assinatura estiver pronto, ative com:

```bash
MEMORIA_JORNADA_ATIVA=true npm start
```

Ou no arquivo `.env`:
```
MEMORIA_JORNADA_ATIVA=true
```

## Arquitetura

### Arquivos Novos
- `src/lib/memoriaSessoes.js` — Lógica de memória (geração, busca, injeção)
- `criar-tabela-resumos.js` — Script de setup (instruções)
- `inicializar-memoria-jornada.js` — Validação da tabela

### Modificações
- `src/server.js`:
  - Import do módulo `memoriaSessoes`
  - Injeção de contexto no `/api/chat` (linha ~1298)
  - Geração de resumo no `gerarEEnviarRelatorio` (background)

## Fluxo de Dados

```
Sessão 1:
┌─────────────────────────────────────────────┐
│ Cliente conversa com Mentor                 │
│ (sem contexto de jornada, flag=false)       │
└─────────────────────────────────────────────┘
                    ↓
        Sessão encerrada (15 mensagens)
                    ↓
        ┌──────────────────────────┐
        │ Background (setTimeout)  │
        │ 1. Gera resumo via IA    │
        │ 2. Salva no BD           │
        └──────────────────────────┘

Sessão 2 (mesma pessoa):
┌─────────────────────────────────────────────┐
│ Cliente inicia nova sessão                  │
└─────────────────────────────────────────────┘
                    ↓
        Se MEMORIA_JORNADA_ATIVA=true:
        1. Busca resumos anteriores (por email)
        2. Injeta no SYSTEM_PROMPT
        3. Mentor responde com continuidade
```

## Testing Localmente

### Teste 1: Verificar que Resumos são Salvos (Flag Desligada)

```bash
# Com a flag desligada (padrão)
npm start

# Fazer uma sessão de teste completa (15 mensagens)
# Ao final, verificar no Supabase se resumo foi salvo

# No Supabase Dashboard → Table Editor → resumos_sessoes
# Deve haver uma linha com email, sessionId e resumo
```

### Teste 2: Confirmar que Comportamento Não Muda (Flag Desligada)

```bash
# Resposta do Mentor deve ser IDÊNTICA quer a flag esteja ligada ou desligada
# Quando flag=false, resumos não afetam o prompt
```

### Teste 3: Verificar Injeção (Quando Flag Ativa)

```bash
# MEMORIA_JORNADA_ATIVA=true npm start

# Fazer duas sessões do mesmo email
# Na segunda sessão, o Mentor deve mencionar/reconhecer contexto anterior
# (sem citar explicitamente "Na sessão passada...")
```

## Padrão de Resumo Gerado

Exemplo de resumo salvo:

```
"Cliente explorou raiz de ansiedade ligada a perfectcionismo.
Identificado padrão de sobrecarga mental e falta de ritmo. 
Orientação: começar prática de presença corporal 5min/dia."
```

## API Interna

### `gerarResumoSessao(session)`
Gera resumo curto da sessão via Claude.
- Input: `{ history, email, name }`
- Output: String (resumo)

### `salvarResumoSessao({ email, sessionId, resumo, session })`
Salva resumo no Supabase.
- Retorna: Promise<void>
- Falha silenciosamente (background)

### `buscarResumosAnteriores(email, limite=3)`
Busca últimos N resumos de um email.
- Retorna: Array<Object>
- Vazio se flag=false ou email não encontrado

### `injetarContextoJornada(systemPrompt, email, name)`
Injeta contexto de jornada no prompt.
- Modifica: SYSTEM_PROMPT
- Retorna: String (prompt modificado)

## Considerações de Privacidade

- Resumos são vinculados ao email (não anônimos)
- Armazenados no Supabase (mesma infra do resto da app)
- Apenas o resumo é salvo (transcrição completa não é guardada)
- Pode ser apagado/desativado por requisição do cliente

## Roadmap

1. ✅ Salvar resumos automaticamente (background)
2. ✅ Injetar contexto quando flag ativa
3. ⏳ Plano de assinatura definido → ligar flag
4. ⏳ UI de histórico de jornada (portal do cliente)
5. ⏳ Exportar jornada em PDF
6. ⏳ Analytics de jornada (temas recorrentes, etc)

## Troubleshooting

### Tabela não existe
```
Error: Could not find the table 'public.resumos_sessoes'
```
Execute o SQL de criação no Supabase Dashboard.

### Resumos não salvam
Verifique que `ANTHROPIC_API_KEY` está correto. Geração falha silenciosamente (não quebra a sessão).

### Contexto não injeta
Verifique que `MEMORIA_JORNADA_ATIVA=true` está no `.env` ou no comando.

## Contato

Qualquer dúvida sobre a implementação, consulte o módulo `src/lib/memoriaSessoes.js`.
