const { generateOTP } = require('../utils/otpGenerator');
const { sendSMS } = require('./smsService');
const supabase = require('./supabaseClient');

async function logEmail(contact, code, method, status, details) {
  try {
    await supabase.from('email_logs').insert([{
      contact,
      code,
      method,
      status,
      details,
      created_at: new Date().toISOString()
    }]);
  } catch (e) {
    console.error('Erro ao gravar log (tabela pode não existir):', e.message);
  }
}

const createOTP = async (phone, checkUserExists = true, method = 'sms') => {
  // Verificar se o usuário existe no banco (para redefinição de senha)
  if (checkUserExists) {
    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('telefone, email')
      .or(`telefone.eq.${phone},email.eq.${phone}`)
      .single();
    
    if (userError || !user) {
      return { success: false, message: 'Usuário não encontrado. Verifique o número/email ou registe-se primeiro.' };
    }
  }
  
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 20 * 60000); // 20 minutos
  
  let sendResult = { success: true };
  
  if (method === 'sms') {
    // Send SMS
    const message = `Seu código de verificação é: ${otp}. Expira em 20 minutos.`;
    sendResult = await sendSMS(phone, message);
    
    if (!sendResult.success) {
      await logEmail(phone, null, 'sms', 'failed', sendResult.message);
      throw new Error('Falha ao enviar SMS');
    }
  } else if (method === 'email') {
    // Send via Supabase Auth
    const { data, error } = await supabase.auth.resetPasswordForEmail(phone, {
      redirectTo: `${process.env.APP_URL}/reset-password`,
    });
    
    if (error) {
      await logEmail(phone, null, 'email', 'failed', error.message);
      throw new Error('Falha ao enviar email: ' + error.message);
    }
    await logEmail(phone, null, 'email', 'sent', 'Email enviado via Supabase Auth');
  }
  
  // Remove existing OTPs for this contact
  await supabase.from('otps').delete().eq('phone', phone);
  
  // Store new OTP
  const insertData = { 
    phone: phone,
    code: otp, 
    expires_at: expiresAt.toISOString(),
    attempts: 0,
    verified: false,
    method: method
  };
  
  if (method === 'sms') {
    insertData.message_id = sendResult.messageId;
  }
  
  const { data, error } = await supabase
    .from('otps')
    .insert([insertData])
    .select();
    
  if (error) throw error;  
  await logEmail(phone, otp, method, 'sent', 'OTP gerado com sucesso');
  return { success: true, message: `OTP enviado com sucesso via ${method}` };
};

  const verifyOTP = async (phone, code) => {
  const { data: otps, error } = await supabase
    .from('otps')
    .select('*')
    .eq('phone', phone)
    .eq('code', code)
    .single();
    
  if (error || !otps) return { success: false, message: 'Código inválido ou não encontrado' };
    
  if (new Date(otps.expires_at) < new Date()) {
    return { success: false, message: 'Código expirado (válido por 20 minutos)' };
  }
    
  if (otps.attempts >= 3) {
    return { success: false, message: 'Muitas tentativas. Solicite um novo código.' };
  }
    
  // Update attempts
  await supabase.from('otps')
    .update({ attempts: otps.attempts + 1 })
    .eq('id', otps.id);
    
  if (otps.code !== code) {
    return { success: false, message: 'Código inválido' };
  }
    
  // Mark as verified
  await supabase.from('otps')
    .update({ verified: true })
    .eq('id', otps.id);
    
  return { success: true, message: 'Código verificado com sucesso' };
};

module.exports = { createOTP, verifyOTP };
