-- [nota do snapshot] Snapshot das funcoes de busca do RAG e das tabelas grupos_tema / documentos_quarentena.
-- [nota do snapshot] Origem: rag_temas/2026-11/snapshot_schema.csv (consulta pg_get_functiondef / catalogos, 01/11/2026).
-- [nota do snapshot] Estas funcoes e tabelas foram criadas direto no SQL Editor do Supabase; este arquivo so as versiona.
-- [nota do snapshot] Idempotente (CREATE ... IF NOT EXISTS / CREATE OR REPLACE). NAO e uma migracao a executar em producao
-- [nota do snapshot] sem revisao: as funcoes ja existem la com estas definicoes.
-- [nota do snapshot] Integridade (01/11/2026): md5 e numero de caracteres das 6 definicoes do CSV conferem com os do banco (6/6).
-- [nota do snapshot] Em buscar_documentos e buscar_documentos_hibrido o corpo no banco usa quebras CRLF; aqui foram gravadas com LF
-- [nota do snapshot] (o texto SQL e o mesmo; so o md5 do texto normalizado difere do md5 do banco).
-- [nota do snapshot]
-- [nota do snapshot] Fora do snapshot (nao capturado na consulta; confirmar no painel antes de recriar o banco do zero):
-- [nota do snapshot]   * public.documentos (as funcoes dependem dela; colunas listadas no CSV, mas PK e indice vetorial nao foram consultados)
-- [nota do snapshot]   * GRANT EXECUTE das funcoes e permissoes das tabelas por papel (anon / authenticated / service_role)
-- [nota do snapshot]   * os dados de grupos_tema (ver rag_temas/2026-11/grupos_tema_insert.sql) e de documentos_quarentena
-- [nota do snapshot]
-- [nota do snapshot] Observacao: as funcoes usam o tipo "vector" sem schema e search_path = public, pg_temp; a extensao pgvector
-- [nota do snapshot] precisa estar visivel em public (confirmado em 01/11/2026: pgvector v0.8.0, schema public).

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- [nota do snapshot] ---------------------------------------------------------------------------
-- [nota do snapshot] Tabelas (precisam existir antes das funcoes: funcoes LANGUAGE sql sao validadas na criacao)
-- [nota do snapshot] ---------------------------------------------------------------------------

-- [nota do snapshot] Mapeia o tema de um questionario (grupo) para temas de documentos.tema.
-- [nota do snapshot] buscar_documentos_ranqueado expande p_tema pelo grupo; um grupo com o mesmo nome de um tema indexado SUBSTITUI esse tema.
CREATE TABLE IF NOT EXISTS public.grupos_tema (
  grupo text NOT NULL,
  tema text NOT NULL,
  observacao text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT grupos_tema_pkey PRIMARY KEY (grupo, tema)
);

CREATE INDEX IF NOT EXISTS idx_grupos_tema_grupo ON public.grupos_tema USING btree (grupo);

ALTER TABLE public.grupos_tema ENABLE ROW LEVEL SECURITY;

-- [nota do snapshot] Chunks retirados de documentos por conterem posologia (regra: sem posologia no Mentor).
-- [nota do snapshot] Nenhuma funcao de busca le esta tabela. Colunas espelham documentos + motivo/quarentena_em;
-- [nota do snapshot] no banco ela esta sem PK, sem NOT NULL e sem indices (assim foi capturada).
CREATE TABLE IF NOT EXISTS public.documentos_quarentena (
  id uuid,
  fonte text,
  caminho text,
  titulo text,
  categoria text,
  corpo text,
  embedding vector(1536),
  criado_em timestamp with time zone,
  livro_id text,
  tema text,
  motivo text,
  quarentena_em timestamp with time zone
);

ALTER TABLE public.documentos_quarentena ENABLE ROW LEVEL SECURITY;
-- [nota do snapshot] Sem policies (0 no snapshot): com RLS ligado, so a service role (que ignora RLS) le e escreve.
-- [nota do snapshot] Cliente com chave anon recebe lista vazia, sem erro.

