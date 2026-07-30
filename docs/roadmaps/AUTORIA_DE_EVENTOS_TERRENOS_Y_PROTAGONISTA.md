# Autoría de eventos, terrenos y protagonista

## Objetivo

Completar el configurador PokeDiscover y el runtime para que una aventura pueda
construirse sin editar JSON a mano. El autor debe poder pintar superficies,
declarar lugares, crear eventos complejos mediante recetas, editar después todo
su guion y probar peligros esquivables con consecuencias configurables.

Tegueste será la aceptación editorial: el usuario construirá su contenido real
con el configurador. La implementación no introducirá excepciones por sector,
especie o misión para conseguir que esos ejemplos funcionen.

## Estado actual

- [x] El runtime ejecuta secuencias ambientales, de mapa y de compañero.
- [x] Existen activaciones por zona, proximidad y acción contextual.
- [x] Existen requisitos, persistencia, rutas, transiciones y fade entre sectores.
- [x] El configurador crea eventos espaciales sencillos y edita secuencias
      ambientales.
- [x] Existe un editor avanzado común para `mapSequences`, `ambientSequences` y
      `companionSequences`, con pasos paralelos, pausas, ordenación y acciones
      tipadas sin convertir los documentos.
- [x] Existen superficies semánticas, proyectiles, impactos, desmayo,
      reinicio de sector y fracaso de misión.
- [x] Laboratorios, ranchos, edificios, camas y destinos seguros tienen una
      representación estable reutilizable por eventos.
- [x] El protagonista se resuelve desde el perfil/manifiesto y conserva su
      sprite aunque el nuevo sector no tenga colocación controlable.
- [x] Achamán y Guayota tienen hojas acuáticas activas; Lapras aporta Surf y
      usa una montura direccional normalizada.

## Decisiones cerradas

- La interfaz combinará **recetas guiadas y guion avanzado**. Las recetas sólo
  componen contratos compartidos; nunca crearán un formato paralelo.
- Cada TMJ tendrá una object layer semántica `Terrain`, independiente de
  `Ground`. La interfaz se comportará como una cuadrícula pintable, pero al
  confirmar compactará las celdas en rectángulos `TerrainArea` completos y no
  solapados. Al abrir un TMJ sin ella, el configurador propondrá crear un único
  rectángulo de tierra firme en una transacción de saneamiento deshacible.
- La primera taxonomía funcional será: `ground`, `water`, `void`, `fall`,
  `ice` y `slow`. Los biomas y nombres narrativos serán etiquetas de lugares,
  no tipos de terreno.
- Entrar en `water` exigirá la capacidad `surf` y cambiará automáticamente al
  sprite acuático del avatar. Sin `surf`, el borde se comportará como bloqueo y
  dará feedback; no necesitará una colisión dibujada alrededor.
- Achamán y Guayota tendrán hojas acuáticas propias. No se reutilizarán como
  definitivas hojas de protagonistas ajenos de `asset-library`.
- Los lugares usarán tipos funcionales más etiquetas libres. Por ejemplo:
  área + `building,laboratory`, área + `ranch`, entrada + `door`, descanso +
  `bed` o recuperación + `safe`.
- Los proyectiles y cargas serán objetos reales esquivables, con colisión contra
  escenario, actores y la huella del jugador.
- Cada peligro elegirá una consecuencia:
  - `recover`: fade, reposición y continuación sin castigo.
  - `resetSector`: restaura el estado transitorio del sector y reaparece en el
    destino configurado.
  - `failMission`: termina la expedición, marca el intento como fallido y obliga
    a iniciar de nuevo la misión.
- Cada peligro elige además `preserveGains` o `restoreSnapshot`. El primer modo
  conserva lo obtenido; el segundo restaura la instantánea de entrada al sector
  o al intento, incluidos Pokémon registrados, investigación, recompensas,
  inventario, flags y logros de ese intervalo. El perfil y los ajustes quedan
  fuera de estas instantáneas.
- Si `failMission` ocurre en expedición libre, finalizará la expedición como
  derrota en vez de inventar una misión.
