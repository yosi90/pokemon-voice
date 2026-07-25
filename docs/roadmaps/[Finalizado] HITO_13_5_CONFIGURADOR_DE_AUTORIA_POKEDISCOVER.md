# Hito 13.5 — Configurador de autoría PokeDiscover

## Objetivo

Convertir `/tools/pokediscover-editor/` en la herramienta principal de autoría de aventuras. Tiled seguirá siendo necesario para pintar `Ground`, `Above` y `Detail:*`, pero el configurador podrá crear, editar y guardar el resto de la geometría jugable, la topología del mundo y el contenido del sidecar.

El Hito 14 queda pausado hasta terminar este roadmap. Este documento es la fuente de verdad del rediseño y debe actualizarse después de cada entrega.

## Decisiones cerradas

- Aplicación de escritorio sin scroll de documento, compatible desde `1280×720` hasta `3440×1440` o superior.
- Lienzo central permanente y herramientas en ventanas flotantes no modales; los modales se reservan para confirmaciones y errores.
- Scroll permitido únicamente dentro de ventanas, listas y tablas.
- Apertura automática al elegir una carpeta; guardado directo mediante File System Access API y exportación como fallback.
- Historial global transaccional para sidecar, TMJ y `.world`.
- Tiled pinta tiles; el configurador edita `Anchors`, `Collision`, `Paths`, `Occlusion`, conexiones, entradas y contenido.
- `Ground` es obligatorio. El editor puede crear `Above`, `Collision`, `Anchors`, `Paths` y `Occlusion`.
- Colisiones y oclusiones admiten rectángulos y polígonos; las rutas son polilíneas editables.
- `.world` es la fuente compartida con Tiled para la colocación global de habitaciones.
- Las conexiones entre bordes contiguos crean anclas y transiciones bidireccionales.
- El mapa admite varios puntos de entrada nombrados, asignables por misión, más una entrada de expedición libre.
- El tamaño por colocación es relativo al asset curado y no altera la huella de movimiento.
- El ID histórico `room:tegueste-forest:02-04` no se migra; la UI muestra el archivo real `02-05`.
- En pantallas inferiores al mínimo se muestra un aviso; no se mantiene una interfaz móvil de autoría.

## Entrega 1 — Contratos y documentos editables

- [x] Añadir escala relativa opcional a Pokémon y personajes.
- [x] Añadir puntos de entrada, asignaciones por misión y entrada de expedición libre.
- [x] Mantener compatibilidad con sidecars anteriores.
- [x] Modelar TMJ editables sin perder campos desconocidos.
- [x] Modelar lectura y escritura de archivos `.world`.
- [x] Detectar y registrar automáticamente TMJ ausentes del sidecar.
- [x] Crear proyectos desde carpetas que solo contienen TMJ.
- [x] Preparar capas requeridas ausentes sin tocar datos de tiles.
- [x] Implementar historial transaccional acotado a 100 operaciones.
- [x] Cubrir contratos, importación, round-trip e historial con pruebas unitarias.

## Entrega 2 — Aplicación de escritorio

- [x] Sustituir la página vertical por un shell fijo de `100dvh`.
- [x] Añadir menús Archivo, Edición, Mapa, Contenido, Herramientas y Ventana.
- [x] Añadir explorador de habitaciones y barra de estado.
- [x] Implementar ventanas movibles, redimensionables, maximizables y minimizables.
- [x] Persistir la disposición de ventanas y limitarla al viewport actual.
- [x] Mantener el lienzo estable durante carga y cambio de habitación.
- [x] Simplificar el lenguaje visible y ocultar IDs bajo detalles avanzados.
- [x] Mostrar aviso de escritorio bajo `1280×720`.
- [x] Verificar `1280×720`, `1440×900`, `1920×1080`, `2560×1080` y `3440×1440`.

## Entrega 3 — Lienzo de diseño y geometría

- [x] Separar modos Diseñar y Probar.
- [x] Añadir selección, pan, zoom y ajuste opcional a cuadrícula.
- [x] Crear y editar anclas de punto y rectangulares.
- [x] Crear y editar colisiones rectangulares y poligonales.
- [x] Crear y editar rutas por polilíneas.
- [x] Crear y editar oclusiones rectangulares y poligonales.
- [x] Mantener `nextlayerid` y `nextobjectid` válidos.
- [x] Bloquear borrados referenciados y enumerar dependencias.
- [x] Duplicar colocaciones, pasos de escena y definiciones simples con IDs nuevos.
- [x] Hacer que el runtime respete colisiones poligonales.

## Entrega 4 — Mundo, conexiones y entradas

