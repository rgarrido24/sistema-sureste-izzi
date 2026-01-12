# Formato para proporcionar datos de regiones

Para evitar errores de asignación, proporciona los datos en este formato:

## Formato por región:

```
REGION: NOMBRE_REGION

HUBS:
- HUB NOMBRE1
- HUB NOMBRE2

PLAZAS (nombres completos):
- NOMBRE COMPLETO 1
- NOMBRE COMPLETO 2

CODIGOS_CORTOS:
- COD1: Nombre Completo 1
- COD2: Nombre Completo 2
```

## Ejemplo:

```
REGION: SURESTE

HUBS:
- HUB MERIDA
- HUB CANCUN

PLAZAS:
- MERIDA
- CANCUN
- COATZACOALCOS

CODIGOS_CORTOS:
- ME: Merida
- CN: Cancun
- CC: Coatzacoalcos
```

## Notas importantes:

1. **Una plaza solo puede estar en UNA región** - no debe aparecer en múltiples regiones
2. **Los códigos cortos deben ser únicos** - si un código aparece en múltiples regiones, se asignará a la primera que lo encuentre
3. **Los nombres completos son prioritarios** - si hay un nombre completo, se usa antes que el código corto
4. **METROPOLITANA es el fallback** - cualquier código desconocido se asigna a METROPOLITANA

## Problemas actuales identificados:

1. **Comparaciones demasiado flexibles**: El uso de `includes()` está causando falsos positivos
2. **Dashboard y Operación usan funciones diferentes**: Esto causa que las sumas no coincidan
3. **Orden de verificación inconsistente**: Algunas regiones se verifican antes que otras, causando asignaciones incorrectas

## Solución propuesta:

1. Hacer las comparaciones más estrictas (coincidencias exactas primero)
2. Unificar las funciones de Dashboard y Operación
3. Reordenar la lógica para que sea consistente
4. Priorizar códigos cortos exactos sobre comparaciones parciales

