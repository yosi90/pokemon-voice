# Evolución de Poke-Voice y prototipo Reserva Cero

## Objetivo

Modernizar Poke-Voice sin perder su identidad visual ni su bucle de descubrimiento por voz o texto, mejorar su estabilidad, rendimiento y arquitectura, y terminar con un prototipo jugable de aventuras de investigación Pokémon.

El prototipo se apoyará en un editor web de escenarios propio, mapas pequeños y revisitables, un único Pokémon acompañante, secretos persistentes y fichas de Pokédex que se completan mediante observaciones dentro del hábitat.

## Estado actual

- Estado: Hitos 0, 1, 2, 3, 4, 5, 6 y 7 completados; Hito 8 pendiente de inicio.
- Playwright y Chromium están instalados.
- La web actual ha sido revisada en escritorio y móvil.
- El roadmap termina al validar el prototipo de Reserva Cero. La expansión a más regiones, combates o backend requerirá un roadmap posterior.

## Reglas de ejecución

- Cada hito debe dejar la aplicación utilizable y con build y tests verdes.
- Solo se marca un check cuando su criterio de aceptación ha sido verificado.
- No se trabajará en más de un refactor estructural grande a la vez.
- Las partidas existentes deben migrarse sin perder descubrimientos ni logros.
- Voz y texto deben seguir siendo alternativas equivalentes cuando la interacción lo permita.
- Los sistemas nuevos se escribirán en TypeScript; los antiguos se migrarán de forma incremental y con tests.
- Cualquier cambio de contrato de datos se documentará en este archivo.

---

## Hito 0 — Baseline y red de seguridad

- [x] Instalar `@playwright/test` y Chromium.
- [x] Revisar la experiencia actual en escritorio y móvil.
- [x] Guardar capturas de referencia de los flujos principales.
- [x] Documentar las métricas actuales: 1010 tarjetas, aproximadamente 12.276 nodos y grid móvil de más de 210.000 px.
- [x] Configurar Playwright para escritorio y viewport móvil.
- [x] Añadir Vitest y React Testing Library.
- [x] Crear fixtures locales para que los tests no dependan de PokeAPI.
- [x] Cubrir descubrimiento, error, filtros, logros, persistencia, contrarreloj, modales y fallback de texto.
- [x] Añadir scripts de test, test visual y test end-to-end a `package.json`.

Implementado el 15 de julio de 2026. Baseline documentado en `docs/qa/poke-voice-baseline.md`; 4 pruebas unitarias y 20 pruebas end-to-end pasan entre los dos viewports configurados.

### Criterio de aceptación

Los flujos esenciales están automatizados y cualquier refactor posterior puede compararse contra el comportamiento actual.

---

## Hito 1 — Higiene, dependencias y despliegue

- [x] Dejar de versionar `node_modules` y verificar una instalación limpia con `npm ci`.
- [x] Dejar de versionar los artefactos generados de `dist`.
- [x] Confirmar que GitHub Pages construye y publica únicamente desde fuentes.
- [x] Actualizar Vite dentro de la rama 7.x corregida y React a parches compatibles.
- [x] Resolver vulnerabilidades altas sin introducir actualizaciones mayores innecesarias.
- [x] Corregir el warning de la imagen de fondo durante el build.
- [x] Verificar build local y workflow de despliegue.

Implementado el 15 de julio de 2026. Git deja de seguir 2.289 archivos de `node_modules` y 4 artefactos de `dist`; `npm ci` reproduce la instalación, Vite queda en 7.3.6, React en 19.2.7 y `npm audit` informa 0 vulnerabilidades. El workflow de Pages ejecuta pruebas unitarias antes de construir y publica el `dist` generado junto con el `CNAME` y los assets públicos.

---

## Hito 2 — Fundaciones TypeScript y refactor incremental

- [x] Configurar TypeScript sin bloquear temporalmente los módulos JavaScript existentes.
- [x] Crear tipos compartidos para catálogo, progreso, logros, misiones, mapas y economía.
- [x] Extraer la carga y normalización del catálogo de `usePokemonGame`.
- [x] Extraer el estado y la persistencia legacy de descubrimientos de `usePokemonGame`.
- [x] Extraer la resolución de nombres, alias, formas y tolerancia de voz a lógica pura.
- [x] Extraer la planificación visual y sonora de cada descubrimiento de `usePokemonGame`.
- [x] Extraer navegación de `usePokemonGame`.
- [x] Extraer audio y efectos de `usePokemonGame`.
- [x] Extraer la transacción posterior al descubrimiento: logros, easter eggs y eventos encadenados.
- [x] Extraer modos de `usePokemonGame`.
- [x] Extraer persistencia restante de `usePokemonGame`.
- [x] Crear un store independiente de React que también pueda consumir el motor de aventura.
- [x] Convertir el motor de logros en lógica pura y componentes React.
- [x] Eliminar la manipulación directa del DOM del sistema de logros.
- [x] Crear `AchievementDefinitionV2` con dominio `pokedex`, `pokeDiscover`, `mode` o `global` y ciclo de evaluación.
- [x] Mantener una colección permanente y un conjunto efímero de condiciones satisfechas en la run.
- [x] Evaluar cada run con contexto limpio aunque existan logros permanentes de runs anteriores.
- [x] Ignorar silenciosamente un logro repetido: sin toast, resumen ni recompensa.
- [x] Guardar solo la primera obtención con fecha, dominio y `runId` de origen.
- [x] Permitir obtener en runs diferentes logros incompatibles como Pikachu primero e inicial primero.
- [x] Migrar los logros actuales a la colección permanente conservando sus fechas.
- [x] Dividir el CSS en base, layout, componentes, modos y efectos.
- [x] Migrar módulos antiguos únicamente después de cubrirlos con tests.

Primera entrega implementada el 15 de julio de 2026. TypeScript funciona en modo estricto para código nuevo mientras admite los módulos JavaScript existentes; `npm run typecheck` forma parte de `test:all`. El paquete privado `@poke-voice/contracts` define contratos serializables y versionados para catálogo, investigación, requisitos, logros, runs, PokeDiscover, economía, modos, mapas, misiones, acompañantes, eventos y expresiones por voz. La primera extracción mueve la petición, validación, deduplicación y ordenación de PokeAPI a `pokemonCatalog.ts`, cubierta por pruebas unitarias.

Segunda entrega implementada el 15 de julio de 2026. El estado de descubiertos vive en un store vanilla observable que conserva el orden, evita duplicados y recibe la persistencia como adaptador; React lo consume mediante `useSyncExternalStore` y el futuro motor podrá usar la misma API directamente. Las heurísticas de nombres se han movido a lógica pura conservando alias, formas, visibilidad y distinta tolerancia para voz y teclado. El reset todavía mantiene el comportamiento legacy hasta implementar la separación de runs en el Hito 3.

Tercera entrega implementada el 15 de julio de 2026. La navegación circular y sus candidatos se calculan mediante lógica pura, mientras `usePokemonCardNavigation` encapsula referencias, scroll y foco temporal. `planSpecialReveal` convierte cada regla especial en una secuencia declarativa comprobable y `usePokemonRevealEffects` ejecuta audio, modos y efectos visuales sin recargar `usePokemonGame`. Las pruebas end-to-end cubren ahora la navegación y una revelación especial real en escritorio y móvil.

Cuarta entrega implementada el 15 de julio de 2026. `planPostDiscovery` calcula de forma pura los cambios y efectos encadenados de Unown, Palafin y Xerneas/Yveltal; `processPostDiscovery` coordina ese plan con el motor legacy de logros mediante dependencias inyectadas. Un fallo al evaluar logros ya no puede impedir que se persista o represente un easter egg. El estado legacy mantiene además una referencia síncrona para no perder actualizaciones durante secuencias rápidas de varios descubrimientos.

Quinta entrega implementada el 15 de julio de 2026. `useLegacyPreferences` y `useLegacyEasterEggState` encapsulan las claves y escrituras actuales, dejando `usePokemonGame` sin accesos directos a `localStorage`. `useTimedMode` es ahora propietario del temporizador, resultados, contador de descubrimientos y frontera común de reset. Sigue llamando deliberadamente a `ACV.resetAllPersistent()` hasta que el Hito 3 implemente `startNewPokedexRun`, pero el cambio quedará aislado en ese hook. `usePokemonGame` se reduce a 261 líneas.

Sexta entrega, primera fase, implementada el 15 de julio de 2026. `achievementProgress.ts` separa una colección permanente observable del conjunto de logros satisfechos y recién obtenidos en cada run. El adaptador existente evalúa de nuevo las condiciones al comenzar una run, pero solo una primera obtención genera toast, aparece en el resumen y se escribe en el almacenamiento. Los registros legacy se cargan conservando su primera fecha; las pruebas unitarias cubren repeticiones silenciosas y logros incompatibles entre runs, y Playwright confirma que repetir uno persistido no crea otro toast ni otro registro. Se mantiene deliberadamente el formato `pokevoice-achievements-v1` y la UI DOM actual: persistir `domain` y `runId`, y sustituir el cajón y los toasts por React, quedan para la segunda fase de esta extracción.

Sexta entrega, segunda fase, implementada el 15 de julio de 2026. `AchievementUi.tsx` representa ahora el cajón y los avisos desde stores observables mediante `useSyncExternalStore`; React controla su marcado, cierre y temporizadores. `achievements-logic.js` conserva la API `ACV` para no romper consumidores, pero ya no crea nodos, escribe `innerHTML`, cambia atributos ni registra listeners DOM. El nuevo `achievementUiStore.ts` mantiene únicamente estado de presentación y está cubierto junto a los componentes. El motor de evaluación y el adaptador persistente todavía deben separarse antes de marcar como completa la conversión integral del motor de logros.

Sexta entrega, tercera fase, implementada el 15 de julio de 2026. `evaluateAchievements.ts` selecciona y ejecuta de forma aislada condiciones síncronas o asíncronas, mientras `achievementStorage.ts` encapsula parseo, serialización y limpieza del almacenamiento. Los registros legacy conservan únicamente sus datos fiables; las primeras obtenciones nuevas guardan fecha, dominio y `originRunId`, y Delibird queda clasificado como logro de modo. `achievements-logic.js` pasa a ser un adaptador compatible entre contexto, núcleo, presentación y persistencia. Las pruebas cubren datos corruptos, round-trip enriquecido y checks fallidos, y Playwright verifica el registro completo en ambos viewports.

Séptima entrega implementada el 15 de julio de 2026. El antiguo `styles.css` de 5.587 líneas queda como manifiesto de imports y las reglas se distribuyen en base, layout, componentes de Pokédex y overlays, modos, efectos de descubrimiento y especiales, y responsive. La división conserva literalmente el orden de la cascada original mediante imports secuenciales; el bundle CSS mantiene el mismo tamaño y hash, y las referencias visuales de escritorio y móvil no cambian. Todas las migraciones del hito se realizaron después de disponer de cobertura proporcional.

---

## Hito 3 — Catálogo, runs y persistencia versionada

