import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [currentSection, setCurrentSection] = useState('overview');
  const [users, setUsers] = useState([]);
  const [otps, setOtps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOtps: 0,
    verifiedOtps: 0,
    emailSent: 0,
    passwordResets: 0
  });
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [supabaseStatus, setSupabaseStatus] = useState('Verificando...');
  const [websocketStatus, setWebsocketStatus] = useState('Conectando...');
  const [lastCheck, setLastCheck] = useState('-');
  
  // Password reset states
  const [resetContact, setResetContact] = useState('');
  const [resetMethod, setResetMethod] = useState('sms');
  const [resetOtp, setResetOtp] = useState('');
  const [resetPasswordNew, setResetPasswordNew] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetResult, setResetResult] = useState({ message: '', type: '' });
  const [showStep2, setShowStep2] = useState(false);
  
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://sistema-otp-backend.vercel.app';
  const AUTH = typeof window !== 'undefined' ? 'Basic ' + btoa((process.env.NEXT_PUBLIC_ADMIN_USER || 'admin') + ':' + (process.env.NEXT_PUBLIC_ADMIN_PASS || 'admin123')) : '';

  useEffect(() => {
    checkConnection();
    loadOverview();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/status`);
      const data = await response.json();
      
      if (data.supabase === 'connected') {
        setConnectionStatus('online');
        setSupabaseStatus('Conectado');
      } else {
        throw new Error('Supabase desconectado');
      }
    } catch (error) {
      setConnectionStatus('offline');
      setSupabaseStatus('Desconectado');
    }
    setWebsocketStatus('Conectado');
    setLastCheck(new Date().toLocaleTimeString('pt-BR'));
  };

  const loadOverview = async () => {
    try {
      const [usersRes, otpsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/api/users`),
        fetch(`${API_BASE}/api/otps`),
        fetch(`${API_BASE}/api/logs`)
      ]);
      
      const usersData = await usersRes.json();
      const otpsData = await otpsRes.json();
      const logsData = await logsRes.json();
      
      const users = usersData.data || [];
      const otps = otpsData.data || [];
      const logs = logsData.data || [];
      
      setUsers(users);
      setOtps(otps);
      setLogs(logs);
      setAllLogs(logs);
      
      setStats({
        totalUsers: users.length,
        totalOtps: otps.length,
        verifiedOtps: otps.filter(o => o.verified).length,
        emailSent: logs.filter(l => l.type === 'email' && l.message.includes('sent')).length,
        passwordResets: 0
      });
    } catch (error) {
      console.error('Erro ao carregar visão geral:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/users`);
      const { data } = await response.json();
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadOtps = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/otps`);
      const { data } = await response.json();
      setOtps(data || []);
    } catch (error) {
      console.error('Erro ao carregar OTPs:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/logs`);
      const { data } = await response.json();
      setLogs(data || []);
      setAllLogs(data || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  const refreshCurrentSection = () => {
    switch(currentSection) {
      case 'overview': loadOverview(); break;
      case 'users': loadUsers(); break;
      case 'otps': loadOtps(); break;
      case 'logs': loadLogs(); break;
      default: break;
    }
  };

  const showResult = (message, type) => {
    setResetResult({ message, type });
    setTimeout(() => {
      setResetResult({ message: '', type: '' });
    }, 5000);
  };

  const sendResetCode = async () => {
    if (!resetContact) {
      showResult('Informe um telefone ou email', 'error');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/otp/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: resetContact, method: resetMethod })
      });
      
      const data = await response.json();
      if (data.success) {
        showResult(`Código enviado via ${resetMethod === 'email' ? 'email' : 'SMS'}! Verifique sua caixa de entrada.`, 'success');
      } else {
        showResult(data.message || 'Erro ao enviar código', 'error');
      }
    } catch (error) {
      showResult('Erro de conexão com o servidor', 'error');
    }
  };

  const verifyCodeAndProceed = async () => {
    if (!resetOtp) {
      showResult('Digite o código recebido', 'error');
      return;
    }
    
    try {
      const verifyRes = await fetch(`${API_BASE}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: resetContact, code: resetOtp })
      });
      
      const verifyData = await verifyRes.json();
      
      if (!verifyData.success) {
        showResult(verifyData.message || 'Código inválido', 'error');
        return;
      }
      
      showResult('Código validado com sucesso! Agora defina sua nova senha.', 'success');
      setShowStep2(true);
    } catch (error) {
      showResult('Erro de conexão com o servidor', 'error');
    }
  };

  const resetPasswordStep2 = async () => {
    if (!resetPasswordNew || !resetPasswordConfirm) {
      showResult('Preencha a nova senha e a confirmação', 'error');
      return;
    }
    
    if (resetPasswordNew !== resetPasswordConfirm) {
      showResult('As senhas não coincidem', 'error');
      return;
    }
    
    if (resetPasswordNew.length < 6) {
      showResult('A senha deve ter pelo menos 6 caracteres', 'error');
      return;
    }
    
    try {
      const resetRes = await fetch(`${API_BASE}/api/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: resetContact, newPassword: resetPasswordNew })
      });
      
      const resetData = await resetRes.json();
      
      if (resetData.success) {
        showResult('Senha redefinida com sucesso!', 'success');
        setResetContact('');
        setResetOtp('');
        setResetPasswordNew('');
        setResetPasswordConfirm('');
        setTimeout(() => {
          setShowStep2(false);
          setResetResult({ message: '', type: '' });
        }, 2000);
      } else {
        showResult(resetData.message || 'Erro ao redefinir senha', 'error');
      }
    } catch (error) {
      showResult('Erro de conexão com o servidor', 'error');
    }
  };

  const deleteOTP = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este OTP?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/otp/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        alert('OTP excluído com sucesso!');
        loadOtps();
      }
    } catch (error) {
      alert('Erro ao excluir OTP');
    }
  };

  const viewUser = async (phoneOrEmail) => {
    try {
      const response = await fetch(`${API_BASE}/api/users`);
      const { data } = await response.json();
      const user = data.find(u => u.telefone === phoneOrEmail || u.email === phoneOrEmail);
      
      if (!user) {
        alert('Usuário não encontrado');
        return;
      }
      
      alert(`Usuário: ${user.nome} ${user.sobrenome || ''}\nEmail: ${user.email || '-'}\nTelefone: ${user.telefone || '-'}\nStatus: ${user.ativo ? 'Ativo' : 'Inativo'}`);
    } catch (error) {
      alert('Erro ao carregar detalhes do usuário');
    }
  };

  const resetUserPassword = (phone) => {
    setResetContact(phone);
    setCurrentSection('password-reset');
  };

  const filterLogs = (type) => {
    if (type === 'all') {
      setLogs(allLogs);
    } else {
      const filtered = allLogs.filter(log => {
        if (type === 'otp') return log.type.includes('otp');
        return log.type === type;
      });
      setLogs(filtered);
    }
  };

  return (
    <>
      <Head>
        <title>OTP CAOP-B Sistema - Gestão de Verificação</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          body { background: #fafbfc; color: #1a1a2e; line-height: 1.5; }
          .dashboard { display: flex; min-height: 100vh; }
          .sidebar { width: 240px; background: #ffffff; color: #1a1a2e; padding: 0; position: fixed; height: 100vh; overflow-y: auto; border-right: 1px solid #e8e8e8; }
          .logo { padding: 20px; text-align: center; border-bottom: 1px solid #e8e8e8; margin-bottom: 8px; }
          .logo h2 { font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; color: #4361ee; }
          .nav-menu { list-style: none; padding: 10px; }
          .nav-item { padding: 12px 16px; margin: 2px 0; cursor: pointer; border-radius: 8px; transition: all 0.2s; display: flex; align-items: center; gap: 10px; font-size: 0.9rem; color: #666; }
          .nav-item:hover { background: #f0f4ff; color: #4361ee; }
          .nav-item.active { background: #4361ee; color: white; }
          .main-content { margin-left: 240px; flex: 1; padding: 20px; }
          .content-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .section-content { display: block; }
          .section-content.hidden { display: none; }
          .card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px; }
          .card h2 { font-size: 1.2rem; margin-bottom: 15px; color: #1a1a2e; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
          .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
          .stat-card h3 { font-size: 0.85rem; color: #666; margin-bottom: 8px; }
          .stat-card .value { font-size: 2rem; font-weight: bold; color: #1a1a2e; }
          .form-container { max-width: 600px; }
          .form-group { margin-bottom: 15px; }
          .form-group label { display: block; margin-bottom: 5px; font-size: 0.9rem; color: #333; font-weight: 500; }
          .form-input { width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; transition: border-color 0.2s; }
          .form-input:focus { outline: none; border-color: #4361ee; box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.1); }
          .btn-primary, .btn-secondary, .btn-success { padding: 10px 20px; border: none; border-radius: 6px; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
          .btn-primary { background: #4361ee; color: white; }
          .btn-primary:hover { background: #3b50d9; transform: translateY(-1px); }
          .btn-secondary { background: #f0f4ff; color: #4361ee; border: 1px solid #4361ee; }
          .btn-success { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; font-weight: 600; }
          .btn-large { padding: 12px 24px; font-size: 1rem; }
          .result { padding: 12px 16px; border-radius: 8px; font-weight: 500; margin-top: 15px; }
          .result.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
          .result.error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
          .status { padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 500; }
          .status.good { background: #f0fdf4; color: #16a34a; }
          .status.bad { background: #fef2f2; color: #dc2626; }
          .status.warning { background: #fef3c7; color: #d97706; }
          table { width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px; border-collapse: collapse; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
          th { background: #f8f9fa; font-weight: 600; font-size: 0.85rem; color: #333; }
          .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 500; }
          .badge.success { background: #f0fdf4; color: #16a34a; }
          .badge.error { background: #fef2f2; color: #dc2626; }
          .btn-icon { background: none; border: none; cursor: pointer; padding: 5px; color: #666; transition: color 0.2s; }
          .btn-icon:hover { color: #4361ee; }
          .activity-item { display: flex; align-items: center; gap: 15px; padding: 12px; border-bottom: 1px solid #f0f0f0; }
          .activity-icon { width: 40px; height: 40px; background: #f0f4ff; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #4361ee; }
          .activity-info p { margin: 0; font-size: 0.9rem; }
          .activity-info small { color: #888; font-size: 0.8rem; }
          .empty-state { text-align: center; padding: 40px; color: #888; }
          #step1, #step2 { background: #f8fafc; padding: 25px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
          #step2 { background: #f0fdf4; border-color: #bbf7d0; }
          #otp-code-field { margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%); border-radius: 8px; border-left: 4px solid #4361ee; animation: slideIn 0.3s ease-out; }
          @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </Head>
      
      <div className="dashboard">
        <aside className="sidebar">
          <div className="logo">
            <h2><i className="fas fa-shield-alt"></i> OTP CAOP-B</h2>
          </div>
          <ul className="nav-menu">
            {['overview', 'users', 'otps', 'password-reset', 'settings', 'logs'].map((section) => (
              <li 
                key={section}
                className={`nav-item ${currentSection === section ? 'active' : ''}`}
                onClick={() => setCurrentSection(section)}
              >
                <i className={`fas fa-${
                  section === 'overview' ? 'tachometer-alt' :
                  section === 'users' ? 'users' :
                  section === 'otps' ? 'mobile-alt' :
                  section === 'password-reset' ? 'key' :
                  section === 'settings' ? 'cog' : 'list'
                }`}></i>
                {section === 'overview' ? 'Visão Geral' :
                 section === 'users' ? 'Usuários' :
                 section === 'otps' ? 'OTPs' :
                 section === 'password-reset' ? 'Redefinir Senha' :
                 section === 'settings' ? 'Configurações' : 'Logs'}
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-content">
          <div className="content-header">
            <h1>
              {currentSection === 'overview' ? 'Visão Geral' :
               currentSection === 'users' ? 'Usuários' :
               currentSection === 'otps' ? 'OTPs' :
               currentSection === 'password-reset' ? 'Redefinir Senha' :
               currentSection === 'settings' ? 'Configurações' : 'Logs'}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span id="connection-status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`status-dot ${connectionStatus === 'online' ? 'online' : 'offline'}`} style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: connectionStatus === 'online' ? '#22c55e' : '#ef4444',
                  display: 'inline-block'
                }}></span>
                <span className="status-text" style={{ fontSize: '0.9rem', color: '#666' }}>
                  {connectionStatus === 'online' ? 'Online' : 'Offline'}
                </span>
              </span>
              <button onClick={refreshCurrentSection} className="btn-secondary" style={{ padding: '8px 16px' }}>
                <i className="fas fa-sync-alt"></i> Atualizar
              </button>
            </div>
          </div>

          {/* Visão Geral */}
          <div className={`section-content ${currentSection === 'overview' ? '' : 'hidden'}`} id="overview-section">
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Usuários</h3>
                <div className="value">{stats.totalUsers}</div>
              </div>
              <div className="stat-card">
                <h3>OTPs Gerados</h3>
                <div className="value">{stats.totalOtps}</div>
              </div>
              <div className="stat-card">
                <h3>OTPs Verificados</h3>
                <div className="value">{stats.verifiedOtps}</div>
              </div>
              <div className="stat-card">
                <h3>Emails Enviados</h3>
                <div className="value">{stats.emailSent}</div>
              </div>
              <div className="stat-card">
                <h3>Redefinições</h3>
                <div className="value">{stats.passwordResets}</div>
              </div>
            </div>

            <div className="card">
              <h2><i className="fas fa-activity"></i> Atividade Recente</h2>
              <div id="recent-activity">
                {otps.slice(0, 5).map((otp, idx) => (
                  <div className="activity-item" key={idx}>
                    <span className="activity-icon"><i className="fas fa-mobile-alt"></i></span>
                    <div className="activity-info">
                      <p><strong>OTP {otp.verified ? 'verificado' : 'gerado'}</strong> para {otp.telefone}</p>
                      <small>{new Date(otp.created_at).toLocaleString('pt-BR')}</small>
                    </div>
                  </div>
                ))}
                {otps.length === 0 && <p className="empty-state">Nenhuma atividade recente</p>}
              </div>
            </div>

            <div className="card">
              <h2><i className="fas fa-info-circle"></i> Status do Sistema</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#888', fontSize: '0.85rem' }}>Supabase</span>
                  <span id="supabase-status" className={`status ${supabaseStatus === 'Conectado' ? 'good' : 'bad'}`}>{supabaseStatus}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#888', fontSize: '0.85rem' }}>API Backend</span>
                  <span className="status good">Online</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: '#888', fontSize: '0.85rem' }}>WebSocket</span>
                  <span id="websocket-status" className={`status ${websocketStatus === 'Conectado' ? 'good' : 'bad'}`}>{websocketStatus}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.85rem', color: '#888' }}>
                  <span>Última Verificação</span>
                  <span id="last-check">{lastCheck}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Usuários */}
          <div className={`section-content ${currentSection === 'users' ? '' : 'hidden'}`} id="users-section">
            <div className="card">
              <h2><i className="fas fa-users"></i> Usuários ({users.length})</h2>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Telefone</th>
                    <th>Criado em</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody id="users-body">
                  {users.map((user, idx) => (
                    <tr key={idx}>
                      <td>{user.nome} {user.sobrenome || ''}</td>
                      <td>{user.email || '-'}</td>
                      <td>{user.telefone || '-'}</td>
                      <td>{new Date(user.criado_em).toLocaleString('pt-BR')}</td>
                      <td><span className={`badge ${user.ativo ? 'success' : 'error'}`}>{user.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td>
                        <button className="btn-icon" onClick={() => viewUser(user.telefone || user.email)} title="Ver detalhes"><i className="fas fa-eye"></i></button>
                        <button className="btn-icon" onClick={() => resetUserPassword(user.telefone || user.email)} title="Redefinir senha"><i className="fas fa-key"></i></button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Nenhum usuário encontrado</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* OTPs */}
          <div className={`section-content ${currentSection === 'otps' ? '' : 'hidden'}`} id="otps-section">
            <div className="card">
              <h2><i className="fas fa-mobile-alt"></i> OTPs ({otps.length})</h2>
              <table>
                <thead>
                  <tr>
                    <th>Telefone</th>
                    <th>Código</th>
                    <th>Status</th>
                    <th>Expira em</th>
                    <th>Tentativas</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody id="otps-body">
                  {otps.map((otp, idx) => {
                    const now = new Date();
                    const expiresAt = new Date(otp.expires_at);
                    const isExpired = expiresAt < now;
                    const status = otp.verified ? 'verified' : (isExpired ? 'expired' : 'pending');
                    const statusText = otp.verified ? 'Verificado' : (isExpired ? 'Expirado' : 'Pendente');
                    
                    return (
                      <tr key={idx}>
                        <td>{otp.telefone}</td>
                        <td><strong>{otp.code}</strong></td>
                        <td className={`status-${status}`} style={{ color: otp.verified ? '#16a34a' : isExpired ? '#dc2626' : '#d97706' }}>{statusText}</td>
                        <td>{expiresAt.toLocaleString('pt-BR')}</td>
                        <td>{otp.attempts || 0}</td>
                        <td><button className="btn-icon" onClick={() => deleteOTP(otp.id)} title="Excluir"><i className="fas fa-trash"></i></button></td>
                      </tr>
                    );
                  })}
                  {otps.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Nenhum OTP encontrado</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Redefinir Senha */}
          <div className={`section-content ${currentSection === 'password-reset' ? '' : 'hidden'}`} id="password-reset-section">
            <div className="card">
              <h2><i className="fas fa-key"></i> Redefinir Senha</h2>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.9rem' }}>Passo 1: Envie o código OTP. Passo 2: Redefina a senha.</p>
              
              <div id="step1" className="form-container">
                <h3 style={{ marginBottom: '15px', color: '#4361ee' }}><i className="fas fa-paper-plane"></i> Passo 1: Enviar e Validar Código</h3>
                
                <div className="form-group">
                  <label>Telefone ou Email</label>
                  <input 
                    type="text" 
                    id="reset-contact" 
                    placeholder="244... ou email@exemplo.com" 
                    className="form-input"
                    value={resetContact}
                    onChange={(e) => setResetContact(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label>Método de Envio</label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="reset-method" 
                        value="sms" 
                        checked={resetMethod === 'sms'}
                        onChange={() => setResetMethod('sms')}
                      /> <i className="fas fa-mobile-alt"></i> SMS
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="reset-method" 
                        value="email" 
                        checked={resetMethod === 'email'}
                        onChange={() => setResetMethod('email')}
                      /> <i className="fas fa-envelope"></i> Email
                    </label>
                  </div>
                </div>
                
                <div id="otp-code-field">
                  <div className="form-group">
                    <label>Código Recebido</label>
                    <input 
                      type="text" 
                      id="reset-otp" 
                      placeholder="Digite o código recebido" 
                      className="form-input"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value)}
                    />
                  </div>
                </div>
                
                <div id="reset-result" className={`result ${resetResult.type === 'success' ? 'success' : 'error'}`} style={{ display: resetResult.message ? 'block' : 'none' }}>
                  {resetResult.message}
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={sendResetCode} className="btn-secondary btn-large" id="btn-send-code">
                    <i className="fas fa-paper-plane"></i> Enviar Código
                  </button>
                  <button onClick={verifyCodeAndProceed} className="btn-primary btn-large" id="btn-verify-code">
                    <i className="fas fa-check"></i> Validar Código
                  </button>
                </div>
              </div>
              
              {showStep2 && (
                <div id="step2" className="form-container" style={{ marginTop: '20px', borderTop: '2px solid #e8e8e8', paddingTop: '20px' }}>
                  <h3 style={{ marginBottom: '15px', color: '#22c55e' }}><i className="fas fa-lock"></i> Passo 2: Nova Senha</h3>
                  
                  <div className="form-group">
                    <label>Nova Senha</label>
                    <input 
                      type="password" 
                      id="reset-password-new" 
                      placeholder="Nova senha (mín. 6 caracteres)" 
                      className="form-input"
                      value={resetPasswordNew}
                      onChange={(e) => setResetPasswordNew(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirmar Nova Senha</label>
                    <input 
                      type="password" 
                      id="reset-password-confirm-new" 
                      placeholder="Confirmar senha" 
                      className="form-input"
                      value={resetPasswordConfirm}
                      onChange={(e) => setResetPasswordConfirm(e.target.value)}
                    />
                  </div>
                  
                  <div id="reset-password-result" className={`result ${resetResult.type === 'success' ? 'success' : 'error'}`} style={{ display: resetResult.message ? 'block' : 'none' }}>
                    {resetResult.message}
                  </div>
                  
                  <button onClick={resetPasswordStep2} className="btn-success btn-large" id="btn-reset-password">
                    <i className="fas fa-key"></i> Redefinir Senha
                  </button>
                </div>
              )}
            </div>
            
            <div className="card">
              <h2><i className="fas fa-info-circle"></i> Lógica de Redefinição</h2>
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '10px' }}>Como funciona:</h3>
                <ol style={{ paddingLeft: '20px', fontSize: '0.9rem', lineHeight: '1.8' }}>
                  <li>Digite telefone/email e escolha o método</li>
                  <li>Clique em "Enviar Código" - o código será enviado</li>
                  <li>Digite o código recebido e clique "Validar Código"</li>
                  <li>Após validação, digite a nova senha no Passo 2</li>
                  <li>Clique em "Redefinir Senha" para concluir</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Logs */}
          <div className={`section-content ${currentSection === 'logs' ? '' : 'hidden'}`} id="logs-section">
            <div className="card">
              <h2><i className="fas fa-list"></i> Logs do Sistema</h2>
              <div style={{ marginBottom: '15px' }}>
                {['all', 'otp', 'user', 'email'].map((type) => (
                  <button 
                    key={type}
                    onClick={() => filterLogs(type)}
                    className="btn-secondary" 
                    style={{ marginRight: '10px', marginBottom: '5px', padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    {type === 'all' ? 'Todos' : type === 'otp' ? 'OTPs' : type === 'user' ? 'Usuários' : 'Emails'}
                  </button>
                ))}
              </div>
              <div id="logs-list">
                {logs.map((log, idx) => (
                  <div key={idx} className={`log-item log-${log.type}`} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '15px', 
                    padding: '12px', 
                    borderBottom: '1px solid #f0f0f0' 
                  }}>
                    <span className="log-icon" style={{ 
                      width: '40px', 
                      height: '40px', 
                      background: '#f0f4ff', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: '#4361ee' 
                    }}>
                      <i className={log.icon}></i>
                    </span>
                    <div className="log-info">
                      <p style={{ margin: 0, fontSize: '0.9rem' }}>{log.message}</p>
                      <small style={{ color: '#888', fontSize: '0.8rem' }}>{new Date(log.time).toLocaleString('pt-BR')}</small>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <p className="empty-state">Nenhum log encontrado</p>}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