- [x] Añadir `tegueste-forest.world` con la distribución acordada.
- [x] Renderizar la vista completa sin huecos artificiales.
- [x] Permitir reorganizar habitaciones y guardar el `.world`.
- [x] Ajustar por cuadrícula y atraer bordes contiguos.
- [x] Crear conexiones bidireccionales entre vecinos.
- [x] Colocar al jugador en la casilla interior contigua al cruzar.
- [x] Crear y administrar puntos de entrada nombrados.
- [x] Asignar entradas por misión y para expedición libre.
- [x] Configurar la misión de Alcanfor para entrar por `02-05`.

Distribución inicial del Bosque de Tegueste, en píxeles:

| Habitación | X | Y |
|---|---:|---:|
| `01-05` | 480 | 0 |
| `02-05` | 480 | 320 |
| `04-05` | 0 | 640 |
| `05-05` | 480 | 640 |
| futura `03-05` | 960 | 320 |

## Entrega 5 — Autoría de contenido

- [x] Colocar Pokémon y NPC seleccionando o creando un ancla en el mapa.
- [x] Mostrar una colocación fantasma antes de confirmar.
- [x] Editar orientación, animación, visibilidad, colisión y tamaño relativo.
- [x] Dibujar o reutilizar una ruta durante la colocación.
- [x] Crear automáticamente su secuencia de movimiento.
- [x] Abrir el editor correspondiente al seleccionar un actor del lienzo.
- [x] Compartir el catálogo con las ventanas que soliciten una selección.
- [x] Mantener coordenadas en TMJ y reglas/secuencias en el sidecar.

## Entrega 6 — Guardado, validación y cierre

- [x] Abrir carpetas mediante `showDirectoryPicker`.
- [x] Guardar TMJ modificados, `.world` y sidecar en orden seguro.
- [x] Detectar conflictos con cambios externos.
- [x] Confirmar pérdida de cambios al abrir, recargar, cerrar o abandonar.
- [x] Conservar exportación de copia cuando no haya permiso de escritura.
- [x] Verificar round-trip de todos los documentos modificados.
- [x] Reescribir las pruebas E2E del editor alrededor de menús y ventanas.
- [x] Comprobar ausencia de scroll y estabilidad del lienzo en todos los viewports objetivo.
- [x] Comprobar colisión poligonal, conexión bidireccional y entradas por misión.
- [x] Ejecutar typecheck, unitarias, E2E específicas, `maps:validate` y build.
- [x] Documentar el resultado y renombrar este archivo con `[Finalizado]`.

## Criterios de aceptación

- Elegir la carpeta de Tegueste carga sus cuatro TMJ sin un segundo botón.
- Los TMJ no declarados quedan editables y preparados en el sidecar en memoria.
- `01-05`, `02-05`, `04-05` y `05-05` aparecen en sus coordenadas reales y sus bordes contiguos se tocan.
- El documento no tiene scroll en ninguna resolución soportada y el mapa no se deforma en ultrawide.
- Abrir una habitación no produce una expansión animada ni cambia el rectángulo del lienzo.
- Una operación puede crear capa, geometría y contenido, y un único Deshacer revierte todo.
- Los TMJ guardados continúan abriendo en Tiled y conservan tiles y propiedades desconocidas.
- Una colisión poligonal dibujada en el editor bloquea al jugador en el runtime.
- Un Pokémon al 150% conserva su huella, recorre su ruta y usa las animaciones elegidas.
- Cruzar una conexión de borde funciona en ambos sentidos y coloca al jugador una casilla hacia el interior.
- Dos misiones pueden iniciar el mismo conjunto de mapas desde habitaciones distintas.

## Fuera de alcance

- Pintura de tiles.
- Edición de tilesets.
- Importación o normalización de sprites.
- Interfaz completa de autoría en móvil.
- Migración del ID histórico `02-04`.

## Estado actual

- Estado: finalizado el 25 de julio de 2026.
- Entregas 1–6 completadas.
- Validación final:
  - `npm run typecheck`: correcto.
  - `npm test`: 87 archivos y 368 pruebas correctas.
  - E2E específico del configurador: 12 escenarios correctos y 12 omitidos por matriz de proyecto; cubre los cinco tamaños de escritorio y el aviso móvil.
  - `npm run maps:validate`: 2 proyectos y 56 recursos Pokémon válidos.
  - `npm run build`: correcto.
- La suite E2E global se ejecutó durante el cierre. Sus fallos restantes pertenecen a flujos y capturas visuales generales ajenos a este configurador; la suite específica de este hito queda verde.
