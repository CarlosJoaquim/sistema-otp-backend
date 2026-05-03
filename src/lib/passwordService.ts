import supabase from '../lib/supabase';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const verifyResetCode = async (email: string, code: string) => {
  const { data: otp } = await supabase
    .from('otps')
    .select('*')
    .eq('email', email)
    .eq('code_type', 'password_reset')
    .eq('verified', false)
    .single();

  if (!otp) {
    return { success: false, message: 'Código inválido' };
  }

  if (new Date(otp.expires_at) < new Date()) {
    return { success: false, message: 'Código expirado' };
  }

  if (otp.attempts >= 3) {
    return { success: false, message: 'Muitas tentativas' };
  }

  const isValid = await bcrypt.compare(code, otp.code_hash);

  await supabase
    .from('otps')
    .update({ attempts: otp.attempts + 1 })
    .eq('id', otp.id);

  if (!isValid) {
    return { success: false, message: 'Código inválido' };
  }

  await supabase
    .from('otps')
    .update({ verified: true })
    .eq('id', otp.id);

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiresAt = new Date(Date.now() + 5 * 60000);

  const { error: updateError } = await supabase
    .from('otps')
    .update({
      reset_token: resetToken,
      reset_token_expires_at: resetTokenExpiresAt.toISOString(),
    })
    .eq('id', otp.id);

  if (updateError) throw updateError;

  return {
    success: true,
    message: 'Código verificado',
    resetToken,
    resetTokenExpiresIn: 300,
  };
};

export const resetPasswordWithToken = async (email: string, resetToken: string, newPassword: string) => {
  const { data: otp } = await supabase
    .from('otps')
    .select('*')
    .eq('email', email)
    .eq('code_type', 'password_reset')
    .eq('verified', true)
    .not('reset_token', 'is', null)
    .single();

  if (!otp || otp.reset_token !== resetToken) {
    return { success: false, message: 'Token inválido' };
  }

  if (new Date(otp.reset_token_expires_at) < new Date()) {
    return { success: false, message: 'Token expirado' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const { error } = await supabase
    .from('usuarios')
    .update({ senha: passwordHash })
    .or(`telefone.eq.${email},email.eq.${email}`);

  if (error) throw error;

  await supabase
    .from('otps')
    .delete()
    .eq('email', email)
    .eq('code_type', 'password_reset');

  return { success: true, message: 'Senha redefinida com sucesso' };
};

export const resetPassword = async (phone: string, newPassword: string) => {
  const { data: otp } = await supabase
    .from('otps')
    .select('*')
    .or(`phone.eq.${phone},email.eq.${phone}`)
    .eq('verified', true)
    .single();

  if (!otp) {
    return { success: false, message: 'Código não verificado' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const { error } = await supabase
    .from('usuarios')
    .update({ senha: passwordHash })
    .or(`telefone.eq.${phone},email.eq.${phone}`);

  if (error) throw error;

  await supabase.from('otps').delete().or(`phone.eq.${phone},email.eq.${phone}`);

  return { success: true, message: 'Senha redefinida' };
};
