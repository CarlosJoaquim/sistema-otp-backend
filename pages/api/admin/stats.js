const supabase = require('../../../lib/supabase');

function checkAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const user = credentials[0];
  const pass = credentials[1];
  
  return user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS;
}

module.exports = async function handler(req, res) {
  if (!checkAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.status(401).send('Autenticação necessária');
  }
  
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { count: userCount } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true });
      
    const { count: otpCount } = await supabase
      .from('otps')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString());
      
    res.json({
      totalUsers: userCount || 0,
      activeOtps: otpCount || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
