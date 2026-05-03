import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

const TIME_SLOTS = [
  '18:00', '18:30', '19:00', '19:30', '20:00',
  '20:30', '21:00', '21:30', '22:00',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { lugar_id, data } = req.query;
  const correlationId = generateCorrelationId();

  if (!lugar_id || !data) {
    return res.status(400).json({ success: false, message: 'lugar_id e data são obrigatórios' });
  }

  try {
    const [day, month, year] = (data as string).split('/');
    const isoDate = `${year}-${month}-${day}`;
    const startOfDay = new Date(`${isoDate}T00:00:00`).toISOString();
    const endOfDay = new Date(`${isoDate}T23:59:59`).toISOString();

    const { data: booked, error } = await supabase
      .from('reservas')
      .select('data_hora')
      .eq('lugar_id', lugar_id)
      .eq('status', 'ACEITA')
      .gte('data_hora', startOfDay)
      .lte('data_hora', endOfDay);

    if (error) throw error;

    const bookedTimes = new Set(
      booked?.map(r => {
        const d = new Date(r.data_hora);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }) || []
    );

    const slots = TIME_SLOTS.map(time => ({
      id: time,
      time,
      available: !bookedTimes.has(time),
    }));

    await logEvent({
      correlation_id: correlationId,
      event_type: 'reservation_listed',
      status: 'success',
      metadata: { lugar_id, data }
    });

    return res.status(200).json({ success: true, data: slots });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