- El avatar elegido en el perfil será el predeterminado de todos los sectores.
  Una misión podrá imponer una apariencia y una secuencia podrá cambiarla o
  restaurarla durante la escena.
- Cada forma de acompañante declarará su comportamiento acuático: nadar, volar,
  usar otro asset o recogerse temporalmente. Las entradas antiguas usarán
  `recall`.
- El configurador abrirá la raíz del repositorio, mostrará un árbol de aventuras,
  sectores y misiones y podrá escribir catálogos globales. Las misiones vivirán
  en un `<mapa>.missions.json` separado y editable.
- La primera importación global cubrirá efectos PNG, audio WAV/OGG/MP3 y sprites
  de personajes. PMD y tilesets mantendrán sus pipelines actuales.
- La previsualización técnica no escribirá progreso, pero sí permitirá simular
  avatar, apariencia, capacidad Surf y las tres consecuencias de impacto.

## Contratos y convenciones

- [x] Ampliar el vocabulario Tiled con la object layer `Terrain` y objetos
      rectangulares `TerrainArea`. El editor mostrará un overlay por celda y
      serializará una cobertura determinista, completa y sin solapamientos.
- [x] Añadir `LocationPoint` y `LocationArea` a una capa `Locations`, con ID
      estable, nombre visible, tipo funcional y etiquetas normalizadas. Puertas
      funcionales se vincularán a una transición; no duplicarán su destino.
- [x] Añadir al mapa definiciones de lugares y peligros que referencien objetos
      Tiled por nombre estable, nunca por ID numérico.
- [x] Extender las activaciones con temporizador, cruce de ruta, contacto con
      actor y entrada en superficie. Los temporizadores declararán demora
      inicial, intervalo y zona opcional de actividad.
- [x] Extender las acciones de secuencia con proyectil, cambio de apariencia,
      traslado a lugar, recuperación/desmayo y carga hacia un objetivo. Un
      proyectil declarará origen, visual registrado, trayectoria, velocidad,
      huella, vida útil y secuencias de impacto y fallo.
- [x] Admitir `dynamic:player` y `dynamic:companion` en todo guion compatible,
      manteniendo los selectores restringidos a acciones válidas para cada actor.
- [x] Ampliar el manifiesto de personajes para agrupar, por avatar y apariencia,
      sus modos `walk` y `swim`. Las apariencias heredarán modos ausentes de la
      apariencia base, salvo que la misión los marque como obligatorios.
- [x] Añadir una apariencia opcional a `MissionDefinitionV1` y una acción
      temporal de cambio/restauración. El runtime recibirá el avatar del perfil;
      las colocaciones `controllable` quedarán sólo como entrada legada.
- [x] Versionar y normalizar documentos antiguos sin perder campos desconocidos.
      La migración de `Terrain` será una operación explícita del workspace y no
      modificará `Ground`, `Above` ni tilesets artísticos.

## Implementación

### 1. Superficies y lugares

- [x] Crear brocha, borrador, cuentagotas, relleno y selección rectangular para
      `Terrain`, siempre ajustados a 16×16 y dentro de los límites del sector.
- [x] Mostrar leyenda, tipo bajo el cursor, celdas sin clasificar y accesibilidad
      de cada superficie según la simulación de capacidades.
- [x] Implementar movimiento:
  - `ground`: paso normal.
  - `water`: requiere `surf`, usa modo visual `swim`.
  - `void`: nunca ocupable.
  - `fall`: dispara la recuperación enlazada.
  - `ice`: conserva dirección hasta salir o bloquearse.
  - `slow`: mantiene la cuadrícula y aumenta la duración del paso.
- [x] Al pintar `fall`, ofrecer **Configurar caída**. La receta genera una regla
      `enterSurface` enlazada al `TerrainArea` y exige un lugar de destino. El
      validador rechazará celdas `fall` sin regla o cubiertas por varias reglas.
- [x] Crear el editor de lugares para puntos y áreas, asociación opcional con
      transición y búsqueda por nombre, tipo o etiqueta.
