const API_BASE = window.location.origin;
// WebSocket desativado para Vercel (serverless não suporta)
// const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
// let ws = null;
let ws = null;
let currentSection = 'overview';
let allLogs = [];

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  // WebSocket desativado para Vercel
  // setupWebSocket();
  checkConnection();
  loadOverview();
  setInterval(checkConnection, 30000);
});

function setupWebSocket() {
  ws = new WebSocket(WS_URL);
  
  ws.onopen = () => {
    console.log('WebSocket conectado');
    document.getElementById('websocket-status').className = 'status good';
    document.getElementById('websocket-status').textContent = 'Conectado';
    checkConnection();
  };
  
  ws.onmessage = (event) => {
    const { event: wsEvent } = JSON.parse(event.data);
    console.log('WebSocket event:', wsEvent);
    
    switch(wsEvent) {
      case 'otp-created':
      case 'otp-verified':
      case 'otp-deleted':
        if (currentSection === 'otps' || currentSection === 'overview') loadOTPs();
        if (currentSection === 'overview') loadOverview();
        if (currentSection === 'logs') loadLogs();
        break;
      case 'user-created':
        if (currentSection === 'users' || currentSection === 'overview') loadUsers();
        if (currentSection === 'overview') loadOverview();
        if (currentSection === 'logs') loadLogs();
        break;
      case 'password-reset':
        if (currentSection === 'overview') loadOverview();
        if (currentSection === 'logs') loadLogs();
        break;
    }
  };
  
  ws.onclose = () => {
    console.log('WebSocket desconectado, tentando reconectar...');
    document.getElementById('websocket-status').className = 'status bad';
    document.getElementById('websocket-status').textContent = 'Desconectado';
    setTimeout(setupWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket erro:', error);
  };
}

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
      document.getElementById(`${section}-section`).classList.remove('hidden');
      
      document.getElementById('section-title').textContent = item.textContent.trim();
      currentSection = section;
      refreshCurrentSection();
    });
  });
}

function refreshCurrentSection() {
  switch(currentSection) {
    case 'overview': loadOverview(); break;
    case 'users': loadUsers(); break;
    case 'otps': loadOTPs(); break;
    case 'password-reset': break;
    case 'settings': loadSettings(); break;
    case 'logs': loadLogs(); break;
  }
}

