import express from 'express';
import OperacionDia from '../models/OperacionDia.js';
import { normalizeCuenta, prepareDataForUpsert } from '../utils/cuentaHelper.js';
import { optimizeDocument } from '../utils/dataOptimizer.js';
import { requireAuth } from '../middleware/auth.js';
import { extractRegionFromRecord, normalizeRegion } from '../utils/regionAccess.js';
import { notifyAll } from '../utils/pushSender.js';
import ActivityEvent from '../models/ActivityEvent.js';
import { applyPermanenciaEstatus } from '../utils/permanenciaFlag.js';

/**
 * Router M5/M6 (misma lógica que M4) con flag Permanencia 0/1.
 * priorLookups: [{ key: 'm4', model }] en orden de herencia de teléfono/notas.
 */
export function createPermanenciaMnRouter({ moduleKey, Model, priorLookups = [] }) {
  const upper = moduleKey.toUpperCase();
  const router = express.Router();
  router.use(requireAuth);

  async function findByCuenta(model, cuenta) {
    return model.findOne({
      $or: [{ cuenta }, { 'Nº de cuenta': cuenta }, { 'Cuenta': cuenta }]
    });
  }

  router.get('/', async (req, res) => {
    try {
      const role = req.user?.role;
      const isScopedByRegion = role === 'regionales' || role === 'cobranza_mx';
      const userRegion = role === 'regionales'
        ? normalizeRegion(req.user.region || '')
        : role === 'cobranza_mx'
          ? normalizeRegion('METROPOLITANA')
          : '';

      if (isScopedByRegion && !userRegion) {
        return res.status(403).json({ error: 'Usuario regional sin región asignada. Pide a Admin que la configure.' });
      }
      const { estado, fecha, vendedor } = req.query;
      const query = {};
      if (estado) query.estado = estado;
      if (fecha) {
        const fechaObj = new Date(fecha);
        query.createdAt = { $gte: fechaObj };
      }
      if (vendedor) {
        query.$or = [{ Vendedor: vendedor }, { 'Vendedor': vendedor }];
      }
      const docs = await Model.find(query).sort({ createdAt: -1 }).lean();

      if (isScopedByRegion) {
        const regionByCuenta = new Map();
        const missingCuentas = [];
        for (const doc of docs) {
          const cuenta = normalizeCuenta(doc) || doc?.cuenta;
          const reg = extractRegionFromRecord(doc);
          if (cuenta && reg) regionByCuenta.set(cuenta, reg);
          else if (cuenta) missingCuentas.push(cuenta);
        }
        if (missingCuentas.length > 0) {
          const uniqueMissing = Array.from(new Set(missingCuentas)).slice(0, 50000);
          const opDocs = await OperacionDia.find(
            { cuenta: { $in: uniqueMissing } },
            { cuenta: 1, Hub: 1, HUB: 1, Plaza: 1, PLAZA: 1, REGION: 1, Region: 1, 'Región': 1, 'REGIÓN': 1, SUBREGION: 1 }
          ).lean();
          for (const od of opDocs) {
            if (!od?.cuenta || regionByCuenta.has(od.cuenta)) continue;
            const reg = extractRegionFromRecord(od);
            if (reg) regionByCuenta.set(od.cuenta, reg);
          }
        }
        const filtered = docs.filter((doc) => {
          const cuenta = normalizeCuenta(doc) || doc?.cuenta;
          const reg = (cuenta && regionByCuenta.get(cuenta)) ? regionByCuenta.get(cuenta) : extractRegionFromRecord(doc);
          return normalizeRegion(reg) === userRegion;
        });
        return res.json(filtered);
      }

      res.json(docs);
    } catch (error) {
      console.error(`Error obteniendo ${upper}:`, error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  router.get('/count', async (req, res) => {
    try {
      const { estado, estatusFPD, vendedor } = req.query;
      const query = {};
      if (estado) query.estado = estado;

      if (estatusFPD === upper) {
        query.$and = [
          {
            $or: [
              { [upper]: 1 },
              { [moduleKey]: 1 },
              { 'Estatus FPD': upper },
              { 'EstatusFPD': upper }
            ]
          },
          {
            $nor: [
              { [upper]: 0 },
              { [moduleKey]: 0 },
              { 'Estatus FPD': 'FPD CORRIENTE' },
              { 'EstatusFPD': 'FPD CORRIENTE' }
            ]
          }
        ];
      } else if (estatusFPD === 'FPD CORRIENTE') {
        query.$or = [
          { [upper]: 0 },
          { [moduleKey]: 0 },
          { 'Estatus FPD': 'FPD CORRIENTE' },
          { 'EstatusFPD': 'FPD CORRIENTE' }
        ];
      }

      if (vendedor) {
        const vendorCondition = { $or: [{ Vendedor: vendedor }, { 'Vendedor': vendedor }] };
        if (query.$and) query.$and.push(vendorCondition);
        else if (query.$or) {
          query.$and = [query.$or, vendorCondition];
          delete query.$or;
        } else {
          query.$and = [vendorCondition];
        }
      }

      if (req.user?.role === 'cobranza_mx') {
        const userRegion = normalizeRegion('METROPOLITANA');
        const found = await Model.find(query).lean();
        const regionByCuenta = new Map();
        const missingCuentas = [];
        for (const doc of found) {
          const cuenta = normalizeCuenta(doc) || doc?.cuenta;
          const reg = extractRegionFromRecord(doc);
          if (cuenta && reg) regionByCuenta.set(cuenta, reg);
          else if (cuenta) missingCuentas.push(cuenta);
        }
        if (missingCuentas.length > 0) {
          const uniqueMissing = Array.from(new Set(missingCuentas)).slice(0, 50000);
          const opDocs = await OperacionDia.find(
            { cuenta: { $in: uniqueMissing } },
            { cuenta: 1, Hub: 1, HUB: 1, Plaza: 1, PLAZA: 1, REGION: 1, Region: 1, 'Región': 1, 'REGIÓN': 1, SUBREGION: 1 }
          ).lean();
          for (const od of opDocs) {
            if (!od?.cuenta || regionByCuenta.has(od.cuenta)) continue;
            const reg = extractRegionFromRecord(od);
            if (reg) regionByCuenta.set(od.cuenta, reg);
          }
        }
        let count = 0;
        for (const doc of found) {
          const cuenta = normalizeCuenta(doc) || doc?.cuenta;
          if (!cuenta) continue;
          const reg = (cuenta && regionByCuenta.get(cuenta)) ? regionByCuenta.get(cuenta) : extractRegionFromRecord(doc);
          if (normalizeRegion(reg) === userRegion) count++;
        }
        return res.json({ count });
      }

      const count = await Model.countDocuments(query);
      res.json({ count });
    } catch (error) {
      console.error(`Error obteniendo conteo ${upper}:`, error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  router.post('/bulk', async (req, res) => {
    try {
      const { data, updateExisting = true, replaceAll = false } = req.body;
      if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'Se espera un array de datos' });
      }

      if (replaceAll) {
        const deleteResult = await Model.deleteMany({});
        console.log(`✅ ${upper} reemplazo mensual: eliminados ${deleteResult.deletedCount}`);
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const item of data) {
        const cuenta = normalizeCuenta(item);
        if (!cuenta) {
          skipped++;
          continue;
        }

        const existing = await findByCuenta(Model, cuenta);
        let sourceRecord = null;
        let origen = moduleKey;
        for (const prior of priorLookups) {
          const found = await findByCuenta(prior.model, cuenta);
          if (found) {
            sourceRecord = found;
            origen = prior.key;
            break;
          }
        }

        const preparedData = prepareDataForUpsert(item, moduleKey);
        applyPermanenciaEstatus(preparedData, item, upper);
        const optimizedData = optimizeDocument(preparedData, moduleKey);

        if (existing) {
          if (updateExisting) {
            const updateData = {
              ...optimizedData,
              Telefono1: existing.Telefono1 || preparedData.Telefono1 || item.Telefono1 || '',
              Telefono2: existing.Telefono2 || preparedData.Telefono2 || item.Telefono2 || '',
              notaContacto: existing.notaContacto || preparedData.notaContacto || '',
              fechaPromesaPago: existing.fechaPromesaPago || preparedData.fechaPromesaPago || '',
              'Nota Contacto': existing['Nota Contacto'] || preparedData['Nota Contacto'] || '',
              'Fecha Promesa Pago': existing['Fecha Promesa Pago'] || preparedData['Fecha Promesa Pago'] || '',
              fechaCreacion: existing.fechaCreacion || new Date(),
              updatedAt: new Date()
            };
            await Model.findByIdAndUpdate(existing._id, optimizeDocument(updateData, moduleKey));
            updated++;
          } else {
            skipped++;
          }
        } else if (sourceRecord) {
          const createData = {
            ...optimizedData,
            Telefono1: sourceRecord.Telefono1 || optimizedData.Telefono1 || item.Telefono1 || '',
            Telefono2: sourceRecord.Telefono2 || optimizedData.Telefono2 || item.Telefono2 || '',
            notaContacto: sourceRecord.notaContacto || optimizedData.notaContacto || '',
            fechaPromesaPago: sourceRecord.fechaPromesaPago || optimizedData.fechaPromesaPago || '',
            'Nota Contacto': sourceRecord['Nota Contacto'] || optimizedData['Nota Contacto'] || '',
            'Fecha Promesa Pago': sourceRecord['Fecha Promesa Pago'] || optimizedData['Fecha Promesa Pago'] || '',
            origen,
            fechaCreacion: sourceRecord?.fechaCreacion || new Date()
          };
          await Model.create(optimizeDocument(createData, moduleKey));
          created++;
        } else {
          await Model.create(optimizedData);
          created++;
        }
      }

      try {
        await ActivityEvent.create({
          type: 'upload',
          module: moduleKey,
          userId: req.user?.id,
          username: req.user?.username || '',
          role: req.user?.role || '',
          region: req.user?.region || '',
          meta: { created, updated, skipped, total: data.length, replaceAll },
        });
      } catch (e) {
        console.warn(`⚠️ No se pudo registrar ActivityEvent upload (${moduleKey}):`, e?.message || e);
      }

      if (created > 0 || updated > 0) {
        notifyAll('Sistema actualizado', `${upper}: ${created} creados, ${updated} actualizados`, '/').catch(() => {});
      }
      res.json({ success: true, created, updated, skipped, total: data.length });
    } catch (error) {
      console.error(`Error en bulk ${upper}:`, error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  router.put('/:id/estado', async (req, res) => {
    try {
      const { id } = req.params;
      const { estado } = req.body;
      if (!['Abierta', 'Completa', 'Cancelada', 'Not done'].includes(estado)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }
      const doc = await Model.findByIdAndUpdate(id, { estado, fechaActualizacion: new Date() }, { new: true });
      if (!doc) return res.status(404).json({ error: 'No encontrado' });
      res.json(doc);
    } catch (error) {
      console.error(`Error actualizando estado ${upper}:`, error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  router.put('/:id/contacto', async (req, res) => {
    try {
      const { id } = req.params;
      const { telefono, notaContacto, fechaPromesaPago } = req.body;
      const updateData = { fechaActualizacion: new Date() };
      if (telefono !== undefined) {
        updateData.Telefono1 = telefono;
        updateData['Telefono1'] = telefono;
      }
      if (notaContacto !== undefined) {
        updateData.notaContacto = notaContacto;
        updateData['Nota Contacto'] = notaContacto;
      }
      if (fechaPromesaPago !== undefined) {
        updateData.fechaPromesaPago = fechaPromesaPago;
        updateData['Fecha Promesa Pago'] = fechaPromesaPago;
      }
      const doc = await Model.findByIdAndUpdate(id, updateData, { new: true });
      if (!doc) return res.status(404).json({ error: 'No encontrado' });
      res.json(doc);
    } catch (error) {
      console.error(`Error actualizando contacto ${upper}:`, error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  router.delete('/all', async (req, res) => {
    try {
      await Model.deleteMany({});
      res.json({ success: true, message: `Todos los registros ${upper} eliminados` });
    } catch (error) {
      console.error(`Error eliminando ${upper}:`, error);
      res.status(500).json({ error: 'Error del servidor' });
    }
  });

  return router;
}
