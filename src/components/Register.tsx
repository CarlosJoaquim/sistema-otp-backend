import { FC, useState } from 'react';

const Register: FC = () => {
  const [step, setStep] = useState<'form' | 'verify' | 'success'>('form');
  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    email: '',
    telefone: '',
    senha: '',
    confirmarSenha: '',
  });
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const showMessage = (msg: string, type: 'success' | 'error') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => { setMessage(''); setMessageType(null); }, 5000);
  };

  const validateForm = () => {
    if (!formData.nome || !formData.email || !formData.senha) {
      showMessage('Nome, email e senha são obrigatórios', 'error');
      return false;
    }
    if (formData.senha.length < 6) {
      showMessage('A senha deve ter pelo menos 6 caracteres', 'error');
      return false;
    }
    if (formData.senha !== formData.confirmarSenha) {
      showMessage('As senhas não coincidem', 'error');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      showMessage('Email inválido', 'error');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          sobrenome: formData.sobrenome || '',
          email: formData.email,
          telefone: formData.telefone || null,
          senha: formData.senha,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Conta criada! Verifique seu email para o código de confirmação.', 'success');
        setStep('verify');
      } else {
        showMessage(data.message || 'Erro ao criar conta', 'error');
      }
    } catch (err: any) {
      showMessage('Erro ao conectar com o servidor', 'error');
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, code: otp }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Email verificado com sucesso!', 'success');
        setStep('success');
      } else {
        showMessage(data.message || 'Código inválido', 'error');
      }
    } catch (err: any) {
      showMessage('Erro ao verificar código', 'error');
    }
    setLoading(false);
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          sobrenome: formData.sobrenome || '',
          email: formData.email,
          telefone: formData.telefone || null,
          senha: formData.senha,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('Novo código enviado!', 'success');
      } else {
        showMessage(data.message || 'Erro ao reenviar', 'error');
      }
    } catch (err: any) {
      showMessage('Erro ao reenviar código', 'error');
    }
    setLoading(false);
  };

  const steps = [
    { id: 'form', label: 'Dados', icon: 'fas fa-user-plus' },
    { id: 'verify', label: 'Verificar', icon: 'fas fa-shield-halved' },
    { id: 'success', label: 'Concluído', icon: 'fas fa-circle-check' },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  const passwordStrength = () => {
    const pwd = formData.senha;
    if (pwd.length === 0) return { level: 0, label: '', color: 'bg-gray-200' };
    if (pwd.length < 6) return { level: 1, label: 'Fraca', color: 'bg-red-500' };
    if (pwd.length < 8) return { level: 2, label: 'Média', color: 'bg-yellow-500' };
    if (/(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/.test(pwd)) return { level: 4, label: 'Forte', color: 'bg-green-500' };
    return { level: 3, label: 'Boa', color: 'bg-blue-500' };
  };

  const strength = passwordStrength();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Criar Conta</h1>
        <p className="text-sm text-gray-500 mt-1">Registre-se e verifique seu email com código OTP</p>
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

        {step === 'form' && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
              <i className="fas fa-user-plus text-2xl text-blue-600"></i>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900">Dados da Conta</h2>
              <p className="text-sm text-gray-500 mt-1">Preencha seus dados para criar a conta</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Nome *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Seu nome"
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Sobrenome</label>
                <input
                  type="text"
                  value={formData.sobrenome}
                  onChange={e => setFormData({ ...formData, sobrenome: e.target.value })}
                  placeholder="Sobrenome"
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="seu@email.com"
                className="input"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Telefone</label>
              <input
                type="tel"
                value={formData.telefone}
                onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="+244 9XX XXX XXX"
                className="input"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Senha *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.senha}
                  onChange={e => setFormData({ ...formData, senha: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="input pr-10"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              {formData.senha && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">Força da senha:</span>
                    <span className="text-xs font-medium text-gray-700">{strength.label}</span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} rounded-full transition-all duration-300`}
                      style={{ width: `${(strength.level / 4) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Confirmar Senha *</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmarSenha}
                  onChange={e => setFormData({ ...formData, confirmarSenha: e.target.value })}
                  placeholder="Repita a senha"
                  className="input pr-10"
                />
                <button
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              {formData.confirmarSenha && formData.senha !== formData.confirmarSenha && (
                <p className="text-xs text-red-500 mt-1">
                  <i className="fas fa-circle-exclamation mr-1"></i>
                  As senhas não coincidem
                </p>
              )}
            </div>

            <button onClick={handleRegister} disabled={loading} className="btn-primary w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  Criando conta...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="fas fa-user-plus"></i>
                  Criar Conta
                </span>
              )}
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto">
              <i className="fas fa-envelope text-2xl text-purple-600"></i>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Verificar Email</h2>
              <p className="text-sm text-gray-500 mt-1">
                Digite o código de 6 dígitos enviado para <strong>{formData.email}</strong>
              </p>
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
            <button onClick={handleResendOTP} disabled={loading} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              <i className="fas fa-arrows-rotate mr-1"></i>
              Reenviar Código
            </button>
            <div>
              <button onClick={() => setStep('form')} className="text-sm text-gray-500 hover:text-gray-700">
                <i className="fas fa-arrow-left mr-1"></i>
                Voltar
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center space-y-4 py-4">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <i className="fas fa-circle-check text-4xl text-green-600"></i>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Conta Criada!</h2>
              <p className="text-sm text-gray-500 mt-1">
                Seu email <strong>{formData.email}</strong> foi verificado com sucesso
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Agora você pode fazer login no sistema
              </p>
            </div>
            <button
              onClick={() => {
                setStep('form');
                setFormData({ nome: '', sobrenome: '', email: '', telefone: '', senha: '', confirmarSenha: '' });
                setOtp('');
              }}
              className="btn-primary"
            >
              <i className="fas fa-plus mr-2"></i>
              Criar Outra Conta
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

export default Register;
