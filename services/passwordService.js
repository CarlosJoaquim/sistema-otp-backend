const bcrypt = require('bcryptjs');
const supabase = require('./supabaseClient');

const resetPassword = async (phone, newPassword) => {
  // Verify if OTP was validated
  const { data: otp, error: otpError } = await supabase
    .from('otps')
    .select('*')
    .eq('phone', phone)
    .eq('verified', true)
    .single();

  if (otpError || !otp) {
    return { success: false, message: 'OTP not verified for this phone' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  // Check if user exists in usuarios table (using telefone field)
  const { data: user, error: userError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('telefone', phone)
    .single();

  if (userError || !user) {
    return { success: false, message: 'Usuário não encontrado' };
  }

  // Update password (field is 'senha' in your table)
  const { error: updateError } = await supabase
    .from('usuarios')
    .update({ password_hash: passwordHash })
    .eq('phone', phone);
    
  if (updateError) throw updateError;

  // Clean up OTP
  await supabase.from('otps').delete().eq('phone', phone);

  return { success: true, message: 'Senha redefinida com sucesso' };
};

module.exports = { resetPassword };
