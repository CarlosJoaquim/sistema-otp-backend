import { FC, useState, useMemo } from 'react';

interface User {
  id?: string;
  nome: string;
  sobrenome?: string;
  email?: string;
  telefone?: string;
  criado_em?: string;
  papel?: string;
  ativo?: boolean;
}

interface UsersTableProps {
  users: User[];
}

const UsersTable: FC<UsersTableProps> = ({ users }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        (user.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.sobrenome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.telefone || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (verificationFilter === 'email') return matchesSearch && user.email;
      if (verificationFilter === 'phone') return matchesSearch && user.telefone;
      if (verificationFilter === 'active') return matchesSearch && user.ativo !== false;
      if (verificationFilter === 'inactive') return matchesSearch && user.ativo === false;
      
      return matchesSearch;
    });
  }, [users, searchTerm, verificationFilter]);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToCSV = () => {
    const headers = ['Nome', 'Sobrenome', 'Email', 'Telefone', 'Papel', 'Ativo', 'Criado em'];
    const rows = filteredUsers.map(user => [
      user.nome,
      user.sobrenome || '',
      user.email || '',
      user.telefone || '',
      user.papel || 'USUARIO',
      user.ativo !== false ? 'Sim' : 'Não',
      user.criado_em ? new Date(user.criado_em).toLocaleString('pt-BR') : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const stats = useMemo(() => ({
    total: users.length,
    withEmail: users.filter(u => u.email).length,
    withPhone: users.filter(u => u.telefone).length,
    inactive: users.filter(u => u.ativo === false).length,
  }), [users]);

  const verificationOptions = [
    { value: 'all', label: 'Todos' },
    { value: 'email', label: 'Com Email' },
    { value: 'phone', label: 'Com Telefone' },
    { value: 'active', label: 'Ativos' },
    { value: 'inactive', label: 'Inativos' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie os usuários registrados no sistema</p>
        </div>
        <button onClick={exportToCSV} className="btn-secondary flex items-center gap-2">
          <i className="fas fa-download text-xs"></i>
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card py-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total de Usuários</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-blue-600">{stats.withEmail}</p>
          <p className="text-xs text-gray-500">Com Email</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-green-600">{stats.withPhone}</p>
          <p className="text-xs text-gray-500">Com Telefone</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
          <p className="text-xs text-gray-500">Inativos</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="input pl-10"
              />
            </div>
          </div>
          <select
            value={verificationFilter}
            onChange={(e) => { setVerificationFilter(e.target.value); setCurrentPage(1); }}
            className="btn-secondary"
          >
            {verificationOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {(searchTerm || verificationFilter !== 'all') && (
            <button
              onClick={() => { setSearchTerm(''); setVerificationFilter('all'); setCurrentPage(1); }}
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Telefone</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Papel</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Registrado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <i className="fas fa-users-slash text-3xl mb-3 block text-gray-300"></i>
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, idx) => (
                  <tr key={user.id || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                          {user.nome.charAt(0).toUpperCase()}
                          {(user.sobrenome || '').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{user.nome} {user.sobrenome || ''}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{user.email || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{user.telefone || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${
                        user.papel === 'ADMIN' ? 'badge-purple' :
                        user.papel === 'AGENTE' ? 'badge-info' : 'badge-gray'
                      }`}>
                        {user.papel || 'USUARIO'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${user.ativo !== false ? 'badge-success' : 'badge-danger'}`}>
                        <i className={`fas ${user.ativo !== false ? 'fa-circle-check' : 'fa-circle-xmark'} mr-1`}></i>
                        {user.ativo !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {user.criado_em ? new Date(user.criado_em).toLocaleDateString('pt-BR') : '-'}
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
              {Math.min(currentPage * itemsPerPage, filteredUsers.length)} de{' '}
              {filteredUsers.length} registros
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
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-100'
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

export default UsersTable;
