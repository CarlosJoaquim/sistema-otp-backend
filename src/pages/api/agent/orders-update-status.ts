import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const updateOrderStatusSchema = z.object({
  order_id: z.string().uuid('ID do pedido inválido'),
  agent_id: z.string().uuid('ID do agente inválido'),
  status: z.enum(['ACEITO', 'REJEITADO', 'EM_TRANSITO', 'CONCLUIDO', 'CANCELADO']),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return apiRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const validated = updateOrderStatusSchema.parse(req.body);
      const { order_id, agent_id, status } = validated;

      const { data: order, error: orderError } = await supabase
        .from('pedidos')
        .select('*, lugar:lugar_id(usuario_id, nome)')
        .eq('id', order_id)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!order) {
        return res.status(404).json({ success: false, message: 'Pedido não encontrado' });
      }

      if (order.lugar?.usuario_id !== agent_id) {
        return res.status(403).json({ success: false, message: 'Não autorizado a atualizar este pedido' });
      }

      if (status === 'CONCLUIDO' && !['ACEITO', 'EM_TRANSITO'].includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: 'Apenas pedidos aceites ou em trânsito podem ser concluídos',
        });
      }

      const { data: updatedOrder, error: updateError } = await supabase
        .from('pedidos')
        .update({
          status,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', order_id)
        .select()
        .maybeSingle();

      if (updateError) throw updateError;

      const { data: customer } = await supabase
        .from('usuarios')
        .select('nome, email')
        .eq('id', order.usuario_id)
        .single();

      if (customer) {
        const statusMessages: Record<string, string> = {
          ACEITO: 'aceite',
          REJEITADO: 'rejeitado',
          EM_TRANSITO: 'em trânsito',
          CONCLUIDO: 'concluído',
          CANCELADO: 'cancelado',
        };

        await supabase.from('notificacoes').insert([{
          usuario_id: order.usuario_id,
          titulo: 'Pedido Atualizado',
          mensagem: `Seu pedido #${order_id.slice(-6)} foi ${statusMessages[status]}.`,
          tipo: 'pedido',
          dados: {
            order_id,
            new_status: status,
            establishment_name: order.lugar?.nome,
          },
          lida: false,
          criado_em: new Date().toISOString(),
        }]);
      }

      await logApiRequest({ correlationId, req, startTime }, 'agent_order_status_updated', 'success', {
        order_id, agent_id, new_status: status,
      });

      return res.status(200).json({ success: true, data: updatedOrder });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro ao atualizar status do pedido', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'agent_order_status_updated', 'failure', {
        error: error.message,
      });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
