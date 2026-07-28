# Saneamiento de mapas y sectores

## Objetivo

Inventario manual de migración para que cada TMJ y sidecar existente cumpla
Mapas V3. Cada elemento se repara desde la cola del configurador; no se
renombra silenciosamente. La auditoría estricta permanecerá separada de
`maps:validate` hasta completar todos los checks.

## Estado

- Estado: en curso.
- Inventario inicial: 27 de julio de 2026.
- Formato de cada check: `archivo · ID/clase actual · motivo · dependencias · construcción esperada`.

## Hito — Bosque de Tegueste

### Sector 01-05

- [ ] Reparto · falta declarar ≥5 Pokémon y NPC previstos · dependencias: colocaciones del sector · esperado: `AdventureSectorRosterV1`.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:transition:south` / `TransitionAnchor` · ID no derivado · transición pendiente de vincular · receta `transition`.
- [ ] `tegueste-forest-01-05.tmj` · objeto sin ID ni clase · construcción incomprensible · sin dependencias demostradas · eliminar si está huérfano.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:pelipper` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:pidove` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-01-05.tmj` · objeto Tiled #67, `anchor:action:1` / `ActionAnchor` · clase no traducible · sin referencia funcional · eliminar y sustituir por `comment:<ordinal>` conservando geometría y metadatos; después crear el evento de Pelipper desde el comentario.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:shellos:right` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:shellos:top` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:shellos:left` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:froakie:deepbreath` / `ActorAnchor` · posible destino suelto · secuencia/beat/acción pendiente · receta `sequence-destination`.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:froakie:float` / `ActorAnchor` · posible destino suelto · secuencia/beat/acción pendiente · receta `sequence-destination`.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:froakie:shoot` / `ActorAnchor` · posible destino suelto · secuencia/beat/acción pendiente · receta `sequence-destination`.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:froakie:headleft` / `ActorAnchor` · posible destino suelto · secuencia/beat/acción pendiente · receta `sequence-destination`.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:froakie:eventsleep` / `ActorAnchor` · posible destino suelto · secuencia/beat/acción pendiente · receta `sequence-destination`.
- [ ] `tegueste-forest-01-05.tmj` · `anchor:froakie:headright` / `ActorAnchor` · posible destino suelto · secuencia/beat/acción pendiente · receta `sequence-destination`.

### Sector 02-05

