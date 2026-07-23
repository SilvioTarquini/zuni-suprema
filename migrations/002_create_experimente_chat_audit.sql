-- Tabela de auditoria para Chat de Demonstração
-- Registra consumo de tokens e custo por visitante
CREATE TABLE IF NOT EXISTS experimente_chat_audit (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL COMMENT 'Hash SHA-256 do IP (LGPD: não identificável)',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  resposta_length INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX idx_experimente_chat_audit_session_id ON experimente_chat_audit(session_id);
CREATE INDEX idx_experimente_chat_audit_ip_hash ON experimente_chat_audit(ip_hash);
CREATE INDEX idx_experimente_chat_audit_created_at ON experimente_chat_audit(created_at);

-- View agregada para dashboard (custo por dia, por visitante, etc)
CREATE OR REPLACE VIEW experimente_chat_audit_summary AS
SELECT
  DATE(created_at) as data,
  session_id,
  COUNT(*) as total_trocas,
  SUM(input_tokens) as total_input_tokens,
  SUM(output_tokens) as total_output_tokens,
  SUM(total_tokens) as total_tokens,
  -- Cálculo de custo (Sonnet-4: $3/$15 por 1M input/output)
  (SUM(input_tokens) / 1000000.0 * 3) + (SUM(output_tokens) / 1000000.0 * 15) as custo_usd
FROM experimente_chat_audit
GROUP BY DATE(created_at), session_id
ORDER BY data DESC, custo_usd DESC;

-- Comentário de documentação LGPD
COMMENT ON TABLE experimente_chat_audit IS 'Auditoria de uso do Chat de Demonstração. IPs são armazenados como hashes SHA-256 para conformidade LGPD.';
COMMENT ON COLUMN experimente_chat_audit.ip_hash IS 'Hash SHA-256 do endereço IP do visitante — não identificável, apenas para rate limiting';
