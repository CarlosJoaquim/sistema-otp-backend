import supabase from './supabase';

export type EventType =
  | 'otp_sent'
  | 'otp_verified'
  | 'otp_failed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'email_verification_sent'
  | 'email_verification_completed'
  | 'email_verification_failed'
  | 'user_registered'
  | 'rate_limit_exceeded'
  | 'blocked_user_attempt';

export type EventStatus = 'success' | 'failure' | 'rate_limited' | 'blocked';

export interface LogEntry {
  correlation_id: string;
  timestamp: string;
  event_type: EventType;
  status: EventStatus;
  email?: string;
  ip_address?: string;
  user_agent?: string;
  attempts?: number;
  time_elapsed_ms?: number;
  metadata?: Record<string, any>;
}

export const generateCorrelationId = (): string => {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

export const logEvent = async (entry: Omit<LogEntry, 'timestamp'>) => {
  try {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('system_logs')
      .insert([logEntry]);

    if (error) {
      console.error('Erro ao salvar log:', error);
    }
  } catch (error) {
    console.error('Erro ao registrar evento:', error);
  }
};

// Métricas para o dashboard
export const getMetrics = async (periodHours: number = 24) => {
  try {
    const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

    // Taxa de sucesso de entrega
    const { data: successData, count: successCount } = await supabase
      .from('system_logs')
      .select('*', { count: 'exact' })
      .gte('timestamp', since)
      .in('event_type', ['otp_sent', 'email_verification_sent'])
      .eq('status', 'success');

    const { count: totalSent } = await supabase
      .from('system_logs')
      .select('*', { count: 'exact' })
      .gte('timestamp', since)
      .in('event_type', ['otp_sent', 'email_verification_sent']);

    // Tempo médio de verificação
    const { data: verifiedLogs } = await supabase
      .from('system_logs')
      .select('correlation_id, time_elapsed_ms')
      .gte('timestamp', since)
      .eq('event_type', 'otp_verified')
      .eq('status', 'success');

    // Taxa de abandono
    const { count: requestedCount } = await supabase
      .from('system_logs')
      .select('*', { count: 'exact' })
      .gte('timestamp', since)
      .eq('event_type', 'password_reset_requested');

    const { count: completedCount } = await supabase
      .from('system_logs')
      .select('*', { count: 'exact' })
      .gte('timestamp', since)
      .eq('event_type', 'password_reset_completed');

    const avgTime = verifiedLogs && verifiedLogs.length > 0
      ? verifiedLogs.reduce((acc, log) => acc + (log.time_elapsed_ms || 0), 0) / verifiedLogs.length
      : 0;

    return {
      successRate: totalSent ? ((successCount || 0) / totalSent * 100) : 0,
      avgVerificationTimeMs: avgTime,
      abandonmentRate: requestedCount ? ((requestedCount - (completedCount || 0)) / requestedCount * 100) : 0,
      totalSent: totalSent || 0,
      totalVerified: successCount || 0,
    };
  } catch (error) {
    console.error('Erro ao calcular métricas:', error);
    return null;
  }
};
