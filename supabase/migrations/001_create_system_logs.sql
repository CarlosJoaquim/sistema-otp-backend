-- Tabela de logs estruturados para o admin
CREATE TABLE IF NOT EXISTS system_logs (
  id BIGSERIAL PRIMARY KEY,
  correlation_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  attempts INTEGER,
  time_elapsed_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_system_logs_correlation_id ON system_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_email ON system_logs(email);
CREATE INDEX IF NOT EXISTS idx_system_logs_status ON system_logs(status);

-- Limpar logs antigos (retenção de 1 ano)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Tabela de códigos OTP (atualizar para hash)
ALTER TABLE otps DROP COLUMN IF EXISTS code;
ALTER TABLE otps ADD COLUMN IF NOT EXISTS code_hash VARCHAR(255);
ALTER TABLE otps ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(255);

-- Colunas para suporte a tipos de código e tokens de redefinição
ALTER TABLE otps ADD COLUMN IF NOT EXISTS code_type VARCHAR(20) DEFAULT 'signup';
ALTER TABLE otps ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
ALTER TABLE otps ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

-- Índice para busca por tipo de código
CREATE INDEX IF NOT EXISTS idx_otps_code_type ON otps(code_type);
CREATE INDEX IF NOT EXISTS idx_otps_reset_token ON otps(reset_token) WHERE reset_token IS NOT NULL;

-- Trigger para limpeza automática de OTPs expirados
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM otps WHERE expires_at < NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Executar limpeza a cada novo insert (ou usar pg_cron)
-- CREATE TRIGGER trigger_cleanup_otps AFTER INSERT ON otps EXECUTE FUNCTION cleanup_expired_otps();
