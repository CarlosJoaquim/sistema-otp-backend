const { generateOTP } = require('../utils/otpGenerator');
const { sendSMS } = require('./smsService');
const supabase = require('./supabaseClient');

const createOTP = async (phone, checkUserExists = true) => {
  // Verificar se o usuário existe no banco (para redefinição de senha)
  if (checkUserExists) {
  const { data: user, error: userError } = await supabase
       .from('usuarios')
       .select('phone')
       .eq('phone', phone)
       .single();
    
    if (userError || !user) {
      return { success: false, message: 'Número não encontrado. Verifique o número ou registe-se primeiro.' };
    }
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + process.env.OTP_EXPIRATION_MINUTES * 60000);
  
  // Send SMS first
  const message = `Seu código de verificação é: ${otp}. Expira em ${process.env.OTP_EXPIRATION_MINUTES} minutos.`;
  const smsResult = await sendSMS(phone, message);
  
  if (!smsResult.success) {
    throw new Error('Falha ao enviar SMS');
  }
  
  // Remove existing OTPs for this phone
  await supabase.from('otps').delete().eq('phone', phone);
  
  // Store new OTP with message_id
  const { data, error } = await supabase
    .from('otps')
    .insert([{ 
      phone, 
      code: otp, 
      message_id: smsResult.messageId,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      verified: false
    }])
    .select();
  
  if (error) throw error;
  
  return { success: true, message: 'OTP enviado com sucesso' };
};

const verifyOTP = async (phone, code) => {
  const { data: otps, error } = await supabase
    .from('otps')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .single();
  
  if (error || !otps) return { success: false, message: 'Invalid OTP' };
  
  if (new Date(otps.expires_at) < new Date()) {
    return { success: false, message: 'OTP expired' };
  }
  
  if (otps.attempts >= process.env.MAX_ATTEMPTS) {
    return { success: false, message: 'Too many attempts' };
  }
  
  // Update attempts
  await supabase.from('otps')
    .update({ attempts: otps.attempts + 1 })
    .eq('id', otps.id);
  
  if (otps.code !== code) {
    return { success: false, message: 'Invalid code' };
  }
  
  // Mark as verified
  await supabase.from('otps')
    .update({ verified: true })
    .eq('id', otps.id);
  
  return { success: true, message: 'OTP verified successfully' };
};

module.exports = { createOTP, verifyOTP };
