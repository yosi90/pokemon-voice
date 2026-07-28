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

### Hito 7 — Afinado del saneamiento

- [x] Sustituir el selector masivo del reparto por cinco tarjetas PMD animadas.
- [x] Reutilizar búsqueda, tipos y generación del randomizador.
- [x] Permitir añadir y quitar Pokémon pulsando sus tarjetas.
- [x] Separar el reparto en dos diálogos consecutivos, Pokémon y NPC, con previews `Idle`.
- [x] Simplificar las tarjetas a animación y nombre centrado.
- [x] Inferir como borrador los Pokémon inequívocos presentes en nombres de anclas.
- [x] Reutilizar durante una hora un backup V2 idéntico ya existente.
- [x] Explicar el mínimo pendiente al intentar avanzar con menos de cinco Pokémon.
- [x] Adaptar anclas Pokémon huérfanas a colocación inicial sin perder su posición.
- [x] Mantener el borrado como alternativa a la adaptación funcional.
- [x] Conservar el contador acumulativo de incidencias resueltas.
- [x] Identificar objetos Tiled mediante número, capa, posición, nombre y clase.
- [x] Compactar esos metadatos en tres columnas, con expansión a dos para valores largos.
- [x] Resolver reclasificación y renombrado dentro del propio modal.
- [x] Permitir reparaciones que no añadan errores nuevos y avanzar a la siguiente incidencia.
- [x] Mostrar los rechazos de una reparación dentro del modal.
- [x] Garantizar que toda incidencia de la cola tenga reparación o eliminación segura, incluida la separación de entradas y colocaciones que compartían ancla.
- [x] Recuperar transiciones heredadas sin enlazar mediante la vecindad del world y crear automáticamente ida, vuelta y extremos derivados.
- [x] Unificar las colocaciones Pokémon con IDs derivados de especie/forma, apariencia y ordinal, sin campos de nombre libre.
- [x] Conservar conexiones hacia sectores aún inexistentes como notas editoriales completables automáticamente al incorporar el TMJ de destino.
- [x] Mover TMJ y `sectorId` al footer informativo.

### Hito 8 — Autoría espacial de escenas desde el mapa

- [x] Permitir dibujar una ruta `AmbientPath` desde el lienzo y ligarla en la misma receta a una acción `movePath`.
- [x] Crear desde un comentario una activación automática, contextual o de proximidad y asociarla a una secuencia válida.
- [x] Encadenar actor, trigger, secuencia, ruta y estado final mediante un wizard del mapa, no desde el saneamiento.
- [ ] Cubrir el caso Pelipper: `Sleep`, despertar, sorpresa, vuelo por ruta e `Idle` final.

### Hito 9 — Comentarios y eventos persistentes

- [x] Añadir la capa editorial `Comments` y la clase `EditorComment`, excluidas del runtime.
- [x] Sustituir un huérfano por un comentario con idéntica geometría y metadatos en una sola operación.
- [x] Editar, mover, redimensionar, ocultar y eliminar comentarios.
- [x] Añadir `TriggerZone`, `MapEventTriggerV3` y secuencias de evento con `movePath`.
- [x] Compartir activaciones y políticas entre contratos, registro, validador, editor y runtime.
- [x] Implementar `enterZone`, `contextAction` y `proximity`.
- [x] Implementar `oncePerVisit`, `repeatable` y `persistent`.
- [x] Restaurar los estados finales al cambiar de sector o recargar.
- [x] Aplicar directamente el estado final con movimiento reducido.
- [x] Rechazar zonas, rutas, referencias y estados finales inválidos.
- [x] Cubrir sustitución, Deshacer/Rehacer, autoría y políticas mediante pruebas unitarias.
- [ ] Añadir el evento de contenido de Pelipper al mapa una vez saneado el sector 01-05.

### Hito 10 — Autoría gestual de movimientos y eventos

- [x] Recolocar Pokémon y NPC por arrastre centrado en celda, con Deshacer/Rehacer.
- [x] Dibujar borradores ortogonales mediante `Shift + arrastre` sin mutar TMJ ni sidecar.
- [x] Resolver diagonales por orden de cruce, retroceso inmediato y simplificación colineal.
- [x] Mostrar la ruta provisional roja, discontinua y compatible con movimiento reducido.
- [x] Añadir `Movimientos y eventos` al inspector de Pokémon y NPC.
- [x] Crear movimientos automáticos de una vez, ida y vuelta o circuito continuo.
- [x] Crear eventos por entrada en área, acción contextual o proximidad.
- [x] Añadir `oncePerSectorVisit` y conservar su estado durante una recarga.
- [x] Permitir ampliar y reordenar recorridos sin renombrar IDs confirmados.
- [x] Reutilizar un constructor transaccional para rutas, secuencias, eventos, zonas y estados finales.
- [x] Validar rejilla relativa, ortogonalidad, continuidad, colisiones, animaciones y referencias.
- [x] Añadir coordinación avanzada de varios actores dentro de un beat.
- [x] Cubrir trazado, transacciones y las cuatro políticas temporales con pruebas unitarias.
- [x] Cubrir en E2E de escritorio recolocación, Deshacer/Rehacer, cancelación limpia, confirmación de ruta y evento con área provisional; la edición móvil permanece deshabilitada por diseño.

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
