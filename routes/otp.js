const express = require('express');
const router = express.Router();
const { createOTP, verifyOTP } = require('../services/otpService');

router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });
    
    // checkUserExists=true para redefinição de senha
    const result = await createOTP(phone, true);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify-code', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Phone and code are required' });
    
    const result = await verifyOTP(phone, code);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
