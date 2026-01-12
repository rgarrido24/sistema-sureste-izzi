# 📁 Estructura del Proyecto - Sistema Sureste

## 🏗️ Arquitectura

El proyecto está organizado siguiendo una arquitectura modular y escalable basada en features (funcionalidades).

```
sistema-sureste/src/
├── api.js                    # Servicio API para comunicarse con el backend
├── App.jsx                    # Componente raíz (simplificado)
├── main.jsx                   # Punto de entrada
├── index.css                  # Estilos globales
│
├── components/                # Componentes reutilizables
│   ├── common/               # Componentes comunes
│   │   ├── ErrorDisplay.jsx
│   │   └── LoadingSpinner.jsx
│   ├── admin/                # Componentes específicos de admin
│   │   └── AdminLayout.jsx
│   └── vendor/               # Componentes específicos de vendor
│       └── VendorLayout.jsx
│
├── pages/                     # Páginas principales
│   ├── LoginPage.jsx
│   ├── AdminDashboard.jsx
│   └── VendorDashboard.jsx
│
├── features/                  # Funcionalidades por dominio
│   ├── sales/                # Módulo de cobranza/ventas
│   │   ├── SalesModule.jsx
│   │   ├── SalesListView.jsx
│   │   └── SalesStatusView.jsx
│   ├── install/              # Módulo de instalaciones
│   │   ├── InstallModule.jsx
│   │   └── InstallListView.jsx
│   ├── operacion/            # Operación del día
│   │   └── OperacionModule.jsx
│   ├── reports/              # Reportes
│   │   └── ReportsModule.jsx
│   ├── users/                # Gestión de usuarios
│   │   └── UsersModule.jsx
│   ├── packages/             # Gestión de paquetes
│   │   └── PackagesModule.jsx
│   ├── promociones/          # Gestión de promociones
│   │   └── PromocionesModule.jsx
│   ├── upload/               # Carga de archivos
│   │   └── UploadModule.jsx
│   ├── template/             # Plantillas
│   │   └── TemplateModule.jsx
│   ├── dashboard/            # Dashboard principal
│   │   └── DashboardModule.jsx
│   └── vendor/               # Vistas del vendedor
│       ├── VendorSalesView.jsx
│       ├── VendorReportsView.jsx
│       └── VendorChatView.jsx
│
├── hooks/                     # Custom hooks
│   ├── useData.js            # Hook para cargar datos
│   ├── usePackages.js        # Hook para paquetes
│   └── useReports.js         # Hook para reportes
│
├── contexts/                  # Contextos de React
│   └── AuthContext.jsx       # Contexto de autenticación
│
├── services/                  # Servicios externos
│   └── geminiService.js      # Servicio de Gemini AI
│
└── utils/                     # Utilidades
    ├── constants.js          # Constantes globales
    ├── helpers.js            # Funciones auxiliares
    ├── fileParser.js         # Parsers de archivos
    └── exporters.js          # Exportadores (CSV, Excel)
```

## 📦 Descripción de Carpetas

### `/components`
Componentes reutilizables que se usan en múltiples lugares:
- **common/**: Componentes genéricos (ErrorDisplay, LoadingSpinner, etc.)
- **admin/**: Componentes específicos del dashboard de admin
- **vendor/**: Componentes específicos del dashboard de vendor

### `/pages`
Páginas principales de la aplicación:
- **LoginPage**: Pantalla de login
- **AdminDashboard**: Dashboard principal de administradores
- **VendorDashboard**: Dashboard principal de vendedores

### `/features`
Cada feature representa una funcionalidad completa del sistema:
- **sales/**: Todo lo relacionado con cobranza y ventas
- **install/**: Gestión de instalaciones
- **operacion/**: Operación del día
- **reports/**: Reportes y estadísticas
- **users/**: Gestión de usuarios
- **packages/**: Catálogo de paquetes
- **promociones/**: Promociones y ofertas
- **upload/**: Carga de archivos Excel/CSV
- **template/**: Plantillas de mensajes
- **dashboard/**: Dashboard con métricas
- **vendor/**: Vistas específicas para vendedores

### `/hooks`
Custom hooks para lógica reutilizable:
- **useData**: Carga y gestiona datos del sistema
- **usePackages**: Gestiona paquetes
- **useReports**: Gestiona reportes

### `/contexts`
Contextos de React para estado global:
- **AuthContext**: Maneja autenticación y usuario actual

### `/services`
Servicios externos:
- **geminiService**: Integración con Google Gemini AI

### `/utils`
Funciones auxiliares y utilidades:
- **constants.js**: Constantes globales (roles, módulos, colecciones)
- **helpers.js**: Funciones de ayuda (cleanValue, hashPassword, etc.)
- **fileParser.js**: Parsers para CSV y Excel
- **exporters.js**: Funciones para exportar datos

## 🔄 Flujo de Datos

```
Usuario → Pages → Features → Hooks → API → Backend → MongoDB
                ↓
            Components (UI)
```

## 📝 Convenciones

### Nombres de Archivos
- Componentes: `PascalCase.jsx` (ej: `SalesModule.jsx`)
- Hooks: `camelCase.js` con prefijo `use` (ej: `useData.js`)
- Utilidades: `camelCase.js` (ej: `fileParser.js`)

### Estructura de Features
Cada feature puede contener:
- `[Feature]Module.jsx` - Componente principal
- `[Feature]View.jsx` - Vistas específicas
- `[Feature]Form.jsx` - Formularios
- `[Feature]List.jsx` - Listas
- `hooks/use[Feature].js` - Hooks específicos (si es necesario)

## 🚀 Cómo Agregar una Nueva Feature

1. Crear carpeta en `/features/[nombre-feature]/`
2. Crear el módulo principal: `[Nombre]Module.jsx`
3. Crear componentes específicos según necesidad
4. Importar y usar en `AdminDashboard.jsx` o `VendorDashboard.jsx`

## 🔧 Mantenimiento

- **Componentes reutilizables**: Agregar en `/components/common/`
- **Utilidades nuevas**: Agregar en `/utils/`
- **Hooks reutilizables**: Agregar en `/hooks/`
- **Nuevas features**: Crear en `/features/`

## 📚 Beneficios de esta Estructura

1. **Escalabilidad**: Fácil agregar nuevas features sin afectar otras
2. **Mantenibilidad**: Código organizado por funcionalidad
3. **Reutilización**: Componentes y hooks compartidos
4. **Testabilidad**: Cada feature puede testearse independientemente
5. **Colaboración**: Múltiples desarrolladores pueden trabajar en features diferentes

