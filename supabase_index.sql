-- Supabase SQL para habilitar pgvector, criar a tabela de documentos e a função de busca
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte text NOT NULL,
  caminho text NOT NULL,
  titulo text,
  corpo text NOT NULL,
  categoria text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  embedding vector(1536)
);

CREATE INDEX IF NOT EXISTS documentos_embedding_idx
  ON public.documentos USING ivfflat (embedding vector_l2_ops)
  WITH (lists = 100);

CREATE OR REPLACE FUNCTION public.buscar_documentos(
  query_embedding vector(1536),
  limite integer DEFAULT 5
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
ORDER BY embedding <-> query_embedding
LIMIT limite;
$$ LANGUAGE sql STABLE;
