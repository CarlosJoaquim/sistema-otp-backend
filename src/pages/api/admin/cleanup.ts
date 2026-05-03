import { NextApiRequest, NextApiResponse } from 'next';
import { runCleanup } from '../../../lib/cleanup';

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ success: false, message: 'Não autorizado' });
  }

  try {
    const result = await runCleanup();
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
