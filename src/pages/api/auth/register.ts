import { NextApiRequest, NextApiResponse } from 'next';
import supabase from '../../../lib/supabase';
import { createOTP } from '../../../lib/otpService';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { sendVerificationEmail } from '../../../lib/mailer';
import { checkIPRateLimit } from '../../../lib/rateLimit';
import { logEvent, generateCorrelationId } from '../../../lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { nome, sobrenome, email, telefone, senha } = req.body as {
    nome?: string;
    sobrenome?: string;
    email?: string;
    telefone?: string;
    senha?: string;
  };

  if (!nome || !email || !senha) {
    return res.status(400).json({ success: false, message: 'Nome, email e senha são obrigatórios' });
  }

  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const correlationId = generateCorrelationId();

  try {
    // Rate limit por IP
    const ipRate = await checkIPRateLimit(ip);
    if (!ipRate.allowed) {
      return res.status(429).json({ success: false, message: 'Muitas solicitações deste IP' });
    }

    // Verificar se usuário já existe na tabela usuarios
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('email, telefone')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (existingUser) {
      await logEvent({
        correlation_id: correlationId,
        event_type: 'user_registered',
        status: 'failure',
        email,
        ip_address: ip,
        metadata: { reason: 'user_already_exists' }
      });
      return res.status(400).json({ success: false, message: 'Usuário já cadastrado' });
    }

    // Criar usuário no Supabase Auth primeiro
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
        email: email.toLowerCase().trim(),
        password: senha,
        email_confirm: true,
        user_metadata: {
          nome,
          sobrenome: sobrenome || '',
        },
      }),
    });

    if (!authResponse.ok) {
      const authError = await authResponse.json();
      if (authError.msg?.includes('already been registered') || authError.message?.includes('already')) {
        return res.status(400).json({ success: false, message: 'Usuário já cadastrado' });
      }
      throw new Error(`Erro ao criar auth: ${JSON.stringify(authError)}`);
    }

    // Hash da senha para a tabela usuarios (compatibilidade com login direto)
    const passwordHash = await bcrypt.hash(senha, 10);

    // Criar registro na tabela usuarios
    const { error: userError } = await supabase
      .from('usuarios')
      .insert([{
        id: userId,
        nome,
        sobrenome: sobrenome || '',
        email: email.toLowerCase().trim(),
        telefone: telefone || null,
        senha: passwordHash,
        papel: 'USUARIO',
        ativo: true,
        criado_em: new Date().toISOString(),
      }]);

    if (userError) {
      // Se falhou na tabela usuarios, tenta limpar o auth
      try {
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });
      } catch {
        // Ignora erro na limpeza
      }
      throw userError;
    }

    // Criar OTP com hash (20 min para cadastro)
    const otpResult = await createOTP(email, false, 'email', correlationId);

    if (!otpResult.success) {
      return res.status(400).json(otpResult);
    }

    // Enviar email de verificação via Resend
    const emailResult = await sendVerificationEmail(email, otpResult.code!, 'signup', nome);

    await logEvent({
      correlation_id: correlationId,
      event_type: 'user_registered',
      status: emailResult.success ? 'success' : 'failure',
      email,
      ip_address: ip,
      metadata: { user_id: userId, email_sent: emailResult.success, resend_message_id: (emailResult as any).messageId }
    });

    // Retornar sucesso mesmo se email falhar (não bloqueia cadastro)
    return res.status(201).json({
      success: true,
      message: 'Usuário cadastrado. Verifique seu email.',
      userId,
      correlation_id: correlationId,
    });
  } catch (error: any) {
    await logEvent({
      correlation_id: correlationId,
      event_type: 'user_registered',
      status: 'failure',
      email: email || 'unknown',
      ip_address: ip,
      metadata: { error: error.message }
    });
    return res.status(500).json({ success: false, message: error.message });
  }
}