- [x] Permitir elegir lugares como destinos y objetivos desde cualquier receta o
      acción avanzada, mostrando sector y nombre editorial en lugar del ID.
- [x] Implementar la búsqueda determinista de tierra segura más cercana por
      cuadrícula, excluyendo colisiones, vacío, agua y actores sólidos. Si no
      existe, usar el punto de entrada del sector y publicar un diagnóstico.

### 2. Protagonista y locomoción

- [x] Resolver una sola identidad de protagonista al iniciar la expedición desde
      `trainerProfile.avatarId`; conservarla al cambiar de sector.
- [x] Separar identidad/apariencia del `PlayerSpawn`: los sectores sólo deciden
      dónde aparece y hacia dónde mira.
- [x] Aplicar la apariencia de misión sobre la del perfil y permitir cambios
      temporales de escena con restauración explícita.
- [x] Cambiar entre `walk` y `swim` al cruzar la frontera semántica sin recrear
      la identidad, perder orientación ni romper la estela del compañero.
- [x] Aplicar al compañero su regla acuática curada (`swim`, `fly`,
      `alternateAsset` o `recall`) y restaurar su presentación terrestre al
      salir del agua.
- [x] Incorporar y validar las hojas acuáticas de Achamán y Guayota con
      el formato 16×24, cuatro direcciones, escala entera y pivote en los pies.
- [x] Añadir al configurador selector de avatar, apariencia y locomoción para la
      preview, además de diagnóstico de modos o archivos ausentes.

### 3. Motor de eventos activos y peligros

- [x] Separar ejecuciones bloqueantes de eventos de fondo. Patrullas,
      temporizadores y proyectiles continuarán mientras el jugador camina, pero
      se pausarán durante diálogos, cinemáticas, transiciones, desmayo y pestaña
      oculta.
- [x] Implementar proyectiles con barrido entre la posición anterior y la nueva
      para evitar atravesar al jugador a velocidades altas. Destruirlos al
      chocar, caducar, abandonar el sector o reiniciarse el evento.
- [x] Implementar peligros de contacto para actores y cargas. Una carga fijará
      su objetivo al comenzar, respetará colisiones y ejecutará una única reacción
      por impacto gracias a un periodo de invulnerabilidad.
- [x] Implementar la reacción `recover`: detener control y eventos, fade out,
      mover jugador y compañero a tierra cercana o lugar explícito, aplicar
      fade in y rearmar el peligro según su política.
- [x] Implementar `resetSector`: realizar la misma transición visual, reconstruir
      actores, proyectiles, rutas y eventos transitorios desde datos y conservar
      únicamente estados de visita o permanentes que correspondan.
- [x] Implementar `failMission`: terminar la sesión, limpiar el runtime,
      limpiar `missionRuntime`, volver a PokeDiscover con mensaje de derrota y
      dejar la misión disponible desde el principio. En expedición libre,
      mostrar el diálogo de mapa declarado y volver igualmente al tablón.
- [x] Aplicar por peligro `preserveGains` o `restoreSnapshot`, separando la
      instantánea de entrada al sector de la de entrada al intento.
- [x] Con movimiento reducido, sustituir destellos y fades agresivos por una
      transición breve de opacidad sin cambiar colisiones, tiempos ni resultado.

### 4. Configurador unificado de eventos

- [x] Sustituir el editor ambiental aislado por una superficie común capaz de
      abrir `ambientSequences`, `mapSequences` y `companionSequences` sin
      convertirlas ni perder campos.
- [x] Mostrar secuencia, pasos y acciones paralelas; permitir añadir, duplicar,
      reordenar y borrar, editar pausas y elegir actores colocados o dinámicos.
- [x] Exponer todas las acciones válidas del contrato, incluidos mostrar,
      ocultar, animar, orientar, rutas, desplazamiento, proyectil, carga, cambio
      de apariencia, cue, desmayo y traslado.
- [x] Editar activación, requisito, repetición, estado final, secuencia de éxito,
      secuencia de fallo y recompensa desde el mismo evento.
