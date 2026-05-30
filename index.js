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

// Mapa de coluna para template
const TEMPLATE_MAP = {
  entrada:    'bike_recebida',
  avaliacao:  'bike_em_avaliacao',
  aprovacao:  'bike_orcamento_pronto',
  aprovadas:  'bike_aprovada',
  servico:    'bike_em_servico',
  aguardando: 'bike_aguardando_peca',
  pronto:     'bike_pronta',
  entregue:   'bike_entregue',
};

const MSG_AUTO_REPLY =
  'Ol\u00E1! \uD83D\uDE04 Este n\u00FAmero \u00E9 exclusivo para *notifica\u00E7\u00F5es autom\u00E1ticas* da Adventure Bikers.\n\n' +
  '\u26D4 N\u00E3o monitoramos mensagens recebidas por aqui.\n\n' +
  '\uD83D\uDCAC Para falar com nossa equipe, entre em contato pelo WhatsApp da loja:\n' +
  '*https://wa.me/5519999683552*\n\n' +
  '_Adventure Bikers \uD83D\uDEB5\u200D\u2642\uFE0F_';

// Enviar mensagem de texto simples
async function sendTextMessage(phone, message) {
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

// Enviar template com variáveis nome e bike
async function sendTemplate(phone, templateName, nome, bike) {
  let p = String(phone).replace(/\D/g, '');
  if (!p.startsWith('55')) p = '55' + p;
  const body = {
    messaging_product: 'whatsapp',
    to: p,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: nome },
            { type: 'text', text: bike }
          ]
        }
      ]
    }
  };
  console.log('Enviando template:', templateName, 'para:', p);
  const response = await axios.post(
    `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`,
    body,
    { headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' } }
  );
  return response.data;
}

// Verificação do webhook
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

// Receber mensagens e auto-reply
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
      await sendTextMessage(from, MSG_AUTO_REPLY);
      console.log('Auto-reply enviado para:', from);
    }
  } catch (err) {
    console.error('Erro no webhook:', err.message);
  }
});

// Enviar notificação via template
app.post('/enviar', async (req, res) => {
  const { telefone, mensagem, col, nome, bike } = req.body;
  if (!telefone) {
    return res.status(400).json({ erro: 'telefone e obrigatorio' });
  }

  // Se tiver col, nome e bike — usar template
  if (col && nome && bike && TEMPLATE_MAP[col]) {
    const templateName = TEMPLATE_MAP[col];
    try {
      const data = await sendTemplate(telefone, templateName, nome, bike);
      console.log('Template enviado:', templateName, 'para:', telefone);
      return res.json({ sucesso: true, tipo: 'template', data });
    } catch (error) {
      const errData = error.response?.data || error.message;
      console.error('Erro template:', JSON.stringify(errData));
      // Fallback para texto livre se template falhar
      console.log('Tentando texto livre como fallback...');
    }
  }

  // Texto livre (orçamento, recusa, etc.)
  if (!mensagem) {
    return res.status(400).json({ erro: 'mensagem obrigatoria para texto livre' });
  }
  try {
    const data = await sendTextMessage(telefone, mensagem);
    console.log('Texto enviado para:', telefone);
    res.json({ sucesso: true, tipo: 'texto', data });
  } catch (error) {
    const errData = error.response?.data || error.message;
    console.error('Erro texto:', JSON.stringify(errData));
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
