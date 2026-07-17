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
- Caminar, cambiar de habitación o entrar y salir no cuentan como convivencia. NPC, inspecciones, Pokémon, identificaciones, triggers, secretos, pistas, coleccionables e investigación sí cuentan.
- Las formas y apariencias comparten la investigación de convivencia de su especie; sus particularidades se documentan como notas adicionales.

## Mapas de expedición

- `tile` designa exclusivamente una celda de 16×16; cada pantalla estática jugable se denomina `room` o habitación.
- `AdventureMapV2` agrupa habitaciones Tiled y transiciones por borde, escalera, puerta o teletransporte sin duplicar geometría en el sidecar.
- Una expedición exige compañero cuando comienza el control. La herramienta es opcional y, una vez elegida, se recuerda para las siguientes expediciones.
- La tienda solo ofrece contenido opcional y permanente. Nunca debe vender directamente especies, formas, apariencias ni hechos de investigación.
- Herramientas, objetos clave, permisos y cosméticos son categorías distintas: solo las herramientas ocupan el slot opcional del loadout.
- Los importes de experiencia y PD viven en `src/data/adventure/rewardBalance.ts`; escenas, secretos y misiones deben reutilizar sus paquetes de balance.
- Los secretos normales y los descubrimientos especiales se pagan siempre mediante un `originId` estable en el ledger.
- Los logros de PokeDiscover calculan mapas, secretos e investigaciones desde el estado persistente; no mantener contadores agregados duplicados.
- Todo mapa nuevo debe respetar `docs/codex/perfil-tiled-poke-voice.md` y superar `npm run maps:validate`.
- Nunca relacionar sidecar y Tiled mediante los IDs numéricos internos de Tiled; usar el nombre estable del objeto.
- Phaser solo se importa al abrir una misión o previsualización; no incluirlo en el bundle inicial de la Pokédex.
- Los tilesets externos `.tsj` se conservan como fuente y se incorporan en memoria antes de entregarlos al parser de Phaser.

## Sprites de expedición PMD

- Conservar los paquetes originales bajo `public/assets/sprites/pokemon/pmd/<numero>-<slug>/<forma>/`.
- No renombrar `AnimData.xml` ni las hojas `*-Anim.png`, `*-Offsets.png` y `*-Shadow.png`; el importador resolverá las animaciones mediante sus nombres PMD.
- Leer dimensiones, copias, puntos de impacto y duraciones desde `AnimData.xml` en lugar de duplicarlas manualmente en componentes.
- Mantener el pixel art sin suavizado y respetar `prefers-reduced-motion` en cualquier previsualización HTML.
- Registrar por separado la atribución indicada por PMDCollab para cada especie o forma antes de publicar sus sprites.

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
