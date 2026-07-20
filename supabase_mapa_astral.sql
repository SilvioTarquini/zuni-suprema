-- Migração para suportar checkout de Leitura de Mapa Astral
-- Adiciona colunas de dados de nascimento à tabela sessions
-- (armazenar data, hora e local de nascimento para uso no chat de Mentor)

ALTER TABLE IF EXISTS public.sessions
  ADD COLUMN IF NOT EXISTS birth_date TEXT,
  ADD COLUMN IF NOT EXISTS birth_time TEXT,
  ADD COLUMN IF NOT EXISTS birth_location TEXT;

-- Criar índice para buscar sessões de mapa astral
CREATE INDEX IF NOT EXISTS idx_sessions_birth_data
ON public.sessions (session_id)
WHERE birth_date IS NOT NULL;
