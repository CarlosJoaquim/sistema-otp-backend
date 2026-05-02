const supabase = require('../../../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { phone, code } = req.body;
  const contact = phone;
  
  try {
    const { data: otp, error } = await supabase
      .from('otps')
      .select('*')
      .or(`phone.eq.${contact},email.eq.${contact}`)
      .eq('code', code)
      .single();
    
    if (error || !otp) {
      return res.status(400).json({ success: false, message: 'Código inválido' });
    }
    
    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ success: false, message: 'Código expirado' });
    }
    
    if (otp.attempts >= 3) {
      return res.status(400).json({ success: false, message: 'Muitas tentativas' });
    }
    
    // Incrementar tentativas
    await supabase.from('otps')
      .update({ attempts: otp.attempts + 1 })
      .eq('id', otp.id);
    
    if (otp.code !== code) {
      return res.status(400).json({ success: false, message: 'Código inválido' });
    }
    
    // Marcar como verificado
    await supabase.from('otps')
      .update({ verified: true })
      .eq('id', otp.id);
    
    res.json({ success: true, message: 'Código verificado' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
