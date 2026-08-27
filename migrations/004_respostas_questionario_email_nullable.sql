-- Torna email opcional em respostas_questionario e resumos_sessoes
-- 27/08/2026
-- Motivo: o checkout do Mentor (Etapa 1, 26/08/2026) parou de coletar e-mail
-- antes do pagamento — sessions.email já é nullable pela mesma razão.

-- respostas_questionario: grava email a partir de session.email, que agora
-- nasce nulo para toda sessão nova; a constraint NOT NULL aqui quebrava
-- POST /api/questionario/salvar-respostas com 23502 (null value in column
-- "email" violates not-null constraint) para essas sessões. Confirmado por
-- reprodução manual contra este mesmo banco (o único usado local e em
-- produção) antes desta migration.
ALTER TABLE respostas_questionario
ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN respostas_questionario.email IS
  'Email do cliente no momento do questionário — pode ser nulo desde a Etapa 1 do checkout do Mentor (26/08/2026), quando o checkout deixou de coletar e-mail antes do pagamento.';

-- resumos_sessoes: mesma causa-raiz (session.email nulo). Ainda não quebrou em
-- produção porque a feature de memória de jornada está desativada hoje
-- (MEMORIA_JORNADA_ATIVA não configurada nem local nem em produção) e o único
-- ponto de código que grava aqui (gerarEEnviarRelatorio, chamado só depois de
-- um e-mail já confirmado) não passa email nulo na prática atual. Corrigido
-- preventivamente agora para quem reativar essa flag no futuro não descobrir
-- a mesma quebra sem contexto.
ALTER TABLE resumos_sessoes
ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN resumos_sessoes.email IS
  'Email do cliente dono do resumo — pode ser nulo desde a Etapa 1 do checkout do Mentor (26/08/2026). Hoje sempre preenchido na prática (só é gravado depois de um e-mail confirmado em /api/relatorio/enviar-email), mas a coluna não deve voltar a exigir NOT NULL sem revisar esse acoplamento.';
