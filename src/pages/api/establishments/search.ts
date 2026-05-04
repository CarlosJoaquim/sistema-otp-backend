import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId, logger, logApiRequest } from '../../../lib/logger';
import { apiRateLimit } from '../../../lib/middleware';
import { z } from 'zod';

const searchSchema = z.object({
  orcamento: z.coerce.number().optional(),
  categoria: z.string().optional(),
  termo: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return apiRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const validated = searchSchema.parse(req.query);
      const { orcamento, categoria, termo, page, limit } = validated;
      const offset = (page - 1) * limit;

      let query = supabase
        .from('lugares')
        .select('*', { count: 'exact' })
        .eq('ativo', true);

      if (orcamento) {
        const faixas: string[] = [];
        if (orcamento >= 50000) {
          faixas.push('BARATO', 'MODERADO', 'CARO');
        } else if (orcamento >= 25000) {
          faixas.push('BARATO', 'MODERADO');
        } else {
          faixas.push('BARATO');
        }
        query = query.in('faixa_preco', faixas);
      }

      if (categoria && categoria !== 'todos') {
        query = query.eq('categoria', categoria);
      }

      if (termo) {
        query = query.or(`nome.ilike.%${termo}%,descricao.ilike.%${termo}%`);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      await logApiRequest(
        { correlationId, req, startTime },
        'establishment_searched',
        'success',
        { orcamento, categoria, termo, count }
      );

      return res.status(200).json({
        success: true,
        data,
        total: count || 0,
        page,
        limit,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro na busca de estabelecimentos', { error: error.message, correlationId });
      await logApiRequest({ correlationId, req, startTime }, 'establishment_searched', 'failure', { error: error.message });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
