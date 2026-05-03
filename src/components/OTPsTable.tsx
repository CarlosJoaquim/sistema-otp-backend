import { FC, useState, useMemo } from 'react';

interface OTP {
  id?: string;
  phone?: string;
  email?: string;
  code: string;
  code_hash?: string;
  verified: boolean;
  attempts?: number;
  created_at?: string;
  expires_at?: string;
  method?: string;
  code_type?: string;
  correlation_id?: string;
}

interface OTPsTableProps {
  otps: OTP[];
}

const OTPsTable: FC<OTPsTableProps> = ({ otps }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const getOTPStatus = (otp: OTP) => {
    if (otp.verified) return 'verified';
    if (otp.attempts && otp.attempts >= 3) return 'blocked';
    if (otp.expires_at && new Date(otp.expires_at) < new Date()) return 'expired';
    return 'pending';
  };

  const statusOptions = [
    { value: 'all', label: 'Todos os Status' },
    { value: 'verified', label: 'Verificado' },
    { value: 'pending', label: 'Pendente' },
    { value: 'expired', label: 'Expirado' },
    { value: 'blocked', label: 'Bloqueado' },
  ];

  const typeOptions = [
    { value: 'all', label: 'Todos os Tipos' },
    { value: 'signup', label: 'Registro' },
    { value: 'password_reset', label: 'Reset de Senha' },
  ];

  const filteredOTPs = useMemo(() => {
    return otps.filter(otp => {
      const matchesSearch = 
        (otp.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (otp.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (otp.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (otp.correlation_id || '').toLowerCase().includes(searchTerm.toLowerCase());

      const status = getOTPStatus(otp);
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesType = typeFilter === 'all' || otp.code_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [otps, searchTerm, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filteredOTPs.length / itemsPerPage);
  const paginatedOTPs = filteredOTPs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const exportToCSV = () => {
    const headers = ['Contact', 'Code', 'Status', 'Type', 'Method', 'Attempts', 'Created', 'Expires'];
    const rows = filteredOTPs.map(otp => {
      const status = getOTPStatus(otp);
      return [
        otp.phone || otp.email || '-',
        otp.code,
        status,
        otp.code_type || '-',
        otp.method || '-',
        otp.attempts || 0,
        otp.created_at ? new Date(otp.created_at).toLocaleString('pt-BR') : '-',
        otp.expires_at ? new Date(otp.expires_at).toLocaleString('pt-BR') : '-',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `otps_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      verified: 'badge-success',
      pending: 'badge-warning',
      expired: 'badge-gray',
      blocked: 'badge-danger',
    };
    const labels: Record<string, string> = {
      verified: 'Verificado',
      pending: 'Pendente',
      expired: 'Expirado',
      blocked: 'Bloqueado',
    };
    const icons: Record<string, string> = {
      verified: 'fas fa-circle-check',
      pending: 'fas fa-clock',
      expired: 'fas fa-hourglass-end',
      blocked: 'fas fa-ban',
    };
    return (
      <span className={`badge ${styles[status]}`}>
        <i className={`${icons[status]} mr-1`}></i>
        {labels[status]}
      </span>
    );
  };

  const typeBadge = (type: string) => {
    const styles: Record<string, string> = {
      signup: 'badge-info',
      password_reset: 'badge-purple',
    };
    const labels: Record<string, string> = {
      signup: 'Registro',
      password_reset: 'Reset',
    };
    return (
      <span className={`badge ${styles[type] || 'badge-gray'}`}>
        {labels[type] || type}
      </span>
    );
  };

  const stats = useMemo(() => ({
    total: otps.length,
    verified: otps.filter(o => o.verified).length,
    pending: otps.filter(o => {
      const status = getOTPStatus(o);
      return status === 'pending';
    }).length,
    expired: otps.filter(o => {
      const status = getOTPStatus(o);
      return status === 'expired';
    }).length,
    blocked: otps.filter(o => {
      const status = getOTPStatus(o);
      return status === 'blocked';
    }).length,
  }), [otps]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">OTPs</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie e monitore todos os códigos OTP</p>
        </div>
        <button onClick={exportToCSV} className="btn-secondary flex items-center gap-2">
          <i className="fas fa-download text-xs"></i>
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card py-4">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
          <p className="text-xs text-gray-500">Verificados</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-gray-500">Pendentes</p>
        </div>
        <div className="card py-4">
          <p className="text-2xl font-bold text-gray-600">{stats.expired}</p>
          <p className="text-xs text-gray-500">Expirados</p>
        </div>
        <div className="card py-4 col-span-2 md:col-span-1">
          <p className="text-2xl font-bold text-red-600">{stats.blocked}</p>
          <p className="text-xs text-gray-500">Bloqueados</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Buscar por contato, código ou correlation ID..."
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
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            className="btn-secondary"
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all'); setCurrentPage(1); }}
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contato</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Código</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Método</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tentativas</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Criado em</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expira em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedOTPs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    <i className="fas fa-inbox text-3xl mb-3 block text-gray-300"></i>
                    Nenhum OTP encontrado
                  </td>
                </tr>
              ) : (
                paginatedOTPs.map((otp, idx) => {
                  const status = getOTPStatus(otp);
                  return (
                    <tr key={otp.id || idx} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-sm">
                        <div className="flex items-center gap-2">
                          <i className={`fas ${otp.phone ? 'fa-phone text-green-500' : 'fa-envelope text-blue-500'}`}></i>
                          <span className="font-medium">{otp.phone || otp.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm font-bold text-blue-600 tracking-wider">{otp.code}</span>
                      </td>
                      <td className="py-3 px-4">{statusBadge(status)}</td>
                      <td className="py-3 px-4">{typeBadge(otp.code_type || 'signup')}</td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {otp.method === 'sms' ? (
                            <span><i className="fas fa-sms mr-1 text-green-500"></i>SMS</span>
                          ) : (
                            <span><i className="fas fa-envelope mr-1 text-blue-500"></i>Email</span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-sm font-medium ${(otp.attempts || 0) >= 3 ? 'text-red-600' : 'text-gray-600'}`}>
                          {otp.attempts || 0}/3
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {otp.created_at ? new Date(otp.created_at).toLocaleString('pt-BR') : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {otp.expires_at ? (
                          <span className={new Date(otp.expires_at) < new Date() ? 'text-red-500' : ''}>
                            {new Date(otp.expires_at).toLocaleString('pt-BR')}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Mostrando {(currentPage - 1) * itemsPerPage + 1} a{' '}
              {Math.min(currentPage * itemsPerPage, filteredOTPs.length)} de{' '}
              {filteredOTPs.length} registros
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

export default OTPsTable;
