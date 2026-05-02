const supabase = require('../../../lib/supabase');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  const { phone, newPassword } = req.body;
  const contact = phone;
  
  try {
    // Verificar se OTP foi validado
    const { data: otp } = await supabase
      .from('otps')
      .select('*')
      .or(`phone.eq.${contact},email.eq.${contact}`)
      .eq('verified', true)
      .single();
    
    if (!otp) {
      return res.status(400).json({ success: false, message: 'Código não verificado' });
    }
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Atualizar senha na tabela usuarios
    const { error } = await supabase
      .from('usuarios')
      .update({ senha: passwordHash })
      .or(`telefone.eq.${contact},email.eq.${contact}`);
    
    if (error) throw error;
    
    // Limpar OTP
    await supabase.from('otps').delete().or(`phone.eq.${contact},email.eq.${contact}`);
    
    res.json({ success: true, message: 'Senha redefinida' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
