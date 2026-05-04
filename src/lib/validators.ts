import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido').min(1, 'Email é obrigatório').max(255),
  senha: z.string().min(1, 'Senha é obrigatória').max(128),
});

export const registerSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  sobrenome: z.string().min(2, 'Sobrenome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(255),
  senha: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(128),
  telefone: z.string().optional().nullable(),
});

export const otpVerificationSchema = z.object({
  email: z.string().email('Email inválido'),
  code: z.string().length(6, 'Código deve ter 6 dígitos'),
  correlation_id: z.string().optional(),
});

export const resetRequestSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
  code: z.string().length(6, 'Código deve ter 6 dígitos'),
  newPassword: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(128),
});

export const reservationSchema = z.object({
  estabelecimento_id: z.string().uuid('ID do estabelecimento inválido'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  horario: z.string().regex(/^\d{2}:\d{2}$/, 'Horário deve estar no formato HH:MM'),
  numero_pessoas: z.number().int().min(1).max(50, 'Máximo 50 pessoas'),
  observacoes: z.string().max(500).optional().nullable(),
});

export const reservationCancelSchema = z.object({
  reserva_id: z.string().uuid('ID da reserva inválido'),
});

export const establishmentSearchSchema = z.object({
  query: z.string().min(1, 'Termo de busca é obrigatório').max(200),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  categoria: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const errorReportSchema = z.object({
  error_name: z.string().max(100),
  error_message: z.string().max(2000),
  stack_trace: z.string().max(10000).optional(),
  component_stack: z.string().max(5000).optional(),
  user_id: z.string().optional().nullable(),
  screen_name: z.string().max(100).optional(),
  app_version: z.string().max(20).optional(),
  device_info: z.string().max(200).optional(),
});

export const updateStatusSchema = z.object({
  reserva_id: z.string().uuid('ID da reserva inválido'),
  status: z.enum(['PENDENTE', 'ACEITA', 'RECUSADA', 'CONCLUÍDA', 'CANCELADA']),
});

export const locationAccessSchema = z.object({
  reserva_id: z.string().uuid('ID da reserva inválido'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type OtpVerificationInput = z.infer<typeof otpVerificationSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ReservationInput = z.infer<typeof reservationSchema>;
export type ReservationCancelInput = z.infer<typeof reservationCancelSchema>;
export type EstablishmentSearchInput = z.infer<typeof establishmentSearchSchema>;
export type ErrorReportInput = z.infer<typeof errorReportSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type LocationAccessInput = z.infer<typeof locationAccessSchema>;
