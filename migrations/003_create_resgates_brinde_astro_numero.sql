-- Migração: Tabela de Resgate de Brinde (Astrologia + Numerologia)
-- Data: 2026-07-31
-- Escopo: "Brinde" gratuito de astrologia e numerologia, 1 por cliente
--         (determinístico, não reenviável)

CREATE TABLE IF NOT EXISTS resgates_brinde_astro_numero (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nome_completo TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  hora_nascimento TIME NOT NULL,
  local_nascimento TEXT NOT NULL,
  timestamp_resgate TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_envio TEXT DEFAULT 'pendente' CHECK (status_envio IN ('pendente', 'enviado', 'erro')),
  erro_mensagem TEXT,

  -- Dados astrológicos/numerológicos gerados (para auditoria/reenvio se necessário)
  sol_signo TEXT,
  lua_signo TEXT,
  ascendente_signo TEXT,
  caminho_de_vida INT,
  essencia INT,

  -- Auditoria
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance (email já tem índice via UNIQUE)
CREATE INDEX IF NOT EXISTS idx_resgates_timestamp ON resgates_brinde_astro_numero(timestamp_resgate);
CREATE INDEX IF NOT EXISTS idx_resgates_status_envio ON resgates_brinde_astro_numero(status_envio);

-- Função para atualizar atualizado_em automaticamente em UPDATE
-- SET search_path para segurança (evita manipulação de schema via search_path da sessão)
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger para chamar a função antes de qualquer UPDATE
CREATE TRIGGER trigger_resgates_brinde_atualizado_em
BEFORE UPDATE ON resgates_brinde_astro_numero
FOR EACH ROW
EXECUTE FUNCTION set_atualizado_em();

-- RLS: bloqueie anon/authenticated por padrão
-- (backend usa service_role key, que ignora RLS)
ALTER TABLE public.resgates_brinde_astro_numero ENABLE ROW LEVEL SECURITY;

-- Comentário de documentação
COMMENT ON TABLE resgates_brinde_astro_numero IS
  'Resgate de brinde (astrologia + numerologia). 1 por cliente, determinístico, não reenviável. RLS bloqueia anon/authenticated; backend usa service_role.';
COMMENT ON COLUMN resgates_brinde_astro_numero.email IS
  'Email único do cliente (chave identificadora para "1 brinde por cliente")';
COMMENT ON COLUMN resgates_brinde_astro_numero.status_envio IS
  'Status do envio de PDF: pendente (em processamento), enviado (sucesso), erro (falha SendGrid)';
