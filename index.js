const express = require('express');
const axios = require('axios');
const app = express();

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
    console.log('Webhook verificado com sucesso!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receber mensagens (obrigatório pela Meta)
app.post('/webhook', (req, res) => {
  console.log('Webhook recebido:', JSON.stringify(req.body));
  res.sendStatus(200);
});

// Enviar mensagem para cliente
app.post('/enviar', async (req, res) => {
  const { telefone, mensagem } = req.body;

  if (!telefone || !mensagem) {
    return res.status(400).json({ erro: 'telefone e mensagem são obrigatórios' });
  }

  // Limpar telefone e garantir formato internacional
  let phone = telefone.replace(/\D/g, '');
  if (!phone.startsWith('55')) phone = '55' + phone;

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: mensagem }
      },
      {
        headers: {
          Authorization: `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Mensagem enviada:', response.data);
    res.json({ sucesso: true, data: response.data });
  } catch (error) {
    console.error('Erro ao enviar:', error.response?.data || error.message);
    res.status(500).json({ erro: error.response?.data || error.message });
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