- [x] Incluir un catálogo local mínimo para arrancar sin depender de PokeAPI.
- [x] Encapsular PokeAPI en un servicio con caché, validación y fallback.
- [x] Separar el concepto de especie, forma y entrada de Pokédex.
- [x] Separar el estado en `PokedexRunStateV1` y `PokeDiscoverStateV1`.
- [x] Diseñar la migración desde las claves actuales sin forzar un reset.
- [x] Conservar descubrimientos, generaciones, tamaño de cartas, logros y easter eggs existentes.
- [x] Migrar los Pokémon descubiertos actuales como la run inicial y los easter eggs a PokeDiscover.
- [x] Recuperar correctamente un contrarreloj al recargar.
- [x] Cerrar como finalizado un contrarreloj que haya caducado durante la ausencia.
- [x] Añadir un ledger de recompensas con identificadores estables y pago único.
- [x] Crear `startNewPokedexRun({ sourceModeId })` para reset manual y modos que lo requieran.
- [x] Sustituir el uso normal de `ACV.resetAllPersistent()` por un reset exclusivo de run.
- [x] Bloquear el reset de Pokédex mientras haya una expedición activa.
- [x] Mostrar antes del reset normal qué se vacía y qué conserva PokeDiscover.
- [x] Crear un borrado total separado con confirmación reforzada.

Primera entrega implementada el 15 de julio de 2026. La aplicación incluye localmente las 1.010 entradas `{id, name}` que ya soportaba, por lo que la Pokédex y el reconocimiento de nombres arrancan de inmediato sin esperar a PokeAPI. `pokemonCatalog.ts` valida la respuesta remota, guarda una caché versionada y aplica la prioridad red → caché → catálogo local; una caché corrupta se ignora sin afectar al progreso. La red externa sigue actualizando el catálogo, pero ya no decide si el juego puede arrancar. Las pruebas unitarias cubren las tres fuentes y Playwright verifica el modo sin PokeAPI en escritorio y móvil.

Segunda entrega implementada el 15 de julio de 2026. `pokemonCatalogModel.ts` normaliza cada elemento en una identidad de especie, una forma por defecto y una entrada de Pokédex nacional con IDs estables independientes. El hook conserva ese catálogo normalizado y deriva la antigua lista `{id, name}` únicamente para los componentes todavía no migrados, evitando cambiar la interfaz durante esta fase. La caché plana v1 se lee como registros normalizados y las escrituras nuevas usan v2; se descartan relaciones incoherentes entre especie, forma y entrada. Las pruebas cubren identidades, proyección compatible, validación y round-trip de ambas versiones.

Tercera entrega implementada el 15 de julio de 2026. `pokevoice-save-v1` reúne por primera vez la run reiniciable, PokeDiscover, preferencias y la sesión de modo activa bajo contratos versionados. La migración idempotente conserva la Pokédex actual como run inicial, fechas y procedencia fiable de logros, generaciones, tamaño de cartas y cualquier estado JSON de easter eggs; las claves antiguas permanecen en escritura dual durante la transición. Los logros sin dominio histórico siguen sin inventar procedencia. Iniciar una run ya no llama a `ACV.resetAllPersistent()` ni borra logros o easter eggs, y el contrarreloj conserva su `runId`, continúa tras recargar y muestra el resumen si caducó durante la ausencia. Las pruebas cubren datos migrados, corruptos e idempotencia, además de recuperación y caducidad en escritorio y móvil.

Cuarta entrega implementada el 15 de julio de 2026. `rewardLedger.ts` aplica lotes de experiencia, PD, herramientas, objetos clave, permisos y cosméticos de forma atómica; un `originId` ya cobrado devuelve su entrada original sin volver a pagar, incluso después de reiniciar la Pokédex. El contrato distingue ahora herramientas y objetos clave para que el destino de inventario no sea ambiguo. La raíz puede representar una expedición activa y rechaza cualquier nueva run mientras exista. El borrado total queda separado del reset normal, exige escribir `BORRAR`, enumera toda la metaprogresión eliminada y conserva las cachés técnicas ajenas a la partida. Hito 3 cerrado con cobertura unitaria y de navegador.

### Formas y apariencias desbloqueables

- El sistema será genérico para todo el catálogo y estará dirigido por datos; no habrá listas especiales limitadas a Pikachu, Raichu ni a los ejemplos iniciales.
- La especie será propietaria del registro principal y de los cuatro campos de investigación compartidos.
- Una forma canónica representará una variación biológica o funcional: regional, alternativa o temporal de combate. Tendrá `formId`, tipos, capacidades y posibles requisitos de acompañante propios, pero seguirá vinculada a la ficha de su especie. Aquí entran, entre otras, formas de Alola, Galar, Hisui y Paldea, además de formas alternativas curadas como Rotom, Unown, Mega o Gigamax cuando correspondan.
- Una apariencia representará un diseño visual sobre una forma existente: diferencia de género, disfraz, atuendo, versión estacional o evento. Tendrá `appearanceId` propio, pero no contará como especie ni forma biológica adicional.
- Los Pokémon Paradoja, convergentes y otras contrapartes que tengan número propio de Pokédex seguirán siendo especies independientes. Se enlazarán mediante `PokemonSpeciesRelationV1` para mostrar su relación narrativa, sin convertirlos falsamente en formas.
- Formas y apariencias podrán descubrirse mediante misiones secundarias, encuentros opcionales, secretos o estímulos declarativos de un mapa.
- El primer encuentro guardará de forma permanente su procedencia —mapa, misión y encuentro— en PokeDiscover. Repetirlo no duplicará recompensas.
- Resetear la Pokédex conservará formas y apariencias descubiertas, aunque permanecerán ocultas en la ficha hasta volver a registrar la especie correspondiente.
- La ficha de detalle mostrará una galería de formas y apariencias descubiertas, junto a su procedencia y notas asociadas.
- Un dato observado sobre una forma o apariencia podrá añadir una nota específica, pero solo completará uno de los cuatro campos cuando el `ResearchFactV1` de la especie lo declare.
- El editor y los encuentros distinguirán `speciesId`, `formId` y `appearanceId`; nunca se creará un Pokémon ficticio separado para representar un atuendo.
- Ejemplos previstos, no exclusivos: una misión en islas podrá descubrir a Raichu de Alola; un secreto de playa activado bajo estímulos concretos podrá hacer aparecer a Pikachu surfista como encuentro extra de evento; otras misiones podrán desbloquear cualquier forma o apariencia declarada en el catálogo.

### Contrato inicial de `PokedexRunStateV1`

- `runId`, fecha de inicio y modo que originó la run.
- Pokémon registrados y orden de descubrimiento.
- Intentos, rachas, fallos y contadores temporales.
- Acompañante seleccionado para la run actual.
- Logros satisfechos silenciosamente durante la run.

### Contrato inicial de `PokeDiscoverStateV1`

- Generación activa, tamaño de cartas y preferencias.
- Nivel y experiencia de entrenador.
- Puntos de Descubrimiento bajo la clave interna `discoveryPoints`.
- Investigación por especie.
- Formas canónicas descubiertas y su primera procedencia.
- Apariencias o variantes de evento descubiertas y su primera procedencia.
- Investigación persistente cuya visibilidad depende del registro en la run actual.
- Cuaderno de campo con pistas conocidas.
- Misiones separadas del estado persistente de cada mapa.
- Inventario permanente de herramientas, objetos clave, permisos y cosméticos.
- Secretos, conversaciones, coleccionables y cambios persistentes por mapa.
- Intentos elegibles de encuentros raros y garantías pendientes.
- Recompensas ya cobradas.
- Compras y cosméticos equipados.
- Colección permanente de logros con primera fecha, dominio y run de origen.
- Cualificaciones permanentes de acompañantes.
- Progreso y logros propios de PokeDiscover y otros modos.

### Reglas de reset

- El reset normal crea una run nueva, vacía los Pokémon registrados y desequipa al acompañante.
- PokeDiscover conserva logros, investigación, mapas, secretos, objetos, nivel, PD, avistamientos, modos y cualificaciones.
- La investigación conservada permanecerá oculta en toda la interfaz hasta volver a registrar la especie.
- Al redescubrirla, la investigación reaparecerá completa sin volver a pagar recompensas.
- Solo el borrado total podrá eliminar PokeDiscover y los logros permanentes.

---

## Hito 4 — Dashboard y Pokédex por generaciones

- [x] Sustituir las barras actuales por un dashboard Pokémon.
- [x] Crear navegación lateral compacta en escritorio.
- [x] Crear navegación inferior adaptada en móvil.
- [x] Integrar voz y texto dentro del área principal en vez de una barra saturada.
- [x] Mostrar una generación activa cada vez y recordar la última selección.
- [x] Usar Gen 1 como valor inicial para usuarios sin preferencia guardada.
- [x] Mostrar progreso de la generación y progreso global por separado.
- [x] Permitir búsqueda global y cambio automático a la generación del resultado.
- [x] Mantener paleta, tipografías, fondo, Pokéballs y estética Pokémon actual.
- [x] Reducir la vista normal a menos de 3000 nodos.
- [x] Evitar overflow horizontal en escritorio y móvil.

Primera entrega implementada el 15 de julio de 2026. La cuadrícula muestra una única generación y persiste `activeGenerationId`, manteniendo `selectedGenerationIds` solo como puente de compatibilidad con partidas anteriores. Una partida sin preferencia comienza en Kanto. La resolución por voz o texto sigue siendo global: encontrar una especie de otra generación cambia la vista antes de revelarla. El progreso activo y el total permanecen separados. Con el catálogo local completo, incluso la generación más grande mantiene menos de 3000 nodos y no produce overflow horizontal en ninguno de los dos viewports. Las nuevas referencias visuales documentan el cambio intencional.

Segunda entrega implementada el 15 de julio de 2026. La barra superior saturada se divide en una consola de reconocimiento dentro del contenido y una navegación dedicada. Escritorio usa un rail lateral compacto con marca, modos, logros y accesos a descubiertos o pendientes; móvil dispone esos mismos destinos en una barra inferior fija. Voz, texto, estado del micrófono y activación de audio comparten `DiscoveryConsole`, por lo que el fallback escrito permanece igual de visible. Una prueba geométrica impide que el dock vuelva accidentalmente a la parte superior o que el formulario se duplique dentro de él. Hito 4 cerrado con referencias visuales específicas para ambos layouts.

Revisión visual posterior. Un único drawer compacto de Pokédex, abierto desde el dock justo antes de los accesos a descubiertos y restantes, reúne la paginación libre en dos filas —generaciones 1 a 9 y una décima posición decorativa deshabilitada—, dos tarjetas con porcentaje y barra para el progreso de generación y global, el tamaño de cartas y el selector compacto de estilo de imagen. Las acciones de partida quedan separadas y ancladas al fondo por su carácter destructivo. Esto elimina tanto el bloque permanente de generación como el menú hamburguesa flotante. La consola de descubrimiento queda fija en el viewport, sin título, fondo ni card contenedora: solo conserva el botón de voz y el formulario de búsqueda por texto, con contraste y separación suficientes respecto a la primera fila. Los accesos a descubiertos y restantes muestran únicamente icono y cantidad, con tooltip, y el botón de logros alterna correctamente un cajón anclado a la derecha.

---

## Hito 5 — Ficha animada de Pokédex

