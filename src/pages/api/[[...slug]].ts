import { NextApiHandler } from 'next';
import supabase from '../../lib/supabase';

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

  // Logs
  if (url?.includes('/api/logs')) {
    try {
      const logs: any[] = [];
      
      const { data: otps } = await supabase
        .from('otps')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (otps) {
        otps.forEach((otp: any) => {
          logs.push({
            type: 'otp',
            message: `OTP ${otp.verified ? 'verificado' : 'gerado'}: ${otp.code} para ${otp.phone || otp.email}`,
            time: new Date(otp.created_at),
            icon: 'fas fa-mobile-alt'
          });
        });
      }
      
      const { data: users } = await supabase
        .from('usuarios')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(20);
      
      if (users) {
        users.forEach((user: any) => {
          logs.push({
            type: 'user',
            message: `Usuário registrado: ${user.nome} (${user.email || user.telefone})`,
            time: new Date(user.criado_em),
            icon: 'fas fa-user-plus'
          });
        });
      }
      
      logs.sort((a: any, b: any) => b.time - a.time);
      return res.json({ success: true, data: logs.slice(0, 50) });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Admin stats
  if (url?.includes('/api/admin/stats')) {
    try {
      const { count: userCount } = await supabase
        .from('usuarios')
        .select('*', { count: 'exact', head: true });
      
      const { count: otpCount } = await supabase
        .from('otps')
        .select('*', { count: 'exact', head: true })
        .gt('expires_at', new Date().toISOString());
      
      return res.json({
        totalUsers: userCount || 0,
        activeOtps: otpCount || 0
      });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Admin users
  if (url?.includes('/api/admin/users')) {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return res.json({ users: data || [], total: data ? data.length : 0 });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  // Admin OTPs
  if (url?.includes('/api/admin/otps')) {
    try {
      const { data, error } = await supabase
        .from('otps')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return res.json({ otps: data || [], total: data ? data.length : 0 });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(404).json({ error: 'Not found' });
};

export default handler;
