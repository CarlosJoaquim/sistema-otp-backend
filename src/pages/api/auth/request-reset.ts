import { NextApiRequest, NextApiResponse } from 'next';
import { createOTP } from '../../../lib/otpService';
import supabase from '../../../lib/supabase';
import { sendVerificationEmail } from '../../../lib/mailer';
import { checkUserRateLimit, checkIPRateLimit, checkGlobalRateLimit, checkRateLimit, isBlocked, recordFailure } from '../../../lib/rateLimit';
import { logEvent } from '../../../lib/logger';

const PASSWORD_RESET_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
  keyPrefix: 'ratelimit:password_reset',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, idempotency_key } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email é obrigatório' });
  }

  const correlationId = idempotency_key || undefined;

  try {
    if (await isBlocked(email)) {
      await logEvent({
        correlation_id: correlationId || '',
        event_type: 'rate_limit_exceeded',
        status: 'blocked',
        email,
        ip_address: ip as string,
        user_agent: userAgent,
      });
      return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
    }

    const userRate = await checkUserRateLimit(email);
    if (!userRate.allowed) {
      await logEvent({
        correlation_id: correlationId || '',
        event_type: 'rate_limit_exceeded',
        status: 'rate_limited',
        email,
        ip_address: ip as string,
        metadata: { retry_after: userRate.retryAfter }
      });
      return res.status(429).json({
        success: false,
        message: `Aguarde ${userRate.retryAfter} segundos antes de solicitar novo código.`
      });
    }

    const ipRate = await checkIPRateLimit(ip as string);
    if (!ipRate.allowed) {
      return res.status(429).json({ success: false, message: 'Muitas solicitações deste IP' });
    }

    const globalRate = await checkGlobalRateLimit();
    if (!globalRate.allowed) {
      return res.status(429).json({ success: false, message: 'Sistema temporariamente indisponível' });
    }

    const resetRateLimit = await checkRateLimit(email, PASSWORD_RESET_RATE_LIMIT);
    if (!resetRateLimit.allowed) {
      await logEvent({
        correlation_id: correlationId || '',
        event_type: 'rate_limit_exceeded',
        status: 'rate_limited',
        email,
        ip_address: ip as string,
        metadata: { retry_after: resetRateLimit.retryAfter, limit_type: 'password_reset' }
      });
      return res.status(429).json({
        success: false,
        message: `Limite de solicitações de redefinição excedido. Aguarde ${resetRateLimit.retryAfter} segundos.`
      });
    }

    const { data: user } = await supabase
      .from('usuarios')
      .select('email, nome')
      .eq('email', email)
      .single();

    if (!user) {
      await logEvent({
        correlation_id: correlationId || '',
        event_type: 'password_reset_requested',
        status: 'success',
        email,
        ip_address: ip as string,
        user_agent: userAgent,
        metadata: { user_exists: false, hidden_for_security: true }
      });
      return res.status(200).json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá um código de verificação.',
      });
    }

    const result = await createOTP(email, false, 'email', correlationId, 'password_reset');

    if (!result.success) {
      return res.status(400).json(result);
    }

    const emailResult = await sendVerificationEmail(email, result.code!, 'password_reset', user.nome);

    if (!emailResult.success) {
      console.error('Erro ao enviar email de redefinição:', emailResult.error);
    }

    await logEvent({
      correlation_id: result.correlationId || '',
      event_type: 'password_reset_requested',
      status: emailResult.success ? 'success' : 'failure',
      email,
      ip_address: ip as string,
      user_agent: userAgent,
      metadata: { email_sent: emailResult.success, resend_message_id: emailResult.messageId }
    });

    return res.status(200).json({
      success: true,
      message: 'Se o email estiver cadastrado, você receberá um código de verificação.',
      correlation_id: result.correlationId,
    });
  } catch (error: any) {
    await logEvent({
      correlation_id: correlationId || '',
      event_type: 'otp_failed',
      status: 'failure',
      email,
      ip_address: ip as string,
      metadata: { error: error.message }
    });
    return res.status(500).json({ success: false, message: error.message });
  }
}
