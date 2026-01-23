import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { parseCSV, parseExcel } from '../../utils/fileParser.js';
import * as api from '../../api.js';
import { MODULES, COLLECTIONS } from '../../utils/constants.js';

export default function UploadModule({ currentModule }) {
  const { user } = useAuth();
  // El rol director no puede cargar archivos
  // El rol mesa_control puede cargar archivos
  const canUpload = user?.role === 'admin' || user?.role === 'admin_general' || user?.role === 'mesa_control';
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [isMonthlyReplace, setIsMonthlyReplace] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!canUpload) {
      alert('No tienes permisos para cargar archivos');
      return;
    }
    
    if (!file) {
      alert('Selecciona un archivo');
      return;
    }

    setUploading(true);
    setProgress('Leyendo archivo...');

    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          let rows = [];
          const fileNameLower = file.name.toLowerCase();

          if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
            // Para CSV/TXT, el resultado ya es texto, no necesita decodificación
            const text = e.target.result;
            rows = parseCSV(text);
          } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.xlsm')) {
            // Para Excel, el resultado es ArrayBuffer
            const buffer = e.target.result;
            rows = parseExcel(buffer);
          } else {
            alert('Formato de archivo no soportado. Usa CSV o Excel (.xlsx, .xls, .csv).');
            setUploading(false);
            return;
          }

          if (rows.length === 0) {
            alert('El archivo está vacío');
            setUploading(false);
            return;
          }

          // Convertir filas a objetos
          if (!rows[0] || rows[0].length === 0) {
            alert('El archivo no tiene encabezados válidos. Verifica el formato del archivo.');
            setUploading(false);
            return;
          }
          
          // A veces los CSV/Excel traen 1-3 filas “extra” antes del header real.
          // Detectar la fila de encabezados buscando una fila que contenga "cuenta" / "Nº de cuenta".
          const normalizeHeaderCell = (v) => String(v || '')
            .trim()
            .toLowerCase()
            .replace(/[\s\u00A0]+/g, ' ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

          const isHeaderRow = (row) => {
            if (!Array.isArray(row)) return false;
            const cells = row.map(normalizeHeaderCell).filter(Boolean);
            if (cells.length < 5) return false;
            // Fuerte: operación del día suele traer "Nº de cuenta" o "Cuenta de facturación"
            const hasCuentaStrong = cells.some(c =>
              c.includes('nº de cuenta') ||
              c.includes('n° de cuenta') ||
              c.includes('no. de cuenta') ||
              c.includes('cuenta de facturacion') ||
              c.includes('cuenta de facturación')
            );
            if (hasCuentaStrong) return true;
            // Fallback: otros archivos (M1-M4) traen "CUENTA"
            return cells.some(c => c === 'cuenta' || c.includes('cuenta'));
          };

          let headerRowIndex = 0;
          // Buscar encabezados en una ventana más amplia:
          // Muchos archivos traen varias filas de reporte antes del header real.
          for (let i = 0; i < Math.min(50, rows.length); i++) {
            if (isHeaderRow(rows[i])) {
              headerRowIndex = i;
              break;
            }
          }

          const headers = rows[headerRowIndex];
          
          // DEBUG: Mostrar los primeros encabezados
          console.log('📋 DEBUG - Total de filas:', rows.length);
          console.log('📋 DEBUG - HeaderRowIndex detectado:', headerRowIndex);
          console.log('📋 DEBUG - Encabezados del archivo:', headers.slice(0, 10));
          console.log('📋 DEBUG - TODOS los encabezados:', headers);
          console.log('📋 DEBUG - Longitud de headers:', headers.length);
          
          // Buscar específicamente las columnas AT y BQ (índices 45 y 66 en base 0)
          // Pero primero necesitamos encontrar los índices reales buscando por nombre
          const cuentaFacturacionIndex = headers.findIndex(h => 
            String(h || '').trim().toLowerCase().includes('cuenta de facturación') ||
            String(h || '').trim().toLowerCase().includes('cuenta de facturacion')
          );
          const cuentaNumIndex = headers.findIndex(h => 
            String(h || '').trim().toLowerCase().includes('nº de cuenta') ||
            String(h || '').trim().toLowerCase().includes('n° de cuenta') ||
            String(h || '').trim().toLowerCase().includes('no. de cuenta')
          );
          
          console.log('📋 DEBUG - Índice de "Cuenta de facturación":', cuentaFacturacionIndex);
          console.log('📋 DEBUG - Índice de "Nº de cuenta":', cuentaNumIndex);

          // Si no encontramos columna de cuenta, alertar antes de subir (evita miles de omitidos)
          if (fileNameLower.includes('operacion') || fileNameLower.includes('output')) {
            if (cuentaNumIndex === -1 && cuentaFacturacionIndex === -1) {
              alert(
                '⚠️ No se detectó la columna de cuenta ("Nº de cuenta" o "Cuenta de facturación") en el archivo.\n' +
                'Esto normalmente pasa por un CSV con separador incorrecto o encabezados desfasados.\n\n' +
                'Sugerencia: vuelve a exportar como CSV UTF-8 y reintenta.'
              );
            }
          }
          
          const data = rows.slice(headerRowIndex + 1).map((row, rowIndex) => {
            const obj = {};
            headers.forEach((header, index) => {
              // Limpiar el nombre del header (quitar espacios, caracteres especiales)
              const cleanHeader = String(header || '').trim().replace(/[\u00A0]+/g, ' ');
              // CRÍTICO: Si el header está vacío, NO guardar la columna.
              // Si se guarda como key "", Mongo truena con: "An empty update path is not valid" (code 56)
              if (!cleanHeader || cleanHeader === 'undefined' || cleanHeader === 'null') return;
              const value = row[index] !== undefined && row[index] !== null ? String(row[index]).trim() : '';
              obj[cleanHeader] = value;
              
              // DEBUG: Para los primeros 3 registros, mostrar valores de cuenta
              if (rowIndex < 3 && (index === cuentaFacturacionIndex || index === cuentaNumIndex)) {
                console.log(`📋 DEBUG - Fila ${rowIndex + 1}, Columna "${cleanHeader}":`, value);
              }
            });
            return obj;
          });

          // Validación fuerte para Operación del Día: ¿realmente viene "Nº de cuenta" con valores?
          const extractCuentaLike = (obj) => {
            if (!obj || typeof obj !== 'object') return '';
            const normalizeKey = (k) => String(k || '')
              .trim()
              .toLowerCase()
              .replace(/[\s\u00A0]+/g, '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');

            const entries = Object.entries(obj);
            const priority = [
              'nºdecuenta',
              'n°decuenta',
              'nodecuenta',
              'cuentadefacturacion',
              'cuenta',
              'nocuenta',
              'referencia',
            ];

            // 1) Buscar por keys exactas normalizadas
            for (const wanted of priority) {
              const hit = entries.find(([k]) => normalizeKey(k) === wanted);
              if (!hit) continue;
              const raw = String(hit[1] ?? '').trim();
              if (!raw) continue;
              const digits = raw.replace(/[^\d]/g, '');
              if (digits.length >= 3) return digits;
              if (raw.length >= 3 && raw !== 'undefined' && raw !== 'null') return raw;
            }

            // 2) Fallback: cualquier columna que contenga "cuenta" / "facturacion"
            for (const [k, v] of entries) {
              const nk = normalizeKey(k);
              if (!nk.includes('cuenta') && !nk.includes('facturacion')) continue;
              const raw = String(v ?? '').trim();
              if (!raw) continue;
              const digits = raw.replace(/[^\d]/g, '');
              if (digits.length >= 3) return digits;
            }

            return '';
          };

          const isOperacionFile = fileNameLower.includes('operacion') || fileNameLower.includes('output');
          if (isOperacionFile) {
            const total = data.length;
            const sample = data.slice(0, 5);
            const found = data.reduce((acc, obj) => acc + (extractCuentaLike(obj) ? 1 : 0), 0);
            const headerCuentaDetected = cuentaNumIndex !== -1 || cuentaFacturacionIndex !== -1;

            console.log('📋 VALIDACIÓN OPERACIÓN - headerCuentaDetected:', headerCuentaDetected);
            console.log('📋 VALIDACIÓN OPERACIÓN - foundCuentaCount:', found, 'de', total);
            console.log('📋 VALIDACIÓN OPERACIÓN - sampleCuenta:', sample.map(s => ({
              cuenta: extractCuentaLike(s),
              keys: Object.keys(s).filter(k => k.toLowerCase().includes('cuenta') || k.toLowerCase().includes('factur')),
            })));

            // Si encontramos muy pocas cuentas, es casi seguro que el archivo no trae esa columna con valores
            if (total > 0 && found / total < 0.2) {
              const proceed = confirm(
                `⚠️ ALERTA: El archivo parece NO traer números de cuenta en "Nº de cuenta".\n\n` +
                `Detectadas con cuenta: ${found} de ${total}.\n` +
                `Si continúas, se omitirán casi todas las filas.\n\n` +
                `Sugerencias:\n` +
                `- Asegura que estás exportando el reporte correcto de Operación del Día (con columna BQ "Nº de cuenta").\n` +
                `- Revisa que la columna no sea fórmula vacía.\n` +
                `- En Bloc de notas, usa Ctrl+F y busca un número de cuenta conocido.\n\n` +
                `¿Quieres continuar de todos modos?`
              );
              if (!proceed) {
                setUploading(false);
                setProgress('');
                return;
              }
            }
          }
          
          // DEBUG: Mostrar el primer registro convertido
          if (data.length > 0) {
            console.log('📋 DEBUG - Primer registro convertido (keys):', Object.keys(data[0]));
            console.log('📋 DEBUG - Primer registro convertido (completo):', data[0]);
            console.log('📋 DEBUG - Valor de CUENTA (mayúsculas):', data[0]['CUENTA']);
            console.log('📋 DEBUG - Valor de cuenta (minúsculas):', data[0]['cuenta']);
            console.log('📋 DEBUG - Valor de Cuenta (capitalizada):', data[0]['Cuenta']);
            
            // Buscar cuenta en todas las variaciones posibles
            // Prioridad: CUENTA > NoCuenta > Referencia > otras variaciones
            const cuentaVariations = [
              'CUENTA',           // Columna A (prioridad 1)
              'Cuenta',
              'cuenta',
              'NoCuenta',         // Columna AD (prioridad 2)
              'No Cuenta',
              'No cuenta',
              'nocuenta',
              'Referencia',       // Columna AE (prioridad 3)
              'referencia',
              'Nº de cuenta', 
              'N° de cuenta', 
              'Nº Cuenta', 
              'N° Cuenta', 
              'Numero de cuenta', 
              'Número de cuenta'
            ];
            let cuentaFound = null;
            for (const variation of cuentaVariations) {
              const value = data[0][variation];
              if (value !== undefined && value !== null && value !== '') {
                cuentaFound = `${variation}: "${value}"`;
                break;
              }
            }
            console.log('📋 DEBUG - Valor de "cuenta" encontrado:', cuentaFound || 'NO ENCONTRADO - Revisa los valores arriba');
            
            // Mostrar todos los valores del primer registro para debugging
            console.log('📋 DEBUG - Todos los valores del primer registro:');
            Object.keys(data[0]).forEach(key => {
              console.log(`  - ${key}: "${data[0][key]}"`);
            });
          }

          setProgress(`Procesando ${data.length} registros...`);

          // Subir datos según el módulo y tipo de archivo
          // Detectar si es M1, M2, M3, M4 por el nombre del archivo o contenido
          let result;
          // Determinar si es M1, M2, M3, M4 para aplicar reemplazo mensual si está activado
          const isM1M2M3M4 = fileNameLower.includes('m1') || fileNameLower.includes('m2') || 
                            fileNameLower.includes('m3') || fileNameLower.includes('m4') || 
                            fileNameLower.includes('cosecha');
          
          if (fileNameLower.includes('m1') || fileNameLower.includes('cosecha')) {
            // DEBUG: Verificar que replaceAll se está enviando
            const shouldReplace = isMonthlyReplace && isM1M2M3M4;
            console.log('📋 DEBUG - Cargando M1:');
            console.log('   - isMonthlyReplace:', isMonthlyReplace);
            console.log('   - isM1M2M3M4:', isM1M2M3M4);
            console.log('   - replaceAll que se enviará:', shouldReplace);
            console.log('   - Total de registros a cargar:', data.length);
            result = await api.bulkUpsertM1(data, true, shouldReplace);
          } else if (fileNameLower.includes('m2')) {
            result = await api.bulkUpsertM2(data, true, isMonthlyReplace && isM1M2M3M4);
          } else if (fileNameLower.includes('m3')) {
            result = await api.bulkUpsertM3(data, true, isMonthlyReplace && isM1M2M3M4);
          } else if (fileNameLower.includes('m4')) {
            result = await api.bulkUpsertM4(data, true, isMonthlyReplace && isM1M2M3M4);
          } else if (fileNameLower.includes('operacion') || fileNameLower.includes('output')) {
            result = await api.bulkUpsertOperacion(data, true);
          } else if (currentModule === MODULES.SALES) {
            result = await api.bulkUpsertSales(data, true);
          } else if (currentModule === MODULES.INSTALL) {
            result = await api.bulkUpsertInstall(data, true);
          } else {
            // Por defecto, usar sales
            result = await api.bulkUpsertSales(data, true);
          }

          // Mostrar resultado detallado
          const created = result.created || 0;
          const updated = result.updated || 0;
          const skipped = result.skipped || 0;
          const total = result.total || data.length;
          const skippedNoCuenta = result.skippedNoCuenta || 0;
          const duplicatedByCuenta = result.duplicatedByCuenta || 0;
          const skippedNoUpdateExisting = result.skippedNoUpdateExisting || 0;
          
          let message = `✅ Carga completada:\n\n`;
          message += `📊 Total procesados: ${total}\n`;
          message += `✅ Creados: ${created}\n`;
          message += `🔄 Actualizados: ${updated}\n`;
          // Mostrar desglose real de omitidos (evita confundir duplicados con "sin cuenta")
          if (duplicatedByCuenta > 0) {
            message += `🧾 Duplicados en archivo: ${duplicatedByCuenta} (se tomó el último por cuenta)\n`;
          }
          if (skippedNoCuenta > 0) {
            message += `⛔ Sin número de cuenta: ${skippedNoCuenta}\n`;
          }
          if (skippedNoUpdateExisting > 0) {
            message += `⏭️ Omitidos (no actualizar existentes): ${skippedNoUpdateExisting}\n`;
          }
          // Compat con backends viejos: si solo viene "skipped", mostrarlo genérico
          if (skipped > 0 && skippedNoCuenta === 0 && duplicatedByCuenta === 0 && skippedNoUpdateExisting === 0) {
            message += `⏭️ Omitidos: ${skipped}\n`;
          }
          
          if (result.errors && result.errors.length > 0) {
            console.warn('Errores durante la carga:', result.errors);
            message += `\n⚠️ Errores: ${result.errors.length}`;
          }
          
          // Si no se creó ni actualizó nada, mostrar advertencia
          if (created === 0 && updated === 0) {
            message += `\n\n⚠️ ADVERTENCIA: No se guardó ningún registro.\n`;
            message += `Posibles causas:\n`;
            message += `- Los registros no tienen número de cuenta\n`;
            message += `- El formato del número de cuenta no es reconocido\n`;
            message += `- Revisa los logs del backend (terminal) para más detalles`;
          }
          
          alert(message);
          setProgress('¡Archivo cargado exitosamente!');
          setFile(null);
        } catch (error) {
          console.error('Error procesando archivo:', error);
          console.error('Error completo:', error);
          
          // Intentar obtener más detalles del error
          let errorMessage = 'Error del servidor';
          
          if (error.message) {
            errorMessage = error.message;
            // Si viene un detalle del backend, anexarlo (api.js adjunta error.details)
            if (error.details?.message && error.details.message !== error.message) {
              errorMessage = `${error.message} (${error.details.message})`;
            }
          } else if (error.error) {
            errorMessage = error.error;
          } else if (typeof error === 'string') {
            errorMessage = error;
          }
          
          // Si es un error de red, mostrar mensaje más específico
          if (errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
            errorMessage = 'No se pudo conectar al servidor. Verifica que el backend esté corriendo en http://localhost:3001';
          }
          
          alert('Error procesando archivo: ' + errorMessage + '\n\nRevisa la consola del navegador (F12) para más detalles.');
          setProgress('');
        } finally {
          setUploading(false);
        }
      };

      if (file.name.endsWith('.csv') || file.name.endsWith('.txt')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error('Error leyendo archivo:', error);
      alert('Error leyendo archivo: ' + error.message);
      setUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <UploadCloud className="text-blue-600" />
        Cargar Archivo
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            Seleccionar archivo (CSV o Excel)
          </label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.xlsm,.txt"
            onChange={handleFileChange}
            disabled={uploading || !canUpload}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
          {file && (
            <p className="text-sm text-slate-600 mt-2">
              Archivo seleccionado: {file.name}
            </p>
          )}
        </div>

        {/* Checkbox para carga mensual (solo para M1, M2, M3, M4) */}
        {file && (file.name.toLowerCase().includes('m1') || file.name.toLowerCase().includes('m2') || 
                 file.name.toLowerCase().includes('m3') || file.name.toLowerCase().includes('m4') || 
                 file.name.toLowerCase().includes('cosecha')) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isMonthlyReplace}
                onChange={(e) => setIsMonthlyReplace(e.target.checked)}
                disabled={uploading}
                className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <div>
                <span className="font-bold text-yellow-800">Carga Mensual (Reemplazo Completo)</span>
                <p className="text-xs text-yellow-700 mt-1">
                  ⚠️ Marca esta opción si es la carga mensual que reemplaza completamente el mes anterior.
                  Se eliminarán TODOS los registros existentes antes de cargar los nuevos.
                </p>
              </div>
            </label>
          </div>
        )}

        {progress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">{progress}</p>
          </div>
        )}

        {!canUpload && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">
              ⚠️ No tienes permisos para cargar archivos. Solo los administradores pueden realizar esta acción.
            </p>
          </div>
        )}
        <button
          onClick={handleUpload}
          disabled={!file || uploading || !canUpload}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-400 transition-colors"
        >
          {uploading ? 'Cargando...' : 'Cargar Archivo'}
        </button>
      </div>
    </div>
  );
}

