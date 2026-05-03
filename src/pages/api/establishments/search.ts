import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { orcamento, categoria, termo, page = '1', limit = '20' } = req.query;
  const correlationId = generateCorrelationId();
  const pageNumber = parseInt(page as string);
  const limitNumber = parseInt(limit as string);
  const offset = (pageNumber - 1) * limitNumber;

  try {
    let query = supabase
      .from('lugares')
      .select('*', { count: 'exact' })
      .eq('ativo', true);

    if (orcamento) {
      const budget = parseInt(orcamento as string);
      const faixas: string[] = [];
      if (budget >= 50000) {
        faixas.push('BARATO', 'MODERADO', 'CARO');
      } else if (budget >= 25000) {
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

    query = query.range(offset, offset + limitNumber - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    await logEvent({
      correlation_id: correlationId,
      event_type: 'establishment_searched',
      status: 'success',
      metadata: { orcamento, categoria, termo, count }
    });

    return res.status(200).json({
      success: true,
      data,
      total: count || 0,
      page: pageNumber,
      limit: limitNumber,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
