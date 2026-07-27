# Mapas V3 y autoría garantizada por el sidecar

## Objetivo

Convertir el sidecar y el runtime en la única fuente de verdad del vocabulario
que puede crear el configurador. La aventura completa se denomina **mapa** y
cada TMJ se denomina **sector**. Ninguna operación de autoría podrá confirmar
objetos o IDs que el sidecar no comprenda y valide.

## Estado

- Estado actual: en desarrollo.
- Inicio: 27 de julio de 2026.
- El trabajo se divide en hitos pequeños; cada uno debe quedar compilable y
  conservar lectura de sidecars V2 hasta completar la migración.

## Checklist

### Hito 1 — Contratos y compatibilidad V3

- [x] Exportar el vocabulario runtime compartido por contratos, editor y validadores.
- [x] Añadir `AdventureMapV3`, sectores y reparto obligatorio.
- [x] Añadir conversión explícita y determinista de V2 a V3.
- [x] Conservar aliases para referencias históricas `room:*`.
- [x] Cubrir contratos y migración mediante pruebas unitarias.

### Hito 2 — Runtime y herramientas con sectores

- [x] Normalizar V2 a V3 al cargar sin perder el documento original.
- [x] Migrar runtime, validadores y herramientas a `sectorId`.
- [x] Mantener compatibilidad de rutas antiguas.
- [x] Actualizar textos visibles de habitación a sector.

### Hito 3 — Reparto y registro de recetas

- [x] Añadir reparto de Pokémon y NPC por sector.
- [x] Exigir al menos cinco assets Pokémon distintos.
- [x] Sincronizar `requiredAssetIds`.
- [x] Crear IDs deterministas con ordinales automáticos.
- [x] Modelar recetas completas que correspondan a construcciones sidecar válidas.

### Hito 4 — Wizard transaccional

- [x] Eliminar la creación libre de anclas desde el lienzo y el menú contextual.
- [x] Mantener los objetos fuera del mapa hasta confirmar el wizard.
- [x] Crear conjuntamente TMJ y sidecar en una transacción.
- [x] Abrir el inspector de propiedades tras confirmar.
- [x] Impedir que cualquier atajo escriba objetos no validados.

### Hito 5 — Saneamiento

- [x] Auditar nombres, clases, referencias y reparto al abrir un mapa.
- [x] Bloquear la autoría normal mientras existan incidencias.
- [x] Permitir reparación individual o borrado de elementos huérfanos.
- [x] Crear el checklist por mapa y sector en
  `docs/roadmaps/SANEAMIENTO_DE_MAPAS_Y_SECTORES.md`.

### Hito 6 — Cierre

- [x] Actualizar las directrices y el perfil Tiled.
- [x] Completar pruebas unitarias y E2E del flujo V3.
- [x] Ejecutar typecheck, tests, `maps:validate` y build.
- [ ] Integrar la auditoría estricta en `maps:validate` cuando el saneamiento esté completo.
- [ ] Renombrar los roadmaps terminados con `[Finalizado]`.

## Decisiones cerradas

- El vocabulario ofrecido por la interfaz será exactamente el comprendido por
  contratos, sidecar, validador y runtime.
- Los IDs técnicos no admiten texto libre.
- Las formas y apariencias cuentan como recursos Pokémon distintos.
- La regla de cinco Pokémon se aplica también a mapas técnicos.
- Un mapa con incidencias queda bloqueado por completo para autoría normal.
- Los elementos referenciados no se eliminan en cascada.
- Los elementos antiguos nunca se renombran silenciosamente.

## Notas técnicas

- `AdventureMapV2` permanecerá como formato de entrada legado.
- La conversión sustituirá el prefijo `room:` por `sector:` sin alterar el resto
  del ID estable.
- Las posiciones visibles como `Sector 02-05` proceden del archivo/world y no
  forman parte del ID estable.
- Mientras existan mapas públicos pendientes de saneamiento, la auditoría de
  convención será independiente de `maps:validate`.
