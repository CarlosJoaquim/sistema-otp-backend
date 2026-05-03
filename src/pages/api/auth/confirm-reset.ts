import { NextApiRequest, NextApiResponse } from 'next';
import { verifyResetCode } from '../../../lib/passwordService';
import { isBlocked, recordFailure, clearFailures } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, code } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const correlationId = generateCorrelationId();

  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email e código são obrigatórios' });
  }

  if (!/^\d{6}$/.test(code)) {
    return res.status(422).json({ success: false, message: 'Código deve conter 6 dígitos numéricos' });
  }

  try {
    if (await isBlocked(email)) {
      return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
    }

    const result = await verifyResetCode(email, code);

    if (!result.success) {
      const failures = await recordFailure(email);

      await logEvent({
        correlation_id: correlationId,
        event_type: 'otp_failed',
        status: 'failure',
        email,
        ip_address: ip as string,
        attempts: failures,
        metadata: { reason: result.message, step: 'reset_code_verification' }
      });

      return res.status(400).json(result);
    }

    await clearFailures(email);

    await logEvent({
      correlation_id: correlationId,
      event_type: 'otp_verified',
      status: 'success',
      email,
      ip_address: ip as string,
      metadata: { step: 'reset_code_verified', token_generated: true }
    });

    return res.status(200).json({
      success: true,
      message: 'Código verificado com sucesso',
      resetToken: result.resetToken,
      resetTokenExpiresIn: result.resetTokenExpiresIn,
    });
  } catch (error: any) {
    await logEvent({
      correlation_id: correlationId,
      event_type: 'otp_failed',
      status: 'failure',
      email,
      ip_address: ip as string,
      metadata: { error: error.message }
    });
    return res.status(500).json({ success: false, message: error.message });
  }
}
