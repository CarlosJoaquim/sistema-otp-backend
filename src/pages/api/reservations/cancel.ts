import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const cancelSchema = z.object({
  reserva_id: z.string().uuid('ID da reserva inválido'),
  usuario_id: z.string().uuid('ID do usuário inválido'),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return apiRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const validated = cancelSchema.parse(req.body);
      const { reserva_id, usuario_id } = validated;

      const { data: reserva } = await supabase
        .from('reservas')
        .select('*')
        .eq('id', reserva_id)
        .eq('usuario_id', usuario_id)
        .single();

      if (!reserva) {
        await logApiRequest({ correlationId, req, startTime }, 'reservation_cancelled', 'failure', { reason: 'not_found' });
        return res.status(404).json({ success: false, message: 'Reserva não encontrada' });
      }

      if (reserva.status === 'CANCELADA' || reserva.status === 'CONCLUÍDA' || reserva.status === 'CONCLUIDA') {
        return res.status(400).json({ success: false, message: 'Não é possível cancelar esta reserva' });
      }

      const { error } = await supabase
        .from('reservas')
        .update({ status: 'CANCELADA', atualizado_em: new Date().toISOString() })
        .eq('id', reserva_id);

      if (error) throw error;

      await logApiRequest({ correlationId, req, startTime }, 'reservation_cancelled', 'success', { reserva_id, usuario_id });
      return res.status(200).json({ success: true, message: 'Reserva cancelada com sucesso' });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro ao cancelar reserva', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'reservation_cancelled', 'failure', { error: error.message });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
