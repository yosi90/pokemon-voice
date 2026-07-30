# Directrices de desarrollo

## Identidad del juego

El proyecto es un juego para descubrir la Pokedex usando comandos de voz, con fallback de texto para navegadores, dispositivos o situaciones donde el microfono no este disponible.

El desarrollo debe mantener el foco en:

- Descubrir Pokemon de forma progresiva.
- Dar feedback claro tras cada intento de voz o texto.
- Mantener logros, estados desbloqueables y modos de juego como parte natural de la experiencia.
- Evitar cambios que conviertan la aplicacion en una pagina informativa o una interfaz generica.

## Aspecto visual Pokemon

Mantener siempre el aspecto Pokemon de la web:

- Respetar la paleta de colores existente y los codigos de color ya usados en la interfaz.
- Mantener la fuente y el estilo tipografico actual, especialmente el tono retro/arcade cuando aplique.
- Usar componentes, bordes, sombras, botones y estados que encajen con la estetica actual.
- Evitar introducir estilos visuales genericos que rompan la identidad del juego.
- Cualquier nuevo modo, logro o efecto debe sentirse integrado dentro del mundo Pokemon del proyecto.

## Voz y fallback de texto

Las funcionalidades nuevas deben contemplar tanto el flujo por voz como el fallback de texto cuando tenga sentido.

- No asumir que el microfono siempre esta disponible.
- Mantener mensajes de error o estados fallidos comprensibles.
- Evitar bloquear el avance del jugador si puede resolverse con entrada de texto.

## Logros y modos de juego

Los logros y modos de juego deben mantenerse coherentes con la progresion de descubrimiento.

- Documentar nuevas reglas de desbloqueo si afectan a varios componentes.
- Evitar estados ocultos dificiles de depurar sin dejar rastro en el codigo o en un roadmap.
- Mantener la persistencia local compatible con partidas existentes siempre que sea posible.

## Requisitos de progresión

- Declarar las condiciones compartidas mediante `RequirementExpressionV1`; no duplicar su evaluación en componentes React.
- Mantener separados el registro de la run actual y la metaprogresión permanente de PokeDiscover.
- Los requisitos narrativos de acompañantes deben ser datos curados. No derivar niveles de estadísticas competitivas.
- La interfaz puede explicar condiciones públicas, pero los requisitos `hinted` y `secret` solo deben exponerse mediante su texto de lore.

## Catálogo curado de compañeros

- Los archivos `src/data/pokemon-adventure/generation-XX.json` son la fuente de verdad local para categorías, formas, niveles narrativos, requisitos y capacidades de campo.
- PokeAPI solo puede utilizarse como semilla mediante `npm run catalog:import`; nunca debe decidir el gameplay durante la ejecución.
- El importador conserva los campos curados existentes y añade datos oficiales nuevos. Después de editar o importar, ejecutar `npm run catalog:validate`.
- Las formas regionales y alternativas persistentes pueden ser compañeros independientes. Las apariencias conservan `appearanceId` y no se convierten en especies ficticias.
- Los niveles automáticos permanecen marcados como `provisional`; cualquier excepción de lore debe cambiarse a `curated`.
- Una especie habilitada como contenido investigable puede reservar `behavior` o `habitat` mediante `companionResearch`. Este campo se obtiene una sola vez tras terminar una expedición con al menos una interacción significativa.
- Caminar, cambiar de sector o entrar y salir no cuentan como convivencia. NPC, inspecciones, Pokémon, identificaciones, triggers, secretos, pistas, coleccionables e investigación sí cuentan.
- Las formas y apariencias comparten la investigación de convivencia de su especie; sus particularidades se documentan como notas adicionales.

## Mapas de expedición

