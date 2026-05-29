const express = require('express');
const axios = require('axios');
const app = express();

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

const MSG_AUTO_REPLY = 
  'Ol\u00E1! \uD83D\uDE04 Este n\u00FAmero \u00E9 exclusivo para *notifica\u00E7\u00F5es autom\u00E1ticas* da Adventure Bikers.\n\n' +
  '\u26D4 N\u00E3o monitoramos mensagens recebidas por aqui.\n\n' +
  '\uD83D\uDCAC Para falar com nossa equipe, entre em contato pelo WhatsApp da loja:\n' +
  '*https://wa.me/5519999683552*\n\n' +
  '_Adventure Bikers \uD83D\uDEB5\u200D\u2642\uFE0F_';

async function sendMessage(phone, message) {
  let p = String(phone).replace(/\D/g, '');
  if (!p.startsWith('55')) p = '55' + p;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: p,
    type: 'text',
    text: { preview_url: false, body: String(message) }
  };
  const response = await axios.post(
    `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
    body,
    { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } }
  );
  return response.data;
}

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

// Receber mensagens e responder automaticamente
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const entry = req.body.entry && req.body.entry[0];
    const changes = entry && entry.changes && entry.changes[0];
    const value = changes && changes.value;
    const messages = value && value.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const from = msg.from;
      console.log('Mensagem recebida de:', from);
      // Enviar auto-reply
      await sendMessage(from, MSG_AUTO_REPLY);
      console.log('Auto-reply enviado para:', from);
    }
  } catch (err) {
    console.error('Erro no webhook:', err.message);
  }
});

// Enviar mensagem para cliente
app.post('/enviar', async (req, res) => {
  const { telefone, mensagem } = req.body;
  if (!telefone || !mensagem) {
    return res.status(400).json({ erro: 'telefone e mensagem sao obrigatorios' });
  }
  try {
    const data = await sendMessage(telefone, mensagem);
    console.log('Mensagem enviada para:', telefone);
    res.json({ sucesso: true, data });
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
