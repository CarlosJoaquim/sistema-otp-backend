import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import bcrypt from 'bcryptjs';
import { isBlocked } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { resetPasswordSchema } from '../../../lib/validators';
import { authRateLimit } from '../../../lib/middleware';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return authRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';

    try {
      const validated = resetPasswordSchema.parse(req.body);
      const { email, code, newPassword } = validated;
      const cleanEmail = email.toLowerCase().trim();

      if (await isBlocked(cleanEmail)) {
        await logApiRequest({ correlationId, req, startTime }, 'password_reset_completed', 'rate_limited', { reason: 'rate_limited' });
        return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
      }

      if (!code) {
        const { data: otp } = await supabase
          .from('otps')
          .select('*')
          .eq('email', cleanEmail)
          .eq('code_type', 'password_reset')
          .eq('verified', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!otp) {
          return res.status(400).json({ success: false, message: 'Nenhum OTP verificado encontrado. Verifique o código primeiro.' });
        }

        if (new Date(otp.created_at).getTime() < Date.now() - 15 * 60 * 1000) {
          return res.status(400).json({ success: false, message: 'Verificação expirada. Solicite um novo código.' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabase.from('usuarios').update({ senha: passwordHash }).eq('email', cleanEmail);
        if (updateError) throw updateError;

        await supabase.from('otps').delete().eq('email', cleanEmail).eq('code_type', 'password_reset');

        await logApiRequest({ correlationId, req, startTime }, 'password_reset_completed', 'success', { method: 'verified_otp' });
        return res.status(200).json({ success: true, message: 'Senha redefinida com sucesso' });
      }

      let { data: otp } = await supabase
        .from('otps')
        .select('*')
        .eq('email', cleanEmail)
        .eq('code_type', 'password_reset')
        .eq('verified', false)
        .single();

      if (!otp) {
        const { data: verifiedOtp } = await supabase
          .from('otps')
          .select('*')
          .eq('email', cleanEmail)
          .eq('code_type', 'password_reset')
          .eq('verified', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (verifiedOtp && new Date(verifiedOtp.created_at).getTime() > Date.now() - 15 * 60 * 1000) {
          otp = verifiedOtp;
        }
      }

      if (!otp) {
        return res.status(400).json({ success: false, message: 'Código inválido ou expirado' });
      }

      if (!otp.verified) {
        if (new Date(otp.expires_at) < new Date()) {
          return res.status(400).json({ success: false, message: 'Código expirado' });
        }

        if (otp.attempts >= 3) {
          return res.status(400).json({ success: false, message: 'Muitas tentativas' });
        }

        const isValid = await bcrypt.compare(code, otp.code_hash);
        await supabase.from('otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);

        if (!isValid) {
          return res.status(400).json({ success: false, message: 'Código inválido' });
        }

        await supabase.from('otps').update({ verified: true }).eq('id', otp.id);
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      const { error: updateError } = await supabase.from('usuarios').update({ senha: passwordHash }).eq('email', cleanEmail);
      if (updateError) throw updateError;

      await supabase.from('otps').delete().eq('email', cleanEmail).eq('code_type', 'password_reset');

      await logApiRequest({ correlationId, req, startTime }, 'password_reset_completed', 'success', { method: 'code_direct' });
      return res.status(200).json({ success: true, message: 'Senha redefinida com sucesso' });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro no reset de senha', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'password_reset_completed', 'failure', { error: error.message });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
