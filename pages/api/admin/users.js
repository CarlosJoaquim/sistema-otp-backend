const supabase = require('../../../../services/supabaseClient');
require('dotenv').config();

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  // Check auth
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.status(401).send('Autenticação necessária');
  }
  
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const user = credentials[0];
  const pass = credentials[1];
  
  if (user !== process.env.ADMIN_USER || pass !== process.env.ADMIN_PASS) {
    return res.status(403).send('Credenciais inválidas');
  }
  
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    res.json({ users: data || [], total: data ? data.length : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