- `tile` designa exclusivamente una celda de 16×16; cada pantalla estática jugable se denomina sector y la aventura completa se denomina mapa.
- `AdventureMapV3` agrupa sectores Tiled y transiciones por borde, escalera, puerta o teletransporte sin duplicar geometría en el sidecar. `AdventureMapV2` es únicamente un formato de entrada legado que exige migración explícita y copia `.adventure.v2.backup.json`. Al abrir una carpeta debe reutilizarse una copia idéntica de menos de una hora; una copia reciente con contenido distinto bloquea la migración.
- Una expedición exige compañero cuando comienza el control. La herramienta es opcional y, una vez elegida, se recuerda para las siguientes expediciones.
- Las rutas de mapas ya desbloqueados deben crear una `activeExpeditionSession` antes de abrir Phaser. Abandonar termina la sesión mediante `endExpeditionWithReport`, conserva PokeDiscover y muestra el resumen; una previsualización técnica nunca debe fingir progreso de expedición.
- La tienda solo ofrece contenido opcional y permanente. Nunca debe vender directamente especies, formas, apariencias ni hechos de investigación.
- Herramientas, objetos clave, permisos y cosméticos son categorías distintas: solo las herramientas ocupan el slot opcional del loadout.
- Los importes de experiencia y PD viven en `src/data/adventure/rewardBalance.ts`; escenas, secretos y misiones deben reutilizar sus paquetes de balance.
- Los secretos normales y los descubrimientos especiales se pagan siempre mediante un `originId` estable en el ledger.
- Los logros de PokeDiscover calculan mapas, secretos e investigaciones desde el estado persistente; no mantener contadores agregados duplicados.
- Todo mapa nuevo debe respetar `docs/codex/perfil-tiled-poke-voice.md` y superar `npm run maps:validate`.
- Nunca relacionar sidecar y Tiled mediante los IDs numéricos internos de Tiled; usar el nombre estable del objeto.
- Phaser solo se importa al abrir una misión o previsualización; no incluirlo en el bundle inicial de la Pokédex.
- Misiones y expediciones usan rutas hash (`#/missions/<id>` y `#/expeditions/<mapId>/<sectorId>`) con cada ID codificado como un segmento. Los aliases V2 `room:*` se resuelven durante la lectura.
- Cada `MissionDefinitionV1` declara un `loadingText` narrativo propio. La interfaz lo muestra mientras carga Phaser y reserva los mensajes genéricos para errores reales.
- El catálogo `src/data/adventure/missionCatalog.ts` decide qué definiciones puede presentar PokeDiscover. Las misiones bloqueadas permanecen ocultas salvo que exista una referencia persistente explícita; la UI nunca muestra el ID técnico como título cuando conoce su definición.
- Los tilesets externos `.tsj` se conservan como fuente y se incorporan en memoria antes de entregarlos al parser de Phaser.
- El movimiento cardinal comprueba la huella de destino antes de iniciar cada paso de 16 px. Una colisión bloqueada no debe comenzar una interpolación ni corregirse mediante retroceso visual.
- La identificación dentro de una expedición resuelve nombres contra el catálogo local completo y después restringe el resultado a las especies presentes en el sector. Nombrar una especie ausente no modifica la run ni muestra un error.
- Voz y texto reutilizan el mismo resolutor contextual dentro de una expedición. La pantalla del runtime debe ofrecer siempre el fallback escrito sin transferir sus pulsaciones al movimiento del canvas.
- La pantalla conserva la proporción real del sector; no se ensancha un mapa ni se añaden tiles de relleno para adaptarlo a la carcasa de la interfaz.
- Los NPC y Pokémon colocados son sólidos por defecto con una huella de un tile centrada en sus pies. Vuelo, levitación u otros actores atravesables deben declarar `collision: pass-through` en el sidecar; nunca se infiere por el tamaño o el dibujo del sprite.
- `Above` solo puede contener overlays con transparencia real. Troncos, suelo y bases opacas pertenecen a `Ground`; no se elimina ningún color de fondo durante la ejecución.
- Las máscaras parciales se dibujan en la capa opcional `Occlusion` mediante `ActorOccluder` y se relacionan con actores por `occlusionGroup`, nunca por coordenadas hardcodeadas en Phaser.
- Los `ActorOccluder` rectangulares que cubren la base completa del actor deben resolverse mediante recorte de sprite. No usar filtros WebGL dinámicos para agua, hierba o franjas horizontales comunes.
- Las rutas ambientales se dibujan como `AmbientPath` en `Paths`; las secuencias y animaciones viven en `ambientSequences` del sidecar. Una misión o interacción contextual siempre puede suspenderlas mediante el controlador compartido.
- Las coreografías ambientales reinician al entrar en el sector, se pausan completas ante un bloqueo y no escriben progreso. Con movimiento reducido permanecen en la pose base.
- Los pivotes PMD se calculan al generar el manifiesto; el runtime no debe recorrer hojas de sombra. La carga bloqueante incluye solo las animaciones base y las hojas ambientales se deduplican por su fuente `CopyOf`, se preparan en segundo plano y activan la coreografía al completarse.
- Al mantener una dirección, los pasos consecutivos de 16 px se encadenan en el mismo frame lógico; no insertar una pose `Idle` entre tiles transitables.
- Al pulsar una dirección distinta estando parado, el protagonista gira inmediatamente y espera 140 ms antes de caminar; si ya mira en esa dirección, el primer paso puede comenzar sin espera. Durante una marcha, cualquier giro encadena el siguiente tile inmediatamente y nunca reutiliza esa espera.
- Las direcciones pulsadas se conservan como una pila por tecla física: manda la más reciente y, al soltarla, se recupera automáticamente la anterior si continúa pulsada.
- Las flechas y WASD capturadas por Phaser deben cancelar el comportamiento de scroll del navegador, salvo cuando el foco esté dentro de un control editable.
- El prototipo de expediciones admite movimiento solo mediante teclado. La cruceta y los botones dibujados en la carcasa son decoración con `aria-hidden` y `pointer-events: none`; no deben recibir listeners ni simular controles táctiles hasta que exista un roadmap específico de controles móviles. Los botones HTML de diálogo, voz, texto y acciones contextuales continúan siendo táctiles y accesibles.
- Tras enviar una identificación por texto o pulsar el micrófono de una expedición, el foco vuelve al runtime en el siguiente frame para poder continuar caminando sin otro clic.
- La cuadrícula usa una única comprobación previa contra límites, colisiones y actores. No añadir colliders Arcade paralelos que puedan corregir la posición después de haber autorizado un paso.
- Ninguna secuencia automática puede comenzar mientras existe un paso incompleto; primero se ajusta al destino de 16 px y después se evalúa el trigger.
- El compañero dinámico sigue la estela del jugador con una casilla de retraso. No bloquea al protagonista: avanzar contra él intercambia ambas casillas y orienta a los dos hacia el avance.
- El compañero reproduce `Walk` durante cada desplazamiento de su estela y regresa a `Idle` únicamente cuando alcanza su última casilla pendiente.
- La previsualización técnica puede representar el compañero seleccionado y ejecutar secuencias sin crear una sesión ni escribir progreso. Solo una expedición real persiste secretos, recompensas e interacciones.
- Las acciones ocultas del compañero se resuelven mediante `behaviorTriggers` y `companionSequences`. Movimiento a anclas, animaciones y efectos persistentes pertenecen al sidecar; Phaser no contiene excepciones por mapa o especie.
- Las cinemáticas de un sector se declaran mediante `mapSequences`, reutilizando los mismos beats y referencias estables que `companionSequences`. Los cues pueden pausar la escena para una decisión HTML accesible, pero la colocación, visibilidad, movimiento y props animados permanecen dentro de Phaser y del sidecar.
- Una cinemática de misión debe persistir su checkpoint al alcanzar cada decisión y poder reanudar desde `pendingMissionLaunch` o `missionRuntime.checkpointId` sin duplicar recompensas. Las escenas con inicial alternativo convergen en el mismo runtime de misión después de elegirlo.
- Las capacidades narrativas se resuelven una sola vez desde el compañero, su apariencia y la herramienta del loadout bloqueado. El mismo conjunto `expeditionCapabilities` debe alimentar tanto la selección de triggers como su ejecución persistente; movimientos como `rock-tomb` se declaran siempre mediante `fieldCapability`, nunca mediante excepciones por especie en Phaser.
- La identificación de una expedición solo acepta especies cuyos actores estén visibles en ese momento. Un registro nuevo elimina todas sus siluetas visibles, persiste el descubrimiento y reproduce su grito; los actores `initiallyHidden` no se anuncian al reconocedor hasta que una secuencia los muestre.
- Las interacciones contextuales se declaran en `interactions` y sus textos en `dialogues` del sidecar. Phaser resuelve proximidad, dirección y prioridad de control; el prompt y el diálogo se renderizan como HTML accesible sobre el canvas.
- Espacio, E y el botón contextual ejecutan la misma interacción. Mientras exista un diálogo activo se detienen jugador y coreografías ambientales; cerrar o completar devuelve el control sin alterar la posición.
- Los triggers expresivos ejecutables en el mapa declaran conjuntamente `sectorId`, `target` y `prompt` dentro de `expressionTriggers`. Comparten la resolución cardinal de las interacciones normales, pero solo se habilitan cuando existe una sesión de expedición real; una previsualización nunca debe crear progreso.
- Voz, texto y `contextAction` resuelven el mismo `triggerId` persistente. La interfaz muestra el texto normalizado que entendió, conserva abierto el prompt tras un intento fallido y nunca deja una ruta obligatoria dependiente exclusivamente del micrófono.
- Las condiciones `acoustic` solo pueden activar una captura tras una acción explícita del jugador. El análisis local puede resumir volumen, duración y estabilidad tonal, pero debe detener todas las pistas al terminar o cancelar y nunca persistir audio, transcripciones ni métricas acústicas.
- La confirmación inicial del perfil prepara el prólogo de Alcanfor una sola vez y encola su llamada urgente. Tras completar esa llamada, `pendingMissionLaunch: awaitingCompanion` bloquea PokeDiscover en el selector hasta confirmar un candidato elegible; una recarga debe restaurar el bloqueo y una misión ya completada nunca vuelve a encolar la emergencia.

