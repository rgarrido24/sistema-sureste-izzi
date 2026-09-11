import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:soporte@agentia.software';

  if (!publicKey || !privateKey) {
    console.warn('⚠️ VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY no configuradas — notificaciones push desactivadas');
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Envía una notificación push a TODOS los usuarios suscritos.
 * Se usa, por ejemplo, después de una carga masiva de archivos exitosa.
 */
export async function notifyAll(title, body, url = '/') {
  if (!ensureConfigured()) return { sent: 0, failed: 0 };

  const subs = await PushSubscription.find({}).lean();
  const payload = JSON.stringify({ title, body, url });

  let sent = 0;
  let failed = 0;

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
      sent++;
    } catch (error) {
      failed++;
      // Suscripción vencida o inválida (410/404) -> limpiar de la base
      if (error.statusCode === 410 || error.statusCode === 404) {
        try { await PushSubscription.deleteOne({ endpoint: sub.endpoint }); } catch (e) {}
      }
    }
  }));

  console.log(`🔔 Push enviado: ${sent} ok, ${failed} fallidos (de ${subs.length} suscritos)`);
  return { sent, failed };
}
