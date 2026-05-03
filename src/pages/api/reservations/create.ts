import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId } from '../../../lib/logger';
import { checkUserRateLimit } from '../../../lib/rateLimit';
import { sendReservationNotificationEmail } from '../../../lib/mailer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { usuario_id, lugar_id, categoria, data_hora, num_pessoas, observacoes, tipo, endereco } = req.body;
  const correlationId = generateCorrelationId();

  if (!usuario_id || !lugar_id || !data_hora || !num_pessoas) {
    return res.status(400).json({ success: false, message: 'Campos obrigatórios faltando' });
  }

  try {
    const rate = await checkUserRateLimit(usuario_id);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: `Aguarde ${rate.retryAfter}s` });
    }

    const { data: lugar } = await supabase
      .from('lugares')
      .select('id, nome, usuario_id')
      .eq('id', lugar_id)
      .single();

    if (!lugar) {
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

    const { data: agent } = await supabase
      .from('usuarios')
      .select('email, nome')
      .eq('id', agentId)
      .single();

    const { data: customer } = await supabase
      .from('usuarios')
      .select('nome, email')
      .eq('id', usuario_id)
      .single();

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
        console.error('Falha ao enviar email de notificação:', emailResult.error);
      }
    }

    await supabase
      .from('notificacoes')
      .insert([{
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
          num_pessoas: num_pessoas,
          tipo: tipo || 'presencial',
          observacoes: observacoes || null,
        },
        lida: false,
        criado_em: new Date().toISOString(),
      }]);

    await supabase
      .from('suporte_mensagens')
      .insert([{
        usuario_id: agentId,
        mensagem: `📋 Nova reserva: ${customer?.nome || 'Cliente'} reservou ${lugar.nome} para ${dateStr} às ${timeStr} (${num_pessoas} pessoa${num_pessoas > 1 ? 's' : ''}).${observacoes ? ` Obs: ${observacoes}` : ''}`,
        tipo: 'reserva',
        criado_em: new Date().toISOString(),
      }]);

    await logEvent({
      correlation_id: correlationId,
      event_type: 'reservation_created',
      status: 'success',
      metadata: {
        reservation_id: insertedReservation.id,
        lugar_id,
        agent_id: agentId,
        time: timeStr,
        guests: num_pessoas,
        email_sent: !!agent?.email,
      }
    });

    return res.status(201).json({
      success: true,
      data: insertedReservation,
      agent_id: agentId,
      establishment_name: lugar.nome,
    });
  } catch (error: any) {
    await logEvent({
      correlation_id: correlationId,
      event_type: 'reservation_failed',
      status: 'failure',
      metadata: { error: error.message }
    });
    return res.status(500).json({ success: false, message: error.message });
  }
}
