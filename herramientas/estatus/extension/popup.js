const $ = (id) => document.getElementById(id);
const msg = (t) => { $('msg').textContent = t; };

chrome.storage.local.get(['url', 'key'], (c) => {
  $('url').value = c.url || '';
  $('key').value = c.key || '';
  if (!c.url || !c.key) $('cfg').open = true;
});

$('guardar').onclick = () => {
  chrome.storage.local.set({ url: $('url').value.trim().replace(/\/$/, ''), key: $('key').value.trim() }, () => msg('Guardado.'));
};

$('sync').onclick = async () => {
  const { url, key } = await chrome.storage.local.get(['url', 'key']);
  if (!url || !key) { $('cfg').open = true; return msg('Primero guarda la dirección y la llave.'); }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Lee la pantalla que ya está abierta (nada más)
  const [{ result: filas }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['captura-core.js'],
  }).then(() => chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.RGOCaptura.capturar(document) }));
  if (!filas || !filas.length) return msg('No encontré órdenes en esta pantalla. Abre el resultado de la búsqueda (o el detalle de la orden) y vuelve a intentar.');
  msg(`Enviando ${filas.length} orden(es)…`);
  try {
    const r = await fetch(`${url}/api/estatus/ingesta/captura`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Integracion-Key': key },
      body: JSON.stringify({ fuente: tab.title || '', filas }),
    });
    const j = await r.json();
    if (!r.ok) return msg(`Error: ${j.error || r.status}`);
    msg(`Listo: ${j.nuevas} nuevas, ${j.actualizadas} actualizadas (${j.conCambio} con cambio de estatus).`);
  } catch (e) {
    msg('No se pudo conectar con RGO.');
  }
};
