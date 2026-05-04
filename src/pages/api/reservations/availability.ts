import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const TIME_SLOTS = [
  '18:00', '18:30', '19:00', '19:30', '20:00',
  '20:30', '21:00', '21:30', '22:00',
];

const availabilitySchema = z.object({
  lugar_id: z.string().uuid('ID do estabelecimento inválido'),
  data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data deve estar no formato DD/MM/AAAA'),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return apiRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const validated = availabilitySchema.parse(req.query);
      const { lugar_id, data } = validated;

      const [day, month, year] = data.split('/');
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

      await logApiRequest({ correlationId, req, startTime }, 'reservation_listed', 'success', {
        lugar_id, data, slots_count: slots.length,
      });

      return res.status(200).json({ success: true, data: slots });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro ao buscar disponibilidade', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'reservation_listed', 'failure', {
        error: error.message,
      });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
