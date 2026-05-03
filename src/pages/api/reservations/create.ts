import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId } from '../../../lib/logger';
import { checkUserRateLimit } from '../../../lib/rateLimit';

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

    await logEvent({
      correlation_id: correlationId,
      event_type: 'reservation_created',
      status: 'success',
      metadata: {
        reservation_id: insertedReservation.id,
        lugar_id,
        agent_id: lugar.usuario_id,
        time: timeStr,
        guests: num_pessoas,
      }
    });

    return res.status(201).json({
      success: true,
      data: insertedReservation,
      agent_id: lugar.usuario_id,
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
