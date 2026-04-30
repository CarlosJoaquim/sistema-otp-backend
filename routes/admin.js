const express = require('express');
const router = express.Router();
const supabase = require('../services/supabaseClient');
require('dotenv').config();

// Middleware de autenticação
const checkAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.status(401).send('Autenticação necessária');
  }
  
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const user = credentials[0];
  const pass = credentials[1];
  
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
    next();
  } else {
    res.status(403).send('Credenciais inválidas');
  }
};

router.use(checkAuth);

// Endpoint para listar usuários (JSON)
router.get('/users', async (req, res) => {
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
});

// Endpoint para listar OTPs (JSON)
router.get('/otps', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    res.json({ otps: data || [], total: data ? data.length : 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para estatísticas
router.get('/stats', async (req, res) => {
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
});

// Painel principal (HTML)
router.get('/', async (req, res) => {
  try {
    const { data: users } = await supabase.from('usuarios').select('*').order('criado_em', { ascending: false }).limit(10);
    const { data: otps } = await supabase.from('otps').select('*').order('created_at', { ascending: false }).limit(10);
    
    // Se for requisição API (Accept: application/json)
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        users: users || [],
        otps: otps || [],
        stats: {
          totalUsers: users ? users.length : 0,
          activeOtps: otps ? otps.filter(o => new Date(o.expires_at) > new Date()).length : 0
        }
      });
    }
    
    // HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>SMS OTP Admin</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; margin:0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin:0 auto; }
    h1 { color: #333; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h3 { margin: 0; color: #666; font-size: 14px; }
    .card .value { font-size: 32px; font-weight: bold; color: #333; margin-top: 10px; }
    table { width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    .status-ok { color: green; }
    .status-pending { color: orange; }
    .refresh-btn { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 SMS OTP Admin Panel</h1>
    <button class="refresh-btn" onclick="location.reload()">🔄 Atualizar</button>
    
    <div class="stats">
      <div class="card">
        <h3>Total Usuários</h3>
        <div class="value">${users ? users.length : 0}</div>
      </div>
      <div class="card">
        <h3>OTPs Ativos</h3>
        <div class="value">${otps ? otps.filter(o => new Date(o.expires_at) > new Date()).length : 0}</div>
      </div>
      <div class="card">
        <h3>Status Servidor</h3>
        <div class="value status-ok">Online</div>
      </div>
    </div>

    <h2>Últimos Usuários (${users ? users.length : 0} encontrados)</h2>
    <table>
      <tr><th>ID</th><th>Nome</th><th>Telefone</th><th>Email</th><th>Criado em</th></tr>
      ${users && users.length > 0 ? users.map(u => `<tr><td>${u.id.substring(0,8)}...</td><td>${u.nome} ${u.sobrenome || ''}</td><td>${u.telefone || 'N/A'}</td><td>${u.email}</td><td>${new Date(u.criado_em).toLocaleString('pt-PT')}</td></tr>`).join('') : '<tr><td colspan="5">Nenhum utilizador</td></tr>'}
    </table>

    <h2>Últimos OTPs</h2>
    <table>
      <tr><th>Telefone</th><th>Código</th><th>Expira em</th><th>Verificado</th><th>Tentativas</th></tr>
      ${otps && otps.length > 0 ? otps.map(o => `<tr><td>${o.phone}</td><td>${o.code}</td><td>${new Date(o.expires_at).toLocaleString('pt-PT')}</td><td class="${o.verified ? 'status-ok' : 'status-pending'}">${o.verified ? 'Sim' : 'Não'}</td><td>${o.attempts}</td></tr>`).join('') : '<tr><td colspan="5">Nenhum OTP</td></tr>'}
    </table>
  </div>
</body>
</html>
    `;
    res.send(html);
  } catch (error) {
    res.status(500).send('Erro: ' + error.message);
  }
});

module.exports = router;
