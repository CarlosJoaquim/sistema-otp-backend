import { NextApiRequest, NextApiResponse } from 'next';
import { createOTP } from '../../../lib/otpService';
import supabase from '../../../lib/supabase';
import { sendVerificationEmail } from '../../../lib/mailer';
import { checkUserRateLimit, checkIPRateLimit, checkGlobalRateLimit, checkRateLimit, isBlocked, recordFailure } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { resetRequestSchema } from '../../../lib/validators';
import { authRateLimit } from '../../../lib/middleware';

const PASSWORD_RESET_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
  keyPrefix: 'ratelimit:password_reset',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return authRateLimit(req, res, async () => {
    const startTime = Date.now();
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] as string || 'unknown';

    try {
      const validated = resetRequestSchema.parse(req.body);
      const { email } = validated;
      const cleanEmail = email.toLowerCase().trim();
      const correlationId = req.body.idempotency_key || generateCorrelationId();

      if (await isBlocked(cleanEmail)) {
        await logApiRequest({ correlationId, req, startTime }, 'rate_limit_exceeded', 'blocked');
        return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
      }

      const userRate = await checkUserRateLimit(cleanEmail);
      if (!userRate.allowed) {
        await logApiRequest({ correlationId, req, startTime }, 'rate_limit_exceeded', 'rate_limited', { retry_after: userRate.retryAfter });
        return res.status(429).json({
          success: false,
          message: `Aguarde ${userRate.retryAfter} segundos antes de solicitar novo código.`,
        });
      }

      const ipRate = await checkIPRateLimit(ip);
      if (!ipRate.allowed) {
        return res.status(429).json({ success: false, message: 'Muitas solicitações deste IP' });
      }

      const globalRate = await checkGlobalRateLimit();
      if (!globalRate.allowed) {
        return res.status(429).json({ success: false, message: 'Sistema temporariamente indisponível' });
      }

      const resetRateLimit = await checkRateLimit(cleanEmail, PASSWORD_RESET_RATE_LIMIT);
      if (!resetRateLimit.allowed) {
        await logApiRequest({ correlationId, req, startTime }, 'rate_limit_exceeded', 'rate_limited', { retry_after: resetRateLimit.retryAfter, limit_type: 'password_reset' });
        return res.status(429).json({
          success: false,
          message: `Limite de solicitações de redefinição excedido. Aguarde ${resetRateLimit.retryAfter} segundos.`,
        });
      }

      const { data: user } = await supabase
        .from('usuarios')
        .select('email, nome')
        .eq('email', cleanEmail)
        .single();

      if (!user) {
        await logApiRequest({ correlationId, req, startTime }, 'password_reset_requested', 'success', { user_exists: false, hidden_for_security: true });
        return res.status(200).json({
          success: true,
          message: 'Se o email estiver cadastrado, você receberá um código de verificação.',
        });
      }

      const result = await createOTP(cleanEmail, false, 'email', correlationId, 'password_reset');

      if (!result.success) {
        return res.status(400).json(result);
      }

      const emailResult = await sendVerificationEmail(cleanEmail, result.code!, 'password_reset', user.nome);

      if (!emailResult.success) {
        logger.warn('Erro ao enviar email de redefinição', { error: emailResult.error });
      }

      await logApiRequest(
        { correlationId, req, startTime },
        'password_reset_requested',
        emailResult.success ? 'success' : 'failure',
        { email_sent: emailResult.success, resend_message_id: emailResult.messageId }
      );

      return res.status(200).json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá um código de verificação.',
        correlation_id: result.correlationId,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro no request reset', { error: error.message });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
