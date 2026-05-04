import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import bcrypt from 'bcryptjs';
import { isBlocked } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId, logger, withTiming, logApiRequest } from '../../../lib/logger';
import { loginSchema } from '../../../lib/validators';
import { authRateLimit, validateWithSchema } from '../../../lib/middleware';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return authRateLimit(req, res, async () => {
    try {
      const validated = loginSchema.parse(req.body);
      const { email, senha } = validated;
      
      const correlationId = generateCorrelationId();
      const startTime = Date.now();
      const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
      const cleanEmail = email.toLowerCase().trim();

      if (await isBlocked(cleanEmail)) {
        await logApiRequest({ correlationId, req, startTime }, 'login_failed', 'rate_limited', { reason: 'rate_limited' });
        return res.status(429).json({ success: false, message: 'Muitas tentativas. Tente novamente em 15 minutos.' });
      }

      const { result: usuario, duration } = await withTiming(async () => {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();
        return data;
      });

      if (!usuario || !usuario.senha) {
        await logApiRequest({ correlationId, req, startTime }, 'login_failed', 'failure', { reason: 'user_not_found' });
        return res.status(401).json({ success: false, message: 'Email ou senha incorretos' });
      }

      if (!usuario.ativo) {
        await logApiRequest({ correlationId, req, startTime }, 'login_failed', 'failure', { reason: 'account_disabled' });
        return res.status(403).json({ success: false, message: 'Sua conta foi desativada. Contate o suporte.' });
      }

      const isValid = await bcrypt.compare(senha, usuario.senha);

      if (!isValid) {
        await logApiRequest({ correlationId, req, startTime }, 'login_failed', 'failure', { reason: 'invalid_password' });
        return res.status(401).json({ success: false, message: 'Email ou senha incorretos' });
      }

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
        logger.warn('Não foi possível criar/sync com Supabase Auth', { userId: usuario.id });
      }

      await logApiRequest(
        { correlationId, req, startTime },
        'login_success',
        'success',
        { user_id: usuario.id, papel: usuario.papel, duration }
      );

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
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: error.errors[0]?.message || 'Dados inválidos',
        });
      }

      logger.error('Erro no login', { error: error.message });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