- [x] Crear un modal que simule una Pokédex física desplegándose.
- [x] Tematizar la ficha por tipo primario, usando el secundario como acento y motivos visuales reutilizables.
- [x] Implementar el estado `desconocido`: número y datos clasificados, sin revelar nombre ni imagen.
- [x] Implementar el estado `registrado`: nombre, imagen y cry tras nombrarlo por voz o texto.
- [x] Separar el eje de registro (`desconocido`/`registrado`) del eje de investigación (`no-avistado`/`avistado`/`parcial`/`completo`).
- [x] Mostrar una galería de formas y apariencias descubiertas sin convertirlas en especies independientes.
- [x] Mostrar la primera procedencia y las notas específicas de cada forma o apariencia.
- [x] Impedir que registrar un Pokémon mítico equivalga a avistarlo o cumpla sus condiciones narrativas.
- [x] Implementar el estado `investigado`: ficha completada mediante aventuras.
- [x] Mostrar campos corruptos en Pokémon registrados pero no investigados.
- [x] Añadir mensajes narrativos variables sobre Team Rocket, fallos del servidor o posibles leyendas.
- [x] Dividir la investigación en biometría, conducta, alimentación/hábitat y nota excepcional.
- [x] Permitir que mapas diferentes aporten campos distintos de una misma especie.
- [x] Completar la ficha únicamente al reunir los cuatro campos base, sin exigir que procedan de un solo mapa.
- [x] Permitir notas adicionales futuras sin invalidar una ficha que ya completó sus cuatro campos base.
- [x] Añadir control explícito para reproducir el cry.
- [x] Implementar foco atrapado, restauración de foco, Escape y lectores de pantalla.
- [x] Respetar `prefers-reduced-motion`.
- [x] Añadir volumen pseudo-3D compartido a Poké Ball, Super Ball, Ultra Ball y Master Ball sin WebGL.
- [x] Inclinar únicamente la Pokéball activa siguiendo el cursor, con límites que preserven la ilusión plana.
- [x] Eliminar la flotación genérica de las Pokéballs; conservar la inclinación bajo cursor y los easter eggs propios de especies concretas.
- [x] Mantener sprites, revelaciones y efectos especiales fuera del plano inclinado.
- [x] Validar accesibilidad, movimiento reducido, carga máxima y ausencia de overflow en Playwright.

Primera entrega iniciada el 15 de julio de 2026. Todas las entradas, incluidas las desconocidas, abren una ficha física accesible. Las registradas cargan sus tipos bajo demanda: el primario gobierna color, brillo y motivo; el secundario se limita al acento. La ficha no confunde registro con investigación, muestra los cuatro campos todavía bloqueados y conserva explícitamente el caso de Mew como nombre registrado pero no avistamiento. La apertura animada se elimina con `prefers-reduced-motion`, Escape cierra, el foco queda atrapado y vuelve a la carta de origen.

Segunda entrega implementada el 15 de julio de 2026. `getPokemonEntryState` combina la run reiniciable con PokeDiscover sin mezclarlos: la investigación permanente se oculta mientras la especie no esté registrada y reaparece al redescubrirla. La ficha representa `no-avistado`, `avistado`, `parcial` y `completo`, y cada uno de los cuatro campos distingue bloqueo, avistamiento, observaciones parciales y finalización. Los 18 tipos poseen motivos CSS con identidad propia: mar para Agua, ondas concéntricas para Psíquico, viento para Volador, burbujas para Veneno, ojos para Fantasma, gemas para Hada, escarcha y copos para Hielo, telaraña para Bicho, puños para Lucha, montañas para Roca, fallas sinuosas para Tierra y placas diagonales reservadas para Acero.

Tercera entrega implementada el 15 de julio de 2026. La ficha incorpora una galería horizontal de variantes construida desde la forma habitual y los registros permanentes `discoveredForms` y `discoveredAppearances` de PokeDiscover. Las variantes nunca alteran el número de especies ni crean tarjetas nuevas en la cuadrícula. Cada hallazgo conserva su primera procedencia por mapa, misión o encuentro y presenta sus notas de campo. Las relaciones de otra especie se descartan y las formas permanentes permanecen ocultas mientras la especie no esté registrada en la run actual.

Corrección visual del 15 de julio de 2026. La capa decorativa de los motivos queda contenida y no puede ampliar el área desplazable de la ficha. Los patrones Bicho y Tierra ya no transforman el lienzo completo, el modal bloquea el desbordamiento horizontal y una prueba recorre los 18 motivos en escritorio y móvil verificando que ninguno modifica sus dimensiones de scroll.

Cuarta entrega implementada el 15 de julio de 2026. `ResearchFactV1` declara si aporta una observación parcial, completa uno de los cuatro campos base o añade una nota posterior. `discoverResearchFact` agrega hechos de cualquier mapa mediante IDs estables, registra el primer avistamiento, calcula el estado de la ficha desde sus cuatro campos y entrega experiencia y PD a través del ledger permanente. Repetir un hecho no vuelve a investigar ni recompensa; añadir contenido futuro no invalida campos completos y una nota adicional conserva el estado `complete`.

Quinta entrega implementada el 15 de julio de 2026. La cuadrícula incorpora una geometría pseudo-3D común para Poké Ball, Super Ball, Ultra Ball y Master Ball sin añadir Three.js ni WebGL. Una capa interior separa carcasa, banda y botón de sprites, brillos y efectos especiales; en escritorio sigue el cursor con rotación limitada, mientras teclado y movimiento reducido conservan feedback estático. Un único `IntersectionObserver` permite flotar solamente a bolas no descubiertas presentes en pantalla, pausa el movimiento con la pestaña oculta y deja estáticas las entradas registradas. La generación V mantiene sus 156 tarjetas por debajo de 3000 nodos, sin overflow ni más de una inclinación activa, y las referencias visuales cubren las cuatro variantes en escritorio y móvil.

Sexta entrega implementada el 16 de julio de 2026. Cada Pokéball conserva un ritmo determinista por especie, pero las duraciones varían entre 5,6 y 8,48 segundos: incluso la más rápida resulta sensiblemente más pausada que el ciclo anterior de 3,4 segundos. Las fichas clasificadas y los campos todavía no investigados distribuyen de forma estable mensajes sobre archivos interceptados por el Team Rocket, fallos de sincronización, rumores de posibles leyendas y notas del profesor. Los textos nunca revelan la identidad ni datos reales antes de tiempo. Con este cierre narrativo, el Hito 5 queda completado.

Corrección de rendimiento del 16 de julio de 2026. Las pruebas en hardware real mostraron que componer muchas capas en movimiento seguía penalizando la experiencia pese a limitar la flotación por visibilidad. Se elimina por completo el vaivén genérico y el `IntersectionObserver` que ya no resulta necesario. En reposo las Pokéballs normales no animan ni declaran `will-change`; el único trabajo compartido ocurre al mover un cursor preciso sobre una tarjeta y afecta como máximo a una bola. Se conservan los comportamientos especiales diseñados como easter eggs de especies concretas, incluido Pikachu inquieto y sus chispas periódicas.

Corrección de interacción del 16 de julio de 2026. La inclinación deja de utilizar la tarjeta completa como hitbox y exige que el cursor esté dentro del círculo real de la Pokéball. Las coordenadas se calculan contra el contenedor estable, no contra la capa ya transformada. Mientras el cursor se mueve no se encadenan transiciones: cada frame adopta la posición más reciente y solo la vuelta al reposo mantiene una transición breve. Salir hacia el espacio sobrante de la tarjeta cancela inmediatamente cualquier frame pendiente.

Corrección de composición del 16 de julio de 2026. La sombra común deja de aplicarse al contenedor que reúne carcasa y efectos locales: al animar el easter egg de Pikachu, Chromium podía rasterizar esa superficie filtrada como un rectángulo y proyectar bandas oscuras sobre las tarjetas vecinas. La sombra pasa a ser un `box-shadow` circular exclusivo de `ball-assembly`; Pikachu conserva el temblor y las chispas sin generar capas rectangulares alrededor. Al abrirse una Pokéball, esa sombra cerrada se retira para no rellenar de negro el espacio transparente entre sus dos mitades; los cuatro modelos conservan sus bordes y su geometría abierta.

Mejora eléctrica del 16 de julio de 2026. El destello cónico de Pikachu se sustituye por una descarga SVG local con siete rayos preparados y entre tres y seis activos por fotograma, todos con núcleo blanco, halo amarillo y posibles ramificaciones regeneradas durante cinco fotogramas breves. La Pokéball se sacude independientemente del campo eléctrico y añade destello interior y neblina energética. El SVG solo existe mientras Pikachu continúa sin descubrir, no aplica filtros al contenedor de la tarjeta, cancela sus temporizadores al ocultar la pestaña o desmontarse y permanece inactivo con movimiento reducido.

---

## Hito 6 — Modos ligeros

- [x] Crear `ModeDefinitionV1` con `runPolicy: preserve | resetPokedex | isolatedPokedex`, usando `preserve` por defecto.
- [x] Configurar el Coleccionista con `runPolicy: isolatedPokedex` y restauración de la run original.
- [x] Permitir que futuros modos declaren explícitamente si necesitan una Pokédex vacía.
- [x] Mostrar confirmación antes de entrar en cualquier modo que reinicie la run.
- [x] Representar la finalización relevante de un modo mediante logros permanentes reutilizables como prerrequisitos.
- [x] Mejorar el contrarreloj con recuperación y estadísticas completas.
- [x] Crear `¿Quién es ese Pokémon?` como racha infinita, con siluetas, comodines y voz/texto.
- [x] Crear retos temáticos por generación, tipo o familia.
- [x] Crear un desafío diario local, determinista y con racha persistente.
- [x] Permitir que estos modos registren Pokémon en la Pokédex.
- [x] Reservar la investigación completa para las misiones del profesor.
- [x] Añadir logros específicos sin conceder Puntos de Descubrimiento repetibles.
- [x] Puntuar los logros del contrarreloj desde cero por sesión sin duplicar la colección permanente.

Implementación de retos temáticos del 16 de julio de 2026. El modo conserva la run y ofrece desafíos declarativos por generación, tipo y familia con conjuntos de especies explícitos, por lo que funciona sin descargar índices completos de PokeAPI. `targetSpeciesIds` puede contener una cantidad arbitraria de respuestas válidas y `targetCount` declara cuántas respuestas distintas bastan para superarlo. Las respuestas pueden darse por voz o texto; una especie válida cuenta en la sesión aunque ya estuviera registrada, pero el descubrimiento, las recompensas y los logros permanentes siguen siendo idempotentes. `ModeProgressV1.completedChallengeIds` conserva los subretos superados, la interfaz permite repetirlos o cambiar de categoría y la primera tríada completa concede un logro específico sin PD ni investigación de profesor.

Ampliación de Trivia Pokémon del 16 de julio de 2026. Se incorporan 27 exámenes adicionales —nueve de generación, nueve de tipo y nueve de familia— para un total de 30, almacenados como contenido JSON validado. El selector muestra seis exámenes por página y mezcla de forma estable dos de cada categoría en las cinco páginas de cada sesión. La Pokédex local y los rangos de novena generación se amplían del #1010 al #1025 para admitir respuestas del DLC de Paldea, y los nombres españoles de los Pokémon Paradoja se resuelven mediante alias hacia el catálogo canónico.

Revisión de contenido del 16 de julio de 2026. Los exámenes cerrados que revelaban una de sus tres únicas respuestas se sustituyen por conjuntos más amplios sobre comida, gusanos, pseudolegendarios y Pokémon asociados con armaduras o espadas. Tyrogue y Applin dejan de aceptarse en los retos que ya los mencionan expresamente, y la descripción del examen de Ash se simplifica sin alterar sus respuestas válidas.