## Sidewebs de desarrollo

- Las herramientas auxiliares viven bajo `tools/<nombre>/index.html` como entradas independientes de Vite y su código bajo `src/sidewebs/<nombre>/`.
- Se publican como URLs ocultas del mismo sitio (`/tools/<nombre>/`), siguiendo el patrón del randomizador. No tienen navegación desde Poke-Voice, dominio propio ni despliegue separado.
- Deben reutilizar los catálogos y contratos locales del juego; no mantener copias paralelas ni depender de PokeAPI durante la ejecución para decidir resultados.
- No deben añadir navegación ni peso al bundle inicial de Poke-Voice salvo que exista una necesidad explícita dentro del juego.
- El configurador PokeDiscover es la herramienta principal de autoría salvo para pintar tiles. Abre una carpeta de aventura, detecta o crea su `.adventure.json`, registra todos los `.tmj` y permite editar tanto los sectores ya declarados como los recién descubiertos.
- El configurador abre la raíz de `pokemon voice` y descubre las aventuras bajo
  `public/assets/adventure/maps`. Misiones, medios y personajes son catálogos
  globales; cambiar de aventura con cambios pendientes siempre exige confirmar.
- Cada aventura conserva sus misiones en `<mapa>.missions.json`. Las
  conversaciones visuales son recursos globales independientes bajo
  `public/assets/adventure/narratives`, se descubren mediante su manifiesto y
  conservan IDs estables aunque se reutilicen desde varios mapas. El contenido
  TypeScript y las secuencias inline V1 son sólo fallbacks de transición.
