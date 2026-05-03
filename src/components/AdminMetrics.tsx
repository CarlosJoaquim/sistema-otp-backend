import { FC, useEffect, useState } from 'react';

interface MetricsData {
  metrics: {
    delivery_success_rate: number;
    total_sent: number;
    total_verified: number;
    percentiles: { p50: number; p95: number; p99: number };
    event_distribution: Record<string, number>;
    total_events: number;
    total_successes: number;
    total_failures: number;
    unique_users: number;
  };
  period_hours: number;
}

const AdminMetrics: FC = () => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [period, setPeriod] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    loadMetrics();
  }, [period]);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const base = API_BASE || window.location.origin;
      const res = await fetch(`${base}/api/admin/metrics?period=${period}`);
      if (!res.ok) {
        if (res.status === 401) {
          setError('Não autorizado. Verifique as credenciais de admin.');
          return;
        }
        throw new Error('Erro ao carregar métricas');
      }
      const data = await res.json();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar métricas');
    }
    setLoading(false);
  };

  const periodOptions = [
    { value: 1, label: 'Última Hora' },
    { value: 6, label: 'Últimas 6h' },
    { value: 12, label: 'Últimas 12h' },
    { value: 24, label: 'Últimas 24h' },
    { value: 48, label: 'Últimas 48h' },
    { value: 168, label: 'Últimos 7 dias' },
  ];

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getPercentileColor = (value: number) => {
    if (value < 500) return 'text-green-600';
    if (value < 2000) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Métricas Avançadas</h1>
          <p className="text-sm text-gray-500 mt-1">Performance e análise detalhada do sistema OTP</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="btn-secondary"
          >
            {periodOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button onClick={loadMetrics} disabled={loading} className="btn-secondary flex items-center gap-2">
            <i className={`fas fa-arrows-rotate text-xs ${loading ? 'fa-spin' : ''}`}></i>
            Atualizar
          </button>
        </div>
      </div>

      {error ? (
        <div className="card border-red-200 bg-red-50">
          <div className="flex items-center gap-3 text-red-700">
            <i className="fas fa-circle-xmark text-lg"></i>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <i className="fas fa-spinner fa-spin text-3xl text-gray-300"></i>
            <p className="text-sm text-gray-500">Carregando métricas...</p>
          </div>
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                  <i className="fas fa-paper-plane text-blue-600"></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-700 mt-4">{metrics.metrics.total_sent}</p>
              <p className="text-sm text-gray-500 mt-1">OTPs Enviados</p>
            </div>

            <div className="card">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <i className="fas fa-circle-check text-green-600"></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-green-700 mt-4">{metrics.metrics.total_verified}</p>
              <p className="text-sm text-gray-500 mt-1">Verificações com Sucesso</p>
            </div>

            <div className="card">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <i className="fas fa-percent text-emerald-600"></i>
                </div>
              </div>
              <p className={`text-2xl font-bold mt-4 ${
                metrics.metrics.delivery_success_rate >= 95 ? 'text-green-700' : 
                metrics.metrics.delivery_success_rate >= 80 ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {metrics.metrics.delivery_success_rate.toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500 mt-1">Taxa de Sucesso</p>
            </div>

            <div className="card">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                  <i className="fas fa-users text-purple-600"></i>
                </div>
              </div>
              <p className="text-2xl font-bold text-purple-700 mt-4">{metrics.metrics.unique_users}</p>
              <p className="text-sm text-gray-500 mt-1">Usuários Únicos</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              <i className="fas fa-gauge-high text-blue-600 mr-2"></i>
              Percentis de Tempo de Verificação
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className={`text-3xl font-bold ${getPercentileColor(metrics.metrics.percentiles.p50)}`}>
                  {formatTime(metrics.metrics.percentiles.p50)}
                </p>
                <p className="text-sm text-gray-500 mt-1 font-medium">P50 (Mediana)</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className={`text-3xl font-bold ${getPercentileColor(metrics.metrics.percentiles.p95)}`}>
                  {formatTime(metrics.metrics.percentiles.p95)}
                </p>
                <p className="text-sm text-gray-500 mt-1 font-medium">P95</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className={`text-3xl font-bold ${getPercentileColor(metrics.metrics.percentiles.p99)}`}>
                  {formatTime(metrics.metrics.percentiles.p99)}
                </p>
                <p className="text-sm text-gray-500 mt-1 font-medium">P99</p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                <i className="fas fa-info-circle mr-1"></i>
                <strong>P50:</strong> 50% das verificações foram concluídas em {formatTime(metrics.metrics.percentiles.p50)} ou menos.{' '}
                <strong>P99:</strong> 99% das verificações foram concluídas em {formatTime(metrics.metrics.percentiles.p99)} ou menos.
              </p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              <i className="fas fa-chart-pie text-purple-600 mr-2"></i>
              Distribuição por Tipo de Evento
            </h3>
            {Object.keys(metrics.metrics.event_distribution).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">Nenhum evento registrado no período</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(metrics.metrics.event_distribution)
                  .sort(([, a], [, b]) => b - a)
                  .map(([event, count]) => {
                    const total = metrics.metrics.total_events;
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    const eventLabels: Record<string, { label: string; color: string }> = {
                      otp_sent: { label: 'OTP Enviado', color: 'bg-blue-500' },
                      otp_verified: { label: 'OTP Verificado', color: 'bg-green-500' },
                      otp_failed: { label: 'OTP Falhou', color: 'bg-red-500' },
                      email_verification_sent: { label: 'Verificação de Email', color: 'bg-purple-500' },
                      user_registered: { label: 'Usuário Registrado', color: 'bg-yellow-500' },
                      password_reset_requested: { label: 'Reset de Senha', color: 'bg-orange-500' },
                    };
                    const config = eventLabels[event] || { label: event, color: 'bg-gray-500' };
                    return (
                      <div key={event} className="flex items-center gap-4">
                        <span className="text-sm text-gray-600 w-48">{config.label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-3">
                          <div
                            className={`${config.color} h-3 rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-20 text-right">{count}</span>
                        <span className="text-sm text-gray-500 w-14 text-right">{percentage.toFixed(1)}%</span>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                <i className="fas fa-chart-bar text-green-600 mr-2"></i>
                Resumo de Performance
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Total de Eventos</span>
                  <span className="text-sm font-bold text-gray-900">{metrics.metrics.total_events}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Sucessos</span>
                  <span className="text-sm font-bold text-green-600">{metrics.metrics.total_successes}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Falhas</span>
                  <span className="text-sm font-bold text-red-600">{metrics.metrics.total_failures}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">Taxa de Sucesso</span>
                  <span className={`text-sm font-bold ${
                    metrics.metrics.delivery_success_rate >= 95 ? 'text-green-600' : 
                    metrics.metrics.delivery_success_rate >= 80 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {metrics.metrics.delivery_success_rate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                <i className="fas fa-lightbulb text-yellow-600 mr-2"></i>
                Recomendações
              </h3>
              <div className="space-y-3">
                {metrics.metrics.delivery_success_rate < 95 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <i className="fas fa-triangle-exclamation text-yellow-600 mt-0.5"></i>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Taxa de sucesso abaixo de 95%</p>
                      <p className="text-xs text-yellow-600 mt-1">Considere revisar o processo de envio de OTPs</p>
                    </div>
                  </div>
                )}
                {metrics.metrics.percentiles.p99 > 5000 && (
                  <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <i className="fas fa-clock text-red-600 mt-0.5"></i>
                    <div>
                      <p className="text-sm font-medium text-red-800">P99 acima de 5 segundos</p>
                      <p className="text-xs text-red-600 mt-1">Verifique a latência do banco de dados</p>
                    </div>
                  </div>
                )}
                {metrics.metrics.delivery_success_rate >= 95 && metrics.metrics.percentiles.p99 <= 5000 && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <i className="fas fa-circle-check text-green-600 mt-0.5"></i>
                    <div>
                      <p className="text-sm font-medium text-green-800">Sistema operando dentro dos parâmetros</p>
                      <p className="text-xs text-green-600 mt-1">Taxa de sucesso e latência estão adequados</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default AdminMetrics;
