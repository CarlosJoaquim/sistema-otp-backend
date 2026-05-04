import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { user_id, lugar_id } = req.query;
  const correlationId = generateCorrelationId();

  if (!user_id || !lugar_id) {
    return res.status(400).json({ success: false, message: 'user_id e lugar_id são obrigatórios' });
  }

  try {
    const now = new Date();

    const { data: reserva, error: reservaError } = await supabase
      .from('reservas')
      .select('id, status, data_hora')
      .eq('usuario_id', user_id)
      .eq('lugar_id', lugar_id)
      .in('status', ['ACEITA', 'CONCLUIDA'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reservaError) throw reservaError;

    let accessGranted = false;

    if (reserva?.status === 'ACEITA') {
      accessGranted = true;
    } else if (reserva?.status === 'CONCLUIDA' && reserva.data_hora) {
      const concluidaEm = new Date(reserva.data_hora);
      const hoursSinceCompletion = (now.getTime() - concluidaEm.getTime()) / (1000 * 60 * 60);
      accessGranted = hoursSinceCompletion <= 48;
    }

    if (!accessGranted) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado. Precisa de uma reserva aceite ou concluída recentemente.',
        access_granted: false,
      });
    }

    const { data: lugar, error: lugarError } = await supabase
      .from('lugares')
      .select('id, nome, latitude, longitude, endereco')
      .eq('id', lugar_id)
      .eq('ativo', true)
      .maybeSingle();

    if (lugarError) throw lugarError;
    if (!lugar) {
      return res.status(404).json({ success: false, message: 'Estabelecimento não encontrado' });
    }

    await logEvent({
      correlation_id: correlationId,
      event_type: 'location_coordinates_fetched',
      status: 'success',
      metadata: { user_id, lugar_id }
    });

    return res.status(200).json({
      success: true,
      access_granted: true,
      location: {
        id: lugar.id,
        nome: lugar.nome,
        latitude: lugar.latitude,
        longitude: lugar.longitude,
        endereco: lugar.endereco,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
