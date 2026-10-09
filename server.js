import express from 'express';
import { aplicarSeguridadBase, puertaDeEntrada, limitarLogin, limitarLoginPorIp, manejarErrores } from './middleware/seguridad.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import os from 'os';
import usersRoutes from './routes/users.js';
import { requireAuth } from './middleware/auth.js';
import { bloquearRoles } from './middleware/bloquearRoles.js';
import { bloquearDistribuidores } from './middleware/bloquearDistribuidores.js';
import { migrarPasswordsLegacy } from './utils/passwords.js';
import salesRoutes from './routes/sales.js';
import installRoutes from './routes/install.js';
import operacionRoutes from './routes/operacion.js';
import reportsRoutes from './routes/reports.js';
import packagesRoutes from './routes/packages.js';
import promocionesRoutes from './routes/promociones.js';
import pdfsRoutes from './routes/pdfs.js';
import m1Routes from './routes/m1.js';
import m0Routes from './routes/m0.js';
import whatsappRoutes from './routes/whatsapp.js';
import pushRoutes from './routes/push.js';
import clavesRoutes from './routes/claves.js';
import capacitacionesRoutes from './routes/capacitaciones.js';
import capacitacionesContenidoRoutes from './routes/capacitacionesContenido.js';
import imagenesVentaRoutes from './routes/imagenesVenta.js';
import rankingRoutes from './routes/ranking.js';
import puntosRoutes from './routes/puntos.js';
import comisionesRoutes from './routes/comisiones.js';
import arranqueRoutes from './routes/arranque.js';
import m2Routes from './routes/m2.js';
import m3Routes from './routes/m3.js';
import m4Routes from './routes/m4.js';
import m5Routes from './routes/m5.js';
import m6Routes from './routes/m6.js';
import templatesRoutes from './routes/templates.js';
import statsRoutes from './routes/stats.js';
import uploadRoutes from './routes/upload.js';
import assistantRoutes from './routes/assistant.js';
import activityRoutes from './routes/activity.js';
import { ingestaRouter, botRouter, adminRouter as estatusAdminRouter } from './routes/estatus.js';
import analisisM1Routes from './routes/analisisM1.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Loguear errores fatales para diagnosticar fallas tipo exit 134 en Render
process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
  // Salir para que Render reinicie el proceso con logs claros
  process.exit(1);
});

// Evita que Mongoose "bufferice" queries cuando la DB no está conectada (causa timeouts/502 en Render)
mongoose.set('bufferCommands', false);

// Middleware
// Seguridad base: headers (helmet), CORS solo para la app, límite de peticiones y consulta saneada
aplicarSeguridadBase(app);
// El login nunca necesita más de 10 KB y se limita por intentos antes de cualquier otra cosa
app.use('/api/users/login', express.json({ limit: '10kb' }), limitarLoginPorIp, limitarLogin);
// Sin una sesión válida no se procesa nada de /api (ni se lee el cuerpo), salvo login, health y videos públicos
app.use(puertaDeEntrada);
// Captura y chatbot traen su propia llave y un limite de cuerpo pequeno: van ANTES del lector de 100 MB
app.use('/api/estatus/ingesta', ingestaRouter);
app.use('/api/estatus/bot', botRouter);
// Límite grande SOLO para quien ya tiene sesión (archivos Excel grandes)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Log de cada POST para saber si la carga llega al backend y a qué ruta
app.use((req, res, next) => {
  if (req.method === 'POST') {
    const n = Array.isArray(req.body?.data) ? req.body.data.length : null;
    console.log(`📥 POST ${req.originalUrl} registros=${n ?? 'n/a'}`);
  }
  next();
});

