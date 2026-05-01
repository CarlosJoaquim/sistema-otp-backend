const API_BASE = window.location.origin;

async function generateOTP() {
  const phone = document.getElementById('phone').value.trim();
  const resultDiv = document.getElementById('generate-result');
  
  if (!phone) {
    showResult(resultDiv, 'Informe um número de telefone válido', 'error');
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
      showResult(resultDiv, 'OTP gerado e enviado com sucesso!', 'success');
      document.getElementById('phone').value = '';
      loadOTPs();
    } else {
      showResult(resultDiv, data.message || 'Erro ao gerar OTP', 'error');
    }
  } catch (error) {
    showResult(resultDiv, 'Erro de conexão com o servidor', 'error');
  }
}

async function verifyOTP() {
  const phone = document.getElementById('verify-phone').value.trim();
  const code = document.getElementById('verify-code').value.trim();
  const resultDiv = document.getElementById('verify-result');
  
  if (!phone || !code) {
    showResult(resultDiv, 'Informe o telefone e o código', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    
    const data = await response.json();
    if (data.success) {
      showResult(resultDiv, 'OTP verificado com sucesso!', 'success');
      document.getElementById('verify-phone').value = '';
      document.getElementById('verify-code').value = '';
      loadOTPs();
    } else {
      showResult(resultDiv, data.message || 'Erro ao verificar OTP', 'error');
    }
  } catch (error) {
    showResult(resultDiv, 'Erro de conexão com o servidor', 'error');
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
          <td>${otp.phone}</td>
          <td>${otp.code}</td>
          <td class="status-${status}">${statusText}</td>
          <td>${expiresAt.toLocaleString('pt-BR')}</td>
          <td>${otp.attempts || 0}</td>
          <td>
            <button class="delete-btn" onclick="deleteOTP('${otp.id}')">Excluir</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6">Erro ao carregar OTPs</td></tr>';
  }
}

async function loadUsers() {
  const tbody = document.getElementById('users-body');
  tbody.innerHTML = '<tr><td colspan="2">Carregando...</td></tr>';
  
  try {
    const response = await fetch(`${API_BASE}/api/users`);
    const { data } = await response.json();
    
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2">Nenhum usuário encontrado</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(user => `
      <tr>
        <td>${user.phone}</td>
        <td>${new Date(user.created_at).toLocaleString('pt-BR')}</td>
      </tr>
    `).join('');
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="2">Erro ao carregar usuários</td></tr>';
  }
}

async function deleteOTP(id) {
  if (!confirm('Tem certeza que deseja excluir este OTP?')) return;
  
  try {
    const response = await fetch(`${API_BASE}/api/otp/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    if (data.success) {
      loadOTPs();
    }
  } catch (error) {
    alert('Erro ao excluir OTP');
  }
}

function showResult(element, message, type) {
  element.textContent = message;
  element.className = `result ${type}`;
  setTimeout(() => {
    element.className = 'result';
  }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
  loadOTPs();
  loadUsers();
});
