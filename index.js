const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const otpRoutes = require('./routes/otp');
const passwordRoutes = require('./routes/password');
const adminRoutes = require('./routes/admin');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/otp', otpRoutes);
app.use('/api/password', passwordRoutes);
app.use('/admin', adminRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'SMS OTP Backend API' });
});

// Export for Vercel serverless
module.exports = app;

// Only listen if not imported (for local dev)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
