-- Migração: Adicionar campos para rastreamento de questionário no contexto de pacotes
-- Data: 2026-08-03
-- Descrição: Suporta a integração do questionário com Sessões Extras

-- Adicionar campo 'questionario_respondido' na tabela 'creditos_sessao'
-- Usado para marcar que um pacote já teve o questionário respondido (apenas 1x por pacote, não a cada sessão)
ALTER TABLE public.creditos_sessao
ADD COLUMN questionario_respondido BOOLEAN DEFAULT false;

-- Adicionar coluna de índice útil para queries futuras
CREATE INDEX idx_creditos_sessao_questionario_respondido
ON public.creditos_sessao(pacote_id, questionario_respondido);

-- Adicionar campo 'pacote_id' na tabela 'respostas_questionario'
-- Opcional — permite ligar respostas de questionário a um pacote específico
-- NULL para sessões avulsas, preenchido para respostas dentro de um pacote
ALTER TABLE public.respostas_questionario
ADD COLUMN pacote_id UUID REFERENCES public.creditos_sessao(pacote_id) ON DELETE CASCADE;

-- Índice para queries de respostas por pacote
CREATE INDEX idx_respostas_questionario_pacote_id
ON public.respostas_questionario(pacote_id);
