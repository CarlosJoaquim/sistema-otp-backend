import supabase from './supabase';
import { NextApiRequest, NextApiResponse } from 'next';

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
  | 'blocked_user_attempt'
  | 'login_success'
  | 'login_failed'
  | 'reservation_created'
  | 'reservation_cancelled'
  | 'reservation_failed'
  | 'reservation_listed'
  | 'reservation_status_updated'
  | 'establishment_searched'
  | 'location_access_check'
  | 'location_coordinates_fetched'
  | 'reservations_with_location_access_fetched'
  | 'error_reported'
  | 'api_request'
  | 'api_error'
  | 'validation_error';

export type EventStatus = 'success' | 'failure' | 'rate_limited' | 'blocked';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

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

export interface LogContext {
  correlationId?: string;
  userId?: string;
  req?: NextApiRequest;
  res?: NextApiResponse;
  startTime?: number;
}

export const generateCorrelationId = (): string => {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

const isDev = process.env.NODE_ENV === 'development';

const formatLog = (level: LogLevel, message: string, context?: Record<string, any>) => {
  const timestamp = new Date().toISOString();
  const parts = [
    `[${timestamp}]`,
    `[${level.toUpperCase()}]`,
    message,
  ];

  if (context && Object.keys(context).length > 0) {
    parts.push(JSON.stringify(context));
  }

  return parts.join(' ');
};

export const logger = {
  info: (message: string, context?: Record<string, any>) => {
    if (isDev) {
      console.log(formatLog('info', message, context));
    }
  },

  warn: (message: string, context?: Record<string, any>) => {
    console.warn(formatLog('warn', message, context));
  },

  error: (message: string, context?: Record<string, any>) => {
    console.error(formatLog('error', message, context));
  },

  debug: (message: string, context?: Record<string, any>) => {
    if (isDev) {
      console.debug(formatLog('debug', message, context));
    }
  },
};

export const withTiming = async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
  const start = Date.now();
  const result = await fn();
  return { result, duration: Date.now() - start };
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

export const logApiRequest = async (context: LogContext, eventType: EventType, status: EventStatus, metadata?: Record<string, any>) => {
  const entry: Omit<LogEntry, 'timestamp'> = {
    correlation_id: context.correlationId || generateCorrelationId(),
    event_type: eventType,
    status,
    email: (context.req?.body as any)?.email,
    ip_address: context.req?.headers['x-forwarded-for'] as string || context.req?.socket.remoteAddress,
    user_agent: context.req?.headers['user-agent'] as string,
    time_elapsed_ms: context.startTime ? Date.now() - context.startTime : undefined,
    metadata,
  };

  await logEvent(entry);
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
