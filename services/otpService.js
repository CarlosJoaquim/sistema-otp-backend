const { generateOTP } = require('../utils/otpGenerator');
const { sendSMS } = require('./smsService');
const supabase = require('./supabaseClient');
const { sendOTPByEmail } = require('./emailService');

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

const createOTP = async (contact, checkUserExists = true, method = 'sms') => {
  // Verificar se o usuário existe no banco (para redefinição de senha)
  if (checkUserExists) {
    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('telefone, email')
      .or(`telefone.eq.${contact},email.eq.${contact}`)
      .single();
    
    if (userError || !user) {
      return { success: false, message: 'Usuário não encontrado. Verifique o número/email ou registe-se primeiro.' };
    }
  }
  
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 20 * 60000); // 20 minutos
  
  let sendResult = { success: true };
  let emailToStore = null;
  
  if (method === 'sms') {
    // Send SMS
    const message = `Seu código de verificação é: ${otp}. Expira em 20 minutos.`;
    sendResult = await sendSMS(contact, message);
    
    if (!sendResult.success) {
      await logEmail(contact, null, 'sms', 'failed', sendResult.message);
      throw new Error('Falha ao enviar SMS');
    }
  } else if (method === 'email') {
    // Send OTP code directly via email using fetch to Resend API
    // (Supabase SMTP is configured with Resend, so we use Resend API directly)
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      // Fallback: log no console se não tiver API key
      console.log(`[EMAIL OTP] Para: ${contact} - Código: ${otp} - Expira em 20min`);
      await logEmail(contact, otp, 'email', 'sent', 'OTP simulado (adicione RESEND_API_KEY no .env)');
    } else {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'noreply@seudominio.com',
            to: contact,
            subject: 'Seu código de verificação OTP',
            html: `
              <h2>Código de Verificação</h2>
              <p>Seu código é: <strong style="font-size: 24px; color: #4361ee;">${otp}</strong></p>
              <p>Este código expira em 20 minutos.</p>
              <p>Se você não solicitou este código, ignore este email.</p>
            `
          })
        });
        
        const emailData = await emailResponse.json();
        
        if (!emailResponse.ok) {
          throw new Error(emailData.message || 'Erro ao enviar email');
        }
        
        await logEmail(contact, otp, 'email', 'sent', 'OTP enviado via Resend API');
      } catch (emailError) {
        await logEmail(contact, otp, 'email', 'failed', emailError.message);
        throw new Error('Falha ao enviar email: ' + emailError.message);
      }
    }
    
    emailToStore = contact;
  }
  
  // Remove existing OTPs for this contact
  await supabase.from('otps').delete().or(`phone.eq.${contact},email.eq.${contact}`);
  
  // Store new OTP
  const insertData = { 
    code: otp, 
    expires_at: expiresAt.toISOString(),
    attempts: 0,
    verified: false,
    method: method
  };
  
  if (method === 'sms') {
    insertData.phone = contact;
    insertData.message_id = sendResult.messageId;
  } else {
    insertData.email = contact;
  }
  
  const { data, error } = await supabase
    .from('otps')
    .insert([insertData])
    .select();
    
  if (error) throw error;  
  await logEmail(contact, otp, method, 'sent', 'OTP gerado com sucesso');
  return { success: true, message: `OTP enviado com sucesso via ${method}` };
};

  const verifyOTP = async (contact, code) => {
  // Check by phone or email
  const { data: otps, error } = await supabase
    .from('otps')
    .select('*')
    .or(`phone.eq.${contact},email.eq.${contact}`)
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