async function checkConnection() {
  const statusEl = document.getElementById('connection-status');
  if (!statusEl) return;
  
  const dot = statusEl.querySelector('.status-dot');
  const text = statusEl.querySelector('.status-text');
  if (!dot || !text) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/status`);
    const data = await response.json();
    
    if (data.supabase === 'connected') {
      dot.className = 'status-dot online';
      text.textContent = 'Online';
      const supabaseStatus = document.getElementById('supabase-status');
      if (supabaseStatus) {
        supabaseStatus.className = 'status good';
        supabaseStatus.textContent = 'Conectado';
      }
    } else {
      throw new Error('Supabase desconectado');
    }
  } catch (error) {
    dot.className = 'status-dot offline';
    text.textContent = 'Offline';
    const supabaseStatus = document.getElementById('supabase-status');
    if (supabaseStatus) {
      supabaseStatus.className = 'status bad';
      supabaseStatus.textContent = 'Desconectado';
    }
  }
  
  const lastCheck = document.getElementById('last-check');
  if (lastCheck) {
    lastCheck.textContent = new Date().toLocaleTimeString('pt-BR');
  }
}

async function loadOverview() {
  try {
    const [usersRes, otpsRes] = await Promise.all([
      fetch(`${API_BASE}/api/users`),
      fetch(`${API_BASE}/api/otps`)
    ]);
    
    const usersData = await usersRes.json();
    const otpsData = await otpsRes.json();
    
    const users = usersData.data || [];
    const otps = otpsData.data || [];
    
    document.getElementById('total-users').textContent = users.length;
    document.getElementById('total-otps').textContent = otps.length;
    document.getElementById('verified-otps').textContent = otps.filter(o => o.verified).length;
    
    const emailLogs = allLogs.filter(l => l.type === 'email');
    document.getElementById('email-sent').textContent = emailLogs.filter(l => l.message.includes('sent')).length;
    document.getElementById('password-resets').textContent = '0';
    
    const activityEl = document.getElementById('recent-activity');
    const recentOTPs = otps.slice(0, 5);
    if (recentOTPs.length > 0) {
      activityEl.innerHTML = recentOTPs.map(otp => `
        <div class="activity-item">
          <span class="activity-icon"><i class="fas fa-mobile-alt"></i></span>
          <div class="activity-info">
            <p><strong>OTP ${otp.verified ? 'verificado' : 'gerado'}</strong> para ${otp.telefone}</p>
            <small>${new Date(otp.created_at).toLocaleString('pt-BR')}</small>
          </div>
        </div>
      `).join('');
    } else {
      activityEl.innerHTML = '<p class="empty-state">Nenhuma atividade recente</p>';
    }
  } catch (error) {
    console.error('Erro ao carregar visão geral:', error);
  }
}

async function loadUsers() {
  const tbody = document.getElementById('users-body');
    tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
  
  try {
    const response = await fetch(`${API_BASE}/api/users`);
    const { data } = await response.json();
    
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhum usuário encontrado</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(user => `
      <tr>
        <td>${user.nome} ${user.sobrenome || ''}</td>
        <td>${user.email || '-'}</td>
        <td>${user.telefone || '-'}</td>
        <td>${new Date(user.criado_em).toLocaleString('pt-BR')}</td>
        <td><span class="badge ${user.ativo ? 'success' : 'error'}">${user.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td>
          <button class="btn-icon" onclick="viewUser('${user.telefone || user.email}')" title="Ver detalhes"><i class="fas fa-eye"></i></button>
          <button class="btn-icon" onclick="resetUserPassword('${user.telefone || user.email}')" title="Redefinir senha"><i class="fas fa-key"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
      tbody.innerHTML = '<tr><td colspan="7">Erro ao carregar usuários</td></tr>';
  }
}

async function loadOTPs() {
  const tbody = document.getElementById('otps-body');
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';
  
  try {
    const response = await fetch(`${API_BASE}/api/otps`);
    const { data } = await response.json();
    
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">Nenhum OTP encontrado</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(otp => {
      const now = new Date();
      const expiresAt = new Date(otp.expires_at);
      const isExpired = expiresAt < now;
      const status = otp.verified ? 'verified' : (isExpired ? 'expired' : 'pending');
      const statusText = otp.verified ? 'Verificado' : (isExpired ? 'Expirado' : 'Pendente');
      
      return `
        <tr>
          <td>${otp.telefone}</td>
          <td><strong>${otp.code}</strong></td>
          <td class="status-${status}">${statusText}</td>
          <td>${expiresAt.toLocaleString('pt-BR')}</td>
          <td>${otp.attempts || 0}</td>
          <td>
            <button class="btn-icon" onclick="deleteOTP('${otp.id}')" title="Excluir"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6">Erro ao carregar OTPs</td></tr>';
  }
}

async function generateOTPFromDashboard() {
  const phone = document.getElementById('phone-otp').value.trim();
  const resultDiv = document.getElementById('otp-result');
  
  if (!phone) {
    showResult(resultDiv, "Informe um número de telefone válido", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/otp/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    
    const data = await response.json();
    if (data.success) {
      showResult(resultDiv, "OTP gerado e enviado com sucesso!", "success");
      document.getElementById('phone-otp').value = '';
    } else {
      showResult(resultDiv, data.message || "Erro ao gerar OTP", "error");
    }
  } catch (error) {
    showResult(resultDiv, 'Erro de conexão com o servidor', 'error');
  }
}

// PASSO 1: Enviar código
async function sendResetCode() {
  const contact = document.getElementById('reset-contact').value.trim();
  const method = document.querySelector('input[name="reset-method"]:checked').value;
  const resultDiv = document.getElementById('reset-result');
  
  if (!contact) {
    showResult(resultDiv, 'Informe um telefone ou email', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/otp/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: contact, method })
    });
    
    const data = await response.json();
    if (data.success) {
      showResult(resultDiv, `Código enviado via ${method === 'email' ? 'email' : 'SMS'}! Verifique sua caixa de entrada.`, 'success');
      // Mostrar campo para digitar o código
      document.getElementById('otp-code-field').style.display = 'block';
      // Scroll para o campo
      document.getElementById('otp-code-field').scrollIntoView({ behavior: 'smooth' });
    } else {
      showResult(resultDiv, data.message || 'Erro ao enviar código', 'error');
    }
  } catch (error) {
    showResult(resultDiv, 'Erro de conexão com o servidor', 'error');
  }
}

// PASSO 1: Validar código e prosseguir para Passo 2
async function verifyCodeAndProceed() {
  const contact = document.getElementById('reset-contact').value.trim();
  const otp = document.getElementById('reset-otp').value.trim();
  const resultDiv = document.getElementById('reset-result');
  
  if (!otp) {
    showResult(resultDiv, 'Digite o código recebido', 'error');
    return;
  }
  
  try {
    const verifyRes = await fetch(`${API_BASE}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: contact, code: otp })
    });
    
    const verifyData = await verifyRes.json();
    
    if (!verifyData.success) {
      showResult(resultDiv, verifyData.message || 'Código inválido', 'error');
      return;
    }
    
    // Sucesso! Ocultar Passo 1 e mostrar Passo 2
    showResult(resultDiv, 'Código validado com sucesso! Agora defina sua nova senha.', 'success');
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    
  } catch (error) {
    showResult(resultDiv, 'Erro de conexão com o servidor', 'error');
  }
}

// PASSO 2: Redefinir senha após validação
async function resetPasswordStep2() {
  const contact = document.getElementById('reset-contact').value.trim();
  const password = document.getElementById('reset-password-new').value;
  const confirmPassword = document.getElementById('reset-password-confirm-new').value;
  const resultDiv = document.getElementById('reset-password-result');
  
  if (!password || !confirmPassword) {
    showResult(resultDiv, 'Preencha a nova senha e a confirmação', 'error');
    return;
  }
  
  if (password !== confirmPassword) {
    showResult(resultDiv, 'As senhas não coincidem', 'error');
    return;
  }
  
  if (password.length < 6) {
    showResult(resultDiv, 'A senha deve ter pelo menos 6 caracteres', 'error');
    return;
  }
  
  try {
    const resetRes = await fetch(`${API_BASE}/api/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: contact, newPassword: password })
    });
    
    const resetData = await resetRes.json();
    
    if (resetData.success) {
      showResult(resultDiv, 'Senha redefinida com sucesso!', 'success');
      // Limpar campos
      document.getElementById('reset-contact').value = '';
      document.getElementById('reset-otp').value = '';
      document.getElementById('reset-password-new').value = '';
      document.getElementById('reset-password-confirm-new').value = '';
      // Voltar para Passo 1 após 2 segundos
      setTimeout(() => {
        document.getElementById('step2').style.display = 'none';
        document.getElementById('step1').style.display = 'block';
        document.getElementById('otp-code-field').style.display = 'none';
        document.getElementById('reset-result').className = 'result hidden';
        document.getElementById('reset-password-result').className = 'result hidden';
      }, 2000);
    } else {
      showResult(resultDiv, resetData.message || 'Erro ao redefinir senha', 'error');
    }
  } catch (error) {
    showResult(resultDiv, 'Erro de conexão com o servidor', 'error');
  }
}

let currentConfirmCallback = null;

async function deleteOTP(id) {
  currentConfirmCallback = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/otp/${id}`, { method: 'DELETE' });
      const data = await response.json();
      closeModal();
      if (data.success) {
        showModal('Sucesso', 'OTP excluído com sucesso!', 'success');
      }
    } catch (error) {
      showModal('Erro', 'Erro ao excluir OTP', 'error');
    }
  };
  
  showConfirm('Confirmar Exclusão', 'Tem certeza que deseja excluir este OTP?');
}

function toggleResetMethod() {
  const method = document.querySelector('input[name="reset-method"]:checked').value;
  // Reset para Passo 1
  document.getElementById('step1').style.display = 'block';
  document.getElementById('step2').style.display = 'none';
  // NÃO esconder o otp-code-field - deixar visível
  document.getElementById('reset-otp').value = '';
  document.getElementById('reset-result').className = 'result hidden';
  document.getElementById('reset-password-result').className = 'result hidden';
}

async function sendResetCode() {
  const contact = document.getElementById('reset-contact').value.trim();
  const method = document.querySelector('input[name="reset-method"]:checked').value;
  const resultDiv = document.getElementById('reset-result');
  
  if (!contact) {
    showResult(resultDiv, 'Informe um telefone ou email', 'error');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/otp/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: contact, method })
    });
    
    const data = await response.json();
    if (data.success) {
      showResult(resultDiv, `Código enviado via ${method === 'email' ? 'email (Supabase Auth)' : 'SMS'}! Verifique sua caixa de entrada.`, 'success');
    } else {
      showResult(resultDiv, data.message || 'Erro ao enviar código', 'error');
    }
  } catch (error) {
    showResult(resultDiv, 'Erro de conexão com o servidor', 'error');
  }
}

async function viewUser(phoneOrEmail) {
  try {
    const response = await fetch(`${API_BASE}/api/users`);
    const { data } = await response.json();
    const user = data.find(u => u.telefone === phoneOrEmail || u.email === phoneOrEmail);
    
    if (!user) {
      showModal('Erro', 'Usuário não encontrado', 'error');
      return;
    }
    
    const statusClass = user.ativo ? 'success' : 'error';
    const statusText = user.ativo ? 'Ativo' : 'Inativo';
    const fotoUrl = user.foto_url ? `<img src="${user.foto_url}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin-bottom:15px;border:2px solid #e8e8e8;">` : 
      `<div style="width:80px;height:80px;border-radius:50%;background:#f0f4ff;display:flex;align-items:center;justify-content:center;margin-bottom:15px;color:#4361ee;font-size:1.5rem;"><i class="fas fa-user"></i></div>`;
    
    document.getElementById('modal-title').textContent = 'Detalhes do Usuário';
    document.getElementById('modal-body').innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        ${fotoUrl}
        <h3 style="color:#1a1a2e;margin-bottom:5px;">${user.nome} ${user.sobrenome || ''}</h3>
        <span class="badge ${statusClass}" style="font-size:0.8rem;">${user.papel}</span>
      </div>
      <div style="display:grid;gap:12px;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:#888;font-size:0.85rem;">Email</span>
          <span style="color:#1a1a2e;font-size:0.85rem;">${user.email || '-'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:#888;font-size:0.85rem;">Telefone</span>
          <span style="color:#1a1a2e;font-size:0.85rem;">${user.telefone || '-'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:#888;font-size:0.85rem;">Papel</span>
          <span style="color:#1a1a2e;font-size:0.85rem;">${user.papel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:#888;font-size:0.85rem;">Status</span>
          <span class="badge ${statusClass}" style="font-size:0.8rem;">${statusText}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <span style="color:#888;font-size:0.85rem;">Criado em</span>
          <span style="color:#1a1a2e;font-size:0.85rem;">${new Date(user.criado_em).toLocaleString('pt-BR')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;">
          <span style="color:#888;font-size:0.85rem;">Atualizado em</span>
          <span style="color:#1a1a2e;font-size:0.85rem;">${new Date(user.atualizado_em).toLocaleString('pt-BR')}</span>
        </div>
      </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
      <button class="btn-secondary" onclick="closeModal()">Fechar</button>
      <button class="btn-primary" onclick="resetUserPassword('${user.telefone || user.email}')">Redefinir Senha</button>
    `;
    document.getElementById('modal-overlay').classList.add('active');
  } catch (error) {
    showModal('Erro', 'Erro ao carregar detalhes do usuário', 'error');
  }
}

function resetUserPassword(phone) {
  document.getElementById('reset-phone').value = phone;
  document.querySelector('.nav-item[data-section="password-reset"]').click();
}

function loadSettings() {
  const url = 'ewyckxscedklztarigha.supabase.co';
  document.getElementById('supabase-url').textContent = url;
  
  const isHTTPS = window.location.protocol === 'https:';
  document.getElementById('https-status').textContent = isHTTPS ? 'Ativo (HTTPS)' : 'Inativo (HTTP)';
  document.getElementById('https-status').className = isHTTPS ? 'status good' : 'status warning';
}

function testSupabaseConnection() {
  checkConnection();
  showModal('Teste de Conexão', 'Teste de conexão executado! Verifique o status acima.', 'info');
}

function testSMS() {
  const phone = prompt('Digite um número para teste de SMS:');
  if (phone) {
    fetch(`${API_BASE}/api/otp/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    }).then(res => res.json())
      .then(data => {
        if (data.success) {
          showModal('SMS Enviado', 'SMS enviado com sucesso!', 'success');
        } else {
          showModal('Erro', 'Erro ao enviar SMS: ' + data.message, 'error');
        }
      });
  }
}

async function loadLogs() {
  const logsList = document.getElementById('logs-list');
  logsList.innerHTML = '<p class="empty-state">Carregando logs...</p>';
  
  try {
    const response = await fetch(`${API_BASE}/api/logs`);
    const { data } = await response.json();
    
    if (!data || data.length === 0) {
      logsList.innerHTML = '<p class="empty-state">Nenhum log encontrado</p>';
      allLogs = [];
      return;
    }
    
    allLogs = data;
    displayLogs(allLogs);
  } catch (error) {
    logsList.innerHTML = '<p class="empty-state">Erro ao carregar logs</p>';
  }
}

function displayLogs(logs) {
  const logsList = document.getElementById('logs-list');
  
  if (logs.length === 0) {
    logsList.innerHTML = '<p class="empty-state">Nenhum log encontrado</p>';
    return;
  }
  
  logsList.innerHTML = logs.map(log => `
    <div class="log-item log-${log.type}">
      <span class="log-icon"><i class="${log.icon}"></i></span>
      <div class="log-info">
        <p>${log.message}</p>
        <small>${new Date(log.time).toLocaleString('pt-BR')}</small>
      </div>
    </div>
  `).join('');
}

function filterLogs(type) {
  document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  if (type === 'all') {
    displayLogs(allLogs);
  } else {
    const filtered = allLogs.filter(log => {
      if (type === 'otp') return log.type.includes('otp');
      return log.type === type;
    });
    displayLogs(filtered);
  }
}

function showResult(element, message, type) {
  element.textContent = message;
  element.className = `result ${type}`;
  element.classList.remove('hidden');
  setTimeout(() => {
    element.classList.add('hidden');
    element.className = 'result hidden';
  }, 5000);
}

function showModal(title, message, type = 'info') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}" 
         style="font-size: 2rem; color: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};"></i>
      <p style="font-size: 1.1rem;">${message}</p>
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn-primary" onclick="closeModal()">OK</button>
  `;
  document.getElementById('modal-overlay').classList.add('active');
}

function showConfirm(title, message) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
      <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #f59e0b;"></i>
      <p style="font-size: 1.1rem;">${message}</p>
    </div>
  `;
  document.getElementById('modal-footer').innerHTML = `
    <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn-primary" onclick="executeConfirm()">Confirmar</button>
  `;
  document.getElementById('modal-overlay').classList.add('active');
}

function executeConfirm() {
  if (currentConfirmCallback) {
    currentConfirmCallback();
    currentConfirmCallback = null;
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}
