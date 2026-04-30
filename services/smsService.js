const axios = require('axios');
require('dotenv').config();

const AUTH_URL = 'https://app.smshubangola.com/api/authentication';
const SEND_URL = 'https://app.smshubangola.com/api/sendsms';

let cachedToken = null;
let tokenExpiry = null;

const getAuthToken = async () => {
  if (cachedToken && tokenExpiry && new Date() < new Date(tokenExpiry)) {
    return cachedToken;
  }

  const response = await axios.post(AUTH_URL, {
    authId: process.env.SMSHUB_AUTH_ID,
    secretKey: process.env.SMSHUB_AUTH_SECRET
  });

  if (response.data.status === 200) {
    cachedToken = response.data.data.authToken;
    tokenExpiry = response.data.data.tokenExpiry;
    return cachedToken;
  } else {
    throw new Error('Falha na autenticação SMSHub');
  }
};

const sendSMS = async (phone, message) => {
  try {
    const authToken = await getAuthToken();
    const from = process.env.SMSHUB_SENDER_ID || 'smshub';
    const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;

    const response = await axios.post(SEND_URL, {
      contactNo: [formattedPhone],
      message: message,
      from: from
    }, {
      headers: {
        'Content-Type': 'application/json',
        'accessToken': authToken
      }
    });

    if (response.data.status === 200 && response.data.sms) {
      const smsData = response.data.sms[0]?.data;
      if (smsData?.status === 1) {
        console.log(`SMS enviado. Message ID: ${smsData.message_id}`);
        return { success: true, messageId: smsData.message_id };
      } else {
        throw new Error(`SMS falhou: ${JSON.stringify(smsData)}`);
      }
    } else {
      throw new Error(`Resposta inválida: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.error('SMS send error:', error.response?.data || error.message);
    throw new Error('Failed to send SMS');
  }
};

module.exports = { sendSMS };
