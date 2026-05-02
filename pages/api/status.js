const supabase = require('../../lib/supabase');

module.exports = async function handler(req, res) {
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
};
