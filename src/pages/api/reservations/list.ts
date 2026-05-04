import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const listReservationsSchema = z.object({
  usuario_id: z.string().uuid('ID do usuário inválido'),
  status: z.string().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return apiRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const validated = listReservationsSchema.parse(req.query);
      const { usuario_id, status } = validated;

      let query = supabase
        .from('reservas')
        .select('*, lugar:lugar_id(nome, categoria, endereco, url_imagem)')
        .eq('usuario_id', usuario_id)
        .order('criado_em', { ascending: false });

      if (status && status !== 'todas') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      await logApiRequest({ correlationId, req, startTime }, 'reservation_listed', 'success', {
        usuario_id, status, count: data?.length || 0,
      });

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro ao listar reservas', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'reservation_listed', 'failure', {
        error: error.message,
      });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