- [x] Representar ramas y reacciones enlazadas —impacto, fallo, requisito
      satisfecho o no satisfecho— como enlaces visibles a otros guiones.
- [x] Mantener IDs técnicos automáticos y de sólo lectura; toda receta conservará
      el borrador fuera de los documentos y confirmará una única transacción.
- [x] Añadir recetas iniciales:
  - Emboscada por proximidad con rama de compañero y rama de fallo.
  - Ataque periódico con proyectil y reacción por impacto.
  - Patrulla con detección de cruce, carga y contacto.
  - Obstáculo Pokémon resuelto mediante objeto o capacidad, como Pokéflauta y
    Snorlax.
  - Reacción automática entre compañero y actor, como Rattata y Pikachu.
  - Inspección que despierta y hace huir a un actor, como Klefki.
  - Intercepción entre actores, como Appletun y Tauros.
  - Coreografía multiactor, como Pelipper, Pidove y NPC del picnic.
- [x] Las recetas expresivas reutilizarán el editor existente de voz, texto y
      acción contextual; no se duplicarán matchers ni recompensas.
- [x] Añadir una biblioteca de eventos del sector con filtros por activación,
      actor, lugar, estado y diagnóstico, de modo que también puedan inspeccionarse
      los Rattata y el prólogo ya existentes.

### 5. Validación, guardado y previsualización

- [x] Validar cobertura y solapamientos de `Terrain`, referencias a
      lugares, destinos alcanzables, assets visuales, actores dinámicos y ciclos
      de secuencias.
- [x] Rechazar `failMission` en contenido que no defina su comportamiento de
      expedición libre y peligros sin reacción segura.
- [x] Detectar rutas de patrulla ausentes, proyectiles sin visual, agua accesible
      sin sprite `swim` y lugares funcionales sin geometría adecuada.
- [x] Incluir TMJ, sidecar y manifiestos afectados en una única transacción de
      Deshacer/Rehacer y en el guardado directo de carpeta.
- [x] Permitir lanzar un evento seleccionado, simular impactos o fallos y
      reiniciar sector desde la preview sin escribir `localStorage`.
- [x] Mostrar telemetría editorial: trigger activo, paso, proyectiles, superficie,
      locomoción, último impacto, consecuencia y destino resuelto.

## Pruebas

### Unitarias

- [x] Migración de TMJ sin `Terrain` a tierra firme, conservación de capas y
      serialización estable.
- [x] Brochas, relleno, deshacer/rehacer y rechazo de celdas fuera de mapa.
- [x] Resolución de superficies, Surf, hielo, terreno lento, vacío y caídas.
- [x] Búsqueda de tierra segura con costa irregular, colisiones y ausencia de
      candidato.
- [x] Lugares, etiquetas, puertas vinculadas y referencias cruzadas.
- [x] Resolución de avatar, apariencia de misión, cambio temporal y modos
      caminar/nadar entre sectores.
- [x] Temporizadores pausables, proyectiles con colisión barrida, contacto y
      periodo de invulnerabilidad.
- [x] Las tres consecuencias de daño y su frontera entre estado transitorio,
      estado de visita y progreso permanente.
- [x] Edición inmutable y round-trip de las tres familias de secuencias.

### Navegador

- [x] Abrir la raíz, descubrir varias aventuras y navegar entre sus sectores
      sin seleccionar carpetas independientes.
- [x] Abrir la biblioteca común, filtrar eventos y cambiar entre las tres
      familias de secuencias.
- [ ] Crear y reabrir cada receta sin tocar JSON; comprobar TMJ y sidecar reales.
- [ ] Pintar agua, bloquear sin Surf, habilitar Surf y observar el cambio de
      sprite al entrar y salir.
- [ ] Cambiar de sector conservando avatar, apariencia, dirección y compañero.
- [ ] Esquivar un proyectil; recibir otro y recuperarse en la tierra más cercana.
- [ ] Recibir una carga y aparecer en un lugar de recuperación de otro sector.
- [ ] Reiniciar sector sin duplicar recompensas ni conservar proyectiles.
- [ ] Perder misión, volver a PokeDiscover y reiniciarla desde checkpoint inicial.
- [ ] Verificar preview técnica y expedición real con movimiento normal y
      reducido.
