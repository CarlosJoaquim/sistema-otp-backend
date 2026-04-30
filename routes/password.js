const express = require('express');
const router = express.Router();
const { resetPassword } = require('../services/passwordService');

router.post('/reset', async (req, res) => {
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
});

module.exports = router;
