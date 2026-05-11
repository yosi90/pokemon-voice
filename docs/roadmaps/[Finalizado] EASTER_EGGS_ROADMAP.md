# Roadmap de Easter Eggs Pokémon

Este documento marca el plan de implementación por fases. La regla general es mantener efectos cortos, seguros para la UI, compatibles con `prefers-reduced-motion` y sin mover realmente cartas en la grid salvo mediante clones o overlays visuales.

## Fase 0 - Base segura

- [x] Extender `pokemonSpecials` con `ids`, `className`, `revealEffect`, `timing`, `hoverEffect`, `idleEffect`, `persistentKey` y comandos secretos.
- [x] Añadir `SpecialEffectsLayer` para overlays globales, partículas y eventos especiales.
- [x] Añadir cola limitada de efectos globales.
- [x] Añadir estado persistente de easter eggs.
- [x] Limpiar efectos y estado persistente al reiniciar.
- [x] Migrar Gengar a la capa global de efectos.
- [x] Mantener Pikachu, Voltorb/Electrode y Master Ball dentro de la registry.

## Fase 1 - Kanto controlado

- [x] Bulbasaur: lianas/brote local y hojas globales.
- [x] Charmander: calor/llama local y brasas globales.
- [x] Squirtle: gotas locales y salpicaduras globales.
- [x] Jigglypuff: `Zzz` local y sueño global suave.
- [x] Diglett: hundimiento visual sin mover la grid real.
- [x] Meowth: moneda clicable y contador `Pokedinero`.
- [x] Psyduck: spinner/pregunta breve.
- [x] Snorlax: overlay dormido temporal sin bloquear interacción.
- [x] Ditto: derretido del artwork al hover.
- [x] MissingNo: comando secreto con glitch retro, oculto y reversible.

## Fase 2 - Starters y primitivas reutilizables

- [x] Chikorita: pétalos y brisa en Pokéballs cercanas.
- [x] Cyndaquil: encendido de llamas desde estado apagado.
- [x] Totodile: mordiscos/temblores desde dentro.
- [x] Treecko: escalada por borde/pared visual.
- [x] Torchic: llamarada pequeña y pluma chamuscada.
- [x] Mudkip: barro temporal en cartas cercanas.
- [x] Turtwig: hierba/árbol/florecillas sobre la Pokéball.
- [x] Chimchar: salto acrobático con estela de fuego.
- [x] Piplup: resbalón sobre hielo.
- [x] Snivy: entrada aristocrática/pose.
- [x] Tepig: humo y empujón visual.
- [x] Oshawott: concha slash y cortina de agua.
- [x] Chespin: pinchos/cáscara con rebote al hover.
- [x] Fennekin: llama mágica y ramita.
- [x] Froakie: burbujas ninja y blink.
- [x] Rowlet: giro de búho y pluma.
- [x] Litten: bola de pelo ardiente.
- [x] Popplio: burbujas musicales clicables.
- [x] Grookey: tambor sobre Pokéball.
- [x] Scorbunny: carrera y huellas ardientes.
- [x] Sobble: desaparición/translucidez.
- [x] Sprigatito: polen y gesto de gato.
- [x] Fuecoco: mordisco torpe.
- [x] Quaxly: peinado/brillo/pose.

## Fase 3 - Interacciones reactivas

- [x] Sudowoodo: reacciona a `agua` o Pokémon de agua.
- [x] Unown: letras flotantes y mensajes secretos acumulados.
- [x] Wobbuffet: respuesta en fallos de voz.
- [x] Shuckle: fermentación y zumo tras tiempo.
- [x] Delibird: regalo con resultado aleatorio.
- [x] Celebi: rewind visual de una carta ya descubierta.
- [x] Castform: clima temporal de página.
- [x] Rotom: posesión breve de un elemento UI.
- [x] Lucario: aura solo cuando el micro esté activo.
- [x] Audino: limpia/estabiliza efectos activos.
- [x] Zorua/Zoroark: falsa revelación y cambio posterior.
- [x] Klefki: llaves y sonido al abrir zonas.
- [x] Gimmighoul: moneda escondida y contador secreto.
- [x] Palafin: retorno heroico tras descubrir otro Pokémon.

## Fase 4 - Spooky y set pieces

- [x] Shedinja: halo/carta hueca e insinuación oscura al hover.
- [x] Sableye: gemas robables.
- [x] Mawile: boca trasera que muerde cursor/carta cercana.
- [x] Drifloon: globo con hilo y sombra sutil.
- [x] Spiritomb: 108 motas/espíritus.
- [x] Darkrai: pesadilla elegante sin screamer.
- [x] Mimikyu: falso Pikachu y apagón insinuado.
- [x] Litwick: llama azul/morada que sigue cursor.
- [x] Chandelure: luces parpadeantes y sombras grandes.

## Fase 5 - Legendarios y eventos grandes

- [x] Milotic: reveal elegante con agua/brillo/escamas.
- [x] Garchomp: pasada a velocidad absurda.
- [x] Arceus: evento divino con pausa/círculo de Pokéballs.
- [x] Xerneas: UI florece y recupera color.
- [x] Yveltal: absorción temporal de color.
- [x] Xerneas/Yveltal: evento de equilibrio al tener ambos.
- [x] Necrozma: prismas y aberración cromática.
- [x] Eternatus: evento dinamax rojo/morado.
- [x] Genesect: escáner/láser.

## Fase 6 - Coleccionables y rarezas

- [x] Wooloo: rueda y empuja Pokéballs visualmente.
- [x] Cramorant: escupe item/silueta aleatoria con assets propios o abstractos.
- [x] Sinistea/Polteageist: té, vapor y comando `té`.
- [x] Alcremie: frosting/topping aleatorio.
- [x] Dragapult: Dreepy como misiles.
- [x] Tandemaus/Maushold: multiplicación sorpresa.
- [x] Fidough: inflado/horneado.
- [x] Tinkaton: martillazo y reacción de tipo Acero.
- [x] Gholdengo: evento al llegar a 999 monedas de Gimmighoul.
- [x] Kingambit: entrada de jefe final con Pawniard/Bisharp.
