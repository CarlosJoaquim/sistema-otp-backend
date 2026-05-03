import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const LOGO_URL = 'https://caop-b.com/assets/Caop-B-Logo-PNG.png';

  useEffect(() => {
    const stored = sessionStorage.getItem('adminAuth');
    if (stored) {
      window.location.href = '/';
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const credentials = btoa(`${username}:${password}`);

    try {
      const response = await fetch('/api/admin/metrics?period=1', {
        headers: {
          'Authorization': `Basic ${credentials}`,
        },
      });

      if (response.ok) {
        sessionStorage.setItem('adminAuth', credentials);
        window.location.href = '/';
      } else {
        const data = await response.json();
        setError(data.message || 'Credenciais inválidas');
      }
    } catch {
      setError('Erro ao conectar com o servidor');
    }

    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>Login Admin - CAOP-B</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl"></div>
        </div>

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="mb-6">
              <img
                src={LOGO_URL}
                alt="CAOP-B"
                className="h-20 w-auto mx-auto drop-shadow-2xl"
              />
            </div>
            <h1 className="text-3xl font-bold text-white">Painel Administrativo</h1>
            <p className="text-gray-400 mt-2">Sistema de Autenticação CAOP-B</p>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-white/10">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
                <i className="fas fa-lock text-2xl text-white"></i>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Acesso Restrito</h2>
              <p className="text-sm text-gray-500 mt-1">Digite suas credenciais para acessar o painel</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Usuário</label>
                <div className="relative">
                  <i className="fas fa-user absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    className="input pl-10"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Senha</label>
                <div className="relative">
                  <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    className="input pl-10 pr-10"
                    onKeyDown={e => e.key === 'Enter' && handleLogin(e)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <i className="fas fa-circle-xmark"></i>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || !username || !password} className="btn-primary w-full">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <i className="fas fa-spinner fa-spin"></i>
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <i className="fas fa-right-to-bracket"></i>
                    Entrar
                  </span>
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 text-center">
            <img
              src={LOGO_URL}
              alt="CAOP-B"
              className="h-8 w-auto mx-auto opacity-30"
            />
          </div>

          <p className="text-center text-xs text-gray-500 mt-4">
            <i className="fas fa-shield-halved mr-1"></i>
            Acesso restrito a administradores autorizados
          </p>
        </div>
      </div>
    </>
  );
}
