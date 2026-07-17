# Perfil Tiled de Poke-Voice

## Formato base

- Guardar cada habitación como JSON de Tiled con extensión `.tmj`.
- Mapa ortogonal, finito y con render order `right-down`.
- Tile base de 16×16 px. No cambiar el tile base para simular zoom.
- La cámara muestra una habitación completa y permanece estática mientras el jugador se mueve en ella.
- Usar escalado entero y desactivar el suavizado de texturas en el runtime.
- Guardar tilesets externos como `.tsj` y rutas relativas al `.tmj`.
- No incrustar imágenes o tilesets como Base64.

## Capas obligatorias

Los nombres distinguen mayúsculas y deben aparecer una sola vez:

1. `Ground`: tile layer con el suelo transitable y la base visual.
2. `Collision`: object layer invisible con rectángulos o polígonos de clase `Collision`.
3. `Above`: tile layer para copas, hierba, arcos y elementos que pueden ocultar actores.
4. `Anchors`: object layer visible durante la edición y ocultable al exportar.

Se pueden añadir capas visuales auxiliares con el prefijo `Detail:`. No se usarán para lógica ni colisión.

## Objetos y anclas

El campo `name` de Tiled es el identificador estable. El ID numérico de Tiled nunca se guarda en PokeDiscover ni se referencia desde el sidecar.

Clases admitidas en `Collision`:

- `Collision`: rectángulo o polígono que bloquea el movimiento.

Clases admitidas en `Anchors`:

- `PlayerSpawn`: punto donde puede aparecer el protagonista.
- `TransitionAnchor`: rectángulo de entrada o salida usado por una transición. Debe cubrir el paso transitable completo; el runtime usa su centro como destino y su superficie como zona de activación.
- `ActorAnchor`: punto donde el sidecar coloca un Pokémon o NPC.
- `EncounterAnchor`: punto o rectángulo para un encuentro contextual.
- `InteractionAnchor`: punto o rectángulo inspeccionable.
- `SecretAnchor`: punto o rectángulo asociado a un secreto persistente.

Prefijos recomendados:

- `anchor:<mapa>:<función>` para anclas.
- `collision:<mapa>:<zona>` para colisiones.

Todos los objetos deben tener un nombre único dentro de la habitación. Las coordenadas pertenecen exclusivamente a Tiled; el sidecar solo conserva el identificador estable.

## Sidecar de aventura

El archivo `<mapa>.adventure.json` contiene `AdventureMapV2` y:

- Registra cada `.tmj` en `tiledMapAssets` mediante ruta relativa a `public/`.
- Relaciona cada habitación con un `tiledMapAssetId`.
- Declara en `actorPlacements` qué asset se coloca en qué `ActorAnchor` y con qué animación.
- Conserva misiones, transiciones, variantes, requisitos y encuentros fuera de la geometría.
- Incluye en `requiredAssetIds` todos los sprites usados por actores.

Un cambio de coordenadas en Tiled no obliga a editar el sidecar mientras el nombre estable del ancla se conserve.

## Flujo de trabajo

1. Copiar la carpeta de plantilla técnica y renombrar `.tmj`, `.tsj` y `.adventure.json` con un slug en minúsculas y guiones.
2. Abrir el `.tmj` en Tiled y sustituir el tileset técnico por el tileset definitivo.
3. Dibujar `Ground`, colisiones y `Above` manteniendo sus nombres.
4. Colocar y nombrar las anclas necesarias.
5. Registrar habitaciones, actores y transiciones en el sidecar.
6. Ejecutar `npm run assets:pmd:manifest` después de añadir sprites PMD.
7. Ejecutar `npm run maps:validate` antes de probar el mapa en el juego.

La plantilla técnica vive en `public/assets/adventure/maps/_technical/`. No es arte definitivo y puede reemplazarse sin migrar progreso.
