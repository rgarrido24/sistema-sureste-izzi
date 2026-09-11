import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import PushSubscription from '../models/PushSubscription.js';

const router = express.Router();

// Pública (sin auth): el frontend la necesita antes de que el usuario inicie sesión en algunos flujos
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

router.use(requireAuth);

router.post('/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ error: 'Suscripción inválida' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userId: req.user?.id || '',
        username: req.user?.username || '',
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error guardando suscripción push:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Falta endpoint' });
    await PushSubscription.deleteOne({ endpoint });
    res.json({ success: true });
  } catch (error) {
    console.error('Error eliminando suscripción push:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

export default router;