- [x] Ejecutar `npm run maps:validate`, pruebas unitarias, Playwright proporcional
      y build de producción antes de cerrar cada hito.

## Aceptación editorial

El desarrollo se considerará terminado cuando el usuario pueda usar el
configurador, sin edición manual de JSON, para construir o revisar:

- [ ] Los tres Rattata ocultos que salen de la madriguera, atacan, empujan al
      jugador y vuelven a esconderse.
- [ ] Froakie disparando burbujas periódicas esquivables y enviando al jugador a
      la tierra firme más cercana.
- [ ] Los Sirfetch'd patrullando, detectando la invasión de su recorrido, cargando
      y enviando al jugador frente al laboratorio de Alcanfor.
- [ ] Rattata pisando la cola de Pikachu y provocando el calambrazo.
- [ ] Snorlax bloqueando una ruta y despertando mediante Pokéflauta en un fixture
      o futuro mapa, sin lógica especial por especie.
- [ ] Pelipper, Pidove y NPC ejecutando una escena multiactor.
- [ ] Klefki despertando por inspección y huyendo por una puerta.
- [ ] Appletun interceptando a Tauros antes de que salga del rancho.
- [ ] Laboratorio, rancho, edificios, puertas, camas y puntos seguros disponibles
      como referencias editoriales.
- [ ] Agua navegable con Surf y sprite acuático, además de tierra, vacío, caída,
      hielo y terreno lento.
- [ ] Avatar persistente entre sectores y disfraz configurable por misión o
      durante una escena.

## Hito adicional: novela visual y composición de misiones

### Contratos y catálogos

- [x] Extraer las secuencias narrativas inline a conversaciones globales, una
      por archivo, con manifiesto, IDs compatibles y migración deshacible.
- [x] Registrar fondos, reparto con poses, voz, música y efectos narrativos;
      permitir además actores PMD sin duplicar sus recursos.
- [x] Añadir flujos de misión con bloques de conversación, expedición,
      condición y terminal, manteniendo un mapa propietario y admitiendo tramos
      jugables de otros mapas.
- [x] Persistir bloque, cue y efectos ejecutados para reanudar sin duplicar
      decisiones, flags o recompensas.

### Autoría y runtime

- [x] Crear `/tools/visual-novel-editor/` con biblioteca, escenario 16:9,
      timeline por diálogos, barras de presencia, cinco posiciones y preview
      aislada.
- [x] Añadir acciones declarativas de entrada, salida, movimiento, pose, fondo,
      música, efecto y voz con fase, retardo, duración y bloqueo opcional.
- [x] Generalizar el reproductor para varios actores, ilustraciones y PMD, con
      tokens tipados, historial, auto, salto de texto leído y movimiento
      reducido.
- [x] Sustituir el editor narrativo de misión por un compositor de bloques y
      carriles, con ramas, convergencias y resultados emitidos por el mapa.
- [x] Compartir navegación interna entre configurador, editor narrativo y
      randomizador, protegiendo los cambios pendientes.

### Aceptación del hito

- [ ] Montar desde las herramientas
      `conversación-inicio-prólogo → Tegueste Forest Adventure 1 →
      conversación-final-prólogo`.
- [ ] Recargar en cada bloque y continuar desde el checkpoint exacto.
- [ ] Probar una rama divergente, una convergente, audio, PMD e ilustraciones.
- [ ] Confirmar que las previews no escriben progreso ni `localStorage`.

## Cierre

- [x] Actualizar `docs/codex/directrices-desarrollo.md` y
      `docs/codex/perfil-tiled-poke-voice.md` al estabilizar los contratos.
- [x] Documentar en el propio configurador un tutorial corto basado en las
      recetas de aceptación.
- [ ] Renombrar este archivo con `[Finalizado]` sólo después de que la aceptación
      editorial anterior se complete usando la carpeta real de Tegueste.
