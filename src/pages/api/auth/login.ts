import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import bcrypt from 'bcryptjs';
import { isBlocked } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, senha } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const correlationId = generateCorrelationId();

  if (!email || !senha) {
    return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
  }

  try {
    if (await isBlocked(email)) {
      return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
    }

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (!usuario || !usuario.senha) {
      await logEvent({
        correlation_id: correlationId,
        event_type: 'login_failed',
        status: 'failure',
        email: email.toLowerCase().trim(),
        ip_address: ip as string,
        metadata: { reason: 'user_not_found' }
      });
      return res.status(401).json({ success: false, message: 'Email ou senha incorretos' });
    }

    if (!usuario.ativo) {
      return res.status(403).json({ success: false, message: 'Sua conta foi desativada. Contate o suporte.' });
    }

    const isValid = await bcrypt.compare(senha, usuario.senha);

    if (!isValid) {
      await logEvent({
        correlation_id: correlationId,
        event_type: 'login_failed',
        status: 'failure',
        email: email.toLowerCase().trim(),
        ip_address: ip as string,
        metadata: { reason: 'invalid_password' }
      });
      return res.status(401).json({ success: false, message: 'Email ou senha incorretos' });
    }

    // Criar utilizador no Supabase Auth se não existir (para RLS funcionar)
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    try {
      const authCheck = await fetch(`${supabaseUrl}/auth/v1/admin/users/${usuario.id}`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });

      if (!authCheck.ok) {
        // Utilizador não existe no Auth, criar
        await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            id: usuario.id,
            email: usuario.email,
            password: senha,
            email_confirm: true,
            user_metadata: {
              nome: usuario.nome,
              sobrenome: usuario.sobrenome,
            },
          }),
        });
      }
    } catch (authError) {
      console.warn('Não foi possível criar/sync com Supabase Auth:', authError);
    }

    await logEvent({
      correlation_id: correlationId,
      event_type: 'login_success',
      status: 'success',
      email: email.toLowerCase().trim(),
      ip_address: ip as string,
      metadata: { user_id: usuario.id, papel: usuario.papel }
    });

    return res.status(200).json({
      success: true,
      user: {
        id: usuario.id,
        nome: usuario.nome,
        sobrenome: usuario.sobrenome,
        email: usuario.email,
        telefone: usuario.telefone,
        papel: usuario.papel,
        ativo: usuario.ativo,
      },
    });
  } catch (error: any) {
    await logEvent({
      correlation_id: correlationId,
      event_type: 'login_failed',
      status: 'failure',
      email: email.toLowerCase().trim(),
      ip_address: ip as string,
      metadata: { error: error.message }
    });
    return res.status(500).json({ success: false, message: error.message });
  }
}
