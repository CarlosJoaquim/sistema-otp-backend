import supabase from '../lib/supabase';
import bcrypt from 'bcryptjs';

export const resetPassword = async (phone: string, newPassword: string) => {
  // Verificar se OTP foi validado
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
  
  // Atualizar senha na tabela usuarios
  const { error } = await supabase
    .from('usuarios')
    .update({ senha: passwordHash })
    .or(`telefone.eq.${phone},email.eq.${phone}`);
  
  if (error) throw error;
  
  // Limpar OTP
  await supabase.from('otps').delete().or(`phone.eq.${phone},email.eq.${phone}`);
  
  return { success: true, message: 'Senha redefinida' };
};