- [ ] Reparto · inferido pero no confirmado para el sector · dependencias: colocaciones Tegueste · esperado: ≥5 Pokémon distintos y NPC previstos.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:professor:fall` / `ActorAnchor` · nombre distinto de `placementId` · colocaciones de Alcanfor y starters · receta de colocación/destino.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:rattata:right` / `ActorAnchor` · nombre distinto de `placementId` · `actor:rattata:right` · receta de colocación Pokémon.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:rattata:middle` / `ActorAnchor` · nombre distinto de `placementId` · `actor:rattata:middle` · receta de colocación Pokémon.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:rattata:left` / `ActorAnchor` · nombre distinto de `placementId` · `actor:rattata:left` · receta de colocación Pokémon.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:gyarados:left` / `ActorAnchor` · nombre distinto de `placementId` · colocación Gyarados · receta de colocación Pokémon.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:gyarados:right` / `ActorAnchor` · nombre distinto de `placementId` · colocación Gyarados · receta de colocación Pokémon.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:cramorant` / `ActorAnchor` · nombre distinto de `placementId` · colocación Cramorant · receta de colocación Pokémon.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:cottonee` / `ActorAnchor` · nombre distinto de `placementId` · `actor:cottonee` · receta de colocación Pokémon.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:player:entrance-south` / `PlayerSpawn` · falta derivar de `entryPointId` · entrada sur · receta `entry-point`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:professor` / `ActorAnchor` · nombre distinto de `placementId` · personaje Alcanfor · receta de colocación NPC.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:transition:east` / `TransitionAnchor` · falta `transitionId:endpoint` · conexión este · receta `transition`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:transition:north` / `TransitionAnchor` · falta `transitionId:endpoint` · conexión norte · receta `transition`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:transition:south` / `TransitionAnchor` · falta `transitionId:endpoint` · conexión sur · receta `transition`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:tree:hit` / `SecretAnchor` · nombre distinto de `interactionId` · secreto Pineco · receta `secret`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:pineco:1` / `ActorAnchor` · destino con nombre libre · secuencia Pineco · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:pineco:2` / `ActorAnchor` · destino con nombre libre · secuencia Pineco · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:pineco:3` / `ActorAnchor` · destino con nombre libre · secuencia Pineco · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:pineco:4` / `ActorAnchor` · destino con nombre libre · secuencia Pineco · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:pineco:5` / `ActorAnchor` · destino con nombre libre · secuencia Pineco · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:pineco:6` / `ActorAnchor` · destino con nombre libre · secuencia Pineco · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:pineco:7` / `ActorAnchor` · destino con nombre libre · secuencia Pineco · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:pineco:8` / `ActorAnchor` · destino con nombre libre · secuencia Pineco · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:pineco:9` / `ActorAnchor` · destino con nombre libre · secuencia Pineco · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:companion:rattata:left` / `ActorAnchor` · destino con nombre libre · secuencia de compañero · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:companion:rattata:middle` / `ActorAnchor` · destino con nombre libre · secuencia de compañero · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:companion:rattata:right` / `ActorAnchor` · destino con nombre libre · secuencia de compañero · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:scientific:scared1` / `ActorAnchor` · destino con nombre libre · secuencia de científicos · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:scientific:scared2` / `ActorAnchor` · destino con nombre libre · secuencia de científicos · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:scientific:init1` / `ActorAnchor` · destino con nombre libre · secuencia de científicos · receta `sequence-destination`.
- [ ] `tegueste-forest-02-05.tmj` · `anchor:scientific:init2` / `ActorAnchor` · destino con nombre libre · secuencia de científicos · receta `sequence-destination`.

### Sector 03-05 pendiente

- [ ] `tegueste-forest-03-05.tmj` · archivo ausente reservado por el `.world` · dependencias: conexiones 02-05/04-05 · esperado: crear TMJ, sector V3 y reparto ≥5.

### Sector 04-05

- [ ] Reparto · falta declarar ≥5 Pokémon y NPC previstos · dependencias: diez anclas actuales · esperado: `AdventureSectorRosterV1`.
- [ ] `tegueste-forest-04-05.tmj` · `anchor:pikachu:hidden1` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-04-05.tmj` · `anchor:chikorita:five` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-04-05.tmj` · `anchor:chikorita:three` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-04-05.tmj` · `anchor:chikorita:one` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-04-05.tmj` · `anchor:chikorita:four` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-04-05.tmj` · `anchor:chikorita:two` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-04-05.tmj` · `anchor:bayleef` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-04-05.tmj` · `anchor:ledyba` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-04-05.tmj` · `anchor:sirfetch:left` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-04-05.tmj` · `anchor:sirfetch:right` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.

### Sector 05-05