Primera entrega implementada el 16 de julio de 2026. `ModeDefinitionV1` deja de ser un contrato aislado y pasa a gobernar un catálogo declarativo consumido por el drawer. `defineModeDefinition` aplica `preserve` cuando un modo no declara política; el contrarreloj utiliza explícitamente `resetPokedex` y su confirmación se deriva de esa política, enumerando lo que se vacía y lo que permanece en PokeDiscover. Cancelar no modifica la run ni cierra el drawer. El texto anterior que afirmaba borrar logros se corrige para reflejar la metaprogresión permanente, y el identificador del contrarreloj tiene una única fuente de verdad compartida por migración, sesión y presentación.

Segunda entrega implementada el 16 de julio de 2026. El marcador del contrarreloj utiliza los logros satisfechos durante la sesión y no solo los recién añadidos a la cuenta. Un logro permanente vuelve a contar la primera vez que se cumple en el evento y muestra un aviso `Logro del reto`, pero no modifica la colección ni entrega recompensas otra vez; una segunda satisfacción en la misma sesión se ignora. Los IDs puntuados se guardan en `activeModeSession`, sobreviven a una recarga y reconstruyen el resumen final. Si el logro era nuevo, también conserva su primera obtención permanente con run y modo de origen.

Tercera entrega implementada el 16 de julio de 2026. Las sesiones del Coleccionista guardan intentos, fallos, racha máxima y descubrimientos por voz o texto junto al cronómetro, por lo que el resumen conserva precisión y estadísticas incluso después de recargar. Finalizar concede una sola vez el logro permanente de modo `timed-collector-complete`, utilizable como prerrequisito narrativo futuro, mientras cada sesión puede volver a puntuarlo sin duplicar la colección. PokeDiscover mantiene partidas completadas, última puntuación y mejor número de logros; el drawer muestra el récord y el modal destaca cuándo se supera. El resumen limita su altura y desplaza solo el contenido para mantener las acciones accesibles en móvil.

Cuarta entrega implementada el 16 de julio de 2026. `¿Quién es ese Pokémon?` propone diez especies distintas mediante una selección determinista por sesión y conserva la run actual. Cada silueta ofrece tres pistas progresivas —generación, longitud del nombre e inicial— y acepta respuestas por el mismo reconocimiento de voz y normalización de texto que la Pokédex principal. Acertar registra la especie en la run, pero no completa investigación ni concede experiencia o PD; fallar o pasar revela la respuesta y avanza sin penalización persistente. El resultado guarda partidas, última puntuación y récord sobre diez, concede logros permanentes por completar y por lograr un pleno, y atribuye ambos al modo sin duplicar recompensas ya obtenidas.

Quinta entrega implementada el 16 de julio de 2026. El formato cerrado de diez rondas se sustituye por una racha sin límite que termina al fallar o rendirse. El catálogo completo se baraja por ciclos sin repetir especies dentro de un ciclo ni colocar al último Pokémon de uno como primero del siguiente; la mejor racha se guarda en cuanto se alcanza para no perderla al salir. Las ayudas pasan a ser comodines: cada silueta permite escuchar su grito una vez, la sesión comparte cinco pistas de texto progresivas y tres revelados de tipo. Alcanzar diez aciertos conserva el logro existente `whos-that-pokemon-perfect` por compatibilidad, ahora reinterpretado como hito de racha. La cabecera elimina los contadores redundantes, el drawer muestra la mejor racha y la salida recibe un control visible y accesible en escritorio y móvil.

Sexta entrega implementada el 16 de julio de 2026. `Examen diario` reutiliza los 30 contenidos de Trivia Pokémon y selecciona uno mediante la fecha civil local, con una rotación estable que recorre todos los exámenes disponibles antes de repetir. Conserva la run, admite voz y texto y solo cobra una finalización por fecha; repetir el mismo día o atrasar el reloj no aumenta partidas, racha ni recompensas. `ModeProgressV1` guarda la fecha y el examen de la última aprobación, la racha actual y su récord, mientras el drawer muestra ambos valores. Los huecos reinician la racha sin borrar el máximo histórico y los logros permanentes reconocen el primer aprobado y una semana consecutiva. El flujo queda cubierto en escritorio y móvil, sin otorgar PD ni investigación de profesor.

Séptima entrega implementada el 16 de julio de 2026. `Contrarreloj: Coleccionista de logros` pasa a llamarse `Coleccionista de logros` y utiliza la política explícita `isolatedPokedex`. Al comenzar suspende la run normal completa dentro de `ActiveModeSessionV1`, muestra una Pokédex temporal vacía y elimina la confirmación destructiva. Los Pokémon pueden descubrirse de nuevo durante los dos minutos para puntuar, pero al finalizar se restaura de forma atómica la Pokédex, el orden, las rachas y los contadores originales; los logros permanentes y el récord del modo sí permanecen en PokeDiscover. La suspensión sobrevive a recargas y también se restaura si el tiempo caduca durante la ausencia. El drawer de modos se cierra ahora con Escape o al pulsar fuera.

Octava entrega implementada el 16 de julio de 2026. El Coleccionista comienza con una cuenta atrás centrada `3, 2, 1, ¡Ahora!`; los dos minutos y la run temporal no se crean hasta terminar esa secuencia. Durante la cuenta atrás y la partida se oculta la navegación principal. Un HUD independiente conserva visible el cronómetro y añade una salida roja grande en la esquina superior derecha; finalizar antes de tiempo produce el mismo resumen y la misma restauración atómica que agotar el reloj. El HUD se recoloca en móvil para no competir con la consola de descubrimiento ni sus avisos.

---

## Hito 7 — Introducción de PokeDiscover, nivel de entrenador y acompañantes

### Entrada narrativa a PokeDiscover

- PokeDiscover no será un modo del drawer, sino el programa de investigación permanente dirigido por el profesor Alcanfor.
- La primera ficha de una especie registrada presentará a Alcanfor; si el jugador no abre fichas, el quinto descubrimiento forzará la invitación.
- Las partidas anteriores no serán interrumpidas al cargar: la presentación esperará a la siguiente ficha registrada o al siguiente descubrimiento nuevo.
- Una escena narrativa solo aparecerá en un momento seguro y permanecerá encolada mientras exista un modo, expedición, revelación, modal o conversación incompatible.
- Rechazar tres veces aplazará la invitación hasta el siguiente descubrimiento nuevo. Aceptar será permanente entre runs y no concederá por sí solo `first-mission`.
- Tras aceptar, una hoja de alcanforero abrirá el centro de encargos fuera del selector de modos.
- Antes de completar la adhesión, Alcanfor mostrará a Achaman y Guayota para elegir protagonista; sus nombres canónicos serán valores iniciales editables.
- El protagonista y su nombre pertenecen a PokeDiscover, sobreviven a resets de Pokédex y se normalizan al cargar guardados.
- Las futuras ofertas del profesor y personajes como Porygon-Z reutilizarán el mismo motor declarativo de novela visual.
- Las escenas narrativas ocultarán completamente la Pokédex y declararán un fondo mediante un ID estable a nivel de secuencia o página.
- La biblioteca actual reúne 21 fondos para laboratorios, hogares, ciudades, tiendas, centros Pokémon, gimnasios, Liga, costa, playa, lagos, bosques, pastizales, desierto, pantano, cuevas, central eléctrica y pueblo fantasma.
- Los fondos cuyo archivo use un slug seguro podrán referenciarse directamente mediante ese mismo `backgroundId`; solo los nombres excepcionales necesitarán alias.

### Reglas cerradas

- Solo se puede llevar un Pokémon acompañante por expedición.
- El acompañante debe estar registrado en la Pokédex del jugador.
- Tras un reset no habrá acompañantes disponibles hasta volver a registrar especies en la nueva run.
- Las cualificaciones complejas obtenidas anteriormente permanecerán guardadas en PokeDiscover.
- Redescubrir una especie ya cualificada bastará para recuperar su elegibilidad sin repetir la cadena.
- La regla general será que un Pokémon no acompañe al jugador si su nivel de referencia supera en más de 5 el nivel de entrenador.
- Los niveles de referencia y requisitos definitivos se decidirán más adelante desde el lore y la personalidad, no mediante una fórmula competitiva exhaustiva.
- El nivel canónico de evolución será una pista de diseño, no una regla automática.
- Cada especie o forma podrá sustituir o ampliar la regla general con requisitos narrativos propios.
- Para la mayoría de especies normales bastará estar registrado, alcanzar el nivel narrativo requerido y cumplir las reglas generales.
- Cada requisito podrá tener visibilidad `public`, `hinted` o `secret`.
- Los requisitos `hinted` y `secret` se comunicarán mediante frases de lore, no mediante una lista técnica completa.
- Míticos y casos especiales podrán exigir avistamientos, campos de investigación, objetos o eventos previos.
- Los requisitos ocultos se reservarán para acompañantes y contenido opcional; nunca serán la única vía silenciosa para completar una misión principal.
- Mewtwo servirá como ejemplo de compañero extremadamente exigente: requerirá aproximadamente nivel de entrenador 90.
- Mew servirá como ejemplo de requisito compuesto: aproximadamente nivel 20 y al menos 20 Pokémon etiquetados como dulces registrados.
- Los iniciales base deberán poder acompañar a un entrenador de nivel 1; sus valores concretos se fijarán durante el balance del prototipo.
- Pikachu y todos los iniciales en su primera fase estarán exentos del logro global `first-mission`.
- El resto de Pokémon exigirá haber obtenido permanentemente `¡Primera misión!` al completar la primera misión del profesor.
- Durante el prototipo no habrá entrenamiento individual ni combates para subir el nivel de los Pokémon.
- La pantalla de selección explicará con lenguaje narrativo todas las condiciones que todavía no se cumplen.
- Si el jugador no tiene ningún acompañante válido, se le dirigirá a la Pokédex para registrar un inicial; la aventura no regalará descubrimientos automáticamente.

### Checklist

