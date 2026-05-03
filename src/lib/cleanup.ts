import supabase from '../lib/supabase';

export const cleanupExpiredOTPs = async () => {
  const { count, error } = await supabase
    .from('otps')
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.error('Erro ao limpar OTPs expirados:', error);
    return { success: false, error: error.message };
  }

  console.log(`OTPs expirados removidos: ${count}`);
  return { success: true, deletedCount: count };
};

export const cleanupOldRecords = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('otps')
    .delete()
    .lt('expires_at', thirtyDaysAgo);

  if (error) {
    console.error('Erro ao limpar registros antigos:', error);
    return { success: false, error: error.message };
  }

  console.log(`Registros antigos removidos: ${count}`);
  return { success: true, deletedCount: count };
};

export const runCleanup = async () => {
  console.log('Iniciando limpeza agendada...');

  const expiredResult = await cleanupExpiredOTPs();
  const oldResult = await cleanupOldRecords();

  console.log('Limpeza agendada concluída.');

  return {
    expiredOTPs: expiredResult,
    oldRecords: oldResult,
  };
};
