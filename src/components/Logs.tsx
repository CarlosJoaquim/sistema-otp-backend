import { FC, useEffect, useState } from 'react';

interface Log {
  type: string;
  message: string;
  time: string;
  icon: string;
  event_type?: string;
  status?: string;
  correlation_id?: string;
  email?: string;
  metadata?: Record<string, any>;
}

const Logs: FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const base = API_BASE || window.location.origin;
      const res = await fetch(`${base}/api/logs`);
      const data = await res.json();
      setLogs(data.data || []);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const getLogColor = (log: Log) => {
    if (log.status === 'success' || log.type === 'user') return 'green';
    if (log.status === 'failure' || log.message.toLowerCase().includes('falh') || log.message.toLowerCase().includes('error')) return 'red';
    if (log.type === 'otp' && log.message.includes('verificado')) return 'green';
    if (log.type === 'otp' && log.message.includes('gerado')) return 'blue';
    return 'gray';
  };

  const filteredLogs = typeFilter === 'all' 
    ? logs 
    : logs.filter(log => log.type === typeFilter);

  const typeOptions = [
    { value: 'all', label: 'Todos os Tipos' },
    { value: 'otp', label: 'OTPs' },
    { value: 'user', label: 'Usuários' },
  ];

  const getLogIcon = (log: Log) => {
    if (log.status === 'failure') return { icon: 'fas fa-circle-xmark', bg: 'bg-red-100', color: 'text-red-600' };
    if (log.status === 'success') return { icon: 'fas fa-circle-check', bg: 'bg-green-100', color: 'text-green-600' };
    if (log.type === 'user') return { icon: 'fas fa-user-plus', bg: 'bg-blue-100', color: 'text-blue-600' };
    if (log.message.includes('verificado')) return { icon: 'fas fa-circle-check', bg: 'bg-green-100', color: 'text-green-600' };
    if (log.message.includes('gerado')) return { icon: 'fas fa-key', bg: 'bg-purple-100', color: 'text-purple-600' };
    return { icon: 'fas fa-info-circle', bg: 'bg-gray-100', color: 'text-gray-600' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs do Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">Histórico de atividades e eventos do sistema</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="btn-secondary"
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button onClick={loadLogs} className="btn-secondary flex items-center gap-2">
            <i className="fas fa-arrows-rotate text-xs"></i>
            Atualizar
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <i className="fas fa-spinner fa-spin text-3xl text-gray-300"></i>
              <p className="text-sm text-gray-500">Carregando logs...</p>
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <i className="fas fa-inbox text-3xl text-gray-300"></i>
              <p className="text-sm text-gray-500">Nenhum log encontrado</p>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200"></div>
            <div className="space-y-0">
              {filteredLogs.map((log, idx) => {
                const logStyle = getLogIcon(log);
                return (
                  <div key={idx} className="relative flex gap-4 py-3">
                    <div className={`relative z-10 w-10 h-10 ${logStyle.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <i className={`${logStyle.icon} ${logStyle.color} text-sm`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 font-medium">{log.message}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">
                          <i className="fas fa-clock mr-1"></i>
                          {new Date(log.time).toLocaleString('pt-BR')}
                        </span>
                        {log.correlation_id && (
                          <span className="text-xs text-gray-400 font-mono">
                            ID: {log.correlation_id.slice(0, 8)}...
                          </span>
                        )}
                        {log.status && (
                          <span className={`badge ${
                            log.status === 'success' ? 'badge-success' : 
                            log.status === 'failure' ? 'badge-danger' : 'badge-gray'
                          }`}>
                            {log.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Logs;
