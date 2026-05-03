import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { reserva_id, usuario_id } = req.body;
  const correlationId = generateCorrelationId();

  if (!reserva_id || !usuario_id) {
    return res.status(400).json({ success: false, message: 'reserva_id e usuario_id são obrigatórios' });
  }

  try {
    const { data: reserva } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', reserva_id)
      .eq('usuario_id', usuario_id)
      .single();

    if (!reserva) {
      return res.status(404).json({ success: false, message: 'Reserva não encontrada' });
    }

    if (reserva.status === 'CANCELADA' || reserva.status === 'CONCLUIDA') {
      return res.status(400).json({ success: false, message: 'Não é possível cancelar esta reserva' });
    }

    const { error } = await supabase
      .from('reservas')
      .update({ status: 'CANCELADA', atualizado_em: new Date().toISOString() })
      .eq('id', reserva_id);

    if (error) throw error;

    await logEvent({
      correlation_id: correlationId,
      event_type: 'reservation_cancelled',
      status: 'success',
      metadata: { reserva_id, usuario_id }
    });

    return res.status(200).json({ success: true, message: 'Reserva cancelada com sucesso' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
