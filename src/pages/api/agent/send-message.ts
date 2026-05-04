import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const sendMessageSchema = z.object({
  from_user_id: z.string().uuid('ID do remetente inválido'),
  to_user_id: z.string().uuid('ID do destinatário inválido'),
  message: z.string().min(1, 'Mensagem é obrigatória').max(1000),
  reservation_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return apiRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const validated = sendMessageSchema.parse(req.body);
      const { from_user_id, to_user_id, message, reservation_id, order_id } = validated;

      const { data: messageData, error: insertError } = await supabase
        .from('suporte_mensagens')
        .insert([{
          usuario_id: to_user_id,
          remetente_id: from_user_id,
          mensagem: message,
          tipo: reservation_id ? 'reserva' : order_id ? 'pedido' : 'geral',
          reserva_id: reservation_id || null,
          pedido_id: order_id || null,
          lida: false,
          criado_em: new Date().toISOString(),
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      const { data: recipient } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', to_user_id)
        .single();

      if (recipient) {
        await supabase.from('notificacoes').insert([{
          usuario_id: to_user_id,
          titulo: 'Nova Mensagem',
          mensagem: `Você recebeu uma mensagem de ${recipient.nome || 'um usuário'}.`,
          tipo: 'mensagem',
          dados: {
            message_id: messageData.id,
            from_user_id,
            reservation_id,
            order_id,
          },
          lida: false,
          criado_em: new Date().toISOString(),
        }]);
      }

      await logApiRequest({ correlationId, req, startTime }, 'agent_message_sent', 'success', {
        from_user_id, to_user_id, reservation_id, order_id,
      });

      return res.status(201).json({ success: true, data: messageData });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro ao enviar mensagem', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'agent_message_sent', 'failure', {
        error: error.message,
      });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
