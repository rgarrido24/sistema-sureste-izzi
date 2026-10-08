// Lee la pantalla del portal de Izzi que YA tienes abierta (tabla de Detalle de Cuentas / Ruta Técnico, o el detalle de una orden)
// y devuelve filas. No navega, no hace clic, no repite consultas: solo lee lo que tú ya cargaste.
// El servidor descarta nombre, teléfono y dirección; aquí solo se arman pares encabezado → valor.
(function (global) {
  const limpia = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  function leerTablas(doc) {
    const filas = [];
    doc.querySelectorAll('table').forEach((t) => {
      const ths = t.querySelectorAll('thead th, thead td');
      let enc = Array.from(ths).map((x) => limpia(x.textContent));
      let cuerpo = Array.from(t.querySelectorAll('tbody tr'));
      if (!enc.length) {
        const todas = Array.from(t.querySelectorAll('tr'));
        if (todas.length < 2) return;
        enc = Array.from(todas[0].children).map((x) => limpia(x.textContent));
        cuerpo = todas.slice(1);
      }
      if (!enc.some((h) => /orden/i.test(h))) return; // solo tablas que traigan número de orden
      cuerpo.forEach((tr) => {
        const celdas = Array.from(tr.children).map((x) => limpia(x.textContent));
        if (celdas.length !== enc.length) return;
        const fila = {};
        enc.forEach((h, i) => { if (h) fila[h] = celdas[i]; });
        filas.push(fila);
      });
    });
    return filas;
  }

  // Detalle de una orden (ventana emergente): Horario, Posición en Ruta, "ya no está pendiente"
  function leerDetalleOrden(doc) {
    const modales = doc.querySelectorAll('[role="dialog"], .modal.show, .modal.in, .modal[style*="display: block"], .swal2-popup');
    for (const m of modales) {
      const txt = limpia(m.innerText || m.textContent);
      const orden = txt.match(/\b\d{1,2}-\d{6,}\b/);
      if (!orden) continue;
      const fila = { 'Num Orden': orden[0] };
      const h = txt.match(/Horario\s*:?\s*([0-9]{1,2}[:.][0-9]{2}\s*(?:-|a|–)\s*[0-9]{1,2}[:.][0-9]{2})/i);
      if (h) fila['Horario'] = h[1];
      const p = txt.match(/Posici[oó]n en Ruta\s*:?\s*(\d+)/i);
      if (p) fila['Posición en Ruta'] = p[1];
      if (/ya no est[aá] pendiente/i.test(txt)) fila.pendienteEnRuta = false;
      else if (h || p) fila.pendienteEnRuta = true;
      return [fila];
    }
    return [];
  }

  function capturar(doc) {
    const tablas = leerTablas(doc);
    return tablas.length ? tablas : leerDetalleOrden(doc);
  }

  global.RGOCaptura = { capturar, leerTablas, leerDetalleOrden };
})(typeof window !== 'undefined' ? window : globalThis);
