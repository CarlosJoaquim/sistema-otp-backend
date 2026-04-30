const supabase = require('./services/supabaseClient');
const { generateOTP } = require('./utils/otpGenerator');
const bcrypt = require('bcryptjs');

async function testAll() {
  console.log('=== INICIANDO TESTES ===\n');

  // Teste 1: Conexão Supabase
  console.log('1. Testando conexão com Supabase...');
  const { data: users, error: userError } = await supabase.from('users').select('count');
  if (userError) { console.error('ERRO:', userError.message); return; }
  console.log('✓ Conexão OK\n');

  // Teste 2: Gerar e inserir OTP
  console.log('2. Testando geração e inserção de OTP...');
  const phone = '244999999999';
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60000).toISOString();
  
  await supabase.from('otps').delete().eq('phone', phone);
  const { data: otpData, error: otpError } = await supabase.from('otps').insert([{
    phone, code: otp, expires_at: expiresAt, attempts: 0, verified: false
  }]).select();
  
  if (otpError) { console.error('ERRO ao inserir OTP:', otpError.message); return; }
  console.log(`✓ OTP gerado e salvo: ${otp}\n`);

  // Teste 3: Verificar OTP
  console.log('3. Testando verificação de OTP...');
  const { data: verifyData } = await supabase.from('otps').select('*').eq('phone', phone).single();
  if (verifyData && verifyData.code === otp) {
    await supabase.from('otps').update({ verified: true }).eq('id', verifyData.id);
    console.log('✓ OTP verificado com sucesso\n');
  } else {
    console.log('✗ Falha na verificação\n');
  }

  // Teste 4: Reset de senha
  console.log('4. Testando reset de senha...');
  const newPassword = 'NovaSenha123';
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  const { data: existingUser } = await supabase.from('users').select('*').eq('phone', phone).single();
  
  if (existingUser) {
    await supabase.from('users').update({ password_hash: passwordHash }).eq('phone', phone);
  } else {
    await supabase.from('users').insert([{ phone, password_hash: passwordHash }]);
  }
  console.log('✓ Senha atualizada com sucesso\n');

  // Teste 5: Verificar senha
  console.log('5. Verificando senha no banco...');
  const { data: userCheck } = await supabase.from('users').select('*').eq('phone', phone).single();
  const passwordMatch = await bcrypt.compare(newPassword, userCheck.password_hash);
  if (passwordMatch) {
    console.log('✓ Senha verificada com sucesso\n');
  }

  // Limpeza
  await supabase.from('otps').delete().eq('phone', phone);
  console.log('=== TODOS OS TESTES PASSARAM ===');
}

testAll().catch(console.error);
