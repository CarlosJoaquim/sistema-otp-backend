const { verifyOTP } = require('../../../../services/otpService');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });
    
    const result = await verifyOTP(phone, code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
