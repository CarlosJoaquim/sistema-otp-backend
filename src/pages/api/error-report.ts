import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../lib/supabase';
import { generateCorrelationId, logEvent, logger } from '../../lib/logger';
import { errorReportSchema } from '../../lib/validators';
import { strictRateLimit } from '../../lib/middleware';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return strictRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();

    try {
      const validated = errorReportSchema.parse(req.body);
      const { error_name, error_message, stack_trace, user_id, screen_name, app_version, device_info } = validated;

      await supabase.from('error_reports').insert([{
        correlation_id: correlationId,
        error_name: error_name || 'UnknownError',
        error_message,
        stack_trace: stack_trace || null,
        user_id: user_id || null,
        screen_name: screen_name || null,
        app_version: app_version || null,
        device_info: device_info || null,
        status: 'pending',
        created_at: new Date().toISOString(),
      }]);

      const resendKey = process.env.RESEND_API_KEY;

      if (resendKey) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: 'Caop-B Error Report <error@caop-b.com>',
              to: ['carlosjoaquim6790@gmail.com', 'suporte@centralcaopb.com'],
              subject: `Erro Critico no App: ${error_name || 'Unknown'}`,
              html: '<h2>Relatorio de Erro</h2><p>' + error_message + '</p>',
            }),
          });
        } catch (emailError) {
          logger.warn('Erro ao enviar email de reporte', { correlationId });
        }
      }

      await logEvent({
        correlation_id: correlationId,
        event_type: 'error_reported',
        status: 'failure',
        metadata: { error_name, screen_name, user_id },
      });

      return res.status(200).json({ success: true, correlation_id: correlationId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados invalidos' });
      }

      logger.error('Erro ao processar error report', { error: error.message });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
