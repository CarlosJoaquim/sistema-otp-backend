import { FC, useState, useMemo, useEffect, useCallback } from 'react';
import { authHeaders } from '../lib/api';

interface Order {
  id: string;
  usuario_id: string;
  lugar_id: string;
  status: string;
  total: number;
  criado_em: string;
  lugar?: { nome: string; endereco: string };
  usuario?: { nome: string; email: string; telefone: string };
  itens?: { quantidade: number; preco_unitario: number; produto: { nome: string; url_imagem: string } }[];
}

const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

const statusColors: Record<string, string> = {
  PENDENTE: 'badge-warning',
  ACEITO: 'badge-success',
  REJEITADO: 'badge-danger',
  EM_TRANSITO: 'badge-info',
  CONCLUIDO: 'badge-success',
  CANCELADO: 'badge-gray',
};

const AgentOrdersTable: FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
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

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      if (!agentIdFilter) return;
      const res = await fetch(`${API_BASE}/api/agent/orders-list?agent_id=${agentIdFilter}&status=${statusFilter}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) setOrders(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    }
    setLoading(false);
  }, [agentIdFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (agentIdFilter) fetchOrders();
  }, [agentIdFilter, fetchOrders]);

  const agents = useMemo(() => {
    return users.filter(u => u.papel === 'AGENTE' || u.papel === 'ADMIN');
  }, [users]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch =
        (order.lugar?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.usuario?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase());

      if (statusFilter === 'TODOS') return matchesSearch;
      return matchesSearch && order.status === statusFilter;
    });
  }, [orders, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`${API_BASE}/api/agent/orders-update-status`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, agent_id: agentIdFilter, status: newStatus }),
      });
      if (res.ok) fetchOrders();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
    }
    setUpdatingId(null);
  };

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(o => o.status === 'PENDENTE').length,
    inTransit: orders.filter(o => o.status === 'EM_TRANSITO').length,
    completed: orders.filter(o => o.status === 'CONCLUIDO').length,
  }), [orders]);

  const statusOptions = [
    { value: 'TODOS', label: 'Todos' },
    { value: 'PENDENTE', label: 'Pendentes' },
    { value: 'ACEITO', label: 'Aceitos' },
    { value: 'EM_TRANSITO', label: 'Em Trânsito' },
    { value: 'CONCLUIDO', label: 'Concluídos' },
    { value: 'REJEITADO', label: 'Rejeitados' },
    { value: 'CANCELADO', label: 'Cancelados' },
  ];

  if (!agentIdFilter) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos do Agente</h1>
          <p className="text-sm text-gray-500 mt-1">Selecione um agente para ver os pedidos</p>
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
          <p className="text-sm text-gray-500">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos do Agente</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie pedidos dos estabelecimentos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAgentIdFilter('')} className="btn-secondary flex items-center gap-2">
            <i className="fas fa-arrow-left text-xs"></i>
            Trocar Agente
          </button>
          <button onClick={fetchOrders} className="btn-secondary flex items-center gap-2">
            <i className="fas fa-arrows-rotate text-xs"></i>
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card py-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total de Pedidos</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-gray-500">Pendentes</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-blue-600">{stats.inTransit}</p>
          <p className="text-xs text-gray-500">Em Trânsito</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-xs text-gray-500">Concluídos</p>
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <i className="fas fa-receipt text-3xl mb-3 block text-gray-300"></i>
                    Nenhum pedido encontrado
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-medium">{order.lugar?.nome || 'N/A'}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{order.usuario?.nome || '-'}</td>
                    <td className="py-3 px-4 text-sm font-medium">
                      {order.total ? `${order.total.toFixed(2)} Kz` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${statusColors[order.status] || 'badge-gray'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {order.criado_em ? new Date(order.criado_em).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {order.status === 'PENDENTE' && (
                          <>
                            <button
                              onClick={() => updateStatus(order.id, 'ACEITO')}
                              disabled={updatingId === order.id}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Aceitar"
                            >
                              <i className="fas fa-check"></i>
                            </button>
                            <button
                              onClick={() => updateStatus(order.id, 'REJEITADO')}
                              disabled={updatingId === order.id}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Rejeitar"
                            >
                              <i className="fas fa-xmark"></i>
                            </button>
                          </>
                        )}
                        {order.status === 'ACEITO' && (
                          <button
                            onClick={() => updateStatus(order.id, 'EM_TRANSITO')}
                            disabled={updatingId === order.id}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Em trânsito"
                          >
                            <i className="fas fa-truck"></i>
                          </button>
                        )}
                        {(order.status === 'ACEITO' || order.status === 'EM_TRANSITO') && (
                          <button
                            onClick={() => updateStatus(order.id, 'CONCLUIDO')}
                            disabled={updatingId === order.id}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
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
              {Math.min(currentPage * itemsPerPage, filteredOrders.length)} de{' '}
              {filteredOrders.length} registros
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

export default AgentOrdersTable;
