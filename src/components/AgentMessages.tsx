import { FC, useState, useMemo, useEffect, useCallback } from 'react';
import { authHeaders } from '../lib/api';

const API_BASE = typeof window !== 'undefined' ? window.location.origin : '';

const AgentMessages: FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromUserId, setFromUserId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/users`, { headers: authHeaders() });
      const data = await res.json();
      if (data.data) {
        setUsers(data.data);
        setAgents(data.data.filter((u: any) => u.papel === 'AGENTE' || u.papel === 'ADMIN'));
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const customers = useMemo(() => {
    return users.filter(u => u.papel !== 'AGENTE' && u.papel !== 'ADMIN');
  }, [users]);

  const handleSend = async () => {
    if (!fromUserId || !toUserId || !message.trim()) {
      setNotification({ type: 'error', message: 'Preencha todos os campos obrigatórios' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/agent/send-message`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_user_id: fromUserId,
          to_user_id: toUserId,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setNotification({ type: 'success', message: 'Mensagem enviada com sucesso!' });
        setMessage('');
        setToUserId('');
      } else {
        setNotification({ type: 'error', message: data.message || 'Erro ao enviar mensagem' });
      }
    } catch (error) {
      setNotification({ type: 'error', message: 'Erro ao conectar com o servidor' });
    }
    setSending(false);
    setTimeout(() => setNotification(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <i className="fas fa-spinner fa-spin text-3xl text-blue-600"></i>
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enviar Mensagem</h1>
        <p className="text-sm text-gray-500 mt-1">Envie mensagens para clientes ou agentes</p>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl border ${
          notification.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <div className="flex items-center gap-2">
            <i className={`fas ${notification.type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark'}`}></i>
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <i className="fas fa-paper-plane text-blue-600"></i>
            Nova Mensagem
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Remetente (Agente)</label>
              <select
                value={fromUserId}
                onChange={(e) => setFromUserId(e.target.value)}
                className="input"
              >
                <option value="">Selecione um agente...</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.nome} ({agent.email || agent.telefone})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Destinatário</label>
              <select
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                className="input"
              >
                <option value="">Selecione um destinatário...</option>
                <optgroup label="Clientes">
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.nome} ({customer.email || customer.telefone})</option>
                  ))}
                </optgroup>
                <optgroup label="Agentes">
                  {agents.filter(a => a.id !== fromUserId).map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.nome} ({agent.email || agent.telefone})</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Mensagem</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                rows={5}
                maxLength={1000}
                className="input resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/1000</p>
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !fromUserId || !toUserId || !message.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Enviando...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane"></i>
                  Enviar Mensagem
                </>
              )}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <i className="fas fa-users text-green-600"></i>
            Utilizadores Rápidos
          </h3>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Clientes ({customers.length})</p>
              <div className="space-y-1">
                {customers.slice(0, 10).map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => setToUserId(customer.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      toUserId === customer.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">
                      {customer.nome?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{customer.nome}</p>
                      <p className="text-xs text-gray-400 truncate">{customer.email || customer.telefone || 'Sem contacto'}</p>
                    </div>
                  </button>
                ))}
                {customers.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">Nenhum cliente encontrado</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Agentes ({agents.length})</p>
              <div className="space-y-1">
                {agents.slice(0, 10).map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => setToUserId(agent.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      toUserId === agent.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {agent.nome?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{agent.nome}</p>
                      <p className="text-xs text-gray-400 truncate">{agent.email || agent.telefone || 'Sem contacto'}</p>
                    </div>
                  </button>
                ))}
                {agents.length === 0 && (
                  <p className="text-sm text-gray-400 py-4 text-center">Nenhum agente encontrado</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentMessages;
