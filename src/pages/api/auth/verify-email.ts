import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import bcrypt from 'bcryptjs';
import { checkAttemptsLimit, isBlocked, recordFailure, clearFailures } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { otpVerificationSchema } from '../../../lib/validators';
import { authRateLimit } from '../../../lib/middleware';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return authRateLimit(req, res, async () => {
    const startTime = Date.now();
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';

    try {
      const validated = otpVerificationSchema.parse(req.body);
      const { email, code, correlation_id } = validated;
      const cleanEmail = email.toLowerCase().trim();
      const correlationId = correlation_id || generateCorrelationId();

      if (await isBlocked(cleanEmail)) {
        await logApiRequest({ correlationId, req, startTime }, 'email_verification_failed', 'blocked');
        return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
      }

      const attemptsCheck = await checkAttemptsLimit(cleanEmail);
      if (!attemptsCheck.allowed) {
        return res.status(429).json({ success: false, message: 'Limite de tentativas excedido.' });
      }

      const { data: otp } = await supabase
        .from('otps')
        .select('*')
        .eq('email', cleanEmail)
        .single();

      if (!otp) {
        await recordFailure(cleanEmail);
        return res.status(400).json({ success: false, message: 'Código inválido' });
      }

      if (new Date(otp.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: 'Código expirado' });
      }

      if (otp.attempts >= 3) {
        return res.status(400).json({ success: false, message: 'Muitas tentativas' });
      }

      const isValid = await bcrypt.compare(code, otp.code_hash);

      await supabase.from('otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);

      if (!isValid) {
        const failures = await recordFailure(cleanEmail);
        await logApiRequest({ correlationId, req, startTime }, 'email_verification_failed', 'failure', { reason: 'invalid_code', attempts: failures });
        return res.status(400).json({ success: false, message: 'Código inválido' });
      }

      await supabase.from('otps').update({ verified: true }).eq('id', otp.id);
      await supabase.from('otps').delete().eq('email', cleanEmail);
      await clearFailures(cleanEmail);

      await logApiRequest({ correlationId, req, startTime }, 'email_verification_completed', 'success');
      return res.status(200).json({ success: true, message: 'Email verificado com sucesso' });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro na verificação de email', { error: error.message });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