- [ ] Reparto · falta declarar ≥5 Pokémon y NPC previstos · dependencias: colocaciones futuras · esperado: `AdventureSectorRosterV1`.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:heracross` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:tauros:middle` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:tauros:left` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:tauros:top` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:tauros:bottom` / `ActorAnchor` · convención antigua · colocación/destino pendiente · receta compatible.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:staraptor` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:appletun` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:klefki` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:rellor` / `ActorAnchor` · convención antigua · colocación pendiente · receta de colocación Pokémon.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:transition:north` / clase vacía · clase incomprensible · conexión norte · receta `transition`.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:transition:west` / clase vacía · clase incomprensible · conexión oeste · receta `transition`.
- [ ] `tegueste-forest-05-05.tmj` · `anchor:heracross:trigger` / clase vacía · clase incomprensible · trigger pendiente · receta `interaction`.

## Hito — Mapa técnico

### Sector technical-clearing

- [ ] Reparto · solo existe Rattata · dependencias: plantilla y pruebas · esperado: ≥5 assets Pokémon distintos.
- [ ] `technical-clearing.tmj` · `anchor:technical:player-south` / `PlayerSpawn` · falta `entryPointId` derivado · entrada técnica · receta `entry-point`.
- [ ] `technical-clearing.tmj` · `anchor:technical:rattata-grass` / `ActorAnchor` · nombre distinto de `placementId` · colocación Rattata · receta `pokemon-placement`.
- [ ] `technical-clearing.tmj` · `anchor:technical:clearing-east` / `TransitionAnchor` · falta `transitionId:from` · transición técnica · receta `transition`.

### Sector technical-path

- [ ] Reparto · no contiene Pokémon · dependencias: plantilla y pruebas · esperado: ≥5 assets Pokémon distintos.
- [ ] `technical-path.tmj` · `anchor:technical:path-west` / `TransitionAnchor` · falta `transitionId:to` · transición técnica · receta `transition`.

## Cierre

- [ ] Completar todos los checks de Tegueste.
- [ ] Crear y sanear el sector 03-05.
- [ ] Completar todos los checks del mapa técnico.
- [ ] Ejecutar la prueba tabular de todas las recetas y el round-trip TMJ/JSON.
- [ ] Integrar `auditPokeDiscoverAuthoringSnapshot` en `maps:validate`.
- [ ] Renombrar este roadmap con prefijo `[Finalizado]`.

## Inventario individual de colisiones

Todas las entradas siguientes pertenecen al archivo indicado, tienen clase
actual `Collision`, no poseen dependencias sidecar y deben recibir mediante la
cola un ID `collision:<ordinal>`. El motivo común es un nombre vacío o
descriptivo que no cumple la convención técnica V3.

### `tegueste-forest-01-05.tmj`

- [ ] Collision #1 · nombre vacío.
- [ ] Collision #2 · nombre vacío.
- [ ] Collision #3 · nombre vacío.
- [ ] Collision #4 · nombre vacío.
- [ ] Collision #5 · nombre vacío.
- [ ] Collision #6 · nombre vacío.
- [ ] Collision #8 · nombre vacío.
- [ ] Collision #9 · nombre vacío.
- [ ] Collision #10 · nombre vacío.
- [ ] Collision #11 · nombre vacío.
- [ ] Collision #12 · nombre vacío.
- [ ] Collision #13 · nombre vacío.
- [ ] Collision #14 · nombre vacío.
- [ ] Collision #15 · nombre vacío.
- [ ] Collision #16 · nombre vacío.
- [ ] Collision #17 · nombre vacío.
- [ ] Collision #18 · nombre vacío.
- [ ] Collision #19 · nombre vacío.
- [ ] Collision #20 · nombre vacío.
- [ ] Collision #21 · nombre vacío.
- [ ] Collision #22 · nombre vacío.
- [ ] Collision #23 · nombre vacío.
- [ ] Collision #24 · nombre vacío.
- [ ] Collision #25 · nombre vacío.
- [ ] Collision #26 · nombre vacío.
- [ ] Collision #27 · nombre vacío.
- [ ] Collision #28 · nombre vacío.
- [ ] Collision #29 · nombre vacío.
- [ ] Collision #30 · nombre vacío.
- [ ] Collision #31 · nombre vacío.
- [ ] Collision #32 · nombre vacío.
- [ ] Collision #33 · nombre vacío.
- [ ] Collision #34 · nombre vacío.
- [ ] Collision #35 · nombre vacío.
- [ ] Collision #36 · nombre vacío.
- [ ] Collision #37 · nombre vacío.
- [ ] Collision #38 · nombre vacío.
- [ ] Collision #39 · nombre vacío.
- [ ] Collision #40 · nombre vacío.
- [ ] Collision #41 · nombre vacío.
- [ ] Collision #42 · nombre vacío.
- [ ] Collision #43 · nombre vacío.
- [ ] Collision #44 · nombre vacío.
- [ ] Collision #45 · nombre vacío.
- [ ] Collision #46 · nombre vacío.
- [ ] Collision #47 · nombre vacío.
- [ ] Collision #48 · nombre vacío.
- [ ] Collision #49 · nombre vacío.
- [ ] Collision #50 · nombre vacío.
- [ ] Collision #51 · nombre vacío.
- [ ] Collision #52 · nombre vacío.
- [ ] Collision #53 · nombre vacío.
- [ ] Collision #54 · nombre vacío.
- [ ] Collision #55 · nombre vacío.
- [ ] Collision #56 · nombre vacío.
- [ ] Collision #58 · nombre vacío.
- [ ] Collision #62 · nombre vacío.
- [ ] Collision #63 · nombre vacío.
- [ ] Collision #70 · nombre actual `anchor:marill`.
- [ ] Collision #72 · nombre actual `anchor:girl`.
- [ ] Collision #73 · nombre actual `anchor:guy`.
- [ ] Collision #83 · nombre vacío.

### `tegueste-forest-02-05.tmj`

- [ ] Collision #4 · nombre vacío.
- [ ] Collision #5 · nombre vacío.
- [ ] Collision #6 · nombre vacío.
- [ ] Collision #7 · nombre vacío.
- [ ] Collision #8 · nombre vacío.
- [ ] Collision #9 · nombre vacío.
- [ ] Collision #10 · nombre vacío.
- [ ] Collision #11 · nombre vacío.
- [ ] Collision #12 · nombre vacío.
- [ ] Collision #13 · nombre vacío.
- [ ] Collision #14 · nombre vacío.
- [ ] Collision #16 · nombre vacío.
- [ ] Collision #17 · nombre vacío.
- [ ] Collision #18 · nombre vacío.
- [ ] Collision #19 · nombre vacío.
- [ ] Collision #20 · nombre vacío.
- [ ] Collision #21 · nombre vacío.
- [ ] Collision #22 · nombre vacío.
- [ ] Collision #26 · nombre vacío.
- [ ] Collision #27 · nombre vacío.
- [ ] Collision #29 · nombre vacío.
- [ ] Collision #30 · nombre vacío.
- [ ] Collision #31 · nombre vacío.
- [ ] Collision #33 · nombre vacío.
- [ ] Collision #34 · nombre vacío.
- [ ] Collision #35 · nombre vacío.
- [ ] Collision #36 · nombre vacío.
- [ ] Collision #37 · nombre vacío.
- [ ] Collision #38 · nombre vacío.
- [ ] Collision #39 · nombre vacío.
- [ ] Collision #40 · nombre vacío.
- [ ] Collision #42 · nombre vacío.
- [ ] Collision #43 · nombre vacío.
- [ ] Collision #44 · nombre vacío.
- [ ] Collision #46 · nombre vacío.
- [ ] Collision #47 · nombre vacío.
- [ ] Collision #49 · nombre vacío.
- [ ] Collision #50 · nombre vacío.
- [ ] Collision #79 · nombre vacío.
- [ ] Collision #88 · nombre vacío.
- [ ] Collision #89 · nombre vacío.
- [ ] Collision #90 · nombre vacío.
- [ ] Collision #91 · nombre vacío.

### `tegueste-forest-04-05.tmj`

- [ ] Collision #1 · nombre vacío.
- [ ] Collision #2 · nombre vacío.
- [ ] Collision #3 · nombre vacío.
- [ ] Collision #4 · nombre vacío.
- [ ] Collision #5 · nombre vacío.
- [ ] Collision #6 · nombre vacío.
- [ ] Collision #7 · nombre vacío.
- [ ] Collision #9 · nombre vacío.
- [ ] Collision #10 · nombre vacío.
- [ ] Collision #11 · nombre vacío.
- [ ] Collision #12 · nombre vacío.
- [ ] Collision #13 · nombre vacío.
- [ ] Collision #14 · nombre vacío.
- [ ] Collision #15 · nombre vacío.
- [ ] Collision #16 · nombre vacío.
- [ ] Collision #17 · nombre vacío.
- [ ] Collision #18 · nombre vacío.
- [ ] Collision #19 · nombre vacío.
- [ ] Collision #20 · nombre vacío.
- [ ] Collision #21 · nombre vacío.
- [ ] Collision #22 · nombre vacío.
- [ ] Collision #23 · nombre vacío.
- [ ] Collision #24 · nombre vacío.
- [ ] Collision #25 · nombre vacío.
- [ ] Collision #26 · nombre vacío.
- [ ] Collision #27 · nombre vacío.
- [ ] Collision #51 · nombre vacío.
- [ ] Collision #52 · nombre vacío.
- [ ] Collision #53 · nombre vacío.
- [ ] Collision #54 · nombre vacío.

### `tegueste-forest-05-05.tmj`

- [ ] Collision #12 · nombre vacío.
- [ ] Collision #13 · nombre vacío.
- [ ] Collision #15 · nombre vacío.
- [ ] Collision #16 · nombre vacío.
- [ ] Collision #17 · nombre vacío.
- [ ] Collision #18 · nombre vacío.
- [ ] Collision #19 · nombre vacío.
- [ ] Collision #20 · nombre vacío.
- [ ] Collision #21 · nombre vacío.
- [ ] Collision #22 · nombre vacío.
- [ ] Collision #23 · nombre vacío.
- [ ] Collision #24 · nombre vacío.
- [ ] Collision #25 · nombre vacío.
- [ ] Collision #26 · nombre vacío.
- [ ] Collision #27 · nombre vacío.
- [ ] Collision #28 · nombre vacío.
- [ ] Collision #29 · nombre vacío.
- [ ] Collision #30 · nombre vacío.
- [ ] Collision #31 · nombre vacío.
- [ ] Collision #32 · nombre vacío.
- [ ] Collision #33 · nombre vacío.
- [ ] Collision #34 · nombre vacío.
- [ ] Collision #35 · nombre vacío.
- [ ] Collision #36 · nombre vacío.
- [ ] Collision #37 · nombre vacío.
- [ ] Collision #38 · nombre vacío.
- [ ] Collision #39 · nombre vacío.
- [ ] Collision #40 · nombre vacío.
- [ ] Collision #42 · nombre vacío.
- [ ] Collision #43 · nombre vacío.
- [ ] Collision #44 · nombre vacío.
- [ ] Collision #46 · nombre vacío.
- [ ] Collision #47 · nombre vacío.
- [ ] Collision #48 · nombre vacío.
- [ ] Collision #49 · nombre vacío.
- [ ] Collision #50 · nombre vacío.
- [ ] Collision #51 · nombre vacío.
- [ ] Collision #52 · nombre vacío.
- [ ] Collision #64 · nombre vacío.
- [ ] Collision #65 · nombre vacío.
- [ ] Collision #66 · nombre vacío.
- [ ] Collision #67 · nombre vacío.
- [ ] Collision #68 · nombre vacío.

### `technical-clearing.tmj`

- [ ] Collision #1 · nombre actual `collision:technical:north`.
- [ ] Collision #2 · nombre actual `collision:technical:south`.
- [ ] Collision #3 · nombre actual `collision:technical:west`.
- [ ] Collision #4 · nombre actual `collision:technical:east-north`.
- [ ] Collision #7 · nombre actual `collision:technical:east-south`.

### `technical-path.tmj`

- [ ] Collision #1 · nombre actual `collision:technical-path:north`.
- [ ] Collision #2 · nombre actual `collision:technical-path:south`.
- [ ] Collision #3 · nombre actual `collision:technical-path:west-north`.
- [ ] Collision #4 · nombre actual `collision:technical-path:west-south`.
- [ ] Collision #5 · nombre actual `collision:technical-path:east`.
