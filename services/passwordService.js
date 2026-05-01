const bcrypt = require('bcryptjs');
const supabase = require('./supabaseClient');

const resetPassword = async (contact, newPassword) => {
  // Verify if OTP was validated (phone field stores both phone and email)
  const { data: otp, error: otpError } = await supabase
    .from('otps')
    .select('*')
    .eq('phone', contact)
    .eq('verified', true)
    .single();
  
  if (otpError || !otp) {
    return { success: false, message: 'Código não verificado ou expirado' };
  }
  
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  // Check if user exists in usuarios table (by telefone OR email)
  const { data: user, error: userError } = await supabase
    .from('usuarios')
    .select('*')
    .or(`telefone.eq.${contact},email.eq.${contact}`)
    .single();
  
  if (userError || !user) {
    return { success: false, message: 'Usuário não encontrado na tabela usuarios' };
  }
  
  // Update password (field is 'senha' in your table)
  const { error: updateError } = await supabase
    .from('usuarios')
    .update({ senha: passwordHash })
    .or(`telefone.eq.${contact},email.eq.${contact}`);
    
  if (updateError) throw updateError;
  
  // Clean up OTP
  await supabase.from('otps').delete().eq('phone', contact);
  
  return { success: true, message: 'Senha redefinida com sucesso' };
};

module.exports = { resetPassword };
