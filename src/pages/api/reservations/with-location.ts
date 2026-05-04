import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { user_id } = req.query;
  const correlationId = generateCorrelationId();

  if (!user_id) {
    return res.status(400).json({ success: false, message: 'user_id é obrigatório' });
  }

  try {
    const { data: reservas, error } = await supabase
      .from('reservas')
      .select(`
        id,
        status,
        data_hora,
        criado_em,
        concluida_em,
        preco_total,
        notas,
        lugar_id,
        lugares (
          id,
          nome,
          categoria,
          endereco,
          url_imagem,
          avaliacao,
          latitude,
          longitude
        )
      `)
      .eq('usuario_id', user_id)
      .in('status', ['ACEITA', 'CONCLUIDA'])
      .order('criado_em', { ascending: false });

    if (error) throw error;

    const now = new Date();
    const reservasComAcesso = (reservas || []).map((r: any) => {
      let locationAccess = false;
      let locationAccessReason = '';

      if (r.status === 'ACEITA') {
        locationAccess = true;
        locationAccessReason = 'Reserva aceite';
      } else if (r.status === 'CONCLUIDA' && r.data_hora) {
        const hoursSinceCompletion = (now.getTime() - new Date(r.data_hora).getTime()) / (1000 * 60 * 60);
        if (hoursSinceCompletion <= 48) {
          locationAccess = true;
          locationAccessReason = `Reserva concluída (${Math.round(hoursSinceCompletion)}h atrás)`;
        } else {
          locationAccessReason = 'Acesso expirado (>48h após conclusão)';
        }
      }

      return {
        ...r,
        location_access: locationAccess,
        location_access_reason: locationAccessReason,
      };
    });

    await logEvent({
      correlation_id: correlationId,
      event_type: 'reservations_with_location_access_fetched',
      status: 'success',
      metadata: { user_id, total: reservasComAcesso.length }
    });

    return res.status(200).json({ success: true, data: reservasComAcesso });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
