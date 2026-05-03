import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import bcrypt from 'bcryptjs';
import { isBlocked } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, code, newPassword } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const correlationId = generateCorrelationId();

  if (!email || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email e nova senha são obrigatórios' });
  }

  if (newPassword.length < 6) {
    return res.status(422).json({ success: false, message: 'A senha deve ter pelo menos 6 caracteres' });
  }

  try {
    if (await isBlocked(email)) {
      return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
    }

    // Se não tem código, procura OTP verificado
    if (!code) {
      const { data: otp } = await supabase
        .from('otps')
        .select('*')
        .eq('email', email)
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

      // Reset password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ senha: passwordHash })
        .eq('email', email);

      if (updateError) throw updateError;

      await supabase
        .from('otps')
        .delete()
        .eq('email', email)
        .eq('code_type', 'password_reset');

      await logEvent({
        correlation_id: correlationId,
        event_type: 'password_reset_completed',
        status: 'success',
        email,
        ip_address: ip as string,
        metadata: { method: 'verified_otp' }
      });

      return res.status(200).json({ success: true, message: 'Senha redefinida com sucesso' });
    }

    // Se tem código, tenta verificar e reset
    // Primeiro procura OTP não verificado com o código
    let { data: otp } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .eq('code_type', 'password_reset')
      .eq('verified', false)
      .single();

    // Se não encontrou não verificado, procura um já verificado
    if (!otp) {
      const { data: verifiedOtp } = await supabase
        .from('otps')
        .select('*')
        .eq('email', email)
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

    // Se já está verificado, pula a verificação do código
    if (!otp.verified) {
      if (new Date(otp.expires_at) < new Date()) {
        return res.status(400).json({ success: false, message: 'Código expirado' });
      }

      if (otp.attempts >= 3) {
        return res.status(400).json({ success: false, message: 'Muitas tentativas' });
      }

      const isValid = await bcrypt.compare(code, otp.code_hash);

      await supabase
        .from('otps')
        .update({ attempts: otp.attempts + 1 })
        .eq('id', otp.id);

      if (!isValid) {
        return res.status(400).json({ success: false, message: 'Código inválido' });
      }

      await supabase
        .from('otps')
        .update({ verified: true })
        .eq('id', otp.id);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ senha: passwordHash })
      .eq('email', email);

    if (updateError) throw updateError;

    await supabase
      .from('otps')
      .delete()
      .eq('email', email)
      .eq('code_type', 'password_reset');

    await logEvent({
      correlation_id: correlationId,
      event_type: 'password_reset_completed',
      status: 'success',
      email,
      ip_address: ip as string,
      metadata: { method: 'code_direct' }
    });

    return res.status(200).json({ success: true, message: 'Senha redefinida com sucesso' });
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
