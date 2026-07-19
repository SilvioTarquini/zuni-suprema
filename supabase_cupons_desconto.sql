-- SQL para o funil de cupom de desconto (sessão do Mentor -> loja de
-- livros, e loja -> Mentor). Já aplicado em produção via migration
-- "criar_cupons_desconto" — este arquivo fica só como registro, no mesmo
-- padrão de supabase_index.sql e supabase_livro_chat.sql.
--
-- Dois tipos de cupom (coluna `tipo`):
--   'sessao'   — gerado automaticamente ao fim de cada sessão do Mentor
--                (ver criarCupomSessao em src/lib/cupons.js), pessoal
--                (email_cliente preenchido), 30% sem teto, expira em 7
--                dias, uso múltiplo permitido dentro do prazo.
--   'campanha' — cadastrado manualmente (ex: ZUNI30 abaixo), sem dono,
--                sem expiração. 30% sem teto em livros de categoria
--                'compacta', 30% com teto de R$15 em 'principal'
--                (ver calcularDesconto em src/lib/cupons.js).

CREATE TABLE IF NOT EXISTS cupons_desconto (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('sessao', 'campanha')),
  percentual NUMERIC NOT NULL DEFAULT 30,
  teto_reais NUMERIC,
  email_cliente TEXT,
  token_sessao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ,
  usado_em TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cupons_codigo ON cupons_desconto (codigo);
INSERT INTO cupons_desconto (codigo, tipo, percentual, teto_reais)
VALUES ('ZUNI30', 'campanha', 30, 15) ON CONFLICT (codigo) DO NOTHING;

-- RLS ativado sem policies, mesmo padrão já usado em documentos, sessions,
-- acessos_livros, pedidos_livros_pendentes e uso_chat_livro: bloqueia
-- anon/authenticated por padrão; o backend usa a secret key, que ignora RLS.
ALTER TABLE public.cupons_desconto ENABLE ROW LEVEL SECURITY;
