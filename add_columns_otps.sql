-- Script para adicionar colunas necessárias na tabela otps
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna method (sms ou email)
ALTER TABLE otps ADD COLUMN IF NOT EXISTS method VARCHAR(10) DEFAULT 'sms';

-- Adicionar coluna email (para quando o envio for por email)
ALTER TABLE otps ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Adicionar coluna message_id (para SMS)
ALTER TABLE otps ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);

-- Verificar estrutura
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'otps'
ORDER BY ordinal_position;