-- [nota do snapshot] ---------------------------------------------------------------------------
-- [nota do snapshot] Funcoes de busca (definicoes literais de pg_get_functiondef)
-- [nota do snapshot] ---------------------------------------------------------------------------

-- [nota do snapshot] buscar_documentos(vector,integer)
-- [nota do snapshot] Busca vetorial simples (usada sem tema por searchKnowledge e por src/indexar.js).
CREATE OR REPLACE FUNCTION public.buscar_documentos(query_embedding vector, limite integer DEFAULT 5)
 RETURNS TABLE(id uuid, fonte text, caminho text, titulo text, categoria text, corpo text, similaridade double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

-- [nota do snapshot] buscar_documentos_hibrido(vector,integer,integer,text)
-- [nota do snapshot] Legada: tema + geral, sem ranqueamento (nao e usada por searchKnowledge desde 19a3718).
CREATE OR REPLACE FUNCTION public.buscar_documentos_hibrido(query_embedding vector, limite_tema integer DEFAULT 3, limite_geral integer DEFAULT 2, p_tema text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, fonte text, caminho text, titulo text, categoria text, corpo text, similaridade double precision, tema_doc text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_tema IS NULL THEN
    RETURN QUERY
    SELECT
      d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
      1.0 / (1.0 + (d.embedding <-> query_embedding)) AS similaridade,
      d.tema
    FROM public.documentos d
    WHERE d.embedding IS NOT NULL
    ORDER BY d.embedding <-> query_embedding
    LIMIT (limite_tema + limite_geral);
  ELSE
    RETURN QUERY
    SELECT
      d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
      1.0 / (1.0 + (d.embedding <-> query_embedding)) AS similaridade,
      d.tema
    FROM public.documentos d
    WHERE d.embedding IS NOT NULL
      AND d.tema = p_tema
    ORDER BY d.embedding <-> query_embedding
    LIMIT limite_tema;

    RETURN QUERY
    SELECT
      d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
      1.0 / (1.0 + (d.embedding <-> query_embedding)) AS similaridade,
      d.tema
    FROM public.documentos d
    WHERE d.embedding IS NOT NULL
      AND d.tema IS DISTINCT FROM p_tema
    ORDER BY d.embedding <-> query_embedding
    LIMIT limite_geral;
  END IF;
END;
$function$;

-- [nota do snapshot] buscar_documentos_ranqueado(vector,integer,integer,text)
-- [nota do snapshot] Overload 1/4 de buscar_documentos_ranqueado (4 parametros).
CREATE OR REPLACE FUNCTION public.buscar_documentos_ranqueado(query_embedding vector, piso_tema integer DEFAULT 2, total integer DEFAULT 5, p_tema text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, fonte text, caminho text, titulo text, categoria text, corpo text, similaridade double precision, tema_doc text, origem text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with pool_tema as (
  select d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
         1.0 / (1.0 + (d.embedding <-> query_embedding)) as similaridade,
         d.tema as tema_doc,
         'tema'::text as origem
  from public.documentos d
  where d.embedding is not null
    and p_tema is not null
    and d.tema = p_tema
  order by d.embedding <-> query_embedding
  limit greatest(total, 1)
),
pool_geral as (
  select d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
         1.0 / (1.0 + (d.embedding <-> query_embedding)) as similaridade,
         d.tema as tema_doc,
         'geral'::text as origem
  from public.documentos d
  where d.embedding is not null
    and (p_tema is null or d.tema is distinct from p_tema)
  order by d.embedding <-> query_embedding
  limit greatest(total, 1)
),
unificado as (
  select * from pool_tema
  union all
  select * from pool_geral
),
sem_duplicata as (
  select distinct on (md5(u.corpo)) u.*
  from unificado u
  order by md5(u.corpo), u.similaridade desc
),
piso as (
  select * from sem_duplicata
  where origem = 'tema'
  order by similaridade desc
  limit greatest(least(piso_tema, total), 0)
),
resto as (
  select s.* from sem_duplicata s
  where not exists (select 1 from piso p where p.id = s.id)
  order by s.similaridade desc
  limit greatest(total - (select count(*) from piso), 0)
)
select f.id, f.fonte, f.caminho, f.titulo, f.categoria, f.corpo,
       f.similaridade, f.tema_doc, f.origem
from (select * from piso union all select * from resto) f
order by f.similaridade desc;
$function$;

-- [nota do snapshot] buscar_documentos_ranqueado(vector,integer,integer,text,integer)
-- [nota do snapshot] Overload 2/4 (acrescenta teto_por_arquivo).
CREATE OR REPLACE FUNCTION public.buscar_documentos_ranqueado(query_embedding vector, piso_tema integer DEFAULT 2, total integer DEFAULT 5, p_tema text DEFAULT NULL::text, teto_por_arquivo integer DEFAULT 2)
 RETURNS TABLE(id uuid, fonte text, caminho text, titulo text, categoria text, corpo text, similaridade double precision, tema_doc text, origem text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with pool_tema as (
  select d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
         1.0 / (1.0 + (d.embedding <-> query_embedding)) as similaridade,
         d.tema as tema_doc, 'tema'::text as origem
  from public.documentos d
  where d.embedding is not null and p_tema is not null and d.tema = p_tema
  order by d.embedding <-> query_embedding
  limit greatest(total * 3, 3)
),
pool_geral as (
  select d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
         1.0 / (1.0 + (d.embedding <-> query_embedding)) as similaridade,
         d.tema as tema_doc, 'geral'::text as origem
  from public.documentos d
  where d.embedding is not null and (p_tema is null or d.tema is distinct from p_tema)
  order by d.embedding <-> query_embedding
  limit greatest(total * 3, 3)
),
unificado as (
  select * from pool_tema union all select * from pool_geral
),
sem_duplicata as (
  select distinct on (md5(u.corpo)) u.*
  from unificado u
  order by md5(u.corpo), u.similaridade desc
),
com_teto as (
  select s.* from (
    select s.*, row_number() over (partition by s.caminho order by s.similaridade desc) as posicao_no_arquivo
    from sem_duplicata s
  ) s
  where s.posicao_no_arquivo <= greatest(teto_por_arquivo, 1)
),
piso as (
  select * from com_teto where origem = 'tema'
  order by similaridade desc
  limit greatest(least(piso_tema, total), 0)
),
resto as (
  select c.* from com_teto c
  where not exists (select 1 from piso p where p.id = c.id)
  order by c.similaridade desc
  limit greatest(total - (select count(*) from piso), 0)
)
select f.id, f.fonte, f.caminho, f.titulo, f.categoria, f.corpo,
       f.similaridade, f.tema_doc, f.origem
from (select * from piso union all select * from resto) f
order by f.similaridade desc;
$function$;

-- [nota do snapshot] buscar_documentos_ranqueado(vector,integer,integer,text,integer,integer)
-- [nota do snapshot] Overload 3/4 (acrescenta piso_por_tema e expansao de grupo via grupos_tema).
CREATE OR REPLACE FUNCTION public.buscar_documentos_ranqueado(query_embedding vector, piso_tema integer DEFAULT 2, total integer DEFAULT 5, p_tema text DEFAULT NULL::text, teto_por_arquivo integer DEFAULT 2, piso_por_tema integer DEFAULT 0)
 RETURNS TABLE(id uuid, fonte text, caminho text, titulo text, categoria text, corpo text, similaridade double precision, tema_doc text, origem text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with alvo as (
  select coalesce(
    (select array_agg(g.tema) from public.grupos_tema g where g.grupo = p_tema),
    case when p_tema is null then null else array[p_tema] end
  ) as temas
),
pool_tema as (
  select d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
         1.0 / (1.0 + (d.embedding <-> query_embedding)) as similaridade,
         d.tema as tema_doc, 'tema'::text as origem
  from public.documentos d, alvo a
  where d.embedding is not null
    and a.temas is not null
    and d.tema = any(a.temas)
  order by d.embedding <-> query_embedding
  limit greatest(total * 4, 8)
),
pool_geral as (
  select d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
         1.0 / (1.0 + (d.embedding <-> query_embedding)) as similaridade,
         d.tema as tema_doc, 'geral'::text as origem
  from public.documentos d, alvo a
  where d.embedding is not null
    and (a.temas is null or d.tema is null or not (d.tema = any(a.temas)))
  order by d.embedding <-> query_embedding
  limit greatest(total * 4, 8)
),
unificado as (
  select * from pool_tema
  union all
  select * from pool_geral pg where pg.id not in (select pt.id from pool_tema pt)
),
sem_duplicata as (
  select distinct on (md5(u.corpo))
         u.id, u.fonte, u.caminho, u.titulo, u.categoria, u.corpo,
         u.similaridade, u.tema_doc, u.origem
  from unificado u
  order by md5(u.corpo), u.similaridade desc
),
com_teto as (
  select x.id, x.fonte, x.caminho, x.titulo, x.categoria, x.corpo,
         x.similaridade, x.tema_doc, x.origem
  from (
    select s.*, row_number() over (partition by s.caminho order by s.similaridade desc) as pos_arquivo
    from sem_duplicata s
  ) x
  where x.pos_arquivo <= greatest(teto_por_arquivo, 1)
),
piso_grupo as (
  select y.id, y.fonte, y.caminho, y.titulo, y.categoria, y.corpo,
         y.similaridade, y.tema_doc, y.origem
  from (
    select c.*, row_number() over (partition by c.tema_doc order by c.similaridade desc) as pos_tema
    from com_teto c where c.origem = 'tema'
  ) y
  where piso_por_tema > 0 and y.pos_tema <= piso_por_tema
),
piso as (
  select c.id, c.fonte, c.caminho, c.titulo, c.categoria, c.corpo,
         c.similaridade, c.tema_doc, c.origem
  from com_teto c
  where c.origem = 'tema'
    and not exists (select 1 from piso_grupo g where g.id = c.id)
  order by c.similaridade desc
  limit greatest(least(piso_tema, total) - (select count(*) from piso_grupo), 0)
),
selecionados as (
  select * from piso_grupo union all select * from piso
),
resto as (
  select c.id, c.fonte, c.caminho, c.titulo, c.categoria, c.corpo,
         c.similaridade, c.tema_doc, c.origem
  from com_teto c
  where not exists (select 1 from selecionados s where s.id = c.id)
  order by c.similaridade desc
  limit greatest(total - (select count(*) from selecionados), 0)
)
select f.id, f.fonte, f.caminho, f.titulo, f.categoria, f.corpo,
       f.similaridade, f.tema_doc, f.origem
from (select * from selecionados union all select * from resto) f
order by f.similaridade desc
limit greatest(total, 1);
$function$;

-- [nota do snapshot] buscar_documentos_ranqueado(vector,integer,integer,text,integer,integer,integer)
-- [nota do snapshot] Overload 4/4 (acrescenta teto_por_fonte). E a chamada por searchKnowledge em src/server.js.
CREATE OR REPLACE FUNCTION public.buscar_documentos_ranqueado(query_embedding vector, piso_tema integer DEFAULT 1, total integer DEFAULT 8, p_tema text DEFAULT NULL::text, teto_por_arquivo integer DEFAULT 2, piso_por_tema integer DEFAULT 1, teto_por_fonte integer DEFAULT 0)
 RETURNS TABLE(id uuid, fonte text, caminho text, titulo text, categoria text, corpo text, similaridade double precision, tema_doc text, origem text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with alvo as (
  select coalesce(
    (select array_agg(g.tema) from public.grupos_tema g where g.grupo = p_tema),
    case when p_tema is null then null else array[p_tema] end
  ) as temas
),
pool_tema as (
  select d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
         1.0 / (1.0 + (d.embedding <-> query_embedding)) as similaridade,
         d.tema as tema_doc, 'tema'::text as origem
  from public.documentos d, alvo a
  where d.embedding is not null and a.temas is not null and d.tema = any(a.temas)
  order by d.embedding <-> query_embedding
  limit greatest(total * 5, 20)
),
pool_geral as (
  select d.id, d.fonte, d.caminho, d.titulo, d.categoria, d.corpo,
         1.0 / (1.0 + (d.embedding <-> query_embedding)) as similaridade,
         d.tema as tema_doc, 'geral'::text as origem
  from public.documentos d, alvo a
  where d.embedding is not null
    and (a.temas is null or d.tema is null or not (d.tema = any(a.temas)))
  order by d.embedding <-> query_embedding
  limit greatest(total * 5, 20)
),
unificado as (
  select * from pool_tema
  union all
  select * from pool_geral pg where pg.id not in (select pt.id from pool_tema pt)
),
sem_duplicata as (
  select distinct on (md5(u.corpo))
         u.id, u.fonte, u.caminho, u.titulo, u.categoria, u.corpo,
         u.similaridade, u.tema_doc, u.origem
  from unificado u
  order by md5(u.corpo), u.similaridade desc
),
-- Teto por CAMINHO (util em bases onde varios blocos compartilham arquivo)
-- e por FONTE (util em bases do indexarTema.js, onde cada bloco tem caminho proprio
-- e a fonte e o unico eixo real de diversidade). 0 desliga o teto por fonte.
com_teto as (
  select x.id, x.fonte, x.caminho, x.titulo, x.categoria, x.corpo,
         x.similaridade, x.tema_doc, x.origem
  from (
    select s.*,
           row_number() over (partition by s.caminho order by s.similaridade desc) as pos_arquivo,
           row_number() over (partition by s.fonte   order by s.similaridade desc) as pos_fonte
    from sem_duplicata s
  ) x
  where x.pos_arquivo <= greatest(teto_por_arquivo, 1)
    and (teto_por_fonte <= 0 or x.pos_fonte <= teto_por_fonte)
),
piso_grupo as (
  select y.id, y.fonte, y.caminho, y.titulo, y.categoria, y.corpo,
         y.similaridade, y.tema_doc, y.origem
  from (
    select c.*, row_number() over (partition by c.tema_doc order by c.similaridade desc) as pos_tema
    from com_teto c where c.origem = 'tema'
  ) y
  where piso_por_tema > 0 and y.pos_tema <= piso_por_tema
),
piso as (
  select c.id, c.fonte, c.caminho, c.titulo, c.categoria, c.corpo,
         c.similaridade, c.tema_doc, c.origem
  from com_teto c
  where c.origem = 'tema' and not exists (select 1 from piso_grupo g where g.id = c.id)
  order by c.similaridade desc
  limit greatest(least(piso_tema, total) - (select count(*) from piso_grupo), 0)
),
selecionados as (select * from piso_grupo union all select * from piso),
resto as (
  select c.id, c.fonte, c.caminho, c.titulo, c.categoria, c.corpo,
         c.similaridade, c.tema_doc, c.origem
  from com_teto c
  where not exists (select 1 from selecionados s where s.id = c.id)
  order by c.similaridade desc
  limit greatest(total - (select count(*) from selecionados), 0)
)
select f.id, f.fonte, f.caminho, f.titulo, f.categoria, f.corpo,
       f.similaridade, f.tema_doc, f.origem
from (select * from selecionados union all select * from resto) f
order by f.similaridade desc
limit greatest(total, 1);
$function$;