- [x] Crear contratos declarativos para secuencias, páginas, retratos, elecciones y acciones narrativas.
- [x] Persistir introducción, escenas pendientes, escena activa y secuencias completadas dentro de PokeDiscover.
- [x] Migrar partidas existentes sin presentar automáticamente al profesor durante la carga.
- [x] Activar la invitación desde la primera ficha registrada o el quinto descubrimiento.
- [x] Presentar las escenas automáticas como llamadas pendientes después del scroll, la revelación, el cry y los efectos especiales.
- [x] Detener el reconocimiento de voz al recibir o aceptar una llamada narrativa.
- [x] Implementar las tres negativas, el aplazamiento y la reaparición tras el siguiente descubrimiento.
- [x] Crear la escena accesible de novela visual con typewriter acelerable y movimiento reducido.
- [x] Bloquear la cuadrícula y ocultar navegación, consola, footer, cajones y avisos durante la escena.
- [x] Añadir la hoja de Alcanfor con transparencia real y el modal de encargos fuera del drawer de modos.
- [x] Integrar los retratos definitivos de Alcanfor para `neutral`, `speaking` e `idea`.
- [x] Integrar a Achaman y Guayota con Horquilla, elección visual y orientación hacia el centro.
- [x] Persistir protagonista y nombre editable con valores iniciales `Achaman` y `Guayota`.
- [x] Ofrecer la ficha de protagonista desde el botón de Poke-Discover a adhesiones antiguas, sin interrumpir la carga.
- [x] Sustituir la cuadrícula visible durante diálogos por fondos narrativos declarativos y registrar la primera biblioteca de escenarios.
- [x] Corregir la zona segura de nombres y botones de protagonista para que nunca quede bajo la caja de diálogo.
- [x] Añadir experiencia acumulada y nivel de entrenador a `PokeDiscoverStateV1`.
- [x] Definir una tabla configurable de umbrales de nivel.
- [x] Crear `CompanionRequirementV1` con nivel mínimo, descubrimientos temáticos, flags de historia y condiciones compuestas.
- [x] Crear `CompanionAccessRecordV1` para cualificaciones permanentes que sobreviven a resets.
- [x] Añadir a `CompanionRequirementV1` la visibilidad `public`, `hinted` o `secret` y su texto narrativo de rechazo.
- [x] Añadir nivel de referencia, etiquetas de lore y capacidades de campo al catálogo de formas.
- [x] Crear un catálogo curado de requisitos por especie o forma, sin derivarlos automáticamente de estadísticas de combate.
- [x] Crear el selector de acompañante mostrando solo especies registradas y diferenciando disponibles de inelegibles en escala de grises.
- [x] Crear una portada de PokeDiscover con avatar, nivel, experiencia, PD, resumen de encargos y estado de acompañantes.
- [x] Crear un catálogo local editable por generación con las 1.025 especies, formas, apariencias, niveles, requisitos y capacidades.
- [x] Añadir clasificación exclusiva por prioridad y una categoría `Especiales` para Ultraentes y Pokémon Paradoja.
- [x] Sembrar niveles provisionales por categoría preservando las excepciones curadas de Mew, Mewtwo y Pikachu.
- [x] Añadir un importador reproducible de PokeAPI que preserve la curación local y un validador de cobertura.
- [x] Permitir seleccionar formas persistentes y apariencias desbloqueadas como candidatos independientes.
- [x] Migrar la selección a `{ formId, appearanceId? }` manteniendo compatibilidad con `selectedCompanionFormId`.
- [x] Filtrar acompañantes por las categorías presentes entre los candidatos registrados y desbloqueados.
- [x] Validar con Playwright el filtro, las variantes, la selección persistida y la ausencia de overflow en escritorio y móvil.
- [x] Mantener una altura estable del centro PokeDiscover al alternar entre Inicio, Encargos y Compañero.
- [x] Convertir el letrero regional de escritorio en un selector rápido de las nueve regiones.
- [x] Añadir un filtro de generación combinable con categoría y búsqueda en el selector de compañeros.
- [x] Implementar la regla general de diferencia de 5 niveles y permitir excepciones narrativas declarativas.
- [x] Añadir soporte para requisitos como `minTrainerLevel`, `minDiscoveredByTag`, `requiredStoryFlags` y operadores `all`/`any`.
- [x] Permitir que acompañantes y secretos requieran logros permanentes de Pokédex, PokeDiscover o modos específicos.
- [x] Permitir requisitos de avistamiento, investigación y objetos clave para especies especiales.
- [x] Aplicar `first-mission` como prerrequisito global salvo para Pikachu e iniciales base.
- [x] Añadir mensajes y animaciones de rechazo no punitivas.
- [x] Registrar estadísticas de acompañantes elegidos para detectar opciones dominantes.

Primera entrega implementada el 16 de julio de 2026. La experiencia acumulada de PokeDiscover pasa a ser la única fuente de verdad del nivel de entrenador: una tabla configurable de cien umbrales deriva el nivel al cobrar cualquier recompensa de experiencia y lo limita al nivel 100. La curva inicial es deliberadamente sustituible para poder balancearla con las expediciones reales sin cambiar contratos ni guardados. Las partidas raíz anteriores se normalizan y persisten silenciosamente al cargarse, conservando su experiencia y corrigiendo niveles ausentes o incoherentes. Las fronteras de nivel, tablas alternativas, recompensas idempotentes y migración quedan cubiertas por pruebas unitarias.

Segunda entrega implementada el 16 de julio de 2026. PokeDiscover deja de plantearse como modo visible y obtiene una entrada narrativa persistente. Alcanfor interrumpe la primera ficha registrada —cerrándola— o aparece tras el quinto descubrimiento; las partidas veteranas esperan a la siguiente acción y las actividades incompatibles encolan la escena. La conversación declarativa admite typewriter acelerable, teclado, movimiento reducido, tres negativas y aplazamiento. Aceptar conserva la relación entre runs, no concede `first-mission` y añade al dock una hoja de alcanfor que abre el centro de encargos. Los retratos finales usan las poses alegre, parlanchín y explicando para los estados `neutral`, `speaking` e `idea`; sus PNG y el icono se integran con transparencia real, conservando el resto de poses originales como reserva narrativa. El motor guarda secuencias pendientes, activas y completadas para futuras ofertas.

Tercera entrega implementada el 16 de julio de 2026. La adhesión incorpora una ficha de entrenador: Alcanfor presenta visualmente a Achaman y Guayota —esta última junto a Horquilla—, propone sus nombres canónicos y permite editarlos antes de confirmar. El perfil queda en PokeDiscover y no depende de la run de Pokédex. Los guardados que ya habían aceptado antes de existir esta ficha no reciben una interrupción al cargar; el botón Poke-Discover muestra una novedad y abre la selección antes del centro de encargos. Los retratos de saludo se recortan con transparencia real y Guayota se refleja únicamente mediante CSS para que ambos candidatos miren hacia el centro sin duplicar assets.

Cuarta entrega implementada el 16 de julio de 2026. Las escenas dejan de mostrar Pokéballs detrás de personajes y utilizan fondos declarados mediante `backgroundId`, con valor general por secuencia y sobrescritura opcional por página. La introducción usa el laboratorio de Alcanfor y el registro local prepara otros siete escenarios para futuras conversaciones y misiones. La selección reserva una franja segura sobre el diálogo, evitando que nombres o acciones queden ocultos incluso en viewports bajos.

Quinta entrega implementada el 16 de julio de 2026. Los requisitos declarativos dejan de ser solo contratos y cuentan con un evaluador común para condiciones atómicas, `all` y `any`; las alternativas fallidas conservan únicamente la rama más cercana para no inundar la futura interfaz. El motor consulta la run actual y la metaprogresión permanente: nivel, especies y etiquetas registradas, avistamientos, investigación, logros, modos, flags, contadores, inventario, NPC, conversaciones, secretos y capacidades del acompañante. La elegibilidad distingue especies no registradas de candidatas inelegibles, aplica la diferencia general de cinco niveles cuando existe un nivel de referencia curado y admite excepciones narrativas. Las cadenas complejas pueden guardarse una sola vez mediante `CompanionAccessRecordV1` y reactivarse tras un reset al redescubrir la especie, sin eludir el nivel ni el registro actuales. Pikachu, Eevee y los iniciales base quedan declarados como excepciones provisionales a `first-mission`; el resto ya reconoce ese prerrequisito, aunque su concesión se implementará junto a la primera misión real.

Sexta entrega implementada el 16 de julio de 2026. El catálogo de acompañantes separa la regla estándar de las excepciones curadas y no consulta estadísticas de combate ni PokeAPI para decidir niveles. Pikachu conserva acceso inicial explícito; Mewtwo queda como ejemplo `hinted` de nivel 90 y Mew como requisito `secret` de nivel 20, avistamiento real y veinte especies etiquetadas como `sweet`. El texto visible de Mew no revela cifras ni condiciones técnicas. La asignación definitiva de etiquetas temáticas y el balance del resto de especies quedan deliberadamente pendientes de contenido, mientras las entradas normales reciben identificadores estables por especie para poder cualificarse y migrarse sin ambigüedad.

Séptima entrega implementada el 16 de julio de 2026. El centro Poke-Discover incorpora pestañas separadas para encargos y compañero. El selector reúne las especies registradas de la run actual sin listar ningún Pokémon ausente de la Pokédex, ni siquiera iniciales o especies avistadas en runs anteriores. Cada tarjeta diferencia `disponible`, `inelegible` en escala de grises y la selección actual; las condiciones ocultas se sustituyen por pistas narrativas. Elegir persiste `selectedCompanionFormId`, registra cualificaciones complejas cuando corresponde y queda bloqueado durante una expedición. El nivel de entrenador se muestra como contexto y los rechazos usan feedback breve, no punitivo y compatible con movimiento reducido.

Octava entrega implementada el 16 de julio de 2026. `first-mission` ya se aplica como prerrequisito permanente a todas las especies salvo Pikachu, Eevee y los iniciales base, y la selección registra contadores permanentes por forma y un total agregado para detectar compañeros dominantes durante el balance. Volver a pulsar sobre el mismo compañero no infla la estadística y los contadores sobreviven a los resets por pertenecer a PokeDiscover. La definición y concesión efectiva de `first-mission` permanece deliberadamente pendiente del primer encargo real del Hito 8: no se simula una misión ni se entrega el logro por aceptar al profesor.

Novena entrega implementada el 16 de julio de 2026. Las secuencias narrativas automáticas ya no sustituyen la interfaz en cuanto se desbloquean. Permanecen en la cola persistente mientras termina el desplazamiento hasta la tarjeta, la revelación, el cry y cualquier efecto especial; después de una pausa breve se presentan como una llamada entrante no bloqueante. La ficha que origine la primera invitación puede contemplarse y cerrarse con normalidad. Solo `Descolgar` activa la novela visual, momento en que se cierran capas incompatibles. El reconocimiento de voz se detiene en cuanto aparece la llamada, cancela su reinicio automático e ignora lotes pendientes, evitando que siga escuchando durante la conversación. El mismo flujo queda disponible para futuras ofertas de Alcanfor y anomalías narrativas.

Décima entrega implementada el 16 de julio de 2026. PokeDiscover abre ahora en una portada propia en lugar de presentar directamente los encargos. La ficha reúne el avatar y nombre elegidos, nivel, experiencia, PD, actividad de misiones, número de Pokémon dispuestos a acompañar y el compañero actual. El encabezado deja de tratar el programa como un modal del profesor y utiliza el nombre PokeDiscover, con un cierre de alto contraste. La frontera de la run se refuerza: el selector omite por completo especies no registradas y reserva el estado gris para Pokémon conocidos que todavía no cumplen sus requisitos.

Undécima entrega implementada el 16 de julio de 2026. Nueve catálogos JSON generacionales convierten las 1.025 especies y 1.336 formas importadas en datos de gameplay editables y validados. Cada forma declara tipos, etapa, nivel narrativo, estado de balance, requisitos, tamaño, capacidades y selectabilidad; las apariencias pueden heredar la forma y sumar excepciones, como `surf` para Pikachu surfista. La clasificación elige una sola categoría mediante la prioridad mítico, legendario, especial, pseudo, tercera etapa, segunda etapa, bebé, inicial y común. Los niveles provisionales siguen esa misma jerarquía, mientras Mew, Mewtwo y Pikachu conservan su lore curado. El selector genera únicamente las categorías presentes, combina el filtro con la búsqueda y trata formas regionales y apariencias descubiertas como candidatos independientes. La selección versionada conserva forma y apariencia, y las partidas anteriores migran silenciosamente desde `selectedCompanionFormId`.

