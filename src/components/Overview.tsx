import { FC, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

const LOGO_URL = 'https://caop-b.com/assets/Caop-B-Logo-PNG.png';

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

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const res = await apiFetch('/api/status');
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
    },
    {
      title: 'OTPs Gerados',
      value: stats.totalOtps,
      icon: 'fas fa-shield-halved',
      color: 'purple',
    },
    {
      title: 'OTPs Verificados',
      value: stats.verifiedOtps,
      icon: 'fas fa-circle-check',
      color: 'green',
    },
    {
      title: 'Taxa de Sucesso',
      value: `${verificationRate}%`,
      icon: 'fas fa-chart-line',
      color: 'emerald',
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
    const colors: Record<string, { bg: string; icon: string; text: string }> = {
      blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-700' },
      purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-700' },
      green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-700' },
      emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-700' },
      yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', text: 'text-yellow-700' },
      orange: { bg: 'bg-orange-50', icon: 'text-orange-600', text: 'text-orange-700' },
      red: { bg: 'bg-red-50', icon: 'text-red-600', text: 'text-red-700' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={LOGO_URL} alt="CAOP-B" className="h-10 w-auto" />
          <div className="h-8 w-px bg-gray-200"></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
            <p className="text-sm text-gray-500 mt-0.5">Métricas e status do sistema em tempo real</p>
          </div>
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
        <div className="flex items-center gap-3">
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
            <div key={idx} className={`stat-card stat-card-${card.color}`}>
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 ${colorClasses.bg} rounded-lg flex items-center justify-center`}>
                  <i className={`${card.icon} ${colorClasses.icon}`}></i>
                </div>
              </div>
              <div className="mt-4">
                <p className={`text-3xl font-bold ${colorClasses.text}`}>{card.value}</p>
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
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${colorClasses.bg} rounded-xl flex items-center justify-center`}>
                  <i className={`${card.icon} ${colorClasses.icon} text-lg`}></i>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${colorClasses.text}`}>{card.value}</p>
                  <p className="text-sm text-gray-500">{card.title}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-gray-900">
            <i className="fas fa-chart-bar text-blue-600 mr-2"></i>
            Distribuição de OTPs
          </h3>
          <span className="text-xs text-gray-500">{stats.totalOtps} total</span>
        </div>
        <div className="space-y-4">
          {[
            { label: 'Verificados', value: stats.verifiedOtps, total: stats.totalOtps, color: 'bg-green-500', icon: 'fa-circle-check' },
            { label: 'Pendentes', value: stats.pendingOtps, total: stats.totalOtps, color: 'bg-yellow-500', icon: 'fa-clock' },
            { label: 'Expirados', value: stats.expiredOtps, total: stats.totalOtps, color: 'bg-orange-500', icon: 'fa-hourglass-end' },
            { label: 'Falharam', value: stats.failedOtps, total: stats.totalOtps, color: 'bg-red-500', icon: 'fa-circle-xmark' },
          ].map((item, idx) => {
            const percentage = item.total > 0 ? (item.value / item.total) * 100 : 0;
            return (
              <div key={idx} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-24 flex items-center gap-2">
                  <i className={`fas ${item.icon} text-gray-400`}></i>
                  {item.label}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${item.color} h-3 rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-12 text-right">{item.value}</span>
                <span className="text-xs text-gray-400 w-14 text-right">{percentage.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>

        {stats.totalOtps > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
              {stats.verifiedOtps > 0 && (
                <div
                  className="bg-green-500 transition-all duration-500"
                  style={{ width: `${(stats.verifiedOtps / stats.totalOtps) * 100}%` }}
                  title={`Verificados: ${stats.verifiedOtps}`}
                ></div>
              )}
              {stats.pendingOtps > 0 && (
                <div
                  className="bg-yellow-500 transition-all duration-500"
                  style={{ width: `${(stats.pendingOtps / stats.totalOtps) * 100}%` }}
                  title={`Pendentes: ${stats.pendingOtps}`}
                ></div>
              )}
              {stats.expiredOtps > 0 && (
                <div
                  className="bg-orange-500 transition-all duration-500"
                  style={{ width: `${(stats.expiredOtps / stats.totalOtps) * 100}%` }}
                  title={`Expirados: ${stats.expiredOtps}`}
                ></div>
              )}
              {stats.failedOtps > 0 && (
                <div
                  className="bg-red-500 transition-all duration-500"
                  style={{ width: `${(stats.failedOtps / stats.totalOtps) * 100}%` }}
                  title={`Falharam: ${stats.failedOtps}`}
                ></div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                Verificados
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                Pendentes
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                Expirados
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                Falharam
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Overview;
