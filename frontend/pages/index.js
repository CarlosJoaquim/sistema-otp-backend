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
  
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
  
  useEffect(() => {
    checkConnection();
    loadOverview();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const base = API_BASE || window.location.origin;
      const response = await fetch(`${base}/api/status`);
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
      const base = API_BASE || window.location.origin;
      const [usersRes, otpsRes, logsRes] = await Promise.all([
        fetch(`${base}/api/users`),
        fetch(`${base}/api/otps`),
        fetch(`${base}/api/logs`)
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
      const base = API_BASE || window.location.origin;
      const response = await fetch(`${base}/api/otp/create`, {
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
      const base = API_BASE || window.location.origin;
      const verifyRes = await fetch(`${base}/api/otp/verify`, {
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
      const base = API_BASE || window.location.origin;
      const resetRes = await fetch(`${base}/api/password/reset`, {
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
          table { width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin-bottom: 20px; border-collapse: collapse; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
          th { background: #f8f9fa; font-weight: 600; font-size: 0.85rem; color: #333; }
          .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 500; }
          .badge.success { background: #f0fdf4; color: #16a34a; }
          .badge.error { background: #fef2f2; color: #dc2626; }
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
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: connectionStatus === 'online' ? '#22c55e' : '#ef4444',
                  display: 'inline-block'
                }}></span>
                <span style={{ fontSize: '0.9rem', color: '#666' }}>
                  {connectionStatus === 'online' ? 'Online' : 'Offline'}
                </span>
              </span>
              <button onClick={() => {
                if (currentSection === 'overview') loadOverview();
                else if (currentSection === 'users') {
                  // load users
                } else if (currentSection === 'otps') {
                  // load otps  
                } else if (currentSection === 'logs') {
                  // load logs
                }
              }} style={{ padding: '8px 16px' }} className="btn-secondary">
                <i className="fas fa-sync-alt"></i> Atualizar
              </button>
            </div>
          </div>

          {/* Visão Geral */}
          <div className={`section-content ${currentSection === 'overview' ? '' : 'hidden'}`}>
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
              <div>
                {otps.slice(0, 5).map((otp, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ width: '40px', height: '40px', background: '#f0f4ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4361ee' }}>
                      <i className="fas fa-mobile-alt"></i>
                    </span>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.9rem' }}><strong>OTP {otp.verified ? 'verificado' : 'gerado'}</strong> para {otp.phone || otp.email}</p>
                      <small style={{ color: '#888', fontSize: '0.8rem' }}>{new Date(otp.created_at).toLocaleString('pt-BR')}</small>
                    </div>
                  </div>
                ))}
                {otps.length === 0 && <p style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Nenhuma atividade recente</p>}
              </div>
            </div>

            <div className="card">
              <h2><i className="fas fa-info-circle"></i> Status do Sistema</h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#888', fontSize: '0.85rem' }}>Supabase</span>
                  <span className={`badge ${supabaseStatus === 'Conectado' ? 'success' : 'error'}`}>{supabaseStatus}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ color: '#888', fontSize: '0.85rem' }}>API Backend</span>
                  <span className="badge success">Online</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: '#888', fontSize: '0.85rem' }}>WebSocket</span>
                  <span className={`badge ${websocketStatus === 'Conectado' ? 'success' : 'error'}`}>{websocketStatus}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.85rem', color: '#888' }}>
                  <span>Última Verificação</span>
                  <span>{lastCheck}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Redefinir Senha */}
          <div className={`section-content ${currentSection === 'password-reset' ? '' : 'hidden'}`}>
            <div className="card">
              <h2><i className="fas fa-key"></i> Redefinir Senha</h2>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.9rem' }}>Passo 1: Envie o código OTP. Passo 2: Redefina a senha.</p>
              
              <div id="step1" className="form-container">
                <h3 style={{ marginBottom: '15px', color: '#4361ee' }}><i className="fas fa-paper-plane"></i> Passo 1: Enviar e Validar Código</h3>
                
                <div className="form-group">
                  <label>Telefone ou Email</label>
                  <input 
                    type="text" 
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
                        checked={resetMethod === 'sms'} 
                        onChange={() => setResetMethod('sms')}
                      /> <i className="fas fa-mobile-alt"></i> SMS
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
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
                      placeholder="Digite o código recebido" 
                      className="form-input"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className={`result ${resetResult.type === 'success' ? 'success' : 'error'}`} style={{ display: resetResult.message ? 'block' : 'none' }}>
                  {resetResult.message}
                </div>
                
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={sendResetCode} className="btn-secondary btn-large">
                    <i className="fas fa-paper-plane"></i> Enviar Código
                  </button>
                  <button onClick={verifyCodeAndProceed} className="btn-primary btn-large">
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
                      placeholder="Confirmar senha" 
                      className="form-input"
                      value={resetPasswordConfirm}
                      onChange={(e) => setResetPasswordConfirm(e.target.value)}
                    />
                  </div>
                  
                  <div className={`result ${resetResult.type === 'success' ? 'success' : 'error'}`} style={{ display: resetResult.message ? 'block' : 'none' }}>
                    {resetResult.message}
                  </div>
                  
                  <button onClick={resetPasswordStep2} className="btn-success btn-large">
                    <i className="fas fa-key"></i> Redefinir Senha
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
