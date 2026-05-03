import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const dbCheck = await supabase.from('usuarios').select('count', { count: 'exact', head: true }).limit(1);
    
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round(uptime),
      version: process.env.npm_package_version || '1.0.0',
      database: dbCheck.error ? 'disconnected' : 'connected',
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      },
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error: any) {
    return res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
