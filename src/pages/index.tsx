import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [currentSection, setCurrentSection] = useState('overview');
  const [users, setUsers] = useState([]);
  const [otps, setOtps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOtps: 0,
    verifiedOtps: 0
  });
  
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
  
  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      const base = API_BASE || window.location.origin;
      const [usersRes, otpsRes] = await Promise.all([
        fetch(`${base}/api/users`),
        fetch(`${base}/api/otps`)
      ]);
      
      const usersData = await usersRes.json();
      const otpsData = await otpsRes.json();
      
      setUsers(usersData.data || []);
      setOtps(otpsData.data || []);
      setStats({
        totalUsers: (usersData.data || []).length,
        totalOtps: (otpsData.data || []).length,
        verifiedOtps: (otpsData.data || []).filter((o: any) => o.verified).length
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <Head>
        <title>OTP CAOP-B</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>
      
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <aside style={{ width: '240px', background: 'white', padding: '20px' }}>
          <h2>OTP CAOP-B</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {['overview', 'users', 'otps', 'password-reset', 'logs'].map(section => (
              <li 
                key={section}
                onClick={() => setCurrentSection(section)}
                style={{ padding: '12px 16px', cursor: 'pointer', background: currentSection === section ? '#4361ee' : 'transparent', color: currentSection === section ? 'white' : '#666', borderRadius: '8px', margin: '4px 0' }}
              >
                {section === 'overview' ? 'Visão Geral' : 
                 section === 'users' ? 'Usuários' :
                 section === 'otps' ? 'OTPs' :
                 section === 'password-reset' ? 'Redefinir Senha' : 'Logs'}
              </li>
            ))}
          </ul>
        </aside>

        <main style={{ marginLeft: '240px', padding: '20px', flex: 1 }}>
          <h1>
            {currentSection === 'overview' ? 'Visão Geral' :
             currentSection === 'users' ? 'Usuários' :
             currentSection === 'otps' ? 'OTPs' :
             currentSection === 'password-reset' ? 'Redefinir Senha' : 'Logs'}
          </h1>
          
          {currentSection === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
              <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
                <h3>Usuários</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalUsers}</div>
              </div>
              <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
                <h3>OTPs Gerados</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.totalOtps}</div>
              </div>
              <div style={{ background: 'white', padding: '20px', borderRadius: '10px' }}>
                <h3>OTPs Verificados</h3>
                <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.verifiedOtps}</div>
              </div>
            </div>
          )}
          
          {currentSection === 'users' && (
            <table style={{ width: '100%', background: 'white', borderRadius: '10px', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>Nome</th><th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>Email</th><th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>Telefone</th></tr>
              </thead>
              <tbody>
                {users.map((user: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{user.nome} {user.sobrenome || ''}</td>
                    <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{user.email || '-'}</td>
                    <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{user.telefone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          {currentSection === 'otps' && (
            <table style={{ width: '100%', background: 'white', borderRadius: '10px', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>Telefone</th><th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>Código</th><th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #eee' }}>Status</th></tr>
              </thead>
              <tbody>
                {otps.map((otp: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}>{otp.phone || otp.email}</td>
                    <td style={{ padding: '12px', borderBottom: '1px solid #eee' }}><strong>{otp.code}</strong></td>
                    <td style={{ padding: '12px', borderBottom: '1px solid #eee', color: otp.verified ? '#16a34a' : '#dc2626' }}>{otp.verified ? 'Verificado' : 'Pendente'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </>
  );
}
