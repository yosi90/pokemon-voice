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
  - `npm test`: 87 archivos y 369 pruebas correctas.
  - E2E específico del configurador: 13 escenarios correctos y 13 omitidos por matriz de proyecto; cubre cámara, mundo, los cinco tamaños de escritorio y el aviso móvil.
  - `npm run maps:validate`: 2 proyectos y 56 recursos Pokémon válidos.
  - `npm run build`: correcto.
- La suite E2E global se ejecutó durante el cierre. Sus fallos restantes pertenecen a flujos y capturas visuales generales ajenos a este configurador; la suite específica de este hito queda verde.

## Correcciones posteriores

### 26 de julio de 2026 — Cámara y vista completa

- [x] Mantener el canvas Phaser a las dimensiones nativas del TMJ para evitar doble escalado.
- [x] Aplicar la misma transformación de cámara al mapa, anclas, geometría y marcadores.
- [x] Conservar el zoom de habitación y vista completa como preferencia local del usuario.
- [x] Mantener el zoom al cambiar de habitación o alternar entre habitación y mundo.
- [x] Hacer que Recentrar modifique únicamente la posición de la cámara.
- [x] Corregir el drag de la herramienta Mano y admitir desplazamiento con el botón central.
- [x] Permitir desplazar la vista completa incluso al iniciar el gesto sobre una habitación.
- [x] Corregir la fila colapsada del viewport de la vista completa.
- [x] Verificar por E2E la alineación a 200% y 180%, el pan, el recentrado, la persistencia y la presencia de píxeles dibujados en el mundo.

### 26 de julio de 2026 — Ribbon, rotaciones y organización visual

- [x] Compartir las ocho transformaciones ortogonales de tiles de Tiled entre las vistas.
- [x] Aplicar la rotación de Tiled a Paths, colisiones y oclusiones en editor y runtime.
- [x] Convertir Diseñar, Probar y Ver completo en modos principales de la barra inferior.
- [x] Sustituir los menús y barras horizontales por una ribbon con familias y overflow medido.
- [x] Trasladar zoom y centrado a controles flotantes dentro del lienzo.
- [x] Permitir editar el título visible sin modificar IDs ni prefijos.
- [x] Abrir el organizador al pulsar el encabezado de habitaciones.
- [x] Mantener un borrador del `.world` hasta Aplicar organización.
- [x] Añadir, quitar, mover y reincorporar piezas desde el organizador.
- [x] Numerar las piezas activas por posición y actualizar rutas sin migrar IDs.
- [x] Apartar TMJ retirados mediante nombres terminados en `.old`.
- [x] Guardar renombrados físicos después de TMJ, `.world` y sidecar.
- [x] Representar habitaciones pendientes sin fondo, con borde y etiqueta.
- [x] Incorporar `03-05` como pieza pendiente en el mundo de Tegueste.
- [x] Enlazar la marca PokeDiscover con la aplicación principal.
- [x] Cubrir transformaciones, nomenclatura, renombrado físico, título, placeholders y organización mediante pruebas.
- [x] Hacer que la ribbon comience a la derecha del explorador sin desplazar su encabezado.
- [x] Trasladar Diseñar, Probar y Ver completo al pie del explorador de habitaciones.
- [x] Recuperar la barra de estado inferior compacta dedicada a mensajes y estado de guardado.
- [x] Confinar utilidades flotantes al rectángulo útil del lienzo al mover, redimensionar, minimizar y maximizar.
- [x] Abrir las propiedades de una colocación del mapa en un inspector lateral acoplado.
- [x] Hacer que el inspector reduzca el lienzo y restaure su espacio al cerrarse.
- [x] Reutilizar el mismo formulario de propiedades en el inspector y el resumen general de colocaciones.
- [x] Corregir las filas comprimidas y los checkboxes sobredimensionados del resumen de contenido.
- [x] Recordar durante 24 horas la última carpeta abierta mediante su permiso y una copia local temporal de respaldo.
- [x] Reabrir automáticamente la carpeta reciente con el directorio real o, si no hay permiso, con la copia local.
- [x] Ofrecer una acción de reapertura cuando el navegador requiera renovar el permiso con un gesto.
- [x] Mostrar en el slider la escala efectiva del recurso y la entidad, igual que en el runtime.
- [x] Limitar la edición visual de entidades a 50–150 % en pasos de 5 %, preservando sidecars antiguos.
- [x] Añadir un guardado contextual con disquete para los documentos pendientes.
- [x] Proteger apertura, recarga, cierre y navegación mediante Guardar, Descartar o Cancelar.
- [x] Eliminar el borde de los controles y resaltar Recentrar únicamente cuando la cámara se haya desplazado.
- [x] Añadir una grilla de tiles alineada con cámara y zoom y recordar su visibilidad.
- [x] Abrir un menú de creación al pulsar una celda vacía en modo Diseñar.
- [x] Crear Pokémon, NPC, interacciones y secretos mediante borradores multiarchivo cancelables.
- [x] Crear anclas, entradas, salidas, colisiones y oclusiones desde una celda.
- [x] Dibujar rutas ortogonales arrastrando por las celdas del mapa.
- [x] Sustituir el inspector flotante de geometría por un inspector lateral común.
- [x] Editar coordenadas, dimensiones, rotación y vértices desde el inspector lateral.
- [x] Avisar antes de modificar una ancla compartida por varias referencias.
- [x] Integrar el guion automático completo de Pokémon y NPC mediante `ambientSequences`.
- [x] Añadir mostrar/ocultar, reordenación y eliminación de pasos y acciones ambientales.
- [x] Permitir crear y duplicar tanto pasos como acciones individuales del guion.
- [x] Conservar la escala efectiva de una entidad durante los cambios de animación.
- [x] Añadir una preferencia persistente para crear directamente o exigir `Shift` al usar clic y arrastre.
- [x] Corregir el relleno triangular de la rejilla y mostrarla con líneas rojas discontinuas un tile fuera del mapa.
- [x] Cerrar el menú de celda al pulsar otra posición o alejar el puntero más de 100 px.
- [x] Añadir tooltips explicativos al zoom, recentrado y rejilla.
- [x] Eliminar el separador vertical innecesario delante de los controles de visibilidad.
- [x] Corregir la restauración de la carpeta al recargar también en navegadores sin `showDirectoryPicker`.
- [x] Eliminar los tooltips nativos duplicados de los controles del mapa.

Validación de la corrección:

- `npm run typecheck`: correcto.
- `npm run test`: 87 archivos y 377 pruebas correctas.
- E2E del configurador: 21 escenarios de escritorio y el aviso móvil correctos; 22 pruebas correctas y 22 omisiones esperadas por la matriz de proyectos.
- Inspección visual manual correcta a `1440×900` y `3440×1440`, incluyendo inspector lateral, escala efectiva, guardado contextual y aprovechamiento del lienzo.
- `npm run maps:validate`: 2 proyectos y 56 recursos Pokémon válidos.
- `npm run build`: correcto.
- La ejecución E2E global queda en 146 pruebas correctas, 22 omitidas y 18 fallos ajenos al configurador. Permanecen desajustes de capturas de referencia, un recurso PMD ausente (`0019-rattata/default/Idle-Anim.png`), una expectativa antigua sobre tres Rattata inicialmente ocultos y varios timeouts aislados en flujos generales.
