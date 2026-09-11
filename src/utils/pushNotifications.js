const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const AUTH_STORAGE_KEY = 'ss_auth_v1';

function getAuthToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Pide permiso de notificaciones y suscribe al usuario al servicio push del backend.
 * Se debe llamar una vez que el usuario ya inició sesión.
 * No hace nada (silenciosamente) si el navegador no soporta push o el usuario ya negó el permiso antes.
 */
export async function subscribeToPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return; // Navegador sin soporte
    }
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') {
      return; // El usuario ya dijo que no, no insistir
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const keyRes = await fetch(`${API_BASE_URL}/push/vapid-public-key`);
      const { publicKey } = await keyRes.json();
      if (!publicKey) return; // Backend sin VAPID configurado todavía

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const token = getAuthToken();
    await fetch(`${API_BASE_URL}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
  } catch (error) {
    console.warn('No se pudo suscribir a notificaciones push:', error);
  }
}