Duodécima entrega implementada el 17 de julio de 2026. El cierre visual del Hito 7 fija el alto adaptable de PokeDiscover para que sus tres secciones no desplacen el modal al navegar. En escritorio, el antiguo letrero regional pasa a ser un botón separado del micrófono que despliega las nueve regiones, conserva la selección mediante las preferencias existentes y se cierra al elegir, pulsar fuera o usar Escape. El selector de compañeros añade Generación junto a Categoría; ambas opciones se calculan solo a partir de candidatos registrados y variantes desbloqueadas, y se combinan mediante AND con la búsqueda y la paginación. Las referencias Playwright cubren el menú regional y la distribución de los tres filtros en escritorio y móvil.

Hito 7 finalizado el 17 de julio de 2026. La introducción narrativa, la metaprogresión de entrenador, los contratos de requisitos, el catálogo completo de compañeros y el centro PokeDiscover quedan operativos y cubiertos por build, pruebas unitarias y Playwright. La concesión de `first-mission` se traslada expresamente al Hito 8 porque depende de completar la primera misión real del profesor, todavía no de aceptar su invitación.

### Criterio de aceptación

El jugador solo puede entrar con un acompañante registrado en la run actual cuyos requisitos narrativos cumpla. Antes de `¡Primera misión!` solo serán elegibles Pikachu e iniciales base; una cualificación especial ya conseguida sobrevivirá al reset y se reactivará al redescubrir la especie.

---

## Hito 8 — Mapas revisitables, capacidades y secretos persistentes

### Bucle de expedición

- El profesor presentará cada mapa mediante una primera misión; al completarla, el mapa quedará disponible para expediciones libres y encargos posteriores.
- El mapa y la misión serán entidades separadas: la misión aporta briefing, objetivos y modificaciones temporales; el mapa conserva su estado permanente.
- Antes de entrar se elegirán exactamente un acompañante y una herramienta de campo.
- No se podrá cambiar acompañante ni herramienta dentro del mapa; será necesario regresar y preparar otra expedición.
- El cuaderno de campo guardará únicamente indicios ya encontrados y nunca mostrará el total oculto de secretos.
- Al salir, el profesor resumirá observaciones, experiencia, Puntos de Descubrimiento y nuevas pistas.
- Completar una misión no exigirá investigar todas las especies ni resolver todos los secretos del mapa.
- Los diálogos introductorios ya vistos podrán resumirse o saltarse en revisitas.

### Reglas cerradas

- Cada mapa podrá albergar normalmente entre 4 y 5 especies, aunque no todas serán accesibles en la primera visita.
- Los obstáculos y secretos podrán exigir capacidades como `cut`, `surf`, `light`, `fly` o `carry`, pero no estarán limitados a las MO tradicionales.
- El catálogo podrá incluir movimientos con una función narrativa concreta, como `rock-tomb` para provocar o controlar un desprendimiento; no se asumirá que todo movimiento ofensivo sirve como herramienta genérica.
- Las capacidades derivadas de movimientos se asignarán de forma curada por especie o forma y se comunicarán mediante lore, sin simular sets competitivos.
- Las capacidades podrán proceder del único acompañante elegido o de la única herramienta equipada.
- Los requisitos podrán combinarse mediante grupos `all` y `any` para crear secretos que necesiten varias condiciones.
- Un requisito podrá comprobar especie concreta, tipo, tamaño mínimo, etapa evolutiva, etiqueta de vuelo u otra propiedad de lore.
- También podrá comprobar NPC ya conocidos, conversaciones acumuladas, contadores globales, objetos, secretos anteriores o flags de historia.
- El mapa nunca exigirá descubrir todo en una sola expedición.
- Una ruta, puerta, atajo o secreto desbloqueado permanecerá abierto en visitas futuras, aunque se vuelva sin el acompañante original.
- Los secretos tendrán identificadores estables e independientes de sus coordenadas para sobrevivir a cambios del mapa.
- Cada secreto, interacción y descubrimiento concederá experiencia y Puntos de Descubrimiento una sola vez.
- Repetir una visita permitirá completar contenido pendiente, pero no farmear recompensas ya cobradas.
- El estado global podrá modificar mapas ya visitados y añadir encuentros nuevos sin borrar el progreso anterior.
- Las herramientas podrán sustituir capacidades físicas, pero no condiciones sociales, biológicas o de especie concreta.
- Las conversaciones acumuladas y coleccionables usarán IDs únicos; repetir una misma acción no avanzará contadores globales.

### Investigación distribuida

- Cada especie tendrá cuatro campos base fijos, pero un mapa podrá ofrecer únicamente uno o dos.
- Los campos restantes se publicarán en otros mapas para mantener especies relevantes a lo largo del desarrollo.
- Una ficha completa conservará ese estado aunque futuras misiones añadan notas adicionales.
- El contenido distinguirá especies focales investigables de Pokémon puramente ambientales.

### Encuentros

- Los encuentros necesarios para una misión serán deterministas cuando se cumplan sus condiciones.
- Los encuentros raros opcionales registrarán visitas elegibles y aumentarán su probabilidad en cada una.
- La tercera visita elegible garantizará por defecto la aparición; cada encuentro podrá declarar otro límite por lore.
- Fallar una identificación o abandonar el mapa no eliminará una oportunidad ni una observación ya obtenida.

### Comportamiento del acompañante

- Las acciones normales usarán un prompt contextual cuando el acompañante pueda ayudar.
- `CompanionBehaviorTriggerV1` permitirá escenas `prompt`, `automatic` o `ambient` seleccionadas por especie, tipo, tamaño, evolución, capacidad o etiqueta narrativa.
- Habrá reacciones genéricas por etiquetas y excepciones específicas por especie y mapa.
- Un acompañante podrá separarse temporalmente del entrenador e iniciar una secuencia, pero nunca provocar pérdida permanente.
- No se exigirá una escena única para cada Pokémon en cada mapa; solo se crearán cuando tengan valor narrativo.
- Un psíquico inteligente podrá interpretar pistas de un puzle mediante una reacción genérica.
- Rattata podrá separarse, pisar la cola de Pikachu e iniciar automáticamente la escena del calambrazo.
- Magnemite podrá activar una secuencia específica para investigar la formación de Magneton.

### Anomalías de PokeDiscover

- MissingNo se tratará como una investigación opcional persistente de PokeDiscover, no como un Pokémon registrado normalmente en la run.
- El comando secreto actual podrá actuar como primera pista, pero no completará por sí solo su cadena de investigación ni sus recompensas.
- Su aparición podrá activar `missingnoAnomalySeen` y una variante corrupta de uno o varios mapas mediante `WorldEventV1`.
- La corrupción será temporal y reversible en la presentación, mientras que pistas, encuentros y recompensas obtenidos quedarán en PokeDiscover.
- Una variante corrupta podrá alterar tiles, colisiones controladas, diálogos, encuentros y audio sin duplicar el mapa base.
- MissingNo y otras anomalías nunca bloquearán la historia principal, borrarán progreso ni causarán pérdidas permanentes.
- `Corrupción del mundo digital` será una cadena especial oculta que exigirá haberse unido a PokeDiscover y poseer permanentemente `tm:rock-tomb`, en homenaje a los rumores clásicos sobre glitches.
- Al desbloquearla, Porygon-Z romperá la presentación de la web, hablará mentalmente al jugador y pedirá ayuda para detener la corrupción de MissingNo.
- Aceptar iniciará directamente el escenario especial; aplazar conservará la oferta pendiente en la hoja de Alcanfor.
- La confrontación contra MissingNo será narrativa y basada en puzles o anomalías del escenario, sin introducir combate Pokémon convencional.
- El jardín de Bill y el volcán de Isla Canela quedan registrados como semillas de futuras ofertas especiales de Alcanfor; sus requisitos se definirán al diseñar esos mapas.

### Interacciones expresivas por voz

- PokeDiscover permitirá descubrir secretos hablando, cantando, tarareando, gritando o dirigiéndose a un Pokémon, no solo pronunciando nombres de especies.
- Estas interacciones solo escucharán después de activar un prompt contextual; el micrófono no permanecerá interpretando frases ambientales durante toda la expedición.
- `ExpeditionExpressionTriggerV1` describirá la activación, el tipo de expresión, las respuestas aceptadas, las pistas conocidas, la secuencia resultante y su recompensa única.
- El reconocimiento podrá evaluar frases curadas, alias localizados e intenciones sencillas como `compliment`, `calm`, `warn` o `sing`, evitando depender de un backend o de interpretación generativa.
- Las condiciones acústicas como gritar, mantener una nota o tararear usarán únicamente volumen, duración o patrones simples calculados en local; no se guardarán grabaciones de voz.
- El jugador verá qué ha entendido el juego y recibirá feedback parcial sin penalización cuando la frase o el sonido no encajen.
- Los NPC podrán enseñar gustos, palabras o formas de reaccionar de una especie. La pista quedará guardada en el cuaderno sin revelar necesariamente la frase exacta.
- Ninguna misión principal dependerá exclusivamente del micrófono. Texto o una acción contextual accesible podrán producir el mismo cambio de mundo si la voz no está disponible.
- Los secretos opcionales podrán conceder logros diferenciados por haber usado realmente la voz, pero la investigación y las rutas no quedarán inaccesibles por usar el fallback.
- Cada interacción expresiva tendrá un ID estable y su recompensa se registrará en el ledger para impedir repeticiones explotables.

### Ejemplos de requisitos narrativos

- Superar una pared llevando un Pokémon volador con tamaño suficiente o en su tercera etapa evolutiva.
- Desbloquear una pista después de hablar con determinados NPC a lo largo de varias expediciones.
- Llevar un Magnemite para observar cómo otros Magnemite se unen y descubrir a Magneton.
- Haber encontrado 100 monedas durante las misiones para activar el encuentro de Gimmighoul.
- Combinar una herramienta que aporte `surf` con un acompañante que aporte `cut` para alcanzar un secreto con dos capacidades.
- Usar una capacidad narrativa como `rock-tomb` para estabilizar o provocar un derrumbe previsto por el diseñador, sin convertirla en sustituto universal de `break-rock`.
- Calmar al Sharpedo de una bahía con una intención de cumplido; un NPC podrá sugerir que decirle «tiburón bonito» hace que deje bañarse a la gente.
- Espantar temporalmente a un Pokémon territorial mediante un grito, con una alternativa contextual accesible cuando no haya micrófono.
- Cantar o tararear delante de Meloetta para iniciar una observación musical o alterar una variante del escenario.

### Checklist

