-- Migração: tabela genérica de pedido pendente para checkout via Stripe
-- Data: 2026-09-27
-- Escopo: Fase 2 da migração MercadoPago → Stripe — primeiro produto: Livros.
--
-- Substitui, para produtos novos no Stripe, o padrão de tabela ad-hoc por
-- produto (pedidos_livros_pendentes, pedidos_sessoes_extras_pendentes): uma
-- linha aqui carrega o payload necessário para o fulfillment (ex.: livroId,
-- email, audiolivroIncluido) entre a criação da Checkout Session e a
-- confirmação via webhook, identificada só pelo id opaco (pedidoId) — sem
-- limite de 64 caracteres como o external_reference do MercadoPago, então
-- não precisa de referência curta+tabela de lookup por produto.
--
-- As tabelas antigas (pedidos_livros_pendentes etc.) continuam existindo,
-- intocadas, usadas pelo fluxo Pix/MercadoPago que permanece em paralelo
-- até o Stripe habilitar Pix nesta conta (ver STATUS_ZUNI.md).
--
-- processado_em: marca de idempotência do webhook — só é setado depois que
-- o fulfillment (ex.: criarAcesso) já foi concluído com sucesso, nunca antes
-- (senão uma falha no meio do fulfillment faria o pedido ser considerado
-- resolvido sem o cliente ter recebido nada).
-- resultado: o que o fulfillment gerou (ex.: { token, tokenAudiolivro }),
-- consumido pelo endpoint de polling do front.

CREATE TABLE IF NOT EXISTS checkout_pedidos_pendentes (
  id TEXT PRIMARY KEY,
  fulfillment_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  valor_pago NUMERIC,
  stripe_session_id TEXT,
  resultado JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  processado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_checkout_pedidos_pendentes_stripe_session_id
  ON checkout_pedidos_pendentes (stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_checkout_pedidos_pendentes_fulfillment_type
  ON checkout_pedidos_pendentes (fulfillment_type);

-- RLS: bloqueia anon/authenticated por padrão (backend usa service_role, que ignora RLS)
ALTER TABLE public.checkout_pedidos_pendentes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE checkout_pedidos_pendentes IS
  'Pedido pendente genérico do checkout Stripe (Fase 2+), por fulfillment_type. RLS bloqueia anon/authenticated; backend usa service_role.';
COMMENT ON COLUMN checkout_pedidos_pendentes.processado_em IS
  'Setado só após o fulfillment ter sido concluído com sucesso — guarda de idempotência do webhook, nunca marcado antes de o cliente efetivamente receber o produto.';
