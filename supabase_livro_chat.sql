-- SQL para o chat de leitura por livro (POST /api/livro-chat).
-- Pré-requisito: supabase_index.sql já deve ter sido executado antes
-- (extensões pgcrypto/vector e tabela public.documentos).

-- 1. Vincula cada chunk indexado a um livro específico.
--    livro_id NULL continua sendo conteúdo do Mentor (não muda o
--    comportamento de buscar_documentos, que ignora esta coluna).
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS livro_id text;

CREATE INDEX IF NOT EXISTS documentos_livro_id_idx
  ON public.documentos (livro_id);

-- 2. Busca vetorial filtrada por livro, usada pelo endpoint de chat.
CREATE OR REPLACE FUNCTION public.match_documents_livro(
  query_embedding vector(1536),
  match_count integer DEFAULT 5,
  p_livro_id text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  fonte text,
  caminho text,
  titulo text,
  categoria text,
  corpo text,
  similaridade double precision
)
AS $$
SELECT
  id,
  fonte,
  caminho,
  titulo,
  categoria,
  corpo,
  1.0 / (1.0 + (embedding <-> query_embedding)) AS similaridade
FROM public.documentos
WHERE embedding IS NOT NULL
  AND livro_id = p_livro_id
ORDER BY embedding <-> query_embedding
LIMIT match_count;
$$ LANGUAGE sql STABLE;

-- 3. Controle de limite diário de perguntas por token+livro.
--    A constraint UNIQUE é obrigatória: o backend faz upsert com
--    onConflict em (token, livro_id, data) para incrementar o contador.
CREATE TABLE IF NOT EXISTS public.uso_chat_livro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL,
  livro_id text NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  perguntas integer NOT NULL DEFAULT 0,
  UNIQUE (token, livro_id, data)
);
