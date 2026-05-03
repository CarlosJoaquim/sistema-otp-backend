import { generateOTP } from '../lib/otpGenerator';
import supabase from '../lib/supabase';
import bcrypt from 'bcryptjs';
import { logEvent, generateCorrelationId } from './logger';

export type CodeType = 'signup' | 'password_reset';

const EXPIRY_MINUTES: Record<CodeType, number> = {
  signup: 24 * 60,
  password_reset: 15,
};

export const createOTP = async (
  phone: string,
  checkUserExists: boolean = true,
  method: string = 'sms',
  correlationId?: string,
  codeType: CodeType = 'signup'
) => {
  const corrId = correlationId || generateCorrelationId();

  if (checkUserExists) {
    const { data: user } = await supabase
      .from('usuarios')
      .select('telefone, email, nome')
      .or(`telefone.eq.${phone},email.eq.${phone}`)
      .single();

    if (!user) {
      await logEvent({
        correlation_id: corrId,
        event_type: 'otp_failed',
        status: 'failure',
        email: phone,
        metadata: { reason: 'user_not_found' }
      });
      return { success: false, message: 'Usuário não encontrado', correlationId: corrId };
    }
  }

  if (codeType === 'password_reset') {
    await supabase
      .from('otps')
      .delete()
      .or(`phone.eq.${phone},email.eq.${phone}`)
      .eq('verified', false)
      .eq('code_type', 'password_reset');
  }

  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiryMinutes = EXPIRY_MINUTES[codeType];
  const expiresAt = new Date(Date.now() + expiryMinutes * 60000);

  await supabase
    .from('otps')
    .delete()
    .or(`phone.eq.${phone},email.eq.${phone}`);

  const insertData: any = {
    code_hash: otpHash,
    expires_at: expiresAt.toISOString(),
    attempts: 0,
    verified: false,
    method: method,
    correlation_id: corrId,
    code_type: codeType,
  };

  if (method === 'sms') {
    insertData.phone = phone;
  } else {
    insertData.email = phone;
  }

  const { data, error } = await supabase
    .from('otps')
    .insert([insertData])
    .select();

  if (error) throw error;

  await logEvent({
    correlation_id: corrId,
    event_type: method === 'email' ? 'otp_sent' : 'otp_sent',
    status: 'success',
    email: phone,
    metadata: { method, expires_in_minutes: expiryMinutes, code_type: codeType }
  });

  return { success: true, message: `OTP enviado via ${method}`, code: otp, correlationId: corrId };
};

export const verifyOTP = async (phone: string, code: string, correlationId?: string) => {
  const startTime = Date.now();

  const { data: otp } = await supabase
    .from('otps')
    .select('*')
    .or(`phone.eq.${phone},email.eq.${phone}`)
    .eq('verified', false)
    .single();

  if (!otp) {
    await logEvent({
      correlation_id: correlationId || generateCorrelationId(),
      event_type: 'otp_failed',
      status: 'failure',
      email: phone,
      metadata: { reason: 'code_not_found' }
    });
    return { success: false, message: 'Código inválido' };
  }

  if (new Date(otp.expires_at) < new Date()) {
    await logEvent({
      correlation_id: otp.correlation_id || correlationId || generateCorrelationId(),
      event_type: 'otp_failed',
      status: 'failure',
      email: phone,
      metadata: { reason: 'expired' }
    });
    return { success: false, message: 'Código expirado' };
  }

  if (otp.attempts >= 3) {
    await logEvent({
      correlation_id: otp.correlation_id || correlationId || generateCorrelationId(),
      event_type: 'otp_failed',
      status: 'failure',
      email: phone,
      attempts: otp.attempts,
      metadata: { reason: 'max_attempts' }
    });
    return { success: false, message: 'Muitas tentativas' };
  }

  const isValid = await bcrypt.compare(code, otp.code_hash);

  await supabase
    .from('otps')
    .update({ attempts: otp.attempts + 1 })
    .eq('id', otp.id);

  if (!isValid) {
    await logEvent({
      correlation_id: otp.correlation_id || correlationId || generateCorrelationId(),
      event_type: 'otp_failed',
      status: 'failure',
      email: phone,
      attempts: otp.attempts + 1,
      metadata: { reason: 'invalid_code' }
    });
    return { success: false, message: 'Código inválido' };
  }

  await supabase
    .from('otps')
    .update({ verified: true })
    .eq('id', otp.id);

  const timeElapsed = Date.now() - startTime;

  await logEvent({
    correlation_id: otp.correlation_id || correlationId || generateCorrelationId(),
    event_type: 'otp_verified',
    status: 'success',
    email: phone,
    time_elapsed_ms: timeElapsed,
    metadata: { method: otp.method, code_type: otp.code_type }
  });

  return { success: true, message: 'Código verificado', codeType: otp.code_type as CodeType };
};

export const invalidateOldCodes = async (email: string, codeType?: CodeType) => {
  let query = supabase
    .from('otps')
    .delete()
    .eq('email', email)
    .eq('verified', false);

  if (codeType) {
    query = query.eq('code_type', codeType);
  }

  return await query;
};
