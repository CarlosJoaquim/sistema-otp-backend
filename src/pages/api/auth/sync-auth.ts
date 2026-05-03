import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, password, userId, nome, sobrenome } = req.body;

  if (!email || !password || !userId) {
    return res.status(400).json({ success: false, message: 'Dados obrigatórios em falta' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    // Verificar se já existe no Auth
    const authCheck = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (authCheck.ok) {
      return res.status(200).json({ success: true, message: 'Utilizador já existe no Auth' });
    }

    // Criar utilizador no Supabase Auth
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        id: userId,
        email: email.toLowerCase().trim(),
        password: password,
        email_confirm: true,
        user_metadata: {
          nome: nome || '',
          sobrenome: sobrenome || '',
        },
      }),
    });

    if (!authResponse.ok) {
      const authError = await authResponse.json();
      // Se já existe, considerar sucesso
      if (authError.msg?.includes('already') || authError.message?.includes('already')) {
        return res.status(200).json({ success: true, message: 'Utilizador já existe no Auth' });
      }
      throw new Error(`Erro ao criar auth: ${JSON.stringify(authError)}`);
    }

    return res.status(200).json({ success: true, message: 'Utilizador criado no Supabase Auth' });
  } catch (error: any) {
    console.error('Sync auth error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
