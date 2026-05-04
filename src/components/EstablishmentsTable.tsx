import { FC, useState, useMemo, useEffect, useCallback } from 'react';
import { authHeaders } from '../lib/api';

interface Establishment {
  id: string;
  nome: string;
  categoria: string;
  endereco: string;
  descricao: string;
  faixa_preco: string;
  ativo: boolean;
  usuario_id: string;
  url_imagem: string;
  criado_em: string;
}

const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

const precoLabels: Record<string, string> = {
  BARATO: '$',
  MODERADO: '$$',
  CARO: '$$$',
  LUXUOSO: '$$$$',
};

const precoColors: Record<string, string> = {
  BARATO: 'badge-success',
  MODERADO: 'badge-info',
  CARO: 'badge-warning',
  LUXUOSO: 'badge-purple',
};

const EstablishmentsTable: FC = () => {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [priceFilter, setPriceFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchEstablishments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/establishments/search?limit=100&page=1`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setEstablishments(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar estabelecimentos:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEstablishments();
  }, [fetchEstablishments]);

  const categories = useMemo(() => {
    const cats = new Set(establishments.map(e => e.categoria));
    return ['todos', ...Array.from(cats)];
  }, [establishments]);

  const filteredEstablishments = useMemo(() => {
    return establishments.filter(est => {
      const matchesSearch =
        (est.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (est.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (est.endereco || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = categoryFilter === 'todos' || est.categoria === categoryFilter;
      const matchesPrice = priceFilter === 'todos' || est.faixa_preco === priceFilter;
      const matchesStatus = statusFilter === 'todos' ||
        (statusFilter === 'ativos' && est.ativo !== false) ||
        (statusFilter === 'inativos' && est.ativo === false);

      return matchesSearch && matchesCategory && matchesPrice && matchesStatus;
    });
  }, [establishments, searchTerm, categoryFilter, priceFilter, statusFilter]);

  const totalPages = Math.ceil(filteredEstablishments.length / itemsPerPage);
  const paginatedEstablishments = filteredEstablishments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = useMemo(() => ({
    total: establishments.length,
    active: establishments.filter(e => e.ativo !== false).length,
    inactive: establishments.filter(e => e.ativo === false).length,
    restaurants: establishments.filter(e => e.categoria?.toLowerCase() === 'restaurante').length,
  }), [establishments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <i className="fas fa-spinner fa-spin text-3xl text-blue-600"></i>
          <p className="text-sm text-gray-500">Carregando estabelecimentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estabelecimentos</h1>
          <p className="text-sm text-gray-500 mt-1">Lista de todos os estabelecimentos registados</p>
        </div>
        <button onClick={fetchEstablishments} className="btn-secondary flex items-center gap-2">
          <i className="fas fa-arrows-rotate text-xs"></i>
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card py-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          <p className="text-xs text-gray-500">Ativos</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
          <p className="text-xs text-gray-500">Inativos</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-orange-600">{stats.restaurants}</p>
          <p className="text-xs text-gray-500">Restaurantes</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Buscar por nome, descrição ou endereço..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="input pl-10"
              />
            </div>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="btn-secondary"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat === 'todos' ? 'Todas Categorias' : cat}</option>
            ))}
          </select>
          <select
            value={priceFilter}
            onChange={(e) => { setPriceFilter(e.target.value); setCurrentPage(1); }}
            className="btn-secondary"
          >
            <option value="todos">Todos os Preços</option>
            <option value="BARATO">$ Barato</option>
            <option value="MODERADO">$$ Moderado</option>
            <option value="CARO">$$$ Caro</option>
            <option value="LUXUOSO">$$$$ Luxuoso</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="btn-secondary"
          >
            <option value="todos">Todos Status</option>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
          </select>
          {(searchTerm || categoryFilter !== 'todos' || priceFilter !== 'todos' || statusFilter !== 'todos') && (
            <button
              onClick={() => { setSearchTerm(''); setCategoryFilter('todos'); setPriceFilter('todos'); setStatusFilter('todos'); setCurrentPage(1); }}
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Preço</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Endereço</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEstablishments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <i className="fas fa-store-slash text-3xl mb-3 block text-gray-300"></i>
                    Nenhum estabelecimento encontrado
                  </td>
                </tr>
              ) : (
                paginatedEstablishments.map((est) => (
                  <tr key={est.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {est.url_imagem ? (
                          <img src={est.url_imagem} alt={est.nome} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-sm font-bold">
                            {est.nome.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">{est.nome}</span>
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">{est.descricao}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge badge-info">{est.categoria || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${precoColors[est.faixa_preco] || 'badge-gray'}`}>
                        {precoLabels[est.faixa_preco] || est.faixa_preco || '-'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 max-w-[200px] truncate">{est.endereco || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${est.ativo !== false ? 'badge-success' : 'badge-danger'}`}>
                        <i className={`fas ${est.ativo !== false ? 'fa-circle-check' : 'fa-circle-xmark'} mr-1`}></i>
                        {est.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {est.criado_em ? new Date(est.criado_em).toLocaleDateString('pt-BR') : '-'}
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
              {Math.min(currentPage * itemsPerPage, filteredEstablishments.length)} de{' '}
              {filteredEstablishments.length} registros
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

export default EstablishmentsTable;
