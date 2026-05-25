const express = require('express');
const axios = require('axios');
const app = express();

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'advbikers2024';
const WA_TOKEN = process.env.WA_TOKEN;
const WA_PHONE_ID = process.env.WA_PHONE_ID;

// Verificação do webhook pela Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verificado!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receber mensagens
app.post('/webhook', (req, res) => {
  console.log('Webhook recebido:', JSON.stringify(req.body));
  res.sendStatus(200);
});

// Enviar mensagem
app.post('/enviar', async (req, res) => {
  const { telefone, mensagem } = req.body;
  if (!telefone || !mensagem) {
    return res.status(400).json({ erro: 'telefone e mensagem são obrigatórios' });
  }

  let phone = String(telefone).replace(/\D/g, '');
  if (!phone.startsWith('55')) phone = '55' + phone;

  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: {
      preview_url: false,
      body: String(mensagem)
    }
  };

  console.log('Enviando para:', phone);
  console.log('Body:', JSON.stringify(body));

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
      body,
      {
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Sucesso:', response.data);
    res.json({ sucesso: true, data: response.data });
  } catch (error) {
    const errData = error.response?.data || error.message;
    console.error('Erro ao enviar:', JSON.stringify(errData));
    res.status(500).json({ erro: errData });
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'online', servico: 'Adventure Bikers WhatsApp Webhook' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
