import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const updateStatusSchema = z.object({
  reservation_id: z.string().uuid('ID da reserva inválido'),
  user_id: z.string().uuid('ID do usuário inválido'),
  status: z.enum(['CONCLUIDA', 'CONCLUÍDA', 'CANCELADA', 'NO_SHOW']),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return apiRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const validated = updateStatusSchema.parse(req.body);
      const { reservation_id, user_id, status } = validated;

      const { data: reserva, error: reservaError } = await supabase
        .from('reservas')
        .select('*, lugares(usuario_id, nome)')
        .eq('id', reservation_id)
        .eq('usuario_id', user_id)
        .maybeSingle();

      if (reservaError) throw reservaError;
      if (!reserva) {
        await logApiRequest({ correlationId, req, startTime }, 'reservation_status_updated', 'failure', { reason: 'not_found' });
        return res.status(404).json({ success: false, message: 'Reserva não encontrada' });
      }

      const normalizedStatus = status === 'CONCLUÍDA' ? 'CONCLUIDA' : status;

      if (normalizedStatus === 'CONCLUIDA' && reserva.status !== 'ACEITA') {
        return res.status(400).json({ success: false, message: 'Apenas reservas aceites podem ser concluídas' });
      }

      const { data: updatedReserva, error: updateError } = await supabase
        .from('reservas')
        .update({
          status: normalizedStatus,
          concluida_em: normalizedStatus === 'CONCLUIDA' ? new Date().toISOString() : undefined,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', reservation_id)
        .select()
        .maybeSingle();

      if (updateError) throw updateError;

      await logApiRequest(
        { correlationId, req, startTime },
        'reservation_status_updated',
        'success',
        { reservation_id, new_status: normalizedStatus, user_id }
      );

      return res.status(200).json({ success: true, data: updatedReserva });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro ao atualizar status', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'reservation_status_updated', 'failure', { error: error.message });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
