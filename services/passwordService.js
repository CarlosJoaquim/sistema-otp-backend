const supabase = require('./supabaseClient');
const bcrypt = require('bcryptjs');

const resetPassword = async (phone, newPassword) => {
  const { data: otp } = await supabase
    .from('otps')
    .select('*')
    .or(`phone.eq.${phone},email.eq.${phone}`)
    .eq('verified', true)
    .single();
  
  if (!otp) {
    return { success: false, message: 'Código não verificado' };
  }
  
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  const { error } = await supabase
    .from('usuarios')
    .update({ senha: passwordHash })
    .or(`telefone.eq.${phone},email.eq.${phone}`);
  
  if (error) throw error;
  
  await supabase.from('otps').delete().or(`phone.eq.${phone},email.eq.${phone}`);
  
  return { success: true, message: 'Senha redefinida' };
};

module.exports = { resetPassword };
