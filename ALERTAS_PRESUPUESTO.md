# 🔔 Guía de Configuración de Alertas de Presupuesto

## 📊 Firebase - Configurar Alertas de Presupuesto

### Paso 1: Acceder a Firebase Console
1. Ve a: https://console.firebase.google.com/
2. Selecciona tu proyecto: `sales-master-production`
3. Haz clic en el ícono de configuración (⚙️) → **Uso y facturación**

### Paso 2: Configurar Alertas de Presupuesto

#### Para Firestore:
1. En la sección **Firestore**, haz clic en **Configurar alertas**
2. Configura las siguientes alertas:
   - **Lecturas diarias**: Alerta al 80% de 50,000 (40,000 lecturas)
   - **Escrituras diarias**: Alerta al 80% de 20,000 (16,000 escrituras)
   - **Almacenamiento**: Alerta al 80% de 1 GB (0.8 GB)

#### Para Storage:
1. En la sección **Storage**, haz clic en **Configurar alertas**
2. Configura:
   - **Almacenamiento**: Alerta al 80% de 5 GB (4 GB)
   - **Descargas diarias**: Alerta al 80% de 1 GB (0.8 GB)

#### Para Authentication:
1. En la sección **Authentication**, haz clic en **Configurar alertas**
2. Configura:
   - **Verificaciones mensuales**: Alerta al 80% de 10,000 (8,000 verificaciones)

### Paso 3: Configurar Límites de Presupuesto (Opcional pero Recomendado)

1. Ve a: https://console.cloud.google.com/billing
2. Selecciona tu proyecto
3. Ve a **Presupuestos y alertas**
4. Crea un nuevo presupuesto:
   - **Monto**: $5 USD/mes (o el límite que prefieras)
   - **Alertas**: 
     - 50% del presupuesto ($2.50)
     - 90% del presupuesto ($4.50)
     - 100% del presupuesto ($5.00)
   - **Acción**: Enviar email cuando se alcance cada umbral

## 🤖 Google Gemini API - Configurar Alertas

### Paso 1: Acceder a Google Cloud Console
1. Ve a: https://console.cloud.google.com/
2. Selecciona tu proyecto
3. Ve a **API y servicios** → **Credenciales**

### Paso 2: Configurar Cuotas y Límites
1. Ve a **API y servicios** → **Cuotas**
2. Busca "Generative Language API"
3. Configura alertas para:
   - **Requests per minute**: Alerta al 80% del límite
   - **Tokens per day**: Alerta al 80% del límite

### Paso 3: Configurar Presupuesto para Gemini
1. Ve a **Presupuestos y alertas**
2. Crea un presupuesto específico para Gemini API:
   - **Monto**: $10 USD/mes (ajusta según necesites)
   - **Filtro**: Solo servicios de "Generative Language API"
   - **Alertas**: 50%, 90%, 100%

## 📧 Configurar Emails de Alerta

### En Firebase:
1. Ve a **Configuración del proyecto** → **Usuarios y permisos**
2. Asegúrate de que tu email esté agregado
3. Las alertas se enviarán automáticamente a los administradores

### En Google Cloud:
1. Ve a **IAM y administración** → **Cuentas de servicio**
2. O configura alertas en **Presupuestos y alertas** → **Notificaciones**

## 🔍 Monitoreo Regular

### Revisar Uso Actual en Firebase:
1. Ve a Firebase Console → **Uso y facturación**
2. Revisa:
   - **Firestore**: Lecturas, escrituras, almacenamiento
   - **Storage**: Almacenamiento, descargas
   - **Authentication**: Verificaciones

### Revisar Uso de Gemini:
1. Ve a Google AI Studio: https://aistudio.google.com/
2. Revisa el uso de API en tu cuenta
3. Monitorea tokens consumidos

## ⚠️ Límites del Plan Gratuito (Resumen)

### Firebase Spark (Gratuito):
- **Firestore**: 
  - 1 GB almacenamiento
  - 50,000 lecturas/día
  - 20,000 escrituras/día
- **Storage**: 5 GB
- **Auth**: 10,000 verificaciones/mes

### Gemini API (Free Tier):
- **Flash**: 15 requests/minuto
- **Pro**: 2 requests/minuto
- Sin límite mensual claro (pero monitorea tokens)

## 💡 Recomendaciones

1. **Revisa semanalmente** el uso en Firebase Console
2. **Configura alertas** al 80% para tener margen
3. **Optimiza consultas** si te acercas a los límites
4. **Considera pagar** solo si realmente necesitas más capacidad

## 🚨 Qué Hacer si Recibes una Alerta

1. **Revisa el uso** en la consola correspondiente
2. **Identifica** qué está consumiendo más recursos
3. **Optimiza**:
   - Reduce consultas innecesarias
   - Limpia datos antiguos
   - Optimiza el tamaño de archivos
4. **Si es necesario**, considera actualizar al plan de pago

---

**Última actualización**: 2024

