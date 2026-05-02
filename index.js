const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: __dirname + '/.env' });
const supabase = require('./services/supabaseClient');

const app = express();
app.use(cors());
app.use(express.json());

// Test route
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    supabase: 'connected',
    websocket: 'connected'
  });
});

// Users route
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .order('criado_em', { ascending: false });
    
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro /api/users:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// OTPs route
app.get('/api/otps', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('otps')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Erro /api/otps:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
