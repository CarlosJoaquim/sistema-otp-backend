import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const listOrdersSchema = z.object({
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
      const validated = listOrdersSchema.parse(req.query);
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
        .from('pedidos')
        .select(`
          *,
          lugar:lugar_id (nome, endereco),
          itens:pedido_itens (
            quantidade,
            preco_unitario,
            produto:produto_id (nome, url_imagem)
          )
        `)
        .in('lugar_id', establishmentIds)
        .order('criado_em', { ascending: false });

      if (status && status !== 'TODOS') {
        query = query.eq('status', status);
      }

      const { data: pedidos, error: pedidosError } = await query;

      if (pedidosError) throw pedidosError;

      if (pedidos && pedidos.length > 0) {
        const usuarioIds = [...new Set(pedidos.map(p => p.usuario_id))];
        
        const { data: usuariosData } = await supabase
          .from('usuarios')
          .select('id, nome, email, telefone')
          .in('id', usuarioIds);
        
        const usuariosMap = new Map();
        if (usuariosData) {
          usuariosData.forEach((usuario: any) => {
            usuariosMap.set(usuario.id, usuario);
          });
        }
        
        const pedidosCompletos = pedidos.map((pedido: any) => ({
          ...pedido,
          usuario: usuariosMap.get(pedido.usuario_id) || null,
        }));

        await logApiRequest({ correlationId, req, startTime }, 'agent_orders_listed', 'success', {
          agent_id, status, count: pedidosCompletos.length,
        });

        return res.status(200).json({ success: true, data: pedidosCompletos });
      }

      return res.status(200).json({ success: true, data: [] });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro ao listar pedidos do agente', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'agent_orders_listed', 'failure', {
        error: error.message,
      });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
