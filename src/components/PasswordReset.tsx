import { FC, useState } from 'react';

const PasswordReset: FC = () => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'request' | 'verify' | 'reset'>('request');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

  const steps = [
    { id: 'request', label: 'Solicitar', icon: 'fas fa-envelope' },
    { id: 'verify', label: 'Verificar', icon: 'fas fa-shield-halved' },
    { id: 'reset', label: 'Redefinir', icon: 'fas fa-lock' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => { setMessage(''); setMessageType(null); }, 5000);
  };

  const handleRequestOTP = async () => {
    if (!email) return;
    setLoading(true);
    setMessage('');
    setMessageType(null);
    try {
      const base = API_BASE || window.location.origin;
      const res = await fetch(`${base}/api/auth/request-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage(data.message || 'Código enviado com sucesso!', 'success');
        setStep('verify');
      } else {
        showMessage(data.message || 'Erro ao enviar código', 'error');
      }
    } catch (err: any) {
      showMessage('Erro ao enviar código', 'error');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) return;
    setLoading(true);
    setMessage('');
    setMessageType(null);
    try {
      const base = API_BASE || window.location.origin;
      const res = await fetch(`${base}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Código verificado com sucesso!', 'success');
        setStep('reset');
      } else {
        showMessage(data.message || 'Código inválido', 'error');
      }
    } catch (err: any) {
      showMessage('Erro ao verificar código', 'error');
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) return;
    setLoading(true);
    setMessage('');
    setMessageType(null);
    try {
      const base = API_BASE || window.location.origin;
      const res = await fetch(`${base}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Senha redefinida com sucesso!', 'success');
        setTimeout(() => {
          setStep('request');
          setEmail('');
          setOtp('');
          setNewPassword('');
        }, 2000);
      } else {
        showMessage(data.message || 'Erro ao redefinir senha', 'error');
      }
    } catch (err: any) {
      showMessage('Erro ao redefinir senha', 'error');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Redefinir Senha</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie a redefinição de senhas dos usuários</p>
      </div>

      <div className="card max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, idx) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className={`flex flex-col items-center ${
                idx <= currentStepIndex ? 'text-blue-600' : 'text-gray-400'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  idx <= currentStepIndex 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'bg-gray-100'
                }`}>
                  <i className={`${s.icon} text-lg`}></i>
                </div>
                <span className="text-xs font-medium mt-2">{s.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 transition-colors ${
                  idx < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                }`}></div>
              )}
            </div>
          ))}
        </div>

        {step === 'request' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
              <i className="fas fa-envelope text-2xl text-blue-600"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Solicitar Código</h2>
              <p className="text-sm text-gray-500 mt-1">Digite o email do usuário para enviar o código de verificação</p>
            </div>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@email.com"
              className="input text-center"
              onKeyDown={e => e.key === 'Enter' && handleRequestOTP()}
            />
            <button onClick={handleRequestOTP} disabled={loading || !email} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  Enviando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-paper-plane"></i>
                  Enviar Código
                </span>
              )}
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto">
              <i className="fas fa-shield-halved text-2xl text-purple-600"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Verificar Código</h2>
              <p className="text-sm text-gray-500 mt-1">Digite o código de 6 dígitos enviado para <strong>{email}</strong></p>
            </div>
            <input
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="input text-center text-3xl font-mono font-bold tracking-[0.5em]"
              maxLength={6}
              onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
              autoFocus
            />
            <button onClick={handleVerifyOTP} disabled={loading || otp.length !== 6} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  Verificando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-check"></i>
                  Verificar Código
                </span>
              )}
            </button>
            <button onClick={() => { setStep('request'); setOtp(''); }} className="text-sm text-gray-500 hover:text-gray-700">
              <i className="fas fa-arrow-left mr-1"></i>
              Voltar
            </button>
          </div>
        )}

        {step === 'reset' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <i className="fas fa-lock text-2xl text-green-600"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Nova Senha</h2>
              <p className="text-sm text-gray-500 mt-1">Defina a nova senha para <strong>{email}</strong></p>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="input pr-10"
                onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                autoFocus
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {newPassword && newPassword.length < 6 && (
              <p className="text-sm text-red-500">
                <i className="fas fa-circle-exclamation mr-1"></i>
                A senha deve ter pelo menos 6 caracteres
              </p>
            )}
            <button onClick={handleResetPassword} disabled={loading || newPassword.length < 6} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  Redefinindo...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-key"></i>
                  Redefinir Senha
                </span>
              )}
            </button>
          </div>
        )}

        {message && messageType && (
          <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
            messageType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <i className={`fas ${messageType === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default PasswordReset;
