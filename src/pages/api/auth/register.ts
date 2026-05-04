import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { createOTP } from '../../../lib/otpService';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { sendVerificationEmail } from '../../../lib/mailer';
import { checkIPRateLimit } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId, logger, withTiming } from '../../../lib/logger';
import { registerSchema } from '../../../lib/validators';
import { strictRateLimit } from '../../../lib/middleware';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  return strictRateLimit(req, res, async () => {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

    try {
      const validated = registerSchema.parse(req.body);
      const { nome, sobrenome, email, telefone, senha } = validated;
      const cleanEmail = email.toLowerCase().trim();

      const ipRate = await checkIPRateLimit(ip);
      if (!ipRate.allowed) {
        await logEvent({
          correlation_id: correlationId,
          event_type: 'user_registered',
          status: 'rate_limited',
          email: cleanEmail,
          ip_address: ip,
          metadata: { reason: 'ip_rate_limited' },
        });
        return res.status(429).json({ success: false, message: 'Muitas solicitações deste IP' });
      }

      const { result: existingUser } = await withTiming(async () => {
        const { data } = await supabase
          .from('usuarios')
          .select('email, telefone')
          .eq('email', cleanEmail)
          .maybeSingle();
        return data;
      });

      if (existingUser) {
        await logEvent({
          correlation_id: correlationId,
          event_type: 'user_registered',
          status: 'failure',
          email: cleanEmail,
          ip_address: ip,
          metadata: { reason: 'user_already_exists' },
        });
        return res.status(400).json({ success: false, message: 'Usuário já cadastrado' });
      }

      const userId = uuidv4();
      const supabaseUrl = process.env.SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_KEY!;

      const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          id: userId,
          email: cleanEmail,
          password: senha,
          email_confirm: true,
          user_metadata: { nome, sobrenome: sobrenome || '' },
        }),
      });

      if (!authResponse.ok) {
        const authError = await authResponse.json();
        if (authError.msg?.includes('already been registered') || authError.message?.includes('already')) {
          return res.status(400).json({ success: false, message: 'Usuário já cadastrado' });
        }
        throw new Error(`Erro ao criar auth: ${JSON.stringify(authError)}`);
      }

      const passwordHash = await bcrypt.hash(senha, 10);

      const { error: userError } = await supabase.from('usuarios').insert([{
        id: userId,
        nome,
        sobrenome: sobrenome || '',
        email: cleanEmail,
        telefone: telefone || null,
        senha: passwordHash,
        papel: 'USUARIO',
        ativo: true,
        criado_em: new Date().toISOString(),
      }]);

      if (userError) {
        try {
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
            method: 'DELETE',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
          });
        } catch { /* ignore */ }
        throw userError;
      }

      const otpResult = await createOTP(cleanEmail, false, 'email', correlationId);

      if (!otpResult.success) {
        return res.status(400).json(otpResult);
      }

      const emailResult = await sendVerificationEmail(cleanEmail, otpResult.code!, 'signup', nome);

      await logEvent({
        correlation_id: correlationId,
        event_type: 'user_registered',
        status: emailResult.success ? 'success' : 'failure',
        email: cleanEmail,
        ip_address: ip,
        metadata: { user_id: userId, email_sent: emailResult.success, resend_message_id: (emailResult as any).messageId },
      });

      return res.status(201).json({
        success: true,
        message: 'Usuário cadastrado. Verifique seu email.',
        userId,
        correlation_id: correlationId,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ success: false, message: error.errors[0]?.message || 'Dados inválidos' });
      }

      logger.error('Erro no registro', { error: error.message, correlationId });
      await logEvent({
        correlation_id: correlationId,
        event_type: 'user_registered',
        status: 'failure',
        ip_address: ip,
        metadata: { error: error.message },
      });
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
  });
}
