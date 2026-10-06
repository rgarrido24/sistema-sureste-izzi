# Seguridad del sistema — checklist

Lo que ya hace el código (no requiere acción): sesiones firmadas, contraseñas con bcrypt, límite de intentos de login,
CORS solo para tu app, headers de seguridad, puerta de entrada que rechaza peticiones sin sesión, errores sin detalles
internos, y permisos por rol en cada ruta.

## Lo que SOLO puedes hacer tú (el código no puede)

1. **Rotar la contraseña de MongoDB** (Atlas > Database Access > tu usuario > Edit Password) y actualizar `MONGODB_URI` en Render.
   Estuvo publicada en git: asume que alguien con acceso al repo la vio.
2. **Poner un `JWT_SECRET` nuevo en Render** (Environment). Generar:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   Mientras no lo pongas, el servidor usa uno temporal y las sesiones se cierran en cada reinicio.
3. **Sacar `.env` de git**: `git rm --cached .env` y commit. (Tu archivo local se queda.)
4. **GitHub**: Settings > General > Danger Zone: el repo debe ser **Private**. Activa 2FA en tu cuenta de GitHub, Vercel, Render y Atlas.
5. **Atlas > Network Access**: quita `0.0.0.0/0` si está. Deja solo las IP de salida de Render (Render > tu servicio > Outbound IP addresses).
6. **Atlas**: crea un usuario de base de datos con permisos solo de lectura/escritura sobre `sistema-sureste` (no admin) y úsalo en `MONGODB_URI`. Activa backups.
7. **Vercel**: si existe la variable `VITE_GEMINI_API_KEY`, bórrala y rota esa clave de Gemini (todo `VITE_*` es público en el navegador).
8. Después de rotar, revisa en Atlas > Security > Access/Activity el historial por accesos que no reconozcas.

## Repartir el sistema a otras personas o empresas

- Este sistema es de **una sola empresa**: no tiene separación de datos entre clientes. A otra empresa dale **su propia instalación**
  (su propio servidor, su propia base de datos y sus propios secretos), nunca una cuenta dentro de esta.
- Dominios adicionales para tu frontend: variable `CORS_ORIGINS` en Render (separados por coma).
- Si pones Cloudflare delante de Render, `TRUST_PROXY_HOPS=2`.
