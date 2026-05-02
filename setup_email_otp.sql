-- Script completo para configurar sistema de OTP por email
-- Execute no SQL Editor do Supabase

-- 1. Adicionar colunas na tabela otps
ALTER TABLE otps ADD COLUMN IF NOT EXISTS method VARCHAR(10) DEFAULT 'sms';
ALTER TABLE otps ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE otps ADD COLUMN IF NOT EXISTS message_id VARCHAR(255);

-- 2. Verificar se a tabela usuarios tem os campos necessários
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;

-- 3. Se necessário, adicionar coluna email na tabela usuarios
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 4. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_code ON otps(code);
CREATE INDEX IF NOT EXISTS idx_otps_expires_at ON otps(expires_at);

-- 5. Criar tabela de logs de email (opcional)
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  contact VARCHAR(255) NOT NULL,
  code VARCHAR(10),
  method VARCHAR(10),
  status VARCHAR(20),
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Habilitar RLS (Row Level Security) se necessário
-- ALTER TABLE otps ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