// Conectar a MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sistema-sureste';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
})
  .then(() => {
    console.log('✅ Conectado a MongoDB');
    // Pasa a bcrypt las contraseñas guardadas con el formato viejo (reversible). Idempotente.
    migrarPasswordsLegacy()
      .then((r) => console.log(`🔐 Contraseñas: ${r.migradas} migradas a bcrypt, ${r.omitidas} omitidas (de ${r.total} pendientes)`))
      .catch((e) => console.error('❌ Error migrando contraseñas:', e?.message || e));
  })
  .catch((error) => {
    console.error('❌ Error conectando a MongoDB:', error.message);
    console.error('');
    console.error('⚠️ IMPORTANTE: El backend necesita MongoDB para funcionar.');
    console.error('   Opciones:');
    console.error('   1. Si usas Docker: docker-compose up -d mongodb');
    console.error('   2. Si MongoDB está instalado: Inicia el servicio MongoDB');
    console.error('   3. Verifica que MongoDB esté corriendo en: mongodb://localhost:27017');
    console.error('');
    console.error('El servidor seguirá intentando conectarse...');
    // No hacer exit(1) para que el servidor siga corriendo y pueda mostrar el error
  });

// Rutas
// Roles que NUNCA deben ver cobranza/operación (datos de clientes), aunque llamen la API directo
const SIN_COBRANZA = bloquearRoles(['reclutador', 'marketing']);
const SIN_ASISTENTE = bloquearRoles(['reclutador']);

app.use('/api/users', usersRoutes);
app.use('/api/sales', requireAuth, SIN_COBRANZA, salesRoutes);
app.use('/api/install', requireAuth, SIN_COBRANZA, installRoutes);
app.use('/api/operacion', requireAuth, SIN_COBRANZA, operacionRoutes);
app.use('/api/reports', requireAuth, SIN_COBRANZA, reportsRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/promociones', promocionesRoutes);
app.use('/api/pdfs', pdfsRoutes);
app.use('/api/m1', requireAuth, SIN_COBRANZA, m1Routes);
app.use('/api/m0', requireAuth, SIN_COBRANZA, m0Routes);
app.use('/api/whatsapp', requireAuth, SIN_COBRANZA, whatsappRoutes);
app.use('/api/m2', requireAuth, SIN_COBRANZA, m2Routes);
app.use('/api/m3', requireAuth, SIN_COBRANZA, m3Routes);
app.use('/api/m4', requireAuth, SIN_COBRANZA, m4Routes);
app.use('/api/m5', requireAuth, SIN_COBRANZA, m5Routes);
app.use('/api/m6', requireAuth, SIN_COBRANZA, m6Routes);
app.use('/api/templates', templatesRoutes);
app.use('/api/stats', requireAuth, SIN_COBRANZA, statsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/assistant', requireAuth, SIN_ASISTENTE, assistantRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/claves', clavesRoutes);
app.use('/api/capacitaciones', capacitacionesRoutes);
app.use('/api/capacitaciones-contenido', capacitacionesContenidoRoutes);
app.use('/api/imagenes-venta', imagenesVentaRoutes);
app.use('/api/ranking', requireAuth, SIN_COBRANZA, bloquearDistribuidores, rankingRoutes);
app.use('/api/puntos', requireAuth, bloquearDistribuidores, puntosRoutes);
app.use('/api/comisiones', comisionesRoutes);
app.use('/api/arranque', arranqueRoutes);
app.use('/api/estatus/admin', estatusAdminRouter);
app.use('/api/analisis-m1', analisisM1Routes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API funcionando correctamente',
    mongo: {
      readyState: mongoose.connection.readyState, // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    },
  });
});

// Iniciar servidor - Escuchar en todas las interfaces de red (0.0.0.0)
// Errores sin detalles internos (al final de todas las rutas)
app.use(manejarErrores);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🌐 Accesible desde la red local en:`);
  
  // Obtener la IP local
  const networkInterfaces = os.networkInterfaces();
  const ips = [];
  
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((iface) => {
      // Solo IPv4 y no loopback
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(`   http://${iface.address}:${PORT}`);
      }
    });
  });
  
  if (ips.length > 0) {
    ips.forEach(ip => console.log(ip));
  } else {
    console.log(`   (Ejecuta: ipconfig para ver tu IP local)`);
  }
  console.log('');
});

