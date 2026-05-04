import { FC, useState, useMemo, useEffect, useCallback } from 'react';
import { authHeaders } from '../lib/api';

interface Reservation {
  id: string;
  usuario_id: string;
  lugar_id: string;
  categoria: string;
  data_hora: string;
  num_pessoas: number;
  status: string;
  criado_em: string;
  lugar?: { nome: string; endereco: string };
  usuario?: { nome: string; email: string; telefone: string };
}

const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

const statusColors: Record<string, string> = {
  PENDENTE: 'badge-warning',
  ACEITA: 'badge-success',
  REJEITADA: 'badge-danger',
  CANCELADA: 'badge-danger',
  CONCLUIDA: 'badge-success',
  CONCLUÍDA: 'badge-success',
  NO_SHOW: 'badge-gray',
};

const AgentReservationsTable: FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [agentIdFilter, setAgentIdFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const itemsPerPage = 15;

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, { headers: authHeaders() });
      const data = await res.json();
      if (data.data) setUsers(data.data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  }, []);

  const fetchReservations = useCallback(async () => {
    setLoading(true);
    try {
      if (!agentIdFilter) return;
      const res = await fetch(`${API_BASE}/api/agent/reservations-list?agent_id=${agentIdFilter}&status=${statusFilter}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) setReservations(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar reservas:', error);
    }
    setLoading(false);
  }, [agentIdFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (agentIdFilter) fetchReservations();
  }, [agentIdFilter, fetchReservations]);

  const agents = useMemo(() => {
    return users.filter(u => u.papel === 'AGENTE' || u.papel === 'ADMIN');
  }, [users]);

  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      const matchesSearch =
        (res.lugar?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (res.usuario?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        res.id.toLowerCase().includes(searchTerm.toLowerCase());

      if (statusFilter === 'TODOS') return matchesSearch;
      return matchesSearch && res.status === statusFilter;
    });
  }, [reservations, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
  const paginatedReservations = filteredReservations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const updateStatus = async (reservationId: string, newStatus: string) => {
    setUpdatingId(reservationId);
    try {
      const res = await fetch(`${API_BASE}/api/agent/reservations-update-status`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: reservationId, agent_id: agentIdFilter, status: newStatus }),
      });
      if (res.ok) fetchReservations();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
    setUpdatingId(null);
  };

  const stats = useMemo(() => ({
    total: reservations.length,
    pending: reservations.filter(r => r.status === 'PENDENTE').length,
    accepted: reservations.filter(r => r.status === 'ACEITA').length,
    completed: reservations.filter(r => r.status === 'CONCLUIDA' || r.status === 'CONCLUÍDA').length,
  }), [reservations]);

  const statusOptions = [
    { value: 'TODOS', label: 'Todas' },
    { value: 'PENDENTE', label: 'Pendentes' },
    { value: 'ACEITA', label: 'Aceites' },
    { value: 'CONCLUIDA', label: 'Concluídas' },
    { value: 'REJEITADA', label: 'Rejeitadas' },
    { value: 'CANCELADA', label: 'Canceladas' },
    { value: 'NO_SHOW', label: 'No Show' },
  ];

  if (!agentIdFilter) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas do Agente</h1>
          <p className="text-sm text-gray-500 mt-1">Selecione um agente para ver as reservas</p>
        </div>
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setAgentIdFilter(agent.id)}
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">
                  {agent.nome?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{agent.nome}</p>
                  <p className="text-sm text-gray-500">{agent.email || agent.telefone}</p>
                </div>
              </button>
            ))}
            {agents.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-500">
                <i className="fas fa-user-gear text-3xl mb-3 block text-gray-300"></i>
                Nenhum agente encontrado
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <i className="fas fa-spinner fa-spin text-3xl text-blue-600"></i>
          <p className="text-sm text-gray-500">Carregando reservas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas do Agente</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie reservas dos estabelecimentos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAgentIdFilter('')} className="btn-secondary flex items-center gap-2">
            <i className="fas fa-arrow-left text-xs"></i>
            Trocar Agente
          </button>
          <button onClick={fetchReservations} className="btn-secondary flex items-center gap-2">
            <i className="fas fa-arrows-rotate text-xs"></i>
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card py-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total de Reservas</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-gray-500">Pendentes</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
          <p className="text-xs text-gray-500">Aceites</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-blue-600">{stats.completed}</p>
          <p className="text-xs text-gray-500">Concluídas</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Buscar por estabelecimento, cliente ou ID..."
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
          {(searchTerm || statusFilter !== 'TODOS') && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter('TODOS'); setCurrentPage(1); }}
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estabelecimento</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data/Hora</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pessoas</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedReservations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <i className="fas fa-calendar-xmark text-3xl mb-3 block text-gray-300"></i>
                    Nenhuma reserva encontrada
                  </td>
                </tr>
              ) : (
                paginatedReservations.map((res) => (
                  <tr key={res.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-medium">{res.lugar?.nome || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      <div>
                        <p>{res.usuario?.nome || '-'}</p>
                        <p className="text-xs text-gray-400">{res.usuario?.telefone || ''}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {res.data_hora ? new Date(res.data_hora).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{res.num_pessoas || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${statusColors[res.status] || 'badge-gray'}`}>
                        {res.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {res.status === 'PENDENTE' && (
                          <>
                            <button
                              onClick={() => updateStatus(res.id, 'ACEITA')}
                              disabled={updatingId === res.id}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Aceitar"
                            >
                              <i className="fas fa-check"></i>
                            </button>
                            <button
                              onClick={() => updateStatus(res.id, 'REJEITADA')}
                              disabled={updatingId === res.id}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Rejeitar"
                            >
                              <i className="fas fa-xmark"></i>
                            </button>
                          </>
                        )}
                        {res.status === 'ACEITA' && (
                          <button
                            onClick={() => updateStatus(res.id, 'CONCLUIDA')}
                            disabled={updatingId === res.id}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Concluir"
                          >
                            <i className="fas fa-check-double"></i>
                          </button>
                        )}
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
              {Math.min(currentPage * itemsPerPage, filteredReservations.length)} de{' '}
              {filteredReservations.length} registros
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
    </div>
  );
};

export default AgentReservationsTable;
