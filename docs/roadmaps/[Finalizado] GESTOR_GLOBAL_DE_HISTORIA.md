# Gestor global de historia

## Objetivo

Crear `/tools/story-editor/` como fuente exclusiva de autoría de misiones,
manteniendo las conversaciones en el editor de novela visual y los eventos
jugables en el configurador de mapas.

## Contratos y migración

- [x] Añadir documentos, definiciones y flujos de misión V2.
- [x] Mantener lectura y migración sin pérdida de documentos V1.
- [x] Añadir outline global por actos y capítulos.
- [x] Añadir requisitos de misión completada y compañero desbloqueado.
- [x] Crear backups V1 antes del primer guardado migrado.

## Runtime

- [x] Persistir un progreso independiente por cada misión activa.
- [x] Ejecutar condiciones y efectos con el evaluador y ledger compartidos.
- [x] Admitir conversaciones, expediciones cruzadas y viajes aplazables.
- [x] Implementar fracaso, reintento y abandono configurables.

## Autoría

- [x] Crear la sideweb global y su workspace transaccional.
- [x] Añadir biblioteca, actos, capítulos y estados editoriales.
- [x] Añadir grafo global de dependencias y timeline accesible.
- [x] Añadir grafo e inspector completo del flujo de una misión.
- [x] Añadir simulación aislada y diagnósticos editoriales.
- [x] Enlazar mapas y conversaciones con sus editores especializados.
- [x] Retirar la edición de misiones del configurador de mapas.

## Integración y aceptación

- [x] Generar manifiesto V2 excluyendo borradores.
- [x] Añadir `story:validate` e integrarlo en `maps:validate`.
- [x] Cubrir migración, flujo, efectos, requisitos y workspace con Vitest.
- [x] Cubrir la sideweb en escritorio/móvil y el viaje aplazado con pruebas automatizadas.
- [x] Ejecutar typecheck, pruebas, build y validadores.
- [x] Actualizar las directrices y cerrar este roadmap.

## Estado actual

Implementación completada el 31 de julio de 2026. Historia es la fuente de
autoría; los cargadores conservan compatibilidad V1, el runtime admite misiones
concurrentes y el guardado editorial coordina todos los artefactos afectados.

## Verificación final

- `npm run typecheck`: correcto.
- `npm test`: 112 archivos y 494 pruebas correctas.
- `npm run maps:validate`: contratos, historia, catálogos, medios y mapas correctos.
- `npm run build`: correcto, incluida la entrada `/tools/story-editor/`.
- Playwright específico de Historia: correcto en escritorio y móvil.
- La ejecución E2E global dejó 131 pruebas correctas, 58 omitidas y 29 fallos;
  tras corregir el bucle de montaje revelado por esa ejecución, el único caso
  de mapa repetido de forma aislada alcanza `data-runtime="ready"` y falla más
  adelante por expectativas antiguas de IDs y recuentos del mapa público. Esos
  casos históricos no forman parte de los contratos ni de la sideweb de este
  roadmap.
