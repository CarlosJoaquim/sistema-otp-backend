const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createOTP, verifyOTP } = require('./services/otpService');
const { resetPassword } = require('./services/passwordService');
const supabase = require('./services/supabaseClient');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/otp/create', async (req, res) => {
  try {
    const { phone } = req.body;
    const result = await createOTP(phone);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/otp/verify', async (req, res) => {
  try {
    const { phone, code } = req.body;
    const result = await verifyOTP(phone, code);
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
      .order('created_at', { ascending: false });
    
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
    
    res.json({ success: true, message: 'Usuário registrado com sucesso' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

module.exports = app;
