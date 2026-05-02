const supabase = require('../../lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const logs = [];
    
    // OTP logs
    const { data: otps, error: otpError } = await supabase
      .from('otps')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!otpError && otps) {
      otps.forEach(otp => {
        logs.push({
          type: 'otp',
          message: `OTP ${otp.verified ? 'verificado' : 'gerado'}: ${otp.code} para ${otp.phone || otp.email}`,
          time: new Date(otp.created_at),
          icon: 'fas fa-mobile-alt'
        });
      });
    }
    
    // User logs
    const { data: users, error: userError } = await supabase
      .from('usuarios')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(20);
    
    if (!userError && users) {
      users.forEach(user => {
        logs.push({
          type: 'user',
          message: `Usuário registrado: ${user.nome} (${user.email || user.telefone})`,
          time: new Date(user.criado_em),
          icon: 'fas fa-user-plus'
        });
      });
    }
    
    logs.sort((a, b) => b.time - a.time);
    res.json({ success: true, data: logs.slice(0, 50) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
