const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const sendCode = async (phone) => {
  const res = await fetch(`${API_URL}/api/otp/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  return res.json();
};

export const verifyCode = async (phone, code) => {
  const res = await fetch(`${API_URL}/api/otp/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code })
  });
  return res.json();
};

export const resetPassword = async (phone, newPassword) => {
  const res = await fetch(`${API_URL}/api/password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, newPassword })
  });
  return res.json();
};

export const getStats = async () => {
  const res = await fetch(`${API_URL}/admin/`, {
    headers: { 'Authorization': 'Basic ' + btoa('admin:admin123') }
  });
  return res.text();
};
