-- Migração: orçamento diário PERSISTENTE da demo do ZUNI Direciona (POST /api/experimente-chat)
-- Data: 2026-10-09 · STATUS: PREPARADA, NÃO APLICADA. Aplicar manualmente no Supabase SQL Editor, só com autorização.
--
-- Objetivo: o teto diário da demo (por IP e global) sobreviver a deploys/reinícios e valer entre instâncias.
-- A decisão é atômica: IP e global na mesma transação (não gasta o orçamento do IP se o global está esgotado).
-- Privacidade: a chave do IP é um hash feito pela aplicação; nenhum IP bruto nem texto de visitante é gravado.
-- Segurança: RLS ligada sem políticas (anon/authenticated não leem nem escrevem); a função só é executável pelo service_role.
-- Rollback: DROP FUNCTION consumir_orcamento_demo(text,int,int,int); DROP TABLE orcamento_demo; (a aplicação cai no limite em memória).

CREATE TABLE IF NOT EXISTS orcamento_demo (
  chave TEXT PRIMARY KEY,
  contagem INTEGER NOT NULL DEFAULT 0,
  inicio TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE orcamento_demo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON orcamento_demo FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION consumir_orcamento_demo(p_chave_ip TEXT, p_limite_ip INTEGER, p_limite_global INTEGER, p_janela_seg INTEGER)
RETURNS TABLE (permitido BOOLEAN, motivo TEXT, contagem_ip INTEGER, contagem_global INTEGER, segundos_ate_reset INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_ip orcamento_demo%ROWTYPE;
  v_gl orcamento_demo%ROWTYPE;
  v_agora TIMESTAMPTZ := now();
BEGIN
  IF p_chave_ip IS NULL OR length(p_chave_ip) > 80 OR p_limite_ip < 1 OR p_limite_global < 1 OR p_janela_seg < 60 THEN
    RAISE EXCEPTION 'parametros_invalidos';
  END IF;

  -- Garante as duas linhas e as trava em ordem fixa (global, depois IP) para evitar deadlock.
  INSERT INTO orcamento_demo (chave, contagem, inicio) VALUES ('global', 0, v_agora) ON CONFLICT (chave) DO NOTHING;
  INSERT INTO orcamento_demo (chave, contagem, inicio) VALUES (p_chave_ip, 0, v_agora) ON CONFLICT (chave) DO NOTHING;
  SELECT * INTO v_gl FROM orcamento_demo WHERE chave = 'global' FOR UPDATE;
  SELECT * INTO v_ip FROM orcamento_demo WHERE chave = p_chave_ip FOR UPDATE;

  -- Janela vencida => zera.
  IF v_agora - v_gl.inicio >= make_interval(secs => p_janela_seg) THEN
    UPDATE orcamento_demo SET contagem = 0, inicio = v_agora WHERE chave = 'global' RETURNING * INTO v_gl;
  END IF;
  IF v_agora - v_ip.inicio >= make_interval(secs => p_janela_seg) THEN
    UPDATE orcamento_demo SET contagem = 0, inicio = v_agora WHERE chave = p_chave_ip RETURNING * INTO v_ip;
  END IF;

  IF v_ip.contagem >= p_limite_ip THEN
    RETURN QUERY SELECT FALSE, 'ip'::TEXT, v_ip.contagem, v_gl.contagem, GREATEST(1, p_janela_seg - EXTRACT(EPOCH FROM (v_agora - v_ip.inicio))::INTEGER);
    RETURN;
  END IF;
  IF v_gl.contagem >= p_limite_global THEN
    RETURN QUERY SELECT FALSE, 'global'::TEXT, v_ip.contagem, v_gl.contagem, GREATEST(1, p_janela_seg - EXTRACT(EPOCH FROM (v_agora - v_gl.inicio))::INTEGER);
    RETURN;
  END IF;

  UPDATE orcamento_demo SET contagem = contagem + 1 WHERE chave = 'global' RETURNING * INTO v_gl;
  UPDATE orcamento_demo SET contagem = contagem + 1 WHERE chave = p_chave_ip RETURNING * INTO v_ip;
  RETURN QUERY SELECT TRUE, NULL::TEXT, v_ip.contagem, v_gl.contagem, GREATEST(1, p_janela_seg - EXTRACT(EPOCH FROM (v_agora - v_ip.inicio))::INTEGER);
END;
$$;

REVOKE ALL ON FUNCTION consumir_orcamento_demo(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consumir_orcamento_demo(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

-- Limpeza opcional (rodar de vez em quando): DELETE FROM orcamento_demo WHERE chave <> 'global' AND inicio < now() - interval '2 days';
