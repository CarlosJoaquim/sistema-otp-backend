import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Sidebar from '../components/Sidebar';
import Overview from '../components/Overview';
import UsersTable from '../components/UsersTable';
import OTPsTable from '../components/OTPsTable';
import PasswordReset from '../components/PasswordReset';
import Logs from '../components/Logs';
import AdminMetrics from '../components/AdminMetrics';
import Register from '../components/Register';
import { getAdminAuth, clearAdminAuth, authHeaders } from '../lib/api';

const LOGO_URL = 'https://caop-b.com/assets/Caop-B-Logo-PNG.png';

export default function Dashboard() {
  const router = useRouter();
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
  const [authenticated, setAuthenticated] = useState(false);
  
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    const auth = getAdminAuth();
    if (!auth) {
      router.replace('/login');
      return;
    }
    setAuthenticated(true);
  }, [router]);

  const fetchWithAuth = useCallback(async (url: string) => {
    const base = API_BASE || window.location.origin;
    return fetch(`${base}${url}`, { headers: authHeaders() });
  }, [API_BASE]);

  const loadOverview = useCallback(async () => {
    try {
      const [usersRes, otpsRes] = await Promise.all([
        fetchWithAuth('/api/users'),
        fetchWithAuth('/api/otps')
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
  }, [fetchWithAuth]);

  useEffect(() => {
    if (authenticated) {
      loadOverview();
    }
  }, [authenticated, loadOverview]);

  useEffect(() => {
    if (!autoRefresh || !authenticated) return;
    
    const interval = setInterval(() => {
      loadOverview();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, authenticated, loadOverview]);

  const handleLogout = () => {
    clearAdminAuth();
    router.replace('/login');
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src={LOGO_URL} alt="CAOP-B" className="h-16 w-auto animate-pulse" />
          <p className="text-sm text-gray-500">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  const sectionLabels: Record<string, string> = {
    'overview': 'Visão Geral',
    'admin-metrics': 'Métricas Avançadas',
    'register': 'Criar Conta',
    'users': 'Usuários',
    'otps': 'OTPs',
    'password-reset': 'Redefinir Senha',
    'logs': 'Logs',
    'admin-users': 'Gestão de Usuários',
    'admin-otps': 'Gestão de OTPs',
    'cleanup': 'Limpeza',
  };

  const renderSection = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <img src={LOGO_URL} alt="CAOP-B" className="h-12 w-auto animate-pulse" />
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
        <title>Dashboard - CAOP-B</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        <Sidebar currentSection={currentSection} onSectionChange={setCurrentSection} />

        <main className="ml-64">
          <header className="bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <img src={LOGO_URL} alt="CAOP-B" className="h-8 w-auto" />
              <div className="h-6 w-px bg-gray-200"></div>
              <h2 className="text-lg font-semibold text-gray-900">
                {sectionLabels[currentSection] || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              {currentSection !== 'register' && (
                <>
                  {lastRefresh && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <i className="fas fa-clock"></i>
                      {lastRefresh.toLocaleTimeString('pt-BR')}
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
              <button
                onClick={handleLogout}
                className="btn-secondary flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <i className="fas fa-right-from-bracket text-xs"></i>
                Sair
              </button>
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
