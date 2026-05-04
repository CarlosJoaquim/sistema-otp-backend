import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const listReservationsSchema = z.object({
  agent_id: z.string().uuid('ID do agente inválido'),
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
      const { agent_id, status } = validated;

      const { data: establishments, error: estError } = await supabase
        .from('lugares')
        .select('id')
        .eq('usuario_id', agent_id);

      if (estError) throw estError;

      const establishmentIds = establishments?.map(e => e.id) || [];

      if (establishmentIds.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }

      let query = supabase
        .from('reservas')
        .select('*')
        .in('lugar_id', establishmentIds)
        .order('criado_em', { ascending: false });

      if (status && status !== 'TODOS') {
        query = query.eq('status', status);
      }

      const { data: reservas, error: reservasError } = await query;

      if (reservasError) throw reservasError;

      if (!reservas || reservas.length === 0) {
        return res.status(200).json({ success: true, data: [] });
      }

      const lugarIds = [...new Set(reservas.map(r => r.lugar_id))];
      const { data: lugares } = await supabase
        .from('lugares')
        .select('id, nome, endereco')
        .in('id', lugarIds);

      const usuarioIds = [...new Set(reservas.map(r => r.usuario_id))];
      const { data: usuarios } = await supabase
        .from('usuarios')
        .select('id, nome, email, telefone')
        .in('id', usuarioIds);

      const lugaresMap = new Map();
      if (lugares) {
        lugares.forEach(lugar => lugaresMap.set(lugar.id, lugar));
      }

      const usuariosMap = new Map();
      if (usuarios) {
        usuarios.forEach(usuario => usuariosMap.set(usuario.id, usuario));
      }

      const reservasCompletas = reservas.map(reserva => ({
        ...reserva,
        lugar: lugaresMap.get(reserva.lugar_id),
        usuario: usuariosMap.get(reserva.usuario_id),
      }));

      await logApiRequest({ correlationId, req, startTime }, 'agent_reservations_listed', 'success', {
        agent_id, status, count: reservasCompletas.length,
      });

      return res.status(200).json({ success: true, data: reservasCompletas });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro ao listar reservas do agente', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'agent_reservations_listed', 'failure', {
        error: error.message,
      });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
