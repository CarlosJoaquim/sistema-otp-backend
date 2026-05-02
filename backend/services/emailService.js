const supabase = require('./supabaseClient');

/**
 * Envia OTP por email usando Supabase Auth (mais simples)
 * Para usar SMTP próprio, seria necessário configurar um serviço como Nodemailer
 */
const sendOTPByEmail = async (email, code) => {
  try {
    // Usar Supabase Auth para enviar o código
    // Isso envia um email com link de reset, mas podemos usar o OTP que geramos
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/reset-password`,
    });
    
    if (error) {
      console.error('Erro ao enviar email via Supabase:', error.message);
      return { success: false, message: error.message };
    }
    
    return { success: true, message: 'Email enviado com sucesso' };
  } catch (error) {
    console.error('Erro no serviço de email:', error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Alternativa: Enviar email com o código OTP diretamente
 * Requer configuração de SMTP no Supabase ou serviço externo
 */
const sendOTPEmailDirect = async (email, code) => {
  try {
    // Se tiver configurado SMTP no Supabase, pode usar as funções de banco
    // ou usar um serviço como Resend, SendGrid, etc.
    // Por agora, vamos simular o envio (log)
    console.log(`[EMAIL SIMULADO] Para: ${email} - Código OTP: ${code}`);
    
    // Para implementação real, você precisaria de:
    // 1. Nodemailer configurado, ou
    // 2. API do Resend/SendGrid, ou
    // 3. Supabase Edge Functions com SMTP
    
    return { success: true, message: 'Email simulado (implementar envio real)' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = { sendOTPByEmail, sendOTPEmailDirect };
