const { generateOTP } = require('../../../lib/otpGenerator');
const supabase = require('../../../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { phone, method = 'sms' } = req.body;
  const contact = phone;
  
  try {
    // Verificar se usuário existe
    const { data: user } = await supabase
      .from('usuarios')
      .select('telefone, email')
      .or(`telefone.eq.${contact},email.eq.${contact}`)
      .single();
    
    if (!user) {
      return res.status(400).json({ success: false, message: 'Usuário não encontrado' });
    }
    
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 20 * 60000);
    
    // Remover OTPs antigos
    await supabase.from('otps').delete().or(`phone.eq.${contact},email.eq.${contact}`);
    
    // Criar novo OTP
    const insertData = {
      code: otp,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      verified: false,
      method: method
    };
    
    if (method === 'sms') {
      insertData.phone = contact;
    } else {
      insertData.email = contact;
    }
    
    const { data, error } = await supabase
      .from('otps')
      .insert([insertData])
      .select();
    
    if (error) throw error;
    
    // Enviar por email se necessário
    if (method === 'email') {
      // Aqui você pode integrar com Resend API
      console.log(`[EMAIL OTP] Para: ${contact} - Código: ${otp}`);
    }
    
    return res.json({ success: true, message: `OTP enviado via ${method}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
