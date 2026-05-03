import { NextApiRequest, NextApiResponse } from 'next';
import { resetPasswordWithToken } from '../../../lib/passwordService';
import { isBlocked } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, resetToken, newPassword } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const correlationId = generateCorrelationId();

  if (!email || !resetToken || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, token de redefinição e nova senha são obrigatórios' });
  }

  if (newPassword.length < 6) {
    return res.status(422).json({ success: false, message: 'A senha deve ter pelo menos 6 caracteres' });
  }

  try {
    if (await isBlocked(email)) {
      return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
    }

    const result = await resetPasswordWithToken(email, resetToken, newPassword);

    await logEvent({
      correlation_id: correlationId,
      event_type: result.success ? 'password_reset_completed' : 'otp_failed',
      status: result.success ? 'success' : 'failure',
      email,
      ip_address: ip as string,
      metadata: { success: result.success, message: result.message }
    });

    return res.status(result.success ? 200 : 400).json(result);
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
