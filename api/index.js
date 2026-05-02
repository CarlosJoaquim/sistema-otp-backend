const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createOTP, verifyOTP } = require('../services/otpService');
const { resetPassword } = require('../services/passwordService');
const supabase = require('../services/supabaseClient');
const bcrypt = require('bcryptjs');

const app = express();

app.use(cors());
app.use(express.json());

// Import routes
const adminRoutes = require('../routes/admin');
app.use('/admin', adminRoutes);

app.post('/api/otp/create', async (req, res) => {
  try {
    const { phone, method = 'sms' } = req.body;
    const contact = phone;
    const result = await createOTP(contact, true, method);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/otp/verify', async (req, res) => {
  try {
    const { phone, code } = req.body;
    const contact = phone;
    const result = await verifyOTP(contact, code);
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
    res.json({ success: true, message: 'OTP removido' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/password/reset', async (req, res) => {
  try {
    const { phone, newPassword } = req.body;
    const result = await resetPassword(phone, newPassword);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const logs = [];
    
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
      websocket: 'connected'
    });
  } catch (error) {
    res.json({
      success: true,
      supabase: 'disconnected',
      websocket: 'connected'
    });
  }
});

module.exports = app;
