-- Migração: Criar tabelas para landing "Experimente a ZUNI"
-- Data: 2026-07-21
-- Módulo A: Numerologia + Código-convite

-- Tabela 1: Códigos-convite (tíquetes de acesso)
CREATE TABLE IF NOT EXISTS codigos_experimente (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  validade_ate DATE,
  origem TEXT,
  criado_em TIMESTAMP DEFAULT now(),
  atualizado_em TIMESTAMP DEFAULT now(),
  total_acessos INT DEFAULT 0,
  emails_capturados INT DEFAULT 0
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_codigos_experimente_codigo ON codigos_experimente(codigo);
CREATE INDEX IF NOT EXISTS idx_codigos_experimente_ativo ON codigos_experimente(ativo);
CREATE INDEX IF NOT EXISTS idx_codigos_experimente_validade ON codigos_experimente(validade_ate);

-- Tabela 2: Acessos (opcional, para granularidade de campanha)
CREATE TABLE IF NOT EXISTS acessos_experimente (
  id BIGSERIAL PRIMARY KEY,
  codigo_id BIGINT REFERENCES codigos_experimente(id) ON DELETE CASCADE,
  ip_origem TEXT,
  timestamp TIMESTAMP DEFAULT now(),
  email_capturado TEXT
);

CREATE INDEX IF NOT EXISTS idx_acessos_experimente_codigo_id ON acessos_experimente(codigo_id);
CREATE INDEX IF NOT EXISTS idx_acessos_experimente_timestamp ON acessos_experimente(timestamp);

-- Tabela 3: Capturas de lead (Módulo A)
CREATE TABLE IF NOT EXISTS capturasExperimente (
  id BIGSERIAL PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  email TEXT NOT NULL,
  caminho_de_vida INT,
  essencia INT,
  codigo_usado TEXT,
  timestamp TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capturasExperimente_email ON capturasExperimente(email);
CREATE INDEX IF NOT EXISTS idx_capturasExperimente_timestamp ON capturasExperimente(timestamp);

-- Inserir códigos de teste
INSERT INTO codigos_experimente (codigo, ativo, validade_ate, origem, total_acessos, emails_capturados)
VALUES
  ('EXPERIMENTE', true, '2026-08-21', 'teste', 0, 0),
  ('EXPERIMENTE-FB', true, '2026-08-21', 'facebook', 0, 0),
  ('EXPERIMENTE-IG', true, '2026-08-21', 'instagram', 0, 0)
ON CONFLICT DO NOTHING;

-- RLS (Row Level Security) — desabilitar para esta tabela (acesso público controlado por validação server-side)
ALTER TABLE codigos_experimente DISABLE ROW LEVEL SECURITY;
ALTER TABLE acessos_experimente DISABLE ROW LEVEL SECURITY;
ALTER TABLE capturasExperimente DISABLE ROW LEVEL SECURITY;
