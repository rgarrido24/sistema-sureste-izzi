import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import os from 'os';
import usersRoutes from './routes/users.js';
import salesRoutes from './routes/sales.js';
import installRoutes from './routes/install.js';
import operacionRoutes from './routes/operacion.js';
import reportsRoutes from './routes/reports.js';
import packagesRoutes from './routes/packages.js';
import promocionesRoutes from './routes/promociones.js';
import pdfsRoutes from './routes/pdfs.js';
import m1Routes from './routes/m1.js';
import m2Routes from './routes/m2.js';
import m3Routes from './routes/m3.js';
import m4Routes from './routes/m4.js';
import templatesRoutes from './routes/templates.js';
import statsRoutes from './routes/stats.js';
import uploadRoutes from './routes/upload.js';
import assistantRoutes from './routes/assistant.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Aumentar límite de tamaño para archivos grandes (100MB para archivos Excel grandes)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Conectar a MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sistema-sureste';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB');
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
app.use('/api/users', usersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/install', installRoutes);
app.use('/api/operacion', operacionRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/promociones', promocionesRoutes);
app.use('/api/pdfs', pdfsRoutes);
app.use('/api/m1', m1Routes);
app.use('/api/m2', m2Routes);
app.use('/api/m3', m3Routes);
app.use('/api/m4', m4Routes);
app.use('/api/templates', templatesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/assistant', assistantRoutes);

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API funcionando correctamente' });
});

// Iniciar servidor - Escuchar en todas las interfaces de red (0.0.0.0)
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

