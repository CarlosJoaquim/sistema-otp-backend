import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, withTiming, logApiRequest } from '../../../lib/logger';
import { checkUserRateLimit } from '../../../lib/rateLimit';
import { sendReservationNotificationEmail } from '../../../lib/mailer';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const createReservationSchema = z.object({
  usuario_id: z.string().uuid('ID do usuário inválido'),
  lugar_id: z.string().uuid('ID do estabelecimento inválido'),
  data_hora: z.string().refine(val => {
    const d = new Date(val);
    return !isNaN(d.getTime()) && d > new Date();
  }, 'Data/hora inválida ou no passado'),
  num_pessoas: z.number().int().min(1).max(50, 'Máximo 50 pessoas'),
  categoria: z.string().optional(),
  observacoes: z.string().max(500).optional().nullable(),
  tipo: z.enum(['presencial', 'delivery']).default('presencial'),
  endereco: z.string().max(300).optional().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return apiRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const validated = createReservationSchema.parse(req.body);
      const { usuario_id, lugar_id, data_hora, num_pessoas, observacoes, tipo, endereco, categoria } = validated;

      const rate = await checkUserRateLimit(usuario_id);
      if (!rate.allowed) {
        await logApiRequest({ correlationId, req, startTime }, 'reservation_failed', 'rate_limited', { reason: 'user_rate_limited' });
        return res.status(429).json({ success: false, message: `Aguarde ${rate.retryAfter}s` });
      }

      const { result: lugar } = await withTiming(async () => {
        const { data } = await supabase
          .from('lugares')
          .select('id, nome, usuario_id')
          .eq('id', lugar_id)
          .single();
        return data;
      });

      if (!lugar) {
        await logApiRequest({ correlationId, req, startTime }, 'reservation_failed', 'failure', { reason: 'establishment_not_found' });
        return res.status(404).json({ success: false, message: 'Estabelecimento não encontrado' });
      }

      const date = new Date(data_hora);
      const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

      const { data: existing } = await supabase
        .from('reservas')
        .select('id')
        .eq('lugar_id', lugar_id)
        .eq('status', 'ACEITA')
        .filter('data_hora', 'gte', date.toISOString())
        .filter('data_hora', 'lt', new Date(date.getTime() + 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existing) {
        await logApiRequest({ correlationId, req, startTime }, 'reservation_failed', 'failure', { reason: 'slot_taken' });
        return res.status(409).json({ success: false, message: 'Horário já reservado' });
      }

      const { data: insertedReservation, error } = await supabase
        .from('reservas')
        .insert([{
          usuario_id,
          lugar_id,
          categoria,
          data_hora: date.toISOString(),
          num_pessoas,
          status: 'PENDENTE',
          observacoes: observacoes || null,
          tipo: tipo || 'presencial',
          endereco: endereco || null,
          criado_em: new Date().toISOString(),
        }])
        .select('id, usuario_id, lugar_id, data_hora, num_pessoas, status')
        .single();

      if (error) throw error;

      const agentId = lugar.usuario_id;

      const [{ data: agent }, { data: customer }] = await Promise.all([
        supabase.from('usuarios').select('email, nome').eq('id', agentId).single(),
        supabase.from('usuarios').select('nome, email').eq('id', usuario_id).single(),
      ]);

      if (agent?.email) {
        const emailResult = await sendReservationNotificationEmail({
          agentEmail: agent.email,
          agentName: agent.nome || 'Agente',
          establishmentName: lugar.nome,
          customerName: customer?.nome || 'Cliente',
          date: dateStr,
          time: timeStr,
          numPessoas: num_pessoas,
          tipo: tipo || 'presencial',
          observacoes: observacoes || undefined,
        });

        if (!emailResult.success) {
          logger.warn('Falha ao enviar email de notificação', { error: emailResult.error });
        }
      }

      await Promise.all([
        supabase.from('notificacoes').insert([{
          usuario_id: agentId,
          titulo: 'Nova Reserva Recebida',
          mensagem: `Você tem uma nova reserva de ${customer?.nome || 'um cliente'} para ${dateStr} às ${timeStr}.`,
          tipo: 'reserva',
          dados: {
            reservation_id: insertedReservation.id,
            establishment_name: lugar.nome,
            customer_name: customer?.nome || 'Cliente',
            date: dateStr,
            time: timeStr,
            num_pessoas,
            tipo: tipo || 'presencial',
            observacoes: observacoes || null,
          },
          lida: false,
          criado_em: new Date().toISOString(),
        }]),
        supabase.from('suporte_mensagens').insert([{
          usuario_id: agentId,
          mensagem: `📋 Nova reserva: ${customer?.nome || 'Cliente'} reservou ${lugar.nome} para ${dateStr} às ${timeStr} (${num_pessoas} pessoa${num_pessoas > 1 ? 's' : ''}).${observacoes ? ` Obs: ${observacoes}` : ''}`,
          tipo: 'reserva',
          criado_em: new Date().toISOString(),
        }]),
      ]);

      await logApiRequest(
        { correlationId, req, startTime },
        'reservation_created',
        'success',
        { reservation_id: insertedReservation.id, lugar_id, agent_id: agentId, guests: num_pessoas }
      );

      return res.status(201).json({
        success: true,
        data: insertedReservation,
        agent_id: agentId,
        establishment_name: lugar.nome,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro ao criar reserva', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'reservation_failed', 'failure', { error: error.message });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
