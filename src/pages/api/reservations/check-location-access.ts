import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { user_id, lugar_id } = req.body;
  const correlationId = generateCorrelationId();

  if (!user_id || !lugar_id) {
    return res.status(400).json({ success: false, message: 'user_id e lugar_id são obrigatórios' });
  }

  try {
    const now = new Date();

    const { data: reserva, error } = await supabase
      .from('reservas')
      .select('id, status, data_hora')
      .eq('usuario_id', user_id)
      .eq('lugar_id', lugar_id)
      .in('status', ['ACEITA', 'CONCLUIDA'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    let accessGranted = false;
    let reason = '';

    if (!reserva) {
      reason = 'Nenhuma reserva encontrada para este estabelecimento';
    } else if (reserva.status === 'CONCLUIDA') {
      const concluidaEm = new Date(reserva.data_hora || now);
      const hoursSinceCompletion = (now.getTime() - concluidaEm.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceCompletion <= 48) {
        accessGranted = true;
        reason = `Acesso concedido - Reserva concluída há ${Math.round(hoursSinceCompletion)}h (limite: 48h)`;
      } else {
        reason = 'Acesso expirado - Reserva concluída há mais de 48h';
      }
    } else if (reserva.status === 'ACEITA') {
      accessGranted = true;
      reason = 'Acesso concedido - Reserva aceite';
    }

    await logEvent({
      correlation_id: correlationId,
      event_type: 'location_access_check',
      status: accessGranted ? 'success' : 'failure',
      metadata: { user_id, lugar_id, access_granted: accessGranted, reason }
    });

    return res.status(200).json({
      success: true,
      access_granted: accessGranted,
      reason,
      reservation_status: reserva?.status || null,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
