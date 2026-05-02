-- Script para corrigir a tabela otps
-- Execute no SQL Editor do Supabase

-- 1. Remover a restrição NOT NULL da coluna phone
ALTER TABLE otps ALTER COLUMN phone DROP NOT NULL;

-- 2. Verificar se a alteração funcionou
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'otps'
ORDER BY ordinal_position;

-- 3. (Opcional) Adicionar valor padrão para phone se necessário
-- ALTER TABLE otps ALTER COLUMN phone SET DEFAULT '';
