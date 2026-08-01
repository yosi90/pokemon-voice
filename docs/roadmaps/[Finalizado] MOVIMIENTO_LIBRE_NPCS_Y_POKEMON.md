# Movimiento libre para NPC y Pokémon

## Objetivo

Añadir roaming por áreas como conducta ambiental alternativa a las rutas coreografiadas, con navegación cooperativa y prioridad absoluta del jugador.

## Estado

- [x] Contratos de roaming, áreas Tiled y animaciones de carrera.
- [x] Navegación cardinal cacheada, destinos aleatorios y reservas cooperativas.
- [x] Runtime Phaser, cesión de paso y recuperación de emergencia.
- [x] Autoría visual en el configurador de mapas.
- [x] Validación editorial y diagnóstico de densidad.
- [x] Documentación del perfil Tiled y directrices.
- [x] Pruebas unitarias, de componentes y E2E.
- [x] `maps:validate`, typecheck, unitarias, build y E2E.

## Decisiones cerradas

- `Roaming` es una capa funcional distinta de `Paths`; admite rectángulos y polígonos solapados.
- NPC y Pokémon pueden usar la misma conducta.
- Roaming y `ambientSequence` son conductas base mutuamente exclusivas; eventos y cinemáticas pueden suspender el roaming.
- Los actores continúan siendo sólidos. Primero se apartan; si no existe ruta, se reubican en una celda segura, incluso temporalmente fuera de su área.
- El jugador tiene prioridad y reserva un corredor durante cuatro segundos.
- `Run` se usa cuando existe; `Walk` acelerado es el fallback.
- El estado es efímero por visita y nunca se persiste.

## Cierre

- `npm run typecheck`: correcto.
- `npm test`: 113 archivos y 503 pruebas aprobadas.
- `npm run build`: correcto.
- `npm run maps:validate`: mapas, catálogos, historia, narrativas y medios válidos.
- `npm run test:e2e`: 162 pruebas aprobadas y 60 omisiones intencionales; el escenario accesible de `Pedir paso / Hablar` suma 2 perfiles aprobados en su ejecución dirigida.
