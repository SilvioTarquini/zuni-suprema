-- Revogação de acesso por estorno/disputa do Stripe (charge.refunded e
-- charge.dispute.created — ver src/lib/estornoStripe.js).
--
-- Nada é apagado: os registros ficam, só o acesso é bloqueado.
--
-- acessos_livros.revogado_em / motivo_revogacao: token revogado deixa de abrir
--   o livro e o audiolivro (verificarAcesso em src/lib/acessoLivros.js).
-- sessions.estornado_em: sessão do ZUNI Direciona estornada. O webhook também
--   põe paid=false; estornado_em impede que uma reentrega de
--   checkout.session.completed ou uma gravação com dados antigos reative a sessão.
--
-- Aplicar ANTES do deploy do código que usa essas colunas (Supabase SQL Editor).

ALTER TABLE acessos_livros
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_revogacao text;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS estornado_em timestamptz;
