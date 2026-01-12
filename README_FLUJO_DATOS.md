# 🔄 Flujo de Datos - Sistema Sureste

## 📊 Arquitectura de Colecciones

El sistema maneja el flujo de datos a través de diferentes colecciones que representan el ciclo de vida de una orden:

```
Operación del Día → M1 → M2 → M3 → M4
```

### Colecciones

1. **`operacion_dia`** - Órdenes nuevas (estado: Abierta)
2. **`m1_master`** - Cosecha FPD (M1)
3. **`m2_master`** - M2
4. **`m3_master`** - M3
5. **`m4_master`** - M4

## 🔑 Clave Única: Número de Cuenta

**Todas las colecciones usan el número de cuenta como clave única** para:
- Evitar duplicados
- Relacionar registros entre colecciones
- Rastrear el flujo de una orden

### Normalización del Número de Cuenta

El sistema busca el número de cuenta en estos campos (en orden de prioridad):
- `cuenta`
- `Nº de cuenta`
- `N° de cuenta`
- `Cuenta`
- `Nº Cuenta`
- `N° Cuenta`
- `Numero de cuenta`
- `Número de cuenta`

## 📈 Flujo de Datos

### 1. Operación del Día
- **Origen**: Archivo diario de operaciones
- **Estado inicial**: `Abierta` (pendiente de instalar)
- **Estados posibles**: 
  - `Abierta` - Pendiente
  - `Completa` - Ya instalada
  - `Cancelada` - Cancelada
  - `Not done` - No localizamos al cliente

### 2. M1 (Cosecha FPD)
- **Origen**: Archivo de M1
- **Relación**: Busca si existe en `operacion_dia` por número de cuenta
- **Comportamiento**: 
  - Si existe en operación, crea en M1 preservando fecha de creación
  - Si no existe, crea nuevo registro
  - Si ya existe en M1, actualiza (si `updateExisting = true`)

### 3. M2
- **Origen**: Archivo de M2
- **Relación**: Busca en `m1_master`, `operacion_dia`
- **Comportamiento**: Similar a M1, pero rastrea origen desde M1 o Operación

### 4. M3
- **Origen**: Archivo de M3
- **Relación**: Busca en `m2_master`, `m1_master`, `operacion_dia`
- **Comportamiento**: Rastrea origen desde M2, M1 o Operación

### 5. M4
- **Origen**: Archivo de M4
- **Relación**: Busca en todas las colecciones anteriores
- **Comportamiento**: Rastrea origen completo del flujo

## 🚀 Endpoints API

### Operación del Día
- `GET /api/operacion` - Obtener todas las operaciones
- `GET /api/operacion/count` - Conteo
- `POST /api/operacion/bulk` - Cargar archivo (evita duplicados por cuenta)
- `PUT /api/operacion/:id/estado` - Actualizar estado

### M1
- `GET /api/m1` - Obtener todos los registros M1
- `GET /api/m1/count` - Conteo
- `POST /api/m1/bulk` - Cargar archivo M1
- `GET /api/m1/cuenta/:cuenta` - Buscar por número de cuenta
- `PUT /api/m1/:id/estado` - Actualizar estado

### M2, M3, M4
- Mismos endpoints que M1, pero en `/api/m2`, `/api/m3`, `/api/m4`

## 📝 Ejemplo de Uso

### Cargar Operación del Día
```javascript
POST /api/operacion/bulk
{
  "data": [
    {
      "Nº de cuenta": "123456",
      "Cliente": "Juan Pérez",
      "Estado": "Abierta",
      ...
    }
  ],
  "updateExisting": true
}
```

### Cargar M1
```javascript
POST /api/m1/bulk
{
  "data": [
    {
      "Cuenta": "123456",  // Mismo número de cuenta
      "Cliente": "Juan Pérez",
      ...
    }
  ],
  "updateExisting": true
}
```

**Resultado**: 
- Si la cuenta "123456" existe en `operacion_dia`, se crea en M1 preservando la fecha de creación original
- Si ya existe en M1, se actualiza
- **No se duplica** porque usa el número de cuenta como clave única

## 🔍 Búsqueda y Relaciones

### Buscar un registro por cuenta
```javascript
GET /api/m1/cuenta/123456
```

### Verificar existencia en múltiples colecciones
El sistema automáticamente verifica si un número de cuenta existe en:
- Colecciones anteriores (flujo natural)
- La misma colección (para evitar duplicados)

## ⚙️ Configuración

### Estados Válidos
- `Abierta` - Pendiente
- `Completa` - Completada
- `Cancelada` - Cancelada
- `Not done` - No localizado

### Orígenes Válidos
- `operacion` - Viene de operación del día
- `m1` - Viene de M1
- `m2` - Viene de M2
- `m3` - Viene de M3
- `m4` - Viene de M4

## 📅 Escalabilidad

El sistema está diseñado para:
- ✅ Manejar cargas diarias sin duplicados
- ✅ Rastrear el flujo completo de una orden
- ✅ Preservar fechas de creación originales
- ✅ Escalar desde enero en adelante
- ✅ Evitar duplicados entre colecciones

## 🔄 Actualización de Estados

Puedes actualizar el estado de cualquier registro:

```javascript
PUT /api/operacion/:id/estado
{
  "estado": "Completa"
}
```

Esto es útil cuando:
- Una orden se completa
- Un cliente no se localiza (Not done)
- Una orden se cancela

