import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const updateReservationStatusSchema = z.object({
  reservation_id: z.string().uuid('ID da reserva inválido'),
  agent_id: z.string().uuid('ID do agente inválido'),
  status: z.enum(['ACEITA', 'REJEITADA', 'CONCLUIDA', 'CANCELADA']),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return apiRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const validated = updateReservationStatusSchema.parse(req.body);
      const { reservation_id, agent_id, status } = validated;

      const { data: reserva, error: reservaError } = await supabase
        .from('reservas')
        .select('*, lugar:lugar_id(usuario_id, nome)')
        .eq('id', reservation_id)
        .maybeSingle();

      if (reservaError) throw reservaError;
      if (!reserva) {
        return res.status(404).json({ success: false, message: 'Reserva não encontrada' });
      }

      if (reserva.lugar?.usuario_id !== agent_id) {
        return res.status(403).json({ success: false, message: 'Não autorizado a atualizar esta reserva' });
      }

      if (status === 'CONCLUIDA' && reserva.status !== 'ACEITA') {
        return res.status(400).json({
          success: false,
          message: 'Apenas reservas aceites podem ser concluídas',
        });
      }

      const { data: updatedReserva, error: updateError } = await supabase
        .from('reservas')
        .update({
          status,
          concluida_em: status === 'CONCLUIDA' ? new Date().toISOString() : undefined,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', reservation_id)
        .select()
        .maybeSingle();

      if (updateError) throw updateError;

      const { data: customer } = await supabase
        .from('usuarios')
        .select('nome, email')
        .eq('id', reserva.usuario_id)
        .single();

      if (customer) {
        const statusMessages: Record<string, string> = {
          ACEITA: 'aceite',
          REJEITADA: 'rejeitada',
          CONCLUIDA: 'concluída',
          CANCELADA: 'cancelada',
        };

        await supabase.from('notificacoes').insert([{
          usuario_id: reserva.usuario_id,
          titulo: 'Reserva Atualizada',
          mensagem: `Sua reserva #${reservation_id.slice(-6)} para ${reserva.lugar?.nome} foi ${statusMessages[status]}.`,
          tipo: 'reserva',
          dados: {
            reservation_id,
            new_status: status,
            establishment_name: reserva.lugar?.nome,
          },
          lida: false,
          criado_em: new Date().toISOString(),
        }]);
      }

      await logApiRequest({ correlationId, req, startTime }, 'agent_reservation_status_updated', 'success', {
        reservation_id, agent_id, new_status: status,
      });

      return res.status(200).json({ success: true, data: updatedReserva });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro ao atualizar status da reserva', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'agent_reservation_status_updated', 'failure', {
        error: error.message,
      });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
