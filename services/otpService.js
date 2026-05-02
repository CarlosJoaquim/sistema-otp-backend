const { generateOTP } = require('./otpGenerator');
const supabase = require('./supabaseClient');

const createOTP = async (phone, checkUserExists = true, method = 'sms') => {
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
  
  await supabase.from('otps').delete().or(`phone.eq.${phone},email.eq.${phone}`);
  
  const insertData = { 
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

const verifyOTP = async (phone, code) => {
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
  
  await supabase.from('otps')
    .update({ attempts: otp.attempts + 1 })
    .eq('id', otp.id);
  
  if (otp.code !== code) {
    return { success: false, message: 'Código inválido' };
  }
  
  await supabase.from('otps')
    .update({ verified: true })
    .eq('id', otp.id);
  
  return { success: true, message: 'Código verificado' };
};

module.exports = { createOTP, verifyOTP };
