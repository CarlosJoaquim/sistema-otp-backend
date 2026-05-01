const { resetPassword } = require('../../../../services/passwordService');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { phone, newPassword } = req.body;
    if (!phone || !newPassword) {
      return res.status(400).json({ error: 'Phone and new password are required' });
    }
    
    const result = await resetPassword(phone, newPassword);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
