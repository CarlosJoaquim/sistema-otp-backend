import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Sidebar from '../components/Sidebar';
import Overview from '../components/Overview';
import UsersTable from '../components/UsersTable';
import OTPsTable from '../components/OTPsTable';
import PasswordReset from '../components/PasswordReset';
import Logs from '../components/Logs';
import AdminMetrics from '../components/AdminMetrics';
import Register from '../components/Register';

export default function Dashboard() {
  const [currentSection, setCurrentSection] = useState('overview');
  const [users, setUsers] = useState<any[]>([]);
  const [otps, setOtps] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOtps: 0,
    verifiedOtps: 0,
    expiredOtps: 0,
    pendingOtps: 0,
    failedOtps: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

  const loadOverview = useCallback(async () => {
    try {
      const base = API_BASE || window.location.origin;
      const [usersRes, otpsRes] = await Promise.all([
        fetch(`${base}/api/users`),
        fetch(`${base}/api/otps`)
      ]);
      
      const usersData = await usersRes.json();
      const otpsData = await otpsRes.json();
      
      const usersList = usersData.data || [];
      const otpsList = otpsData.data || [];
      
      const now = new Date();
      const expiredCount = otpsList.filter((o: any) => 
        !o.verified && o.expires_at && new Date(o.expires_at) < now
      ).length;
      const pendingCount = otpsList.filter((o: any) => 
        !o.verified && o.expires_at && new Date(o.expires_at) >= now && (!o.attempts || o.attempts < 3)
      ).length;
      const failedCount = otpsList.filter((o: any) => 
        o.attempts && o.attempts >= 3
      ).length;
      
      setUsers(usersList);
      setOtps(otpsList);
      setStats({
        totalUsers: usersList.length,
        totalOtps: otpsList.length,
        verifiedOtps: otpsList.filter((o: any) => o.verified).length,
        expiredOtps: expiredCount,
        pendingOtps: pendingCount,
        failedOtps: failedCount,
      });
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
    setLoading(false);
  }, [API_BASE]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadOverview();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, loadOverview]);

  const renderSection = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <i className="fas fa-spinner fa-spin text-3xl text-gray-300"></i>
            <p className="text-sm text-gray-500">Carregando...</p>
          </div>
        </div>
      );
    }

    switch (currentSection) {
      case 'overview':
        return <Overview stats={stats} />;
      case 'register':
        return <Register />;
      case 'users':
        return <UsersTable users={users} />;
      case 'otps':
        return <OTPsTable otps={otps} />;
      case 'password-reset':
        return <PasswordReset />;
      case 'logs':
        return <Logs />;
      case 'admin-metrics':
        return <AdminMetrics />;
      default:
        return <Overview stats={stats} />;
    }
  };

  return (
    <>
      <Head>
        <title>OTP CAOP-B | Dashboard</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        <Sidebar currentSection={currentSection} onSectionChange={setCurrentSection} />

        <main className="ml-64">
          <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900 capitalize">
                {currentSection === 'overview' && 'Visão Geral'}
                {currentSection === 'admin-metrics' && 'Métricas Avançadas'}
                {currentSection === 'register' && 'Criar Conta'}
                {currentSection === 'users' && 'Usuários'}
                {currentSection === 'otps' && 'OTPs'}
                {currentSection === 'password-reset' && 'Redefinir Senha'}
                {currentSection === 'logs' && 'Logs'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              {currentSection !== 'register' && (
                <>
                  {lastRefresh && (
                    <span className="text-xs text-gray-500">
                      <i className="fas fa-clock mr-1"></i>
                      Atualizado às {lastRefresh.toLocaleTimeString('pt-BR')}
                    </span>
                  )}
                  <button
                    onClick={loadOverview}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <i className="fas fa-arrows-rotate text-xs"></i>
                    Atualizar
                  </button>
                  <button
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      autoRefresh 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    Auto: {autoRefresh ? 'On' : 'Off'}
                  </button>
                </>
              )}
            </div>
          </header>

          <div className="p-8">
            {renderSection()}
          </div>
        </main>
      </div>
    </>
  );
}
