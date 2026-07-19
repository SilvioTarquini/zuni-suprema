# 📦 Sessões Extras - Setup de Banco de Dados

## Tabela: `creditos_sessao`

Execute este SQL no **SQL Editor** do seu projeto Supabase:

```sql
-- Tabela de créditos de sessão (Sessões Extras)
CREATE TABLE IF NOT EXISTS creditos_sessao (
  id BIGSERIAL PRIMARY KEY,
  pacote_id UUID NOT NULL UNIQUE,
  email VARCHAR NOT NULL,
  payment_id VARCHAR DEFAULT NULL,
  creditos_iniciais INT NOT NULL DEFAULT 3,
  creditos_restantes INT NOT NULL DEFAULT 3,
  data_pagamento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_sessao_id UUID DEFAULT NULL,
  data_ultima_sessao TIMESTAMPTZ DEFAULT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_creditos_email ON creditos_sessao(email);
CREATE INDEX IF NOT EXISTS idx_creditos_ativo ON creditos_sessao(ativo);
CREATE INDEX IF NOT EXISTS idx_creditos_expiracao ON creditos_sessao(expira_em);
CREATE INDEX IF NOT EXISTS idx_creditos_payment ON creditos_sessao(payment_id);

-- Comentário
COMMENT ON TABLE creditos_sessao IS 'Créditos de sessão do Mentor para pacotes "Sessões Extras" — 3 sessões por R$74,90 com memória de jornada ativa dentro do pacote';
```

## Tabela: `resumos_sessoes` (Memória de Jornada)

```sql
-- Tabela de resumos de sessões (Memória de Jornada)
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

## Tabela: `pedidos_sessoes_extras_pendentes` (MercadoPago Webhook)

```sql
-- Tabela de pedidos pendentes de Sessões Extras (usada para correlacionar payments do MP com dados do cliente)
CREATE TABLE IF NOT EXISTS pedidos_sessoes_extras_pendentes (
  id BIGSERIAL PRIMARY KEY,
  referencia VARCHAR NOT NULL UNIQUE,
  nome VARCHAR DEFAULT NULL,
  email VARCHAR NOT NULL,
  cpf VARCHAR DEFAULT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_se_referencia ON pedidos_sessoes_extras_pendentes(referencia);
CREATE INDEX IF NOT EXISTS idx_pedidos_se_email ON pedidos_sessoes_extras_pendentes(email);
```

## Passos

1. Acesse seu projeto no [Supabase Dashboard](https://app.supabase.com)
2. Vá para **SQL Editor** (menu esquerdo)
3. Clique em **New Query**
4. Cole o SQL acima
5. Clique em **Run**
6. Volte aqui e execute o teste: `node testar-sessoes-extras.js`

## Verificação

Após criar a tabela, você deve ver:
- Table: `creditos_sessao`
- Table: `resumos_sessoes` (se já não existia)
- Índices criados automaticamente

---

**Pronto?** Execute o teste:
```bash
node testar-sessoes-extras.js
```
