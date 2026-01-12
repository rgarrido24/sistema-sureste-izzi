import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Obtener estadísticas de la base de datos
router.get('/database', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    
    // Obtener estadísticas de la base de datos
    const dbStats = await db.stats();
    
    // Obtener todas las colecciones
    const collections = await db.listCollections().toArray();
    
    // Obtener estadísticas de cada colección
    const collectionStats = await Promise.all(
      collections.map(async (collection) => {
        const stats = await db.command({ collStats: collection.name });
        const count = await db.collection(collection.name).countDocuments();
        
        return {
          name: collection.name,
          count: count,
          size: stats.size || 0, // Tamaño en bytes
          sizeFormatted: formatBytes(stats.size || 0),
          storageSize: stats.storageSize || 0, // Tamaño de almacenamiento en bytes
          storageSizeFormatted: formatBytes(stats.storageSize || 0),
          indexes: stats.nindexes || 0,
          indexSize: stats.totalIndexSize || 0,
          indexSizeFormatted: formatBytes(stats.totalIndexSize || 0)
        };
      })
    );
    
    // Ordenar por tamaño (de mayor a menor)
    collectionStats.sort((a, b) => b.size - a.size);
    
    res.json({
      database: {
        name: db.databaseName,
        totalSize: dbStats.dataSize,
        totalSizeFormatted: formatBytes(dbStats.dataSize),
        totalStorageSize: dbStats.storageSize,
        totalStorageSizeFormatted: formatBytes(dbStats.storageSize),
        totalIndexSize: dbStats.indexSize,
        totalIndexSizeFormatted: formatBytes(dbStats.indexSize),
        totalCollections: dbStats.collections,
        totalDocuments: dbStats.objects,
        totalIndexes: dbStats.indexes
      },
      collections: collectionStats,
      summary: {
        totalCollections: collectionStats.length,
        totalDocuments: collectionStats.reduce((sum, col) => sum + col.count, 0),
        totalDataSize: collectionStats.reduce((sum, col) => sum + col.size, 0),
        totalDataSizeFormatted: formatBytes(collectionStats.reduce((sum, col) => sum + col.size, 0)),
        totalStorageSize: collectionStats.reduce((sum, col) => sum + col.storageSize, 0),
        totalStorageSizeFormatted: formatBytes(collectionStats.reduce((sum, col) => sum + col.storageSize, 0))
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error del servidor', details: error.message });
  }
});

// Función para formatear bytes a formato legible
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default router;
