import { FC, useEffect, useState } from 'react';

interface OverviewProps {
  stats: {
    totalUsers: number;
    totalOtps: number;
    verifiedOtps: number;
    expiredOtps: number;
    pendingOtps: number;
    failedOtps: number;
  };
}

const Overview: FC<OverviewProps> = ({ stats }) => {
  const [systemStatus, setSystemStatus] = useState<{ supabase: string; websocket: string } | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const base = API_BASE || window.location.origin;
      const res = await fetch(`${base}/api/status`);
      const data = await res.json();
      setSystemStatus({ supabase: data.supabase, websocket: data.websocket });
    } catch (error) {
      console.error(error);
    }
  };

  const verificationRate = stats.totalOtps > 0 
    ? Math.round((stats.verifiedOtps / stats.totalOtps) * 100) 
    : 0;

  const mainCards = [
    {
      title: 'Total de Usuários',
      value: stats.totalUsers,
      icon: 'fas fa-users',
      color: 'blue',
      change: '+12%',
      changeType: 'positive' as const,
    },
    {
      title: 'OTPs Gerados',
      value: stats.totalOtps,
      icon: 'fas fa-shield-halved',
      color: 'purple',
      change: '+8%',
      changeType: 'positive' as const,
    },
    {
      title: 'OTPs Verificados',
      value: stats.verifiedOtps,
      icon: 'fas fa-circle-check',
      color: 'green',
      change: `${verificationRate}%`,
      changeType: 'info' as const,
    },
    {
      title: 'Taxa de Sucesso',
      value: `${verificationRate}%`,
      icon: 'fas fa-chart-line',
      color: 'emerald',
      change: verificationRate > 80 ? 'Ótimo' : 'Atenção',
      changeType: verificationRate > 80 ? 'positive' : 'warning',
    },
  ];

  const secondaryCards = [
    {
      title: 'Pendentes',
      value: stats.pendingOtps,
      icon: 'fas fa-clock',
      color: 'yellow',
    },
    {
      title: 'Expirados',
      value: stats.expiredOtps,
      icon: 'fas fa-hourglass-end',
      color: 'orange',
    },
    {
      title: 'Falharam',
      value: stats.failedOtps,
      icon: 'fas fa-circle-xmark',
      color: 'red',
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string; text: string; ring: string }> = {
      blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-700', ring: 'ring-blue-100' },
      purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-700', ring: 'ring-purple-100' },
      green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-700', ring: 'ring-green-100' },
      emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700', ring: 'ring-emerald-100' },
      yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', text: 'text-yellow-700', ring: 'ring-yellow-100' },
      orange: { bg: 'bg-orange-50', icon: 'text-orange-600', text: 'text-orange-700', ring: 'ring-orange-100' },
      red: { bg: 'bg-red-50', icon: 'text-red-600', text: 'text-red-700', ring: 'ring-red-100' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
          <p className="text-sm text-gray-500 mt-1">Métricas e status do sistema em tempo real</p>
        </div>
        <button
          onClick={checkSystemStatus}
          className="btn-secondary flex items-center gap-2"
        >
          <i className="fas fa-arrows-rotate text-xs"></i>
          Atualizar
        </button>
      </div>

      {systemStatus && (
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            systemStatus.supabase === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${systemStatus.supabase === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            Supabase: {systemStatus.supabase}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            systemStatus.websocket === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full ${systemStatus.websocket === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            WebSocket: {systemStatus.websocket}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((card, idx) => {
          const colorClasses = getColorClasses(card.color);
          return (
            <div key={idx} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 ${colorClasses.bg} rounded-lg flex items-center justify-center`}>
                  <i className={`${card.icon} ${colorClasses.icon}`}></i>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  card.changeType === 'positive' ? 'bg-green-100 text-green-700' :
                  card.changeType === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {card.change}
                </span>
              </div>
              <div className="mt-4">
                <p className={`text-2xl font-bold ${colorClasses.text}`}>{card.value}</p>
                <p className="text-sm text-gray-500 mt-1">{card.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {secondaryCards.map((card, idx) => {
          const colorClasses = getColorClasses(card.color);
          return (
            <div key={idx} className="card">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${colorClasses.bg} rounded-lg flex items-center justify-center`}>
                  <i className={`${card.icon} ${colorClasses.icon}`}></i>
                </div>
                <div>
                  <p className={`text-xl font-bold ${colorClasses.text}`}>{card.value}</p>
                  <p className="text-sm text-gray-500">{card.title}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribuição de OTPs</h3>
        <div className="space-y-3">
          {[
            { label: 'Verificados', value: stats.verifiedOtps, total: stats.totalOtps, color: 'bg-green-500' },
            { label: 'Pendentes', value: stats.pendingOtps, total: stats.totalOtps, color: 'bg-yellow-500' },
            { label: 'Expirados', value: stats.expiredOtps, total: stats.totalOtps, color: 'bg-orange-500' },
            { label: 'Falharam', value: stats.failedOtps, total: stats.totalOtps, color: 'bg-red-500' },
          ].map((item, idx) => {
            const percentage = item.total > 0 ? (item.value / item.total) * 100 : 0;
            return (
              <div key={idx} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-24">{item.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div
                    className={`${item.color} h-2.5 rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-900 w-16 text-right">{item.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Overview;
