import { FC, useState, useMemo, useEffect, useCallback } from 'react';
import { authHeaders } from '../lib/api';
import supabase from '../lib/supabase';

interface ErrorReport {
  id: string;
  correlation_id: string;
  error_name: string;
  error_message: string;
  stack_trace: string;
  user_id: string;
  screen_name: string;
  app_version: string;
  device_info: string;
  status: string;
  created_at: string;
}

const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

const statusColors: Record<string, string> = {
  pending: 'badge-warning',
  resolved: 'badge-success',
  investigating: 'badge-info',
  ignored: 'badge-gray',
};

const ErrorReportsTable: FC = () => {
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [errorFilter, setErrorFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const itemsPerPage = 15;

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('error_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar relatórios de erros:', error);
    }
    setLoading(false);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, { headers: authHeaders() });
      const data = await res.json();
      if (data.data) setUsers(data.data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    fetchUsers();
  }, [fetchReports, fetchUsers]);

  const errorNames = useMemo(() => {
    const names = new Set(reports.map(r => r.error_name));
    return ['todos', ...Array.from(names)];
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const matchesSearch =
        (report.error_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.error_message || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.screen_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.correlation_id || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'todos' || report.status === statusFilter;
      const matchesError = errorFilter === 'todos' || report.error_name === errorFilter;

      return matchesSearch && matchesStatus && matchesError;
    });
  }, [reports, searchTerm, statusFilter, errorFilter]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const updateReportStatus = async (reportId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('error_reports')
        .update({ status: newStatus })
        .eq('id', reportId);

      if (error) throw error;
      fetchReports();
      if (selectedReport?.id === reportId) {
        setSelectedReport({ ...selectedReport, status: newStatus });
      }
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
    }
    setUpdatingStatus(false);
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user ? user.nome : 'Desconhecido';
  };

  const stats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    investigating: reports.filter(r => r.status === 'investigating').length,
    critical: reports.filter(r => r.error_name?.includes('Fatal') || r.error_name?.includes('Critical')).length,
  }), [reports]);

  const statusOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'investigating', label: 'Investigando' },
    { value: 'resolved', label: 'Resolvidos' },
    { value: 'ignored', label: 'Ignorados' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <i className="fas fa-spinner fa-spin text-3xl text-blue-600"></i>
          <p className="text-sm text-gray-500">Carregando relatórios de erros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios de Erros</h1>
          <p className="text-sm text-gray-500 mt-1">Monitorize e gerencie os erros reportados pelo app</p>
        </div>
        <button onClick={fetchReports} className="btn-secondary flex items-center gap-2">
          <i className="fas fa-arrows-rotate text-xs"></i>
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card py-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total de Erros</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-gray-500">Pendentes</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-blue-600">{stats.investigating}</p>
          <p className="text-xs text-gray-500">Investigando</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
          <p className="text-xs text-gray-500">Resolvidos</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
          <p className="text-xs text-gray-500">Críticos</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Buscar por erro, tela ou ID..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="input pl-10"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="btn-secondary"
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={errorFilter}
            onChange={(e) => { setErrorFilter(e.target.value); setCurrentPage(1); }}
            className="btn-secondary"
          >
            {errorNames.map(name => (
              <option key={name} value={name}>{name === 'todos' ? 'Todos os Erros' : name}</option>
            ))}
          </select>
          {(searchTerm || statusFilter !== 'todos' || errorFilter !== 'todos') && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter('todos'); setErrorFilter('todos'); setCurrentPage(1); }}
              className="btn-secondary"
            >
              <i className="fas fa-xmark mr-1"></i>
              Limpar
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Erro</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tela</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Versão</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    <i className="fas fa-bug-slash text-3xl mb-3 block text-gray-300"></i>
                    Nenhum relatório de erro encontrado
                  </td>
                </tr>
              ) : (
                paginatedReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-medium text-red-600">{report.error_name}</span>
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">{report.error_message}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{report.screen_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {report.user_id ? getUserName(report.user_id) : 'Anónimo'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{report.app_version || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${statusColors[report.status] || 'badge-gray'}`}>
                        {report.status || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {report.created_at ? new Date(report.created_at).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Ver detalhes"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                        <select
                          value={report.status || ''}
                          onChange={(e) => updateReportStatus(report.id, e.target.value)}
                          disabled={updatingStatus}
                          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                        >
                          <option value="pending">Pendente</option>
                          <option value="investigating">Investigando</option>
                          <option value="resolved">Resolvido</option>
                          <option value="ignored">Ignorado</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} a{' '}
              {Math.min(currentPage * itemsPerPage, filteredReports.length)} de{' '}
              {filteredReports.length} registros
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary px-3 py-1.5 disabled:opacity-50"
              >
                <i className="fas fa-chevron-left text-xs"></i>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) page = i + 1;
                else if (currentPage <= 3) page = i + 1;
                else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                else page = currentPage - 2 + i;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary px-3 py-1.5 disabled:opacity-50"
              >
                <i className="fas fa-chevron-right text-xs"></i>
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <i className="fas fa-bug text-red-600"></i>
                Detalhes do Erro
              </h2>
              <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <i className="fas fa-xmark text-gray-500"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Nome do Erro</p>
                  <p className="text-sm font-medium text-red-600">{selectedReport.error_name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
                  <span className={`badge ${statusColors[selectedReport.status] || 'badge-gray'}`}>
                    {selectedReport.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Tela</p>
                  <p className="text-sm">{selectedReport.screen_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Usuário</p>
                  <p className="text-sm">{selectedReport.user_id ? getUserName(selectedReport.user_id) : 'Anónimo'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Versão do App</p>
                  <p className="text-sm">{selectedReport.app_version || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Dispositivo</p>
                  <p className="text-sm">{selectedReport.device_info || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Correlation ID</p>
                  <p className="text-sm font-mono text-xs">{selectedReport.correlation_id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Data</p>
                  <p className="text-sm">{new Date(selectedReport.created_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Mensagem de Erro</p>
                <p className="text-sm bg-gray-50 rounded-lg p-3 font-mono">{selectedReport.error_message}</p>
              </div>

              {selectedReport.stack_trace && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Stack Trace</p>
                  <pre className="text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto max-h-40">
                    {selectedReport.stack_trace}
                  </pre>
                </div>
              )}

              <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500">Atualizar Status:</p>
                <button
                  onClick={() => updateReportStatus(selectedReport.id, 'investigating')}
                  disabled={updatingStatus}
                  className="btn-secondary text-sm"
                >
                  Investigando
                </button>
                <button
                  onClick={() => updateReportStatus(selectedReport.id, 'resolved')}
                  disabled={updatingStatus}
                  className="btn-secondary text-sm text-green-600"
                >
                  Resolvido
                </button>
                <button
                  onClick={() => updateReportStatus(selectedReport.id, 'ignored')}
                  disabled={updatingStatus}
                  className="btn-secondary text-sm text-gray-600"
                >
                  Ignorar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorReportsTable;
