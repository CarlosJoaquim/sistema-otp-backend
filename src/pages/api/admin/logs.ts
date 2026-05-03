import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { EventType, EventStatus } from '../../../lib/logger';

// Verificação simples de admin (em produção, usar JWT do Supabase Auth)
const verifyAdmin = (req: NextApiRequest): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return false;
  
  const [user, pass] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  return user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyAdmin(req)) {
    return res.status(401).json({ success: false, message: 'Não autorizado' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const {
    page = '1',
    limit = '100',
    event_type,
    status,
    email,
    start_date,
    end_date,
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = Math.min(parseInt(limit as string), 100);
  const offset = (pageNum - 1) * limitNum;

  try {
    let query = supabase
      .from('system_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limitNum - 1);

    // Filtros
    if (event_type) {
      query = query.eq('event_type', event_type as string);
    }
    if (status) {
      query = query.eq('status', status as string);
    }
    if (email) {
      query = query.eq('email', email as string);
    }
    if (start_date) {
      query = query.gte('timestamp', start_date as string);
    }
    if (end_date) {
      query = query.lte('timestamp', end_date as string);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: data || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