- La sideweb `/tools/visual-novel-editor/` es la autora exclusiva de
  conversaciones visuales. El configurador de mapas y misiones únicamente las
  referencia y combina con expediciones, requisitos y terminales mediante un
  flujo de bloques tipados.
- Una conversación avanza por cues de diálogo. El estado de escenario persiste
  entre cues y sólo cambia mediante acciones declarativas de fondo, actor, pose,
  movimiento o audio. No se admiten scripts ni keyframes arbitrarios.
- Una misión tiene un mapa propietario, pero sus bloques de expedición pueden
  abrir otros mapas. Los eventos jugables se comunican con el flujo mediante
  resultados estables; nunca importan ni conocen la conversación siguiente.
- El runtime descubre mapas mediante
  `public/assets/adventure/maps/manifest.v1.json`. Toda expedición cruzada
  conserva la sesión de misión, actualiza su mapa activo y puede resolver un
  sector y un `LocationPoint` de entrada sin rutas TypeScript específicas.
- Las acciones narrativas persistentes llevan un `actionId` estable y se
  registran en el checkpoint antes de poder repetirse. Los tokens editoriales
  usan `item:<id>`, `counter:<id>` y `flag:<id>` además del perfil y compañero.
- Las sidewebs permanecen ocultas desde Poke-Voice, pero comparten un conmutador
  interno entre configurador, editor de novela visual y randomizador. Abandonar
  un editor con cambios pendientes reutiliza la confirmación de guardado.
- `Terrain` y `Locations` son object layers funcionales propiedad del
  configurador. `Ground` continúa siendo puramente visual. Nunca se deduce agua,
  suelo o locomoción desde un GID, un tileset, una especie o un tipo Pokémon.
- Los actores declaran `terrainRules.allowedSurfaceTypes`; el valor heredado es
  exclusivamente `ground`. El protagonista necesita `surf` y un asset `swim`
  de su apariencia para entrar en `water`.
- Una capacidad Surf aportada por compañero debe declararse en
  `fieldCapabilities`; nunca se infiere por el tipo Agua. Si el compañero sirve
  de montura, `waterTraversal.kind` es `swim` y `mountAssetId` referencia un
  personaje global con `role: mount`. El runtime oculta temporalmente al
  seguidor, coloca la montura bajo el protagonista y restaura al compañero al
  volver a tierra.
