# Captura de estatus del portal de Izzi (pruebas)

Una persona con acceso al portal abre la pantalla (Detalle de Cuentas, Ruta Técnico o el detalle de una orden) y toca **Sincronizar**.
La herramienta solo **lee lo que ya está en pantalla** y lo manda a RGO con una llave propia. No navega ni repite consultas.

1. En RGO (rol admin/director): `POST /api/estatus/admin/integraciones` con `{ "nombre": "Mesa Mérida", "tipo": "captura" }` → devuelve la llave una vez. Igual con `"tipo": "bot"` para el chatbot.
2. PC: Chrome → Extensiones → Modo desarrollador → "Cargar descomprimida" → carpeta `extension/`. Guardar dirección del servidor y llave.
3. Celular: crear un marcador en Chrome con cualquier nombre, editarlo y pegar el contenido de `marcador.txt` como dirección. En el portal, abrir la barra de direcciones, escribir el nombre del marcador y elegirlo (la primera vez pide la dirección y la llave).
4. Chatbot: `POST /api/estatus/bot/consulta` con `{ "telefono": "5219991234567", "mensaje": "123456789" }` y la llave `bot` → `{ "respuesta": "texto" }`.
