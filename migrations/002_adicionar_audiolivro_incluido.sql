-- Adicionar coluna audiolivro_incluido à tabela pedidos_livros_pendentes
-- 18/08/2026 23:00

ALTER TABLE pedidos_livros_pendentes
ADD COLUMN audiolivro_incluido BOOLEAN DEFAULT false;

-- Adicionar coluna tipo_produto à tabela acessos_livros para diferenciar e-book/audiolivro
ALTER TABLE acessos_livros
ADD COLUMN tipo_produto VARCHAR(20) DEFAULT 'livro';
-- tipo_produto: 'livro' (e-book/PDF) ou 'audiolivro'