- Los eventos activos usan temporizadores declarativos y acciones tipadas. No
  se admiten bucles arbitrarios en guiones: repetición, cooldown y vida útil
  pertenecen a sus contratos.
- Todo peligro comparte `HazardConsequenceV1`: `recover`, `resetSector` o
  `failMission`, combinado con `preserveGains` o `restoreSnapshot`. Perfil y
  preferencias nunca forman parte del rollback.
- La preview del configurador puede simular Surf, impacto, reinicio y fracaso,
  pero no importa el store del juego ni escribe `localStorage`.
- Tiled conserva la autoría exclusiva de `Ground`, `Above`, `Detail:*` y los tilesets. El configurador puede crear y editar `Anchors`, `Collision`, `Paths` y `Occlusion`, manteniendo `nextlayerid`, `nextobjectid` y todos los campos desconocidos del TMJ.
- La distribución global vive en un archivo `.world` nativo de Tiled. Tiled y el configurador pueden reorganizarlo; el README solo documenta intención y avance.
- Un `.world` puede reservar un sector cuyo TMJ todavía no exista. El configurador debe mostrarlo como sector pendiente y contarlo al calcular la nomenclatura, los límites y el centrado del mundo.
- Los TMJ activos siguen la convención `<prefijo>-<posición>-<total>.tmj`, ordenados de izquierda a derecha y de arriba abajo sobre la cuadrícula de 16 px. El nombre visible se deriva del `.world`; los aliases históricos `room:*` solo viven en la compatibilidad V2.
- Quitar un sector del `.world` no borra su TMJ: se aparta con `.old` al final del nombre y queda disponible para reincorporarlo desde el organizador.
- El configurador guarda directamente sidecar, TMJ y `.world` cuando el navegador concede acceso a la carpeta, con exportación de copia como fallback. Las operaciones que afecten varios documentos forman una única transacción de Deshacer/Rehacer.
- La última carpeta abierta se conserva durante 24 horas. Si existe un `FileSystemDirectoryHandle` válido se releen los archivos reales; en navegadores sin ese permiso se restaura una copia local temporal de los documentos y el guardado continúa mediante exportación.
- La interfaz de autoría es de escritorio: no tiene scroll de documento entre `1280×720` y pantallas ultrawide, mantiene el lienzo sin deformación y usa scroll únicamente dentro de ventanas y listas.
- El catálogo del configurador pagina los resultados y distingue forma base, forma alternativa y apariencia. La ficha reproduce el asset PMD y la animación seleccionados, sin sintetizar previews para variantes sin asset.
- Las secuencias ambientales pueden encadenar beats de animación y transiciones por ruta o por desplazamiento relativo en tiles. Su final se declara como reinicio, ida y vuelta o terminación conservando la posición; no inferirlo desde las animaciones elegidas.
- El inspector lateral del configurador es la superficie común para entidades y objetos TMJ. Las coordenadas de una entidad editan su ancla estable; una ancla compartida debe enumerar sus dependencias antes de moverlas conjuntamente.
- El menú contextual de una celda crea geometría en el centro o los límites de su tile. Pokémon, NPC, interacciones y secretos deben confirmar sidecar y ancla TMJ en una única transacción, sin dejar objetos temporales al cancelar.
- Cada sector declara un `roster` con cinco o más assets Pokémon distintos y cero o más NPC. Ninguna receta espacial puede comenzar mientras el reparto sea inválido; todo asset colocado debe pertenecer a él y `requiredAssetIds` debe incluir el reparto y las referencias reales.
- El saneamiento del reparto usa dos diálogos consecutivos: primero los cinco o más Pokémon obligatorios y después los NPC. El diálogo NPC permite finalizar sin seleccionar ninguno. Ambos catálogos usan tarjetas con animación `Idle`; las tarjetas muestran únicamente animación y nombre centrado. La búsqueda Pokémon reutiliza texto, tipos y generación del randomizador, muestra como máximo las cinco primeras coincidencias y permite añadir o quitar pulsando la tarjeta; nunca se utiliza un selector masivo de IDs.
- Intentar avanzar desde el diálogo Pokémon con un reparto incompleto debe mantener al usuario en el mismo diálogo y mostrar el mínimo exigido y cuántas selecciones faltan; el botón no puede aparentar estar roto ni depender únicamente del estado `disabled`.
- Si un sector legado no declara reparto Pokémon, el configurador puede preseleccionar silenciosamente como borrador coincidencias inequívocas entre segmentos de nombres de anclas y slugs del manifiesto. Las coincidencias ambiguas se descartan y ninguna inferencia se incorpora al sidecar hasta que el usuario revise y confirme los dos diálogos.
- Un `ActorAnchor` huérfano cuyo nombre identifique inequívocamente un Pokémon puede adaptarse desde saneamiento: se conserva su posición, se deriva un `placementId` y se crea la colocación sidecar con su animación inicial. El saneamiento no diseña escenas, triggers ni rutas porque requieren trabajar sobre el mapa. Sufijos legados como `anchor:pelipper:sleep` sólo sirven como pista para preseleccionar `Sleep`; el ID final deriva de la colocación. El borrado huérfano continúa disponible como alternativa.
- Toda colocación Pokémon usa el ID canónico de solo lectura `placement:pokemon:<especie-o-forma>:<apariencia>:<ordinal>`, derivado directamente del asset PMD; por ejemplo `placement:pokemon:cramorant:default:01`. La animación nunca forma parte del ID. El wizard y el saneamiento muestran el resultado como texto, sin inputs libres, y una reparación renombra conjuntamente colocación, ancla y referencias.
- Cada segmento de un ID técnico admite minúsculas, números y guiones internos, incluido el primer segmento (`entry-point:...`, `map-event:...`). La auditoría, los comandos de geometría y los generadores deben compartir esta misma regla para no proponer reparaciones idénticas al valor que rechazan.
- Una oclusión puede asociar actores tanto mediante `includePlacementIds` en el TMJ como mediante `occlusionGroupIds` en sus colocaciones. Auditoría, validador y runtime deben reconocer ambas rutas; el saneamiento nunca propone borrar una oclusión cuyo grupo ya tiene miembros válidos.
- Los nombres internos de assets, carpetas e IDs técnicos no usan apóstrofos ni otra puntuación reservada. Sirfetch’d se representa internamente como `sirfetchd`; la inferencia de contenido antiguo acepta aliases legados inequívocos como `sirfetch`, sin exigir al usuario que escriba puntuación.
- Las rutas de sprites se insertan en CSS entre comillas y deben respetar la misma convención de nombres internos seguros.
- Las utilidades flotantes que reutilicen formularios del saneamiento deben conservar su lenguaje visual: padding interior, pasos segmentados, avisos destacados, filtros con etiquetas superiores y acciones claramente separadas.
- Tanto el guardado directo como la exportación alternativa deben actualizar el punto de referencia del workspace al completarse; el contador de archivos pendientes representa cambios posteriores al último guardado o exportación.
- El editor solicita `readwrite` al abrir o volver a vincular una carpeta. La decisión entre sobrescritura directa y exportación se basa en las capacidades y permisos reales disponibles, no en identificar el navegador por su nombre.
- Tras guardar o exportar se regenera también la instantánea reciente de IndexedDB con los documentos actuales. La reapertura automática nunca debe recuperar una versión anterior a la última copia considerada guardada.
- Los objetos heredados no traducibles pueden sustituirse durante el saneamiento por un `EditorComment` en `Comments`, conservando su geometría y metadatos de origen dentro de la misma operación de Deshacer/Rehacer. Los comentarios son exclusivamente editoriales: no se incorporan al runtime ni a la configuración funcional.
- El campo de comentario de retirada sólo permanece visible cuando eliminar es la única salida segura. Si existe una reparación preferible, `Eliminar` abre una confirmación secundaria con comentario opcional; el texto propuesto nombra el tipo real de elemento retirado.
- El saneamiento permite deshacer sus operaciones una a una sin cerrar la cola. Guardar progreso parcial escribe o descarga únicamente los documentos modificados, manteniendo la exportación completa como una acción distinta.
- Si varias colocaciones heredadas comparten una ancla, la reparación segura separa la geometría en una ancla derivada por colocación y conserva sus referencias narrativas. No se borran en cascada colocaciones o secuencias todavía utilizadas.
- Toda incidencia incluida en la cola de saneamiento debe ofrecer una salida ejecutable en el propio diálogo: reparación determinista o eliminación segura. Una eliminación debe retirar también las referencias técnicas que sólo existían para ese objeto; la prueba del mapa público completo debe fallar si aparece una incidencia sin ninguna de las dos acciones.
- Una `TransitionAnchor` heredada situada en un borde no se trata como una colocación Pokémon. Si el archivo world identifica un único sector contiguo, el saneamiento crea la conexión bidireccional completa y sus extremos derivados; una geometría coincidente en el borde opuesto se reutiliza como evidencia y se retira en la misma transacción.
- No existen medias transiciones funcionales. Si el world reserva un sector contiguo cuyo TMJ todavía no está disponible, el saneamiento sustituye el extremo legado por un comentario editorial de conexión pendiente, conservando geometría, destino y borde. Cuando se incorpore el sector, la cola ofrecerá completar automáticamente ida, vuelta y extremos en ambos TMJ.
- El comentario predeterminado al retirar cualquier objeto consta de dos líneas: motivo de la retirada y nombre técnico original. Si el objeto no tenía nombre, sólo se muestra la primera.
- La interfaz de saneamiento describe el problema y la reparación en lenguaje de autoría. No muestra al usuario términos internos como «sidecar» ni explicaciones de arquitectura cuando basta con indicar que un elemento anterior no puede traducirse.
- Los eventos espaciales se declaran mediante `mapEventTriggers`, una secuencia de mapa y, cuando corresponda, una `TriggerZone` en `Triggers`. Admiten entrada en zona, acción contextual y proximidad; su política es por estancia en el sector, por visita al mapa, repetible o persistente. El runtime sólo registra la finalización después de completar la secuencia y restaura el estado anterior si la ejecución se interrumpe.
- `oncePerSectorVisit` sobrevive a recargas pero se reinicia al cruzar a otro sector; `oncePerVisit` conserva el resultado entre sectores y recargas de la expedición activa; `repeatable` se rearma al abandonar el área o terminar la acción y `persistent` escribe el resultado permanente del mapa. Con movimiento reducido se aplica el estado final directamente.
- Los identificadores técnicos son de solo lectura, minúsculos, segmentados por `:` y terminados en ordinales automáticos `01`, `02`, etc. El nombre TMJ se deriva del ID sidecar que lo consume; no existen nombres libres, `ActionAnchor` ni anclas funcionalmente huérfanas.
- Toda creación parte del registro compartido de recetas. El wizard conserva el borrador fuera de TMJ y sidecar, muestra los IDs derivados y aplica todos los documentos en una transacción solo después de superar `validateTiledAdventureBundle`. La confirmación abre el inspector de propiedades.
- La cola de saneamiento conserva el ordinal original de cada incidencia aunque disminuya el número pendiente. Los objetos se identifican como `Objeto Tiled #<id>` junto con capa y posición, distribuidos en tres columnas; un valor largo puede ocupar dos sin ensanchar el resto. Toda reparación determinista muestra y confirma dentro del modal los valores derivados. El TMJ y `sectorId` aparecen únicamente como información de footer.
- Una reparación de saneamiento puede confirmarse si no introduce errores canónicos nuevos, aunque el mapa conserve otras incidencias heredadas pendientes. Tras confirmar debe pasar inmediatamente a la siguiente incidencia; cualquier rechazo se explica dentro del propio modal y nunca sólo en una superficie oculta detrás de él.
- `AmbientPath` solo se crea para una acción `movePath`; un destino solo para `moveToAnchor`; `ActorOccluder` exige grupo y al menos una colocación asociada. Las colisiones usan únicamente clase `Collision` e ID técnico ordinal.
- La creación contextual por clic o arrastre admite una preferencia local entre activación directa y activación manteniendo `Shift`; la opción directa es el comportamiento predeterminado.
- La rejilla de autoría es una ayuda visual roja, discontinua y sin relleno. Debe compartir transformación con el mapa y extenderse un tile fuera de sus límites sin alterar el TMJ.
- El guion automático de una entidad reutiliza `ambientSequences`; nunca mantener un segundo formato de comportamiento exclusivo del editor. Una secuencia compartida se muestra completa y conserva la entidad responsable de cada acción.
- Arrastrar una colocación desde el lienzo mueve únicamente su ancla y centra sus pies en la celda de destino. Las rutas existentes permanecen estables; runtime y previsualización conectan ortogonalmente la nueva posición con el primer punto cuando sea necesario.
- `Shift + arrastre` crea un borrador de ruta ortogonal sobre una cuadrícula de 16 px relativa a su inicio. El borrador no modifica documentos, historial ni estado de guardado; sólo una confirmación completa desde `Movimientos y eventos` puede crear o editar ruta, secuencia, trigger, zona y estado final.
- El trazado conserva el orden real de cruce de celdas, permite deshacer el último tramo regresando exactamente a la celda anterior y simplifica únicamente puntos colineales al terminar. Cruzar un tramo anterior no recorta la ruta.
- Toda ruta confirmada tiene una acción `movePath` propietaria. Reordenar rutas cambia el orden de las acciones, nunca sus IDs. Las rutas heredadas compartidas conservan todas sus dependencias.
- Pokémon sólo puede elegir animaciones de su manifiesto. Los NPC mantienen el formato actual de `Walk`, `Idle` y orientación; no se inventan animaciones que sus sprites no declaran.

