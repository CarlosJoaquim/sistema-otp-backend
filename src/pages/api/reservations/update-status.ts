import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { reservation_id, user_id, status } = req.body;
  const correlationId = generateCorrelationId();

  if (!reservation_id || !user_id || !status) {
    return res.status(400).json({ success: false, message: 'reservation_id, user_id e status são obrigatórios' });
  }

  if (!['CONCLUIDA', 'CANCELADA', 'NO_SHOW'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status inválido' });
  }

  try {
    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .select('*, lugares(usuario_id, nome)')
      .eq('id', reservation_id)
      .eq('usuario_id', user_id)
      .maybeSingle();

    if (reservaError) throw reservaError;
    if (!reserva) {
      return res.status(404).json({ success: false, message: 'Reserva não encontrada' });
    }

    if (status === 'CONCLUIDA' && reserva.status !== 'ACEITA') {
      return res.status(400).json({ success: false, message: 'Apenas reservas aceites podem ser concluídas' });
    }

    const { data: updatedReserva, error: updateError } = await supabase
      .from('reservas')
      .update({
        status: status,
        concluida_em: status === 'CONCLUIDA' ? new Date().toISOString() : undefined,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', reservation_id)
      .select()
      .maybeSingle();

    if (updateError) throw updateError;

    await logEvent({
      correlation_id: correlationId,
      event_type: 'reservation_status_updated',
      status: 'success',
      metadata: { reservation_id, new_status: status, user_id }
    });

    return res.status(200).json({ success: true, data: updatedReserva });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