- [ ] Añadir el logro permanente `first-mission` y concederlo al completar la primera misión real del profesor.
- [ ] Crear el registro de capacidades de campo por Pokémon o forma.
- [ ] Diferenciar capacidades físicas genéricas de capacidades narrativas procedentes de movimientos concretos.
- [ ] Crear `RequirementExpressionV1` con operadores `all`, `any` y condiciones atómicas tipadas.
- [ ] Crear `ExpeditionExpressionTriggerV1` para frases, intenciones y propiedades acústicas simples.
- [ ] Soportar requisitos por capacidad, compañero, especie, tipo, tamaño, evolución, NPC, contador, objeto y evento.
- [ ] Crear requisitos compuestos para obstáculos, zonas, apariciones y secretos.
- [ ] Persistir `unlockedSecretIds` por mapa y versión compatible.
- [ ] Persistir `worldFlags`, contadores globales y conversaciones relevantes.
- [ ] Separar `MissionDefinitionV1` del progreso persistente de `AdventureMapV1`.
- [ ] Persistir el desbloqueo de expedición libre tras la primera misión del mapa.
- [ ] Crear el cuaderno de campo con pistas conocidas y sin contador total de secretos.
- [ ] Guardar en el cuaderno las pistas de NPC sobre expresiones que agradan, calman o ahuyentan a determinadas especies.
- [ ] Crear el loadout de un acompañante y una herramienta, inmutable durante la visita.
- [ ] Crear `CompanionBehaviorTriggerV1` y su ejecutor de secuencias contextuales.
- [ ] Persistir secretos expresivos y diferenciar la resolución por voz, texto o acción contextual sin duplicar recompensas.
- [ ] Persistir intentos elegibles y garantía de encuentros raros.
- [ ] Representar visualmente rutas descubiertas y bloqueos todavía desconocidos.
- [ ] Mostrar antes de entrar las capacidades del acompañante elegido sin revelar todos los secretos del mapa.
- [ ] Añadir un resumen al salir: nuevos secretos, investigación, experiencia y Puntos de Descubrimiento.
- [ ] Impedir pagos duplicados mediante el ledger.
- [ ] Añadir tests de revisita con un acompañante distinto.
- [ ] Añadir tests de secretos con herramienta y acompañante cubriendo requisitos diferentes.
- [ ] Permitir inyectar encuentros nuevos en mapas anteriores después de activar un evento global.
- [ ] Migrar el comando de MissingNo a una cadena de anomalía de PokeDiscover con recompensa única.
- [ ] Crear y probar una variante de mapa corrupta que conserve el estado del mapa base.
- [ ] Garantizar que cambiar de acompañante o herramienta requiere abandonar la expedición.

### Diseño reservado para eventos míticos

- El primer encuentro con Mew podrá ocurrir bajo el camión de una reinterpretación de Ciudad Carmín.
- Ese encuentro activará `mewFirstSeen` y permitirá que Mew aparezca de forma rara en misiones anteriores donde originalmente no estaba disponible.
- Celebi podrá usar variantes temporales de un mismo mapa, conservando por separado los cambios relevantes de cada época.
- Hoopa podrá abrir portales hacia variantes dimensionales o mapas conectados que no existen en la navegación normal.
- Los lugares míticos se reinterpretarán con assets propios; no se copiarán mapas extraídos de juegos oficiales.
- Estos contenidos no se implementarán en Reserva Cero, pero el editor, el estado global y el cargador de mapas deberán poder representarlos.
- MissingNo podrá reutilizar el mismo sistema de variantes para corromper mapas existentes sin pertenecer a la Pokédex reiniciable.

---

## Hito 9 — Economía de descubrimiento y tienda

- [ ] Usar una única moneda llamada `Puntos de Descubrimiento (PD)` y la clave interna `discoveryPoints`.
- [ ] Conceder experiencia de entrenador y Puntos de Descubrimiento como recompensas separadas.
- [ ] Mantener los importes en configuración y no dentro de escenas o componentes.
- [ ] Conceder inicialmente 10 PD por observación única, 40 PD por ficha completa y 25 PD por misión completada.
- [ ] Definir recompensas únicas para secretos de mapa y descubrimientos especiales durante el balance del prototipo.
- [ ] Crear una tienda con una skin/paleta de avatar por 120 PD.
- [ ] Crear un tema de Pokédex o Pokéballs por 180 PD.
- [ ] Persistir compras y cosméticos equipados.
- [ ] Usar permisos de misión para formas alternativas, paradojas y especies especiales.
- [ ] No permitir comprar directamente un descubrimiento de Pokédex.
- [ ] Añadir logros por nivel, secretos, mapas completados e investigación.
- [ ] Crear un inventario permanente de herramientas compradas una sola vez.
- [ ] Separar las compras en herramientas equipables, objetos clave pasivos, permisos de misión y cosméticos.
- [ ] Añadir una pala que descubra entradas subterráneas y pueda abrir misiones de fósiles.
- [ ] Añadir un cepillo de arqueología para ruinas, inscripciones y futuras investigaciones de Unown.
- [ ] Añadir un bote que aporte la capacidad `surf` sin ocupar el espacio del acompañante.
- [ ] Permitir que una herramienta abra directamente una misión nueva o satisfaga una parte de un requisito compuesto.
- [ ] Equipar como máximo una herramienta de campo por expedición.
- [ ] Permitir que objetos clave pasivos, como una Escama Dragón, formen parte de requisitos narrativos sin ocupar ese espacio.
- [ ] Mostrar en la tienda qué tipo de contenido habilita una herramienta sin revelar secretos concretos.
- [ ] Evitar consumibles y desgaste en el prototipo: las herramientas compradas serán permanentes.
- [ ] Garantizar que ninguna compra sea obligatoria para continuar la historia principal; tienda y permisos abrirán contenido opcional.

---

## Hito 10 — Sideweb: editor de escenarios Pokémon

### Objetivo

Construir antes del juego de aventura una aplicación web independiente para centralizar tiles, sprites y mapas. El editor será la fuente oficial de escenarios y exportará exactamente el formato consumido por Poke-Voice.

### Arquitectura

- Aplicación Vite + React + TypeScript separada del juego principal.
- Paquete compartido de esquemas, assets y validadores.
- Render y preview con el mismo motor Phaser cargado por el juego.
- Tiles base de 16×16 px y escalado entero sin suavizado.
- Formato propio versionado `AdventureMapV1`, exportado como `.pvmap.json`.
- Manifiesto de assets versionado con identificadores estables y rutas relativas.
- Acceso local a carpetas mediante File System Access API en Chromium, con importación/descarga como fallback.
- Contratos compartidos `MissionDefinitionV1`, `ResearchFactV1`, `CompanionRequirementV1`, `RequirementExpressionV1`, `CompanionBehaviorTriggerV1`, `ExpeditionExpressionTriggerV1`, `WorldEventV1` y `RewardLedgerEntryV1`.

### Herramientas mínimas del editor

- [ ] Crear, abrir, duplicar, renombrar y guardar mapas.
- [ ] Registrar tilesets, sprites, retratos y animaciones en una biblioteca común.
- [ ] Pintar, borrar, rellenar y seleccionar tiles.
- [ ] Gestionar capas de suelo, decoración, superposición y colisión.
- [ ] Colocar spawn del jugador, NPC, salidas y transiciones.
- [ ] Dibujar zonas de hierba, encuentros y triggers.
- [ ] Colocar obstáculos ligados a capacidades de acompañante.
- [ ] Crear un editor visual de requisitos `all`/`any` para acompañantes, herramientas, NPC, contadores y eventos.
- [ ] Colocar secretos persistentes con ID estable y recompensa única.
- [ ] Configurar cambios de estado global que añadan o retiren encuentros de un mapa.
- [ ] Configurar variantes temporales, dimensionales o narrativas de un mismo mapa base.
- [ ] Previsualizar variantes corruptas y las modificaciones activadas por anomalías como MissingNo.
- [ ] Configurar comportamientos del acompañante con modos `prompt`, `automatic` y `ambient`.
- [ ] Configurar secretos expresivos con frases, alias, intención, volumen, duración, fallback y pistas asociadas.
- [ ] Simular nivel, registro, investigación, acompañante, herramienta, objetos clave y flags de historia.
- [ ] Simular transcripción, fuente `voice|text|contextAction` y propiedades acústicas sin necesitar un micrófono real.
- [ ] Previsualizar reacciones genéricas y secuencias especiales del acompañante.
- [ ] Crear una matriz especie × campo de investigación × mapa.
- [ ] Advertir sobre especies completadas demasiado pronto y campos sin contenido planificado.
- [ ] Asociar diálogos, objetivos, especies e interacciones de investigación.
- [ ] Configurar encuentros de una forma concreta o de una apariencia de evento vinculada a una forma.
- [ ] Validar referencias rotas, IDs duplicados, salidas inaccesibles y capas obligatorias.
- [ ] Detectar dependencias circulares y requisitos de progreso imposibles.
- [ ] Advertir si una interacción de voz obligatoria carece de fallback accesible o de pistas obtenibles.
- [ ] Verificar que existe experiencia suficiente antes de cualquier nivel obligatorio de la historia.
- [ ] Advertir si una compra o gasto pudiera bloquear progreso obligatorio.
- [ ] Previsualizar movimiento, cámara, colisiones, capas y desbloqueos dentro del editor.
- [ ] Exportar el mapa y su manifiesto de dependencias.
- [ ] Importar de nuevo un mapa exportado sin pérdida de información.
- [ ] Añadir tests de round-trip y compatibilidad con el cargador del juego.

### Contrato inicial de `AdventureMapV1`

- Metadatos, versión, tamaño y tileset.
- Capas de tiles y colisiones.
- Spawn, NPC, portales y triggers.
- Zonas de encuentro.
- Secretos, requisitos de capacidad y estado visual desbloqueado.
- Expresiones de requisitos, contadores globales, herramientas y flags de historia.
- Variantes del mapa e inyecciones de encuentros condicionadas por el estado global.
- Modificadores de anomalía para tiles, colisiones controladas, audio, diálogos y encuentros.
- Comportamientos contextuales y automáticos del acompañante.
- Interacciones expresivas, pistas de NPC, métodos de entrada admitidos y feedback de reconocimiento.
- Encuentros deterministas, raros y su configuración de garantía.
- Referencias a misiones, diálogos, especies y recompensas.
- Lista de assets requeridos.

### Criterio de aceptación

Un mapa creado completamente en la sideweb se exporta, valida y ejecuta en Poke-Voice sin editar manualmente su JSON.

---

## Hito 11 — Manifiesto de assets

- [ ] Crear una guía exacta para los assets que proporcionará el usuario.
- [ ] Especificar tiles de agua, costa, árboles, hierba alta, caminos, cuevas, interiores, lluvia y obstáculos.
- [ ] Especificar protagonista y protagonista femenina en cuatro direcciones y ciclos de movimiento.
- [x] Especificar e integrar al profesor en retrato neutro, hablando y teniendo una idea.
- [ ] Especificar NPC aldeano y elementos de suministros.
- [ ] Especificar Pikachu, Snorlax, Charizard y Charmander en las poses necesarias para sus observaciones.
- [ ] Relacionar cada pose solicitada con el dato de Pokédex que revelará.
- [ ] Validar tamaños, transparencia, paleta, nombres de archivo y pivotes antes de integrarlos.
- [ ] Importar todo mediante el editor para comprobar que el pipeline de assets funciona.

---

## Hito 12 — Motor de expediciones

