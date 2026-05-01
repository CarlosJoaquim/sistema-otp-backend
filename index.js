const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
require('dotenv').config();
const { createOTP, verifyOTP } = require('./services/otpService');
const { resetPassword } = require('./services/passwordService');
const supabase = require('./services/supabaseClient');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(event, data) {
  const message = JSON.stringify({ event, data });
  clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/otp/create', async (req, res) => {
  try {
    const { phone, method = 'sms' } = req.body;
    const result = await createOTP(phone, true, method);
    broadcast('otp-created', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/otp/verify', async (req, res) => {
  try {
    const { phone, code } = req.body;
    const result = await verifyOTP(phone, code);
    broadcast('otp-verified', result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/otps', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('criado_em', { ascending: false });
    
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/otp/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('otps')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    broadcast('otp-deleted', { id: req.params.id });
    res.json({ success: true, message: 'OTP removido' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Telefone e senha são obrigatórios' });
    }

    const { data: existing } = await supabase
      .from('usuarios')
      .select('telefone')
      .eq('telefone', phone)
      .single();
    
    if (existing) {
      return res.status(400).json({ success: false, message: 'Número já registrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    const { error } = await supabase
      .from('usuarios')
      .insert([{ telefone: phone, password_hash: passwordHash }]);
    
    if (error) throw error;
    
    broadcast('user-created', { phone });
    res.json({ success: true, message: 'Usuário registrado com sucesso' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/password/reset', async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    const result = await resetPassword(phone, newPassword);
    broadcast('password-reset', { phone });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/logs', async (req, res) => {
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
        const contact = otp.phone || otp.email;
        const methodIcon = otp.method === 'email' ? 'fas fa-envelope' : 'fas fa-mobile-alt';
        logs.push({
          type: otp.method === 'email' ? 'otp-email' : 'otp',
          message: `OTP ${otp.verified ? 'verificado' : 'gerado'}: ${otp.code} para ${contact} (${otp.method || 'sms'})`,
          time: new Date(otp.created_at),
          icon: methodIcon
        });
      });
    }
    
    // Email logs
    try {
      const { data: emailLogs, error: emailError } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (!emailError && emailLogs) {
        emailLogs.forEach(log => {
          logs.push({
            type: 'email',
            message: `Email ${log.status}: ${log.contact} - ${log.details}`,
            time: new Date(log.created_at),
            icon: log.status === 'sent' ? 'fas fa-paper-plane' : 'fas fa-exclamation-triangle'
          });
        });
      }
    } catch (e) {
      console.log('Tabela email_logs pode não existir');
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
});

app.get('/api/status', async (req, res) => {
  try {
    const { data, error } = await supabase.from('usuarios').select('count').limit(1);
    const supabaseConnected = !error;
    
    res.json({
      success: true,
      supabase: supabaseConnected ? 'connected' : 'disconnected',
      websocket: wss.clients.size > 0 ? 'connected' : 'waiting'
    });
  } catch (error) {
    res.json({
      success: true,
      supabase: 'disconnected',
      websocket: 'waiting'
    });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
