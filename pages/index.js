import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [otps, setOtps] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, activeOtps: 0 });
  const [backendStatus, setBackendStatus] = useState('checking');

  const API_URL = ''; // Same domain
  const AUTH = 'Basic ' + btoa((process.env.NEXT_PUBLIC_ADMIN_USER || 'admin') + ':' + (process.env.NEXT_PUBLIC_ADMIN_PASS || 'admin123'));

  useEffect(() => {
    checkBackendStatus();
    loadData();
  }, []);

  const checkBackendStatus = async () => {
    try {
      const res = await fetch(API_URL + '/api/otp/send-code', { method: 'HEAD' });
      setBackendStatus(res.ok || res.status === 400 ? 'online' : 'offline');
    } catch {
      setBackendStatus('offline');
    }
  };

  const loadData = async () => {
    try {
      const headers = { Authorization: AUTH };
      
      const [usersRes, otpsRes, statsRes] = await Promise.all([
        fetch(API_URL + '/api/admin/users', { headers }),
        fetch(API_URL + '/api/admin/otps', { headers }),
        fetch(API_URL + '/api/admin/stats', { headers })
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      }

      if (otpsRes.ok) {
        const otpsData = await otpsRes.json();
        setOtps(otpsData.otps || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  const handleSendCode = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL + '/api/otp/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      setMessage(data.message || (data.success ? 'Código enviado!' : 'Erro ao enviar'));
    } catch (err) {
      setMessage('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL + '/api/otp/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      });
      const data = await res.json();
      setMessage(data.message || (data.success ? 'Código verificado!' : 'Código inválido'));
    } catch (err) {
      setMessage('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL + '/api/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, newPassword })
      });
      const data = await res.json();
      setMessage(data.message || (data.success ? 'Senha redefinida!' : 'Erro ao redefinir'));
      if (data.success) loadData();
    } catch (err) {
      setMessage('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>SMS OTP - Gestão de Senhas</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>
      
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">🔐 SMS OTP Admin</h1>
              <div className="flex items-center space-x-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  backendStatus === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {backendStatus === 'online' ? '🟢 Online' : '🔴 Offline'}
                </span>
                <span className="text-sm text-gray-500">Backend: {API_URL}</span>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Usuários</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.totalUsers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">OTPs Ativos</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.activeOtps}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 text-green-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p className="text-2xl font-semibold text-gray-900">OK</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Gestão de Senhas</h2>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">1. Enviar Código OTP</h3>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      placeholder="Número de telefone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
                    />
                    <button
                      onClick={handleSendCode}
                      disabled={loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">2. Verificar Código</h3>
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      placeholder="Código de 6 dígitos"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2"
                    />
                    <button
                      onClick={handleVerifyCode}
                      disabled={loading}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading ? 'Verificando...' : 'Verificar'}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">3. Redefinir Senha</h3>
                  <div className="space-y-3">
                    <input
                      type="password"
                      placeholder="Nova senha"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 p-2"
                    />
                    <button
                      onClick={handleResetPassword}
                      disabled={loading}
                      className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {loading ? 'Redefinindo...' : 'Redefinir Senha'}
                    </button>
                  </div>
                </div>

                {message && (
                  <div className="p-4 rounded-md bg-blue-50 text-blue-700">
                    {message}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Usuários Registados ({users.length})</h2>
                </div>
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {users.length > 0 ? users.map((user, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2">{user.nome} {user.sobrenome || ''}</td>
                            <td className="px-4 py-2">{user.telefone || 'N/A'}</td>
                            <td className="px-4 py-2">{user.email}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="3" className="px-4 py-2 text-center text-gray-500">Nenhum usuário encontrado</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-medium text-gray-900">Status do Sistema</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Backend API</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        backendStatus === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {backendStatus === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Banco Supabase</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        Conectado ({stats.totalUsers} usuários)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">SMSHub Angola</span>
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                        Pendente (ID: 715)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
