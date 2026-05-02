import { NextApiHandler } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const handler: NextApiHandler = async (req, res) => {
  const { url, method } = req;
  
  // API Status
  if (url?.includes('/api/status')) {
    try {
      const { error } = await supabase.from('usuarios').select('count').limit(1);
      return res.json({
        success: true,
        supabase: error ? 'disconnected' : 'connected',
        websocket: 'connected'
      });
    } catch (error: any) {
      return res.json({
        success: true,
        supabase: 'disconnected',
        websocket: 'connected'
      });
    }
  }
  
  // Users
  if (url?.includes('/api/users')) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('criado_em', { ascending: false });
      
      if (error) throw error;
      return res.json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
  
  // OTPs
  if (url?.includes('/api/otps')) {
    try {
      const { data, error } = await supabase
        .from('otps')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return res.json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
  
  res.status(404).json({ error: 'Not found' });
};

export default handler;
