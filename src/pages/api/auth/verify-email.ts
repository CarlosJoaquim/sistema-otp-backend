import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import bcrypt from 'bcryptjs';
import { checkAttemptsLimit, isBlocked, recordFailure, clearFailures } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, code, correlation_id } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email e código são obrigatórios' });
  }

  try {
    // Verificar se usuário está bloqueado
    if (await isBlocked(email)) {
      return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
    }

    // Rate limit de tentativas
    const attemptsCheck = await checkAttemptsLimit(email);
    if (!attemptsCheck.allowed) {
      return res.status(429).json({ success: false, message: 'Limite de tentativas excedido.' });
    }

    // Verificar OTP com hash
    const { data: otp } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .single();

    if (!otp) {
      await recordFailure(email);
      return res.status(400).json({ success: false, message: 'Código inválido' });
    }

    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Código expirado' });
    }

    if (otp.attempts >= 3) {
      return res.status(400).json({ success: false, message: 'Muitas tentativas' });
    }

    // Verificar hash
    const isValid = await bcrypt.compare(code, otp.code_hash);

    // Incrementar tentativas
    await supabase
      .from('otps')
      .update({ attempts: otp.attempts + 1 })
      .eq('id', otp.id);

    if (!isValid) {
      const failures = await recordFailure(email);
      await logEvent({
        correlation_id: correlation_id || otp.correlation_id || '',
        event_type: 'email_verification_failed',
        status: 'failure',
        email,
        ip_address: ip as string,
        attempts: failures,
        metadata: { reason: 'invalid_code' }
      });
      return res.status(400).json({ success: false, message: 'Código inválido' });
    }

    // Marcar OTP como verificado
    await supabase
      .from('otps')
      .update({ verified: true })
      .eq('id', otp.id);

    // Limpar OTP e falhas
    await supabase.from('otps').delete().eq('email', email);
    await clearFailures(email);

    await logEvent({
      correlation_id: correlation_id || otp.correlation_id || '',
      event_type: 'email_verification_completed',
      status: 'success',
      email,
      ip_address: ip as string,
    });

    return res.status(200).json({ success: true, message: 'Email verificado com sucesso' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
