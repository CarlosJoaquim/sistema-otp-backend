import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { usuario_id, status } = req.query;
  const correlationId = generateCorrelationId();

  if (!usuario_id) {
    return res.status(400).json({ success: false, message: 'usuario_id é obrigatório' });
  }

  try {
    let query = supabase
      .from('reservas')
      .select('*, lugares(nome, categoria, endereco, url_imagem)')
      .eq('usuario_id', usuario_id)
      .order('criado_em', { ascending: false });

    if (status && status !== 'todas') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    await logEvent({
      correlation_id: correlationId,
      event_type: 'reservation_listed',
      status: 'success',
      metadata: { usuario_id, status }
    });

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
