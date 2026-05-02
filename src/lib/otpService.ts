import { generateOTP } from '../lib/otpGenerator';
import supabase from '../lib/supabase';

export const createOTP = async (phone: string, checkUserExists: boolean = true, method: string = 'sms') => {
  if (checkUserExists) {
    const { data: user } = await supabase
      .from('usuarios')
      .select('telefone, email')
      .or(`telefone.eq.${phone},email.eq.${phone}`)
      .single();
    
    if (!user) {
      return { success: false, message: 'Usuário não encontrado' };
    }
  }
  
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 20 * 60000);
  
  // Remover OTPs antigos
  await supabase.from('otps').delete().or(`phone.eq.${phone},email.eq.${phone}`);
  
  // Criar novo OTP
  const insertData: any = { 
    code: otp,
    expires_at: expiresAt.toISOString(),
    attempts: 0,
    verified: false,
    method: method
  };
  
  if (method === 'sms') {
    insertData.phone = phone;
  } else {
    insertData.email = phone;
  }
  
  const { data, error } = await supabase
    .from('otps')
    .insert([insertData])
    .select();
  
  if (error) throw error;
  return { success: true, message: `OTP enviado via ${method}` };
};

export const verifyOTP = async (phone: string, code: string) => {
  const { data: otp } = await supabase
    .from('otps')
    .select('*')
    .or(`phone.eq.${phone},email.eq.${phone}`)
    .eq('code', code)
    .single();
  
  if (!otp) return { success: false, message: 'Código inválido' };
  
  if (new Date(otp.expires_at) < new Date()) {
    return { success: false, message: 'Código expirado' };
  }
  
  if (otp.attempts >= 3) {
    return { success: false, message: 'Muitas tentativas' };
  }
  
  // Incrementar tentativas
  await supabase.from('otps')
    .update({ attempts: otp.attempts + 1 })
    .eq('id', otp.id);
  
  if (otp.code !== code) {
    return { success: false, message: 'Código inválido' };
  }
  
  // Marcar como verificado
  await supabase.from('otps')
    .update({ verified: true })
    .eq('id', otp.id);
  
  return { success: true, message: 'Código verificado' };
};
