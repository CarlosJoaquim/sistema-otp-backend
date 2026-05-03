import { NextApiRequest, NextApiResponse } from 'next';
import { verifyOTP } from '../../../lib/otpService';
import { checkAttemptsLimit, isBlocked, recordFailure, clearFailures } from '../../../lib/rateLimit';
import { logEvent, EventType, EventStatus } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, code, correlation_id } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email e código são obrigatórios' });
  }

  try {
    // Verificar se usuário está bloqueado
    if (await isBlocked(email)) {
      return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
    }

    // Rate limit de tentativas por usuário (3 por hora)
    const attemptsCheck = await checkAttemptsLimit(email);
    if (!attemptsCheck.allowed) {
      return res.status(429).json({ success: false, message: 'Limite de tentativas excedido. Tente em 1 hora.' });
    }

    const result = await verifyOTP(email, code, correlation_id);

    if (!result.success) {
      // Registrar falha para possível bloqueio
      const failures = await recordFailure(email);
      await logEvent({
        correlation_id: correlation_id || '',
        event_type: 'otp_failed',
        status: 'failure',
        email,
        ip_address: ip as string,
        user_agent: userAgent,
        attempts: failures,
        metadata: { reason: result.message }
      });
      return res.status(400).json(result);
    }

    // Limpar falhas em caso de sucesso
    await clearFailures(email);
    
    await logEvent({
      correlation_id: correlation_id || '',
      event_type: 'otp_verified',
      status: 'success',
      email,
      ip_address: ip as string,
      user_agent: userAgent,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
