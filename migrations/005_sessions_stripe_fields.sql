-- Fase 1 da migração da Sessão ZUNI (ZUNI Direciona) de MercadoPago para
-- Stripe (Checkout embedded). Os outros quatro produtos (livros, Sessões
-- Extras, Mapa Astral, Mapa Integrado) continuam no MercadoPago por
-- enquanto — esta migração só acrescenta campos, não remove nada.
--
-- stripe_session_id: id da Checkout Session do Stripe, gravado no momento
--   da criação. Serve de chave de idempotência do webhook — impede que uma
--   reentrega do mesmo evento marque a sessão como paga duas vezes.
-- valor_pago: valor final efetivamente cobrado (após cupom), gravado no
--   momento da criação da Checkout Session. Corrige a pendência do pixel
--   do Pinterest, que hoje dispara um valor fixo porque a página de
--   retorno não sabia mais qual preço (com desconto) tinha sido cobrado.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS valor_pago numeric;

CREATE INDEX IF NOT EXISTS idx_sessions_stripe_session_id
  ON sessions (stripe_session_id);