## Sprites de expedición PMD

- Conservar los paquetes originales bajo `public/assets/sprites/pokemon/pmd/<numero>-<slug>/<forma>/`.
- No renombrar `AnimData.xml` ni las hojas `*-Anim.png`, `*-Offsets.png` y `*-Shadow.png`; el importador resolverá las animaciones mediante sus nombres PMD.
- Leer dimensiones, copias, puntos de impacto y duraciones desde `AnimData.xml` en lugar de duplicarlas manualmente en componentes.
- Usar el píxel blanco de `*-Shadow.png` como pivote de suelo de cada animación; no usar el borde del frame ni compensaciones manuales en el mapa.
- Mantener el pixel art sin suavizado y respetar `prefers-reduced-motion` en cualquier previsualización HTML.
- Registrar por separado la atribución indicada por PMDCollab para cada especie o forma antes de publicar sus sprites.

## Sprites de protagonistas y NPC

- Los packs aún sin uso viven en `asset-library/unassigned-sprites/` y las fuentes raw de personajes identificados en `asset-library/character-sources/<personaje>/raw`, siempre fuera de `public`; solo un sprite normalizado y registrado en un manifiesto puede pasar a la carpeta activa.
- Guardar las hojas normalizadas de runtime en `public/assets/sprites/characters/` y declararlas en `manifest.v1.json`.
- Usar PNG transparente dividido en frames regulares. El formato activo es 16×24 px por frame, con una fila por dirección en el orden abajo, izquierda, derecha y arriba; una fuente ampliada puede conservarse únicamente en el almacén.
- El número de columnas puede variar entre hojas; `columns`, `walkFrames` e `idleFrame` deben declararlo explícitamente en el manifiesto.
- El pivote visual y la colisión se sitúan en los pies. No añadir margen inferior que desplace artificialmente al personaje respecto al ancla de Tiled.
- La escala visual se declara mediante `renderScale` en el manifiesto; nunca se corrige agrandando o reduciendo el ancla en Tiled.
- En pixel art, preferir frames nativos de 16×24 con `renderScale: 1`. Evitar escalas fraccionarias en runtime aunque el resultado matemático sea entero, porque el canvas puede mezclar píxeles al componer la escena.
- Si una hoja ya fue ampliada al doble, generar una copia de runtime nativa de 16×24 con vecino más próximo y usar `renderScale: 1`; reducirla dentro de WebGL puede mezclar píxeles aun con una escala matemática exacta.
- Los manifiestos PMD también admiten `renderScale`; el generador conserva actualmente `0.8` como escala común y cualquier excepción futura deberá declararse en datos, no en el runtime.
- Los atlas recopilatorios irregulares o con fondo magenta pueden conservarse como material fuente, pero no deben cargarse directamente en Phaser.

