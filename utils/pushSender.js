import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import User from '../models/User.js';

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

async function enviarASubs(subs, payload) {
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

/**
 * Envía una notificación push a TODOS los usuarios suscritos.
 * Se usa, por ejemplo, después de una carga masiva de archivos exitosa.
 */
export async function notifyAll(title, body, url = '/') {
  if (!ensureConfigured()) return { sent: 0, failed: 0 };

  const subs = await PushSubscription.find({}).lean();
  return enviarASubs(subs, JSON.stringify({ title, body, url }));
}

/**
 * Envía una notificación push solo a los usuarios con alguno de los roles indicados
 * (ej. avisar a Mesa de Control que un reclutado está atorado).
 */
export async function notifyRoles(roles, title, body, url = '/') {
  if (!ensureConfigured()) return { sent: 0, failed: 0 };

  const users = await User.find({ role: { $in: roles } }, { _id: 1 }).lean();
  const ids = users.map((u) => String(u._id));
  if (ids.length === 0) return { sent: 0, failed: 0 };

  const subs = await PushSubscription.find({ userId: { $in: ids } }).lean();
  return enviarASubs(subs, JSON.stringify({ title, body, url }));
}
