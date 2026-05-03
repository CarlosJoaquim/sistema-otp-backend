import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || '');

export type EmailType = 'signup' | 'password_reset' | 'reservation_notification';

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const LOGO_URL = 'https://caop-b.com/assets/Caop-B-Logo-PNG.png';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const sendWithRetry = async (
  params: Parameters<typeof resend.emails.send>[0],
  maxRetries: number = 3
): Promise<EmailResult> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Resend API timeout')), 5000);
      });

      const sendPromise = resend.emails.send(params);

      const { data, error } = await Promise.race([sendPromise, timeoutPromise]);

      if (error) {
        lastError = new Error(error.message);
        console.error(`Resend attempt ${attempt}/${maxRetries} failed:`, error.message);
      } else {
        console.log('Email enviado:', data?.id);
        return { success: true, messageId: data?.id };
      }
    } catch (error: any) {
      lastError = error;
      console.error(`Resend attempt ${attempt}/${maxRetries} error:`, error.message);
    }

    if (attempt < maxRetries) {
      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      console.log(`Retry em ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Falha no envio do email',
  };
};

const EmailHeader = `
  <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb;">
    <img src="${LOGO_URL}" alt="Caop-B" style="max-width: 160px; height: auto; margin-bottom: 8px;" />
    <div style="font-size: 11px; color: #9ca3af; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px;">Sistema de Autenticação</div>
  </div>
`;

const EmailFooter = `
  <div style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
    <div style="margin-bottom: 8px;">
      <img src="${LOGO_URL}" alt="Caop-B" style="max-width: 80px; height: auto; opacity: 0.5;" />
    </div>
    &copy; ${new Date().getFullYear()} CAOP-B. Todos os direitos reservados.
  </div>
`;

const getSignupEmailHTML = (code: string, name?: string, expiresIn: string = '24 horas') => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 40px auto; background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
    <div style="padding: 40px;">
      ${EmailHeader}
      <h1 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Olá${name ? `, ${name}` : ''}!</h1>
      <p style="font-size: 14px; color: #6b7280; margin: 0 0 32px 0;">Bem-vindo ao CAOP-B! Use o código abaixo para verificar sua conta:</p>
      <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 32px; border: 1px solid #bfdbfe;">
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">${code}</div>
        <div style="font-size: 12px; color: #60a5fa; margin-top: 8px;">Este código expira em ${expiresIn}</div>
      </div>
      <div style="background: #fef2f2; border-radius: 8px; padding: 14px; margin-bottom: 24px; border-left: 3px solid #ef4444;">
        <p style="font-size: 13px; color: #991b1b; margin: 0;"><strong>Importante:</strong> Não compartilhe este código com ninguém.</p>
      </div>
      <p style="font-size: 14px; color: #6b7280;">Se você não criou uma conta no CAOP-B, ignore este email.</p>
    </div>
    ${EmailFooter}
  </div>
`;

const getPasswordResetEmailHTML = (code: string, name?: string, expiresIn: string = '15 minutos') => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 40px auto; background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
    <div style="padding: 40px;">
      ${EmailHeader}
      <h1 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Olá${name ? `, ${name}` : ''}!</h1>
      <p style="font-size: 14px; color: #6b7280; margin: 0 0 32px 0;">Alguém solicitou a redefinição da sua senha. Use o código abaixo:</p>
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 32px; border: 1px solid #f59e0b;">
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #d97706;">${code}</div>
        <div style="font-size: 12px; color: #92400e; margin-top: 8px;">Este código expira em ${expiresIn}</div>
      </div>
      <div style="background: #fef2f2; border-radius: 8px; padding: 14px; margin-bottom: 24px; border-left: 3px solid #ef4444;">
        <p style="font-size: 13px; color: #991b1b; margin: 0;"><strong>Atenção:</strong> Não compartilhe este código com ninguém.</p>
      </div>
      <p style="font-size: 14px; color: #6b7280;">Se você não solicitou a redefinição de senha, ignore este email e sua conta continuará segura.</p>
    </div>
    ${EmailFooter}
  </div>
`;

const getSignupEmailText = (code: string, name?: string, expiresIn: string = '24 horas') => `
Olá${name ? `, ${name}` : ''}!

Bem-vindo ao CAOP-B! Use o código abaixo para verificar sua conta:

Seu código de verificação: ${code}

Este código expira em ${expiresIn}.

Importante: Não compartilhe este código com ninguém.

Se você não criou uma conta no CAOP-B, ignore este email.

© ${new Date().getFullYear()} CAOP-B
`;

const getPasswordResetEmailText = (code: string, name?: string, expiresIn: string = '15 minutos') => `
Olá${name ? `, ${name}` : ''}!

Alguém solicitou a redefinição da sua senha. Use o código abaixo:

Seu código de redefinição: ${code}

Este código expira em ${expiresIn}.

Atenção: Não compartilhe este código com ninguém.

Se você não solicitou a redefinição de senha, ignore este email e sua conta continuará segura.

© ${new Date().getFullYear()} CAOP-B
`;

const getReservationEmailHTML = (
  agentName: string,
  establishmentName: string,
  customerName: string,
  date: string,
  time: string,
  numPessoas: number,
  tipo: string,
  observacoes?: string
) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 40px auto; background: white; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden;">
    <div style="padding: 40px;">
      ${EmailHeader}
      <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 28px; border: 1px solid #a7f3d0;">
        <div style="font-size: 32px; margin-bottom: 4px;">📋</div>
        <h2 style="font-size: 18px; font-weight: 600; color: #065f46; margin: 0;">Nova Reserva Recebida!</h2>
      </div>
      <h1 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Olá, ${agentName}!</h1>
      <p style="font-size: 14px; color: #6b7280; margin: 0 0 24px 0;">Você tem uma nova reserva no seu estabelecimento <strong>${establishmentName}</strong>.</p>
      <div style="background: #f9fafb; border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
        <div style="display: grid; gap: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #6b7280;">👤 Cliente</span>
            <span style="font-size: 14px; font-weight: 500; color: #111827;">${customerName}</span>
          </div>
          <div style="border-top: 1px solid #e5e7eb;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #6b7280;">📅 Data</span>
            <span style="font-size: 14px; font-weight: 500; color: #111827;">${date}</span>
          </div>
          <div style="border-top: 1px solid #e5e7eb;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #6b7280;">🕐 Horário</span>
            <span style="font-size: 14px; font-weight: 500; color: #111827;">${time}</span>
          </div>
          <div style="border-top: 1px solid #e5e7eb;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #6b7280;">👥 Pessoas</span>
            <span style="font-size: 14px; font-weight: 500; color: #111827;">${numPessoas}</span>
          </div>
          <div style="border-top: 1px solid #e5e7eb;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #6b7280;">📍 Tipo</span>
            <span style="font-size: 14px; font-weight: 500; color: #111827; text-transform: capitalize;">${tipo}</span>
          </div>
          ${observacoes ? `
          <div style="border-top: 1px solid #e5e7eb;"></div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <span style="font-size: 13px; color: #6b7280;">📝 Observações</span>
            <span style="font-size: 14px; color: #374151; max-width: 60%; text-align: right;">${observacoes}</span>
          </div>
          ` : ''}
        </div>
      </div>
      <div style="background: #eff6ff; border-radius: 8px; padding: 14px; margin-bottom: 24px; border-left: 3px solid #3b82f6;">
        <p style="font-size: 13px; color: #1e40af; margin: 0;">💡 Acesse o painel para aceitar ou recusar esta reserva.</p>
      </div>
      <p style="font-size: 14px; color: #6b7280;">Se você não reconhece esta reserva, entre em contato com o suporte.</p>
    </div>
    ${EmailFooter}
  </div>
`;

const getReservationEmailText = (
  agentName: string,
  establishmentName: string,
  customerName: string,
  date: string,
  time: string,
  numPessoas: number,
  tipo: string,
  observacoes?: string
) => `
Olá, ${agentName}!

Você tem uma nova reserva no seu estabelecimento ${establishmentName}.

Detalhes da reserva:
- Cliente: ${customerName}
- Data: ${date}
- Horário: ${time}
- Número de pessoas: ${numPessoas}
- Tipo: ${tipo}
${observacoes ? `- Observações: ${observacoes}` : ''}

Acesse o painel para aceitar ou recusar esta reserva.

Se você não reconhece esta reserva, entre em contato com o suporte.

© ${new Date().getFullYear()} CAOP-B
`;

export const sendVerificationEmail = async (
  to: string,
  code: string,
  type: EmailType = 'signup',
  name?: string
): Promise<EmailResult> => {
  const isSignup = type === 'signup';
  const expiresIn = isSignup ? '24 horas' : '15 minutos';
  const subject = isSignup
    ? 'Código de verificação - CAOP-B'
    : 'Redefinição de senha - CAOP-B';

  const html = isSignup
    ? getSignupEmailHTML(code, name, expiresIn)
    : getPasswordResetEmailHTML(code, name, expiresIn);

  const text = isSignup
    ? getSignupEmailText(code, name, expiresIn)
    : getPasswordResetEmailText(code, name, expiresIn);

  return sendWithRetry({
    from: process.env.EMAIL_FROM || 'CAOP-B <team@caop-b.com>',
    to: [to],
    subject,
    html,
    text,
  });
};

export const sendOTPEmail = async (to: string, code: string, name?: string): Promise<EmailResult> => {
  return sendVerificationEmail(to, code, 'signup', name);
};

export interface ReservationNotificationParams {
  agentEmail: string;
  agentName: string;
  establishmentName: string;
  customerName: string;
  date: string;
  time: string;
  numPessoas: number;
  tipo: string;
  observacoes?: string;
}

export const sendReservationNotificationEmail = async (
  params: ReservationNotificationParams
): Promise<EmailResult> => {
  const html = getReservationEmailHTML(
    params.agentName,
    params.establishmentName,
    params.customerName,
    params.date,
    params.time,
    params.numPessoas,
    params.tipo,
    params.observacoes
  );

  const text = getReservationEmailText(
    params.agentName,
    params.establishmentName,
    params.customerName,
    params.date,
    params.time,
    params.numPessoas,
    params.tipo,
    params.observacoes
  );

  return sendWithRetry({
    from: process.env.EMAIL_FROM || 'CAOP-B <team@caop-b.com>',
    to: [params.agentEmail],
    subject: `📋 Nova Reserva - ${params.establishmentName}`,
    html,
    text,
  });
};

export default resend;