- [ ] Integrar Phaser de forma lazy-loaded para no penalizar la Pokédex principal.
- [ ] Añadir rutas hash para misiones y expediciones manteniendo el despliegue estático.
- [ ] Crear movimiento con WASD/flechas e interacción con Espacio/E.
- [ ] Crear cámara, colisiones, capas, triggers, NPC y diálogos.
- [ ] Mantener voz y texto como interfaz HTML accesible sobre el canvas.
- [ ] Crear prompts contextuales de expresión que reutilicen el reconocimiento existente y muestren la transcripción interpretada.
- [ ] Añadir detección local y opt-in de volumen o duración para gritos, notas sostenidas y tarareo sencillo.
- [ ] Ejecutar el fallback de texto o acción contextual sobre el mismo trigger y cambio persistente de mundo.
- [ ] Crear estados de misión: bloqueada, disponible, en progreso y completada.
- [ ] Desbloquear la expedición libre de un mapa al terminar su primera misión.
- [ ] Preparar exactamente un acompañante y una herramienta antes de entrar.
- [ ] Mantener el loadout bloqueado hasta abandonar el mapa.
- [ ] Ejecutar prompts contextuales y secuencias automáticas de acompañante desde datos exportados por el editor.
- [ ] Resolver capacidades narrativas de movimientos, como `rock-tomb`, desde los mismos requisitos declarativos.
- [ ] Guardar inmediatamente observaciones, secretos y recompensas.
- [ ] Guardar una sola vez el descubrimiento y procedencia de formas y apariencias encontradas.
- [ ] Guardar pistas del cuaderno, conversaciones únicas, coleccionables e intentos elegibles de encuentros raros.
- [ ] Guardar pistas de expresiones conocidas, secretos resueltos y el método de primera resolución.
- [ ] Permitir abandonar y regresar sin perder progreso.
- [ ] Crear el modal del profesor con briefing, selector de misión, acompañante y recompensas.
- [ ] Mostrar un informe de salida con experiencia, Puntos de Descubrimiento, observaciones y pistas nuevas.
- [ ] Excluir controles táctiles del prototipo; se evaluarán en el roadmap de expansión.

---

## Hito 13 — Prototipo Reserva Cero

### Estructura

Reserva Cero será un conjunto pequeño de mapas temáticos reutilizables y revisitables. El prototipo cubrirá Pikachu, Snorlax, Charizard y Charmander. Mewtwo y Unown quedan fuera del primer alcance para futuras misiones con puzles o combate.

### Investigación

Cada especie tendrá entre 3 y 4 interacciones únicas que podrán revelar:

- Biometría: altura, peso y rasgos.
- Conducta y relaciones.
- Alimentación y hábitat.
- Flavor text excepcional.

Los cuatro campos no tienen que estar disponibles en Reserva Cero. Cada mapa podrá publicar solo una parte de la investigación de una especie y el resto quedará para escenarios futuros.

### Misiones

- [ ] `Peligro en la hierba alta`: Pikachu aparece al pisarle la cola y provoca un calambrazo.
- [ ] `La ruta bloqueada`: un aldeano pide ayuda porque Snorlax impide la llegada de suministros.
- [ ] `Refugio bajo la tormenta`: Charizard protege a un Charmander dentro de una cueva.
- [ ] Dar progreso independiente a Charizard y Charmander aunque compartan escenas.
- [ ] Repartir los campos disponibles de las especies del prototipo sin exigir completar las cuatro fichas en Reserva Cero.
- [ ] Añadir al menos una reacción genérica por etiqueta de acompañante.
- [ ] Añadir una escena especial declarativa por especie y mapa, como Rattata provocando el encuentro con Pikachu.
- [ ] Incluir al menos un secreto expresivo opcional con pista de NPC, resolución por voz y fallback accesible.
- [ ] Incluir al menos un secreto que requiera volver con otra capacidad de acompañante.
- [ ] Incluir al menos un atajo permanente que continúe abierto en visitas posteriores.
- [ ] Identificar Pokémon por voz o texto cuando la misión lo requiera.
- [ ] No incluir derrota: los errores ofrecen pistas y solo afectan a la eficiencia de la investigación.
- [ ] Mostrar las fichas investigadas en la Pokédex principal al volver.
- [ ] Conceder experiencia, Puntos de Descubrimiento, distintivos y logros una sola vez.

---

## Hito 14 — Validación y cierre

- [ ] Cubrir esquemas, migraciones, obediencia, capacidades y recompensas con tests unitarios.
- [ ] Verificar que conseguir Pikachu primero, resetear y elegir un inicial primero conserva ambos logros permanentes.
- [ ] Verificar que repetir un logro ya permanente se ignora sin toast, resumen ni recompensa.
- [ ] Verificar que el reset vacía registrados y acompañante, pero conserva PokeDiscover completo.
- [ ] Verificar que la investigación queda oculta tras el reset y reaparece intacta al redescubrir.
- [ ] Verificar que redescubrir no vuelve a conceder experiencia, PD, objetos o accesos.
- [ ] Verificar que una cualificación compleja sobrevive al reset y solo exige volver a registrar la especie.
- [ ] Verificar que antes de `first-mission` únicamente Pikachu e iniciales base pueden acompañar.
- [ ] Verificar que completar la primera misión desbloquea permanentemente `first-mission`.
- [ ] Verificar que logros permanentes de modos y PokeDiscover pueden habilitar acompañantes y secretos.
- [ ] Verificar que `preserve` conserva la run, `resetPokedex` crea otra tras confirmar e `isolatedPokedex` restaura la original.
- [ ] Verificar que el reset normal queda bloqueado durante una expedición.
- [ ] Verificar que la migración conserva logros, fechas y la Pokédex actual como run inicial.
- [ ] Verificar que solo el borrado total elimina PokeDiscover y logros permanentes.
- [ ] Verificar que registrar Mew no lo marca como avistado ni satisface sus requisitos narrativos.
- [ ] Verificar que descubrir a Raichu de Alola amplía la ficha de Raichu sin crear una especie independiente.
- [ ] Verificar que Pikachu surfista se guarda como apariencia de evento, sobrevive al reset y no duplica recompensas.
- [ ] Verificar que un Pokémon normal registrado y con nivel suficiente puede acompañar.
- [ ] Verificar que un requisito secreto se desbloquea sin revelar previamente su condición exacta.
- [ ] Verificar que una secuencia automática de acompañante se ejecuta y recompensa una sola vez.
- [ ] Verificar que completar la primera misión abre la expedición libre y conserva atajos.
- [ ] Verificar que no se puede cambiar de acompañante o herramienta dentro del mapa.
- [ ] Verificar un requisito compuesto cubierto por un bote y un acompañante con `cut`.
- [ ] Verificar que la tercera visita elegible garantiza un encuentro raro con la configuración por defecto.
- [ ] Verificar que varios mapas aportan campos distintos y la ficha solo se completa al reunir los cuatro.
- [ ] Verificar que gastar PD en cosméticos no puede bloquear la historia principal.
- [ ] Verificar round-trip de mapas con requisitos, triggers, variantes y estado persistente.
- [ ] Verificar que la anomalía de MissingNo persiste en PokeDiscover, no registra una especie normal y no altera irreversiblemente el mapa base.
- [ ] Verificar frases exactas, alias e intenciones aproximadas de un secreto expresivo sin aceptar expresiones ajenas.
- [ ] Verificar que gritar o mantener una nota se procesa localmente, no almacena audio y dispone de fallback.
- [ ] Verificar que voz y texto desbloquean el mismo secreto una sola vez, mientras un logro opcional puede distinguir la resolución por voz.
- [ ] Verificar que una pista de NPC aparece en el cuaderno y permite deducir cómo calmar a una especie.
- [ ] Probar con Playwright selección de misión, acompañante, movimiento, observación, revisita y ficha.
- [ ] Verificar que la Pokédex funciona aunque el editor, Phaser o los assets de aventura fallen.
- [ ] Probar partidas nuevas y migradas.
- [ ] Comparar rendimiento, accesibilidad y responsive contra el baseline.
- [ ] Evaluar movimiento, exploración, investigación, revisitas, acompañantes y deseo de continuar.
- [ ] Documentar qué sistemas deben conservarse, cambiarse o descartarse.
- [ ] Si el prototipo se aprueba, crear un roadmap de expansión para más mapas, Surf, Corte, Destello, vuelo, puzles, combates, controles móviles y posible backend.
- [ ] Si no se aprueba, cerrar Reserva Cero sin comprometer las mejoras de Pokédex, modos y progresión.
- [ ] Renombrar este archivo con el prefijo `[Finalizado]` cuando todos los checks estén completos.

## Trabajo futuro expresamente fuera de alcance

- Backend, cuentas y sincronización online.
- Combates completos y entrenamiento individual de Pokémon.
- Crianza, cansancio, hambre, amistad numérica y consumibles con desgaste.
- Estadísticas competitivas o escalado técnico exhaustivo de niveles.
- Controles táctiles del motor de expediciones.
- Región completa o Pokédex completa investigable.
- Misiones de Mewtwo, Unown, formas alternativas y paradojas.
- Cadenas completas de Meloetta, Sharpedo y otros secretos expresivos más allá del ejemplo mínimo de Reserva Cero.
- Eventos míticos de Mew en Ciudad Carmín, viaje temporal de Celebi y dimensiones de Hoopa.
- Cadena jugable completa de MissingNo; Reserva Cero solo preparará sus contratos y herramientas de variante.
- Multijugador o rankings globales.

## Notas de decisiones

- `PokeDiscover` será el nombre visible provisional de toda la metaprogresión permanente.
- Una run de Pokédex es reiniciable; PokeDiscover no se borra con el reset normal.
- El reset manual y cualquier modo con `runPolicy: resetPokedex` crean un `runId` normal nuevo; `isolatedPokedex` usa un `runId` temporal y restaura el original al terminar.
- Los logros se evalúan con contadores limpios en cada run, pero solo su primera obtención se muestra y recompensa.
- La investigación y las cualificaciones permanecen guardadas tras el reset, aunque se ocultan hasta redescubrir la especie.
- Resetear nunca permite farmear recompensas ya registradas en el ledger.
- Solo el borrado total de ajustes puede eliminar PokeDiscover.
- El editor de escenarios se desarrollará antes que los mapas definitivos.
- El formato propio del editor sustituye a Tiled como fuente principal; el juego y el editor compartirán el mismo contrato.
- La limitación de un acompañante convierte la elección previa y las revisitas en parte central de la aventura.
- El progreso permanente se aplica a secretos y rutas descubiertas, no solo a fichas de Pokémon.
- La experiencia sube el nivel de entrenador; `discoveryPoints` representa los Puntos de Descubrimiento y será la única moneda.
- La obediencia usará una regla de nivel por defecto y excepciones narrativas curadas para cada especie o forma.
- Los requisitos de secretos no se limitan a MO: pueden depender del acompañante, herramientas, lore, NPC, contadores y eventos globales.
- Movimientos como Tumba Rocas podrán actuar como capacidades narrativas específicas cuando la escena lo justifique, sin introducir combate ni sets de movimientos.
- MissingNo pertenece a la investigación persistente de PokeDiscover y utilizará variantes corruptas reversibles de mapas existentes.
- La voz en PokeDiscover servirá también para interactuar con el mundo: cumplidos, avisos, gritos, canto y tarareo podrán resolver secretos declarativos.
- Los NPC y el cuaderno convertirán las expresiones secretas en deducciones de lore, no en contraseñas arbitrarias.
- Las rutas y la investigación siempre tendrán fallback accesible; solo logros opcionales podrán exigir que la primera resolución haya sido realmente por voz.
- Las herramientas permanentes pueden sustituir una capacidad del acompañante y permiten diseñar secretos con varias condiciones simultáneas.
- Los eventos míticos podrán transformar mapas ya visitados o añadir apariciones retroactivas sin invalidar secretos descubiertos.
- Una misión introduce objetivos sobre un mapa; no es propietaria de su estado persistente.
- El acompañante y la herramienta se preparan antes de entrar y no se cambian durante la expedición.
- Las fichas se completan mediante cuatro campos distribuidos entre mapas, no mediante paquetes cerrados por especie.
- Los encuentros obligatorios nunca dependen solo del azar; los raros opcionales usan azar con garantía.
- El cuaderno solo muestra pistas conocidas y nunca revela el total oculto de secretos.
