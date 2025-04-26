import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import serviceRoutes from './routes/service.js';
import productRoutes from './routes/products.js';
import notesRoutes from './routes/notes.js';
// import { messengerHandler } from './controllers/webhook.js';
import { messengerPoller, verifyWebhook } from './controllers/webhook.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
messengerPoller.start();

// Webhook endpoints
app.post('/webhook', (req, res) => {
  if (req.body.object === 'page') {
    req.body.entry.forEach(entry => {
      entry.messaging?.forEach(event => {
        console.log('📥 Webhook event received:', event);
        // You can trigger manual processing here if needed
      });
    });
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
    consolelog('error');
  }
});
app.get('/webhook', verifyWebhook);

app.use('/api/services', serviceRoutes);
app.use('/api/products', productRoutes);
app.use('/api/notes', notesRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    pollerStatus: messengerPoller.isRunning ? 'active' : 'inactive'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});