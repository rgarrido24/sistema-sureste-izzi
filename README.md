# Sistema Sureste - Gestión de Cobranza e Instalaciones Izzi

## 📋 Descripción del Proyecto

Sistema web completo para la gestión de cobranza, instalaciones y operaciones del día para el distribuidor Izzi Sureste. Permite cargar archivos Excel/CSV, gestionar clientes, asignar vendedores, generar reportes y comunicarse con clientes vía WhatsApp.

## 🚀 Tecnologías Utilizadas

### Frontend
- **React 18.2.0** - Framework principal
- **Vite 5.1.4** - Build tool y dev server
- **Tailwind CSS 3.4.1** - Framework de estilos
- **Lucide React 0.344.0** - Iconos

### Backend y Servicios
- **Firebase 10.8.0**
  - **Firestore** - Base de datos NoSQL
  - **Authentication** - Autenticación de usuarios
  - **Storage** - Almacenamiento de archivos PDF
- **Google Gemini API** - Asistente de IA integrado
- **XLSX 0.18.5** - Procesamiento de archivos Excel

### Hosting
- **Vercel** - Despliegue y hosting

## 🏗️ Arquitectura del Sistema

### Estructura de Datos en Firestore

El sistema utiliza la siguiente estructura de colecciones en Firestore:

```
artifacts/
  └── sales-master-production/
      └── public/
          ├── data/
          │   ├── sales_master/          # Clientes de cobranza (M1, M2, M3, M4)
          │   ├── install_master/        # Instalaciones
          │   ├── operacion_dia/         # Operación del día
          │   ├── sales_reports/         # Reportes de ventas
          │   ├── izzi_packages/         # Catálogo de paquetes
          │   ├── izzi_promociones/      # Promociones y servicios
          │   ├── knowledge_pdfs/        # PDFs de conocimiento
          │   └── global_settings/       # Configuraciones globales
          │       ├── cobranza_template/ # Plantilla de cobranza
          │       └── instalaciones_template/ # Plantilla de instalaciones
          └── users/                     # Usuarios del sistema
```

### Modelos de Datos

#### Cliente de Cobranza (`sales_master`)
```javascript
{
  Cliente: string,              // Nombre del cliente (NUNCA "izzi")
  Cuenta: string,               // Número de cuenta
  Telefono: string,             // Teléfono del cliente
  Estatus: string,              // M1, M2, M3, M4, FPD Corriente
  Saldo: number,                // Saldo total
  SaldoPorVencer: number,       // Saldo por vencer
  SaldoVencido: number,         // Saldo vencido
  SaldoTotal: number,           // Saldo total calculado
  Plaza: string,                // Plaza
  Region: string,               // Región
  Vendedor: string,             // Vendedor asignado
  VendedorAsignado: string,     // Vendedor asignado (preservado)
  normalized_resp: string,      // Vendedor normalizado (lowercase)
  FechaInstalacion: string,     // Fecha de instalación
  FechaVencimiento: string,     // Fecha de vencimiento
  FLP: string,                  // Fecha de último pago
  FechaPerdida: string,         // Fecha perdida FPD
  notaContacto: string,         // Notas de contacto
  fechaPromesaPago: string,     // Fecha de promesa de pago
  createdAt: Timestamp,         // Fecha de creación
  updatedAt: Timestamp          // Fecha de actualización
}
```

#### Instalación (`install_master`)
```javascript
{
  Cliente: string,              // Nombre del cliente
  Cuenta: string,               // Número de cuenta
  Telefono: string,             // Teléfono
  Estatus: string,              // Instalado, Completo, etc.
  Plaza: string,                // Plaza
  Ciudad: string,               // Ciudad
  Region: string,               // Región
  Vendedor: string,             // Vendedor asignado
  FechaInstalacion: string,     // Fecha de instalación
  Paquete: string,              // Paquete contratado
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### Operación del Día (`operacion_dia`)
```javascript
{
  Cliente: string,              // Nombre del cliente (de COMPAÑÍA)
  'Nº de orden': string,        // Número de orden
  Compañía: string,             // Nombre de la compañía (prioridad para Cliente)
  Estado: string,               // Estado de la orden
  Hub: string,                  // Hub
  Region: string,               // Región
  'Fecha solicitada': string,   // Fecha solicitada
  'Clave Vendedor': string,     // CVVEN
  Vendedor: string,             // Vendedor asignado
  VendedorAsignado: string,     // Vendedor asignado (preservado)
  FLP: string,                  // Fecha de último pago calculada
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## 🔑 Funcionalidades Principales

### 1. Gestión de Cobranza (M1, M2, M3, M4)

- **Carga de Archivos FPD Cosecha**: Procesa archivos Excel con información de cobranza
- **Detección Automática de Estatus**: Identifica M1, M2, M3, M4 basado en columnas M, M1-M4, o Estatus Cobranza
- **Filtrado por Estatus**: Visualización separada por M1, M2, M3, M4
- **Cálculo de Saldos**: Calcula saldos totales, por vencer y vencidos
- **Asignación de Vendedores**: Asignación automática basada en CVVEN o manual

### 2. Gestión de Instalaciones

- **Carga de Archivos por Ciudad**: Detecta automáticamente la ciudad desde el nombre del archivo
- **Filtrado por Ciudad**: Visualización filtrada por ciudad
- **Contador de Instalaciones**: Muestra total de instalaciones completadas
- **Modal de Instalaciones**: Lista completa de clientes instalados al último corte

### 3. Operación del Día

- **Carga de Órdenes**: Procesa archivos con órdenes de instalación
- **Asignación Automática por CVVEN**: Asigna vendedores automáticamente basado en CVVEN
- **Actualización sin Duplicados**: Actualiza órdenes existentes por número de orden

### 4. Procesamiento de Archivos

#### Proceso de Carga

1. **Detección Automática de Columnas**
   - El sistema detecta automáticamente las columnas importantes usando un diccionario (`COLUMNAS_IMPORTANTES`)
   - Mapea columnas comunes a campos internos del sistema

2. **Procesamiento en Lotes**
   - Procesa archivos en lotes de 50 filas para evitar bloqueos
   - Pausas de 100ms entre lotes para mantener la UI responsive
   - Procesamiento asíncrono con `setTimeout` para yield al event loop

3. **Validación y Limpieza de Datos**
   - Limpia valores (quita comillas, espacios extra)
   - Convierte fechas de Excel a formato legible
   - Valida y normaliza nombres de clientes (NUNCA permite "izzi")
   - Normaliza regiones y otros campos

4. **Escritura en Firestore**
   - Escribe en lotes de 100-150 documentos
   - Pausas de 300ms entre lotes para evitar "Transaction too big"
   - Actualiza registros existentes o crea nuevos según corresponda

#### Reglas de Procesamiento de Clientes

**Para Operación del Día:**
- Prioridad 1: Columna `COMPAÑÍA` (nombre del titular)
- Prioridad 2: Columna `CLIENTE` (si COMPAÑÍA es "izzi" o vacía)

**Para Cobranza (M1, M2, M3, M4):**
- Prioridad 1: Columna `CLIENTE` (nombre del titular)
- NUNCA sobrescribe con "izzi" de otras columnas
- Validación final: Si Cliente es "izzi", busca en todas las columnas

**Para Instalaciones:**
- Prioridad 1: Columna `CLIENTE`
- Si no hay Cliente, busca en `COMPAÑÍA` (solo si no es "izzi")

### 5. Sistema de Usuarios y Roles

- **admin_general**: Acceso completo, puede gestionar cobranza
- **admin_region**: Acceso a operación y reportes, no puede crear usuarios
- **vendor**: Solo ve sus clientes asignados

### 6. Asignación de Vendedores

- **Archivo CVVEN**: Carga Excel con mapeo CVVEN → Vendedores
- **Asignación Automática**: Si un CVVEN tiene un solo vendedor, se asigna automáticamente
- **Asignación Manual**: Si hay múltiples vendedores, muestra modal para seleccionar
- **Preservación**: Preserva vendedores ya asignados al actualizar datos

### 7. Comunicación con Clientes

- **WhatsApp**: Envío de mensajes personalizados con plantillas
- **Llamadas**: Integración con teléfono
- **Plantillas Personalizables**: Plantillas con variables dinámicas
- **Videos**: Enlaces a videos de pago

### 8. Reportes y Estadísticas

- **Reportes de Ventas**: Registro de ventas con filtros por vendedor, plaza, período
- **Estadísticas por Región**: Porcentajes de estatus por región
- **Exportación a Excel**: Exporta datos a Excel
- **Filtros Avanzados**: Por fecha, vendedor, plaza, período

### 9. Asistente de IA

- **Integración con Gemini API**: Asistente de IA para consultas
- **Contexto de PDFs**: Lee PDFs de conocimiento cargados
- **Respuestas Contextuales**: Respuestas basadas en paquetes, promociones y políticas

## 📁 Estructura del Proyecto

```
sistema-sureste/
├── src/
│   ├── App.jsx              # Componente principal (todo el código)
│   ├── main.jsx             # Punto de entrada
│   └── index.css            # Estilos globales
├── public/
│   └── favicon.svg          # Favicon
├── package.json             # Dependencias y scripts
├── vite.config.js           # Configuración de Vite
├── tailwind.config.js       # Configuración de Tailwind
├── postcss.config.js        # Configuración de PostCSS
├── vercel.json              # Configuración de Vercel
└── env-example.txt          # Ejemplo de variables de entorno
```

## ⚙️ Configuración e Instalación

### Requisitos Previos

- Node.js 18+ 
- npm o yarn
- Cuenta de Firebase
- Cuenta de Vercel (para hosting)
- API Key de Google Gemini

### Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_auth_domain
VITE_FIREBASE_PROJECT_ID=tu_project_id
VITE_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
VITE_GEMINI_API_KEY=tu_gemini_api_key
```

### Instalación

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Construir para producción
npm run build

# Preview de producción
npm run preview
```

### Despliegue en Vercel

1. Conectar repositorio a Vercel
2. Configurar variables de entorno en Vercel
3. Deploy automático en cada push

## 🔄 Flujo de Procesamiento de Archivos

### 1. Carga de Archivo
```
Usuario selecciona archivo → FileReader lee archivo → Detecta tipo (Excel/CSV)
```

### 2. Procesamiento
```
parseExcel/parseCSV → processFileRows → Detección automática de columnas → Mapeo
```

### 3. Validación
```
executeUpload → Carga registros existentes → Procesa en lotes → Valida datos
```

### 4. Escritura
```
writeBatch → Firestore → Actualiza/Crea registros → Muestra progreso
```

## 🛡️ Seguridad y Validaciones

### Validaciones de Datos

- **Nombres de Cliente**: NUNCA permite "izzi" como nombre válido
- **Teléfonos**: Valida formato y longitud mínima (10 dígitos)
- **Fechas**: Convierte formatos de Excel a fechas legibles
- **Saldos**: Limpia y parsea valores numéricos

### Optimizaciones de Rendimiento

- **Procesamiento en Lotes**: 50 filas por lote para procesamiento, 100-150 para Firestore
- **Pausas Asíncronas**: `setTimeout` para yield al event loop
- **Actualización Incremental**: Solo actualiza registros que cambiaron
- **Lazy Loading**: Carga datos bajo demanda

## 📊 Capacidades y Límites

### Vercel (Plan Gratuito)
- **Tamaño de archivo por deploy**: 100 MB
- **Ancho de banda**: 100 GB/mes
- **Tiempo de ejecución**: 10 segundos (serverless)

### Firestore
- **Documento individual**: 1 MB máximo
- **Escrituras por segundo**: 10,000 (plan Blaze)
- **Lecturas por segundo**: 50,000 (plan Blaze)

### Recomendaciones
- Archivos Excel: Hasta varios MB (procesados en lotes)
- Sin límite práctico de cantidad de archivos
- Procesamiento optimizado para archivos grandes

## 🐛 Solución de Problemas

### Archivo no carga
- Verificar tamaño del archivo
- Revisar formato (Excel .xlsx/.xls o CSV/TXT)
- Verificar que las columnas estén correctamente mapeadas

### "izzi" aparece como nombre
- El sistema tiene validaciones para evitar esto
- Verificar que la columna CLIENTE esté correctamente mapeada
- El sistema buscará en otras columnas si CLIENTE es "izzi"

### Error "Transaction too big"
- El sistema procesa en lotes pequeños para evitar esto
- Si persiste, reducir tamaño de lotes en el código

## 📝 Notas Técnicas

### Procesamiento Asíncrono

El sistema usa procesamiento asíncrono con `setTimeout` para evitar bloquear la UI:

```javascript
// Procesa en lotes de 50 filas
for (let batchStart = 0; batchStart < validRows.length; batchStart += BATCH_SIZE) {
  // Procesa lote
  // Pausa de 100ms para yield al event loop
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

### Detección de Módulos

El sistema detecta automáticamente el tipo de archivo:

```javascript
// Operación del día: tiene columnas específicas Y NO es cobranza
const isOperacionDia = currentModule !== 'sales' && 
  Object.values(columnMapping).some(v => 
    ['Nº de orden', 'Compañía', 'Estado', 'Hub'].includes(v)
  ) && !Object.values(columnMapping).some(v => 
    ['Estatus Cobranza', 'Saldo'].includes(v)
  );
```

### Normalización de Datos

Todas las funciones de limpieza usan `cleanValue`:

```javascript
const cleanValue = (val) => {
  if (!val) return '';
  let str = String(val).trim();
  str = str.replace(/^["']+|["']+$/g, ''); // Quita comillas
  str = str.replace(/\s+/g, ' ').trim();    // Normaliza espacios
  return str;
};
```

## 👥 Roles y Permisos

| Rol | Cobranza | Instalaciones | Operación | Reportes | Usuarios |
|-----|----------|---------------|-----------|----------|----------|
| admin_general | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin_region | ❌ | ✅ | ✅ | ✅ | ❌ |
| vendor | ❌ | ❌ | ❌ | ❌ | ❌ |

## 📞 Soporte 5628426889

Para problemas técnicos o preguntas sobre el funcionamiento del sistema, contactar al administrador del sistema.

---

**Versión**: 1.0.0  
**Última actualización**: 2024  
**Desarrollado para**: Distribuidor Izzi Sureste