## Pruebas

- Mantener las pruebas unitarias en `tests/unit/` y las pruebas de navegador en `tests/e2e/`.
- Ejecutar los flujos end-to-end en los viewports de escritorio y móvil definidos en `playwright.config.js`.
- Interceptar PokeAPI mediante los fixtures locales de `tests/fixtures/`; la red externa no debe decidir si una prueba pasa.
- Actualizar una referencia visual solo después de comprobar que el cambio de interfaz es intencionado.
- Antes de cerrar un hito, ejecutar las pruebas proporcionales al cambio y un build de producción.

## Roadmaps de desarrollos largos

Los desarrollos largos se documentan en `docs/roadmaps/`.

Cada roadmap debe incluir:

- Objetivo del desarrollo.
- Estado actual.
- Lista de tareas con checkboxes.
- Trabajo completado.
- Trabajo pendiente.
- Notas tecnicas importantes para retomar el desarrollo mas adelante.

Formato recomendado:

```md
# Nombre del desarrollo

## Objetivo

Descripcion breve.

## Checklist

- [ ] Tarea pendiente.
- [x] Tarea completada.

## Notas

Decisiones, riesgos o detalles utiles.
```

Durante el desarrollo, actualiza los checks a medida que completes tareas. Cuando el desarrollo este terminado, renombra el archivo poniendo `[Finalizado]` delante del nombre.

Ejemplo:

`docs/roadmaps/[Finalizado] EASTER_EGGS_ROADMAP.md`
