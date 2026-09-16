# PITBULL ACADEMY · CORE V1.1 PRE-PILOT

PWA mobile-first para entrenamiento comercial de vendedores de suplementación.

## Definición de producto
Pitbull Academy es la plataforma interna de formación comercial de Pitbull Suplementos. La plataforma no pertenece a una marca de suplementos específica: las marcas, categorías y productos funcionan como contenido variable dentro de Academy.

## Principios
- Academy es el sistema estable.
- Las marcas y productos son contenido multimarca.
- Los módulos entrenan competencias comerciales, no catálogos de producto.
- El flujo principal es: cliente → investigar → decidir → consecuencia → aprendizaje.
- Tiby The Boss aparece sólo en momentos de alto valor: Boss Check y Boss Review.
- Incorporar un producto a la biblioteca no equivale a aprobar su información técnica para entrenamiento.

## Core V1.1 · PRE-PILOT
- Home generalizada y continuidad real del entrenamiento: si un módulo ya comenzó, **Continuar entrenamiento** retoma el punto útil y no vuelve innecesariamente a la introducción.
- Protección de casos completados: ya no reinician el caso ni duplican resultados; pasan a una vista de **revisión de caso**.
- Resultados deduplicados por caso para proteger el scoring.
- Migración explícita: conserva un respaldo exacto del guardado anterior y prioriza el progreso activo de `moduleProgress` sobre un estado legacy divergente, sin inferir actualidad por longitud de conversación.
- M01 reformulado con lenguaje prudente: **evaluar glutamina** como posible complemento no equivale a recomendarla automáticamente ni a prometer un resultado.
- Registro de fuentes técnicas para M01, separado de la fuente de catálogo.
- Pantalla final preparada para piloto con nombre/alias, duración y **Compartir resultado**.
- Reinicio limitado al módulo activo en lugar de borrar toda la experiencia.

## Arquitectura
- `index.html` — shell de Academy y pantallas.
- `styles.css` — sistema visual base.
- `core-v1.css` — capa de interfaz general / multimarca / PRE-PILOT.
- `app.js` — composición de dependencias, identidad de release e inicio.
- `engine/` — estado y persistencia schema 1, comandos de sesión, conversación y scoring legacy; ejecutable sin APIs de presentación del navegador.
- `content/` — interfaces de lectura separadas para clientes, casos/visitas legacy, módulos y catálogo.
- `visuals/` — selección de imágenes, sin acceso mutable al progreso.
- `ui/` — renderizado de snapshots de sólo lectura, eventos y efectos de presentación.
- `platform/` — compartir/copiar resultados y coordinación de actualizaciones PWA.
- `data/brands.js` — registro de marcas.
- `data/products.js` — catálogo de productos sin lógica pedagógica.
- `data/modules.js` — competencias, acciones y relaciones módulo-producto.
- `data/sources.js` — registro y rol de las fuentes.
- `data/scenarios/m01.js` — configuración pedagógica del escenario M01 y Boss Check.
- `data/clients.js` — dataset conversacional heredado de M01; se mantiene como capa compatible durante la migración.
- `manifest.webmanifest` + `service-worker.js` — instalación PWA y caché offline.
- `assets/` — producto, Tiby, iconos y sistema visual de clientes.
- `docs/PHASE-1-STABILIZATION.md` — contrato de comportamiento y persistencia estabilizados.
- `docs/PHASE-2-SEPARATION.md` — límites de responsabilidad, compatibilidad, pruebas y rollback de la separación.
- `docs/PRE-PILOT-V1.1.md` — protocolo del piloto con tres vendedores.

## Biblioteca actual
La primera carga contiene productos Pitbull Suplementos obtenidos como base de catálogo desde Nutribull. La arquitectura permite incorporar Star Nutrition, ENA, Optimum Nutrition, BSN u otras marcas sin modificar el motor de Academy.

## Control informativo
Flujo objetivo para contenido formativo:
`FUENTE → AUDITORÍA → CONTENIDO ACADEMY → QA → PUBLICADO`

Las fuentes tipo retailer pueden servir para inventario, presentación, sabores e imágenes. Claims, funciones, recomendaciones y criterios de uso deben pasar por auditoría documental antes de convertirse en material formativo definitivo.

## M01 · Detectá la oportunidad
M01 continúa siendo el único módulo activo. Utiliza Glutamina como producto de referencia para entrenar detección de necesidad, cambio de categoría, reconocimiento de bases insuficientes y la diferencia entre **evaluar un producto** y **convertirlo en respuesta automática**.

Para PRE-PILOT, el contenido se revisó con fuentes técnicas que reportan resultados heterogéneos y evidencia insuficiente para justificar recomendaciones rutinarias de glutamina con fines de rendimiento/recuperación. Por eso Academy no presenta el producto como una solución garantizada ni como indicación clínica.

## Persistencia
El progreso se guarda localmente por dispositivo. Core V1.1 protege el avance durante la migración desde versiones anteriores, deduplica resultados y separa el progreso por módulo.

## Piloto
Objetivo inicial: probar M01 con 3 vendedores y observar:
1. si pueden completar la experiencia sin explicación externa;
2. si mejora su lectura de casos;
3. si transfieren el criterio a situaciones nuevas de mostrador.

Ver `docs/PRE-PILOT-V1.1.md`.

## URL
`https://jorgenfotografia-rgb.github.io/pitbull-academy/`

## Archivo ENTRENO
La última versión del proyecto anterior se conserva en la rama `archive-entreno-v0.3`.
