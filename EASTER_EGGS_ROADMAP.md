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

- [ ] Sudowoodo: reacciona a `agua` o Pokémon de agua.
- [ ] Unown: letras flotantes y mensajes secretos acumulados.
- [ ] Wobbuffet: respuesta en fallos de voz.
- [ ] Shuckle: fermentación y zumo tras tiempo.
- [ ] Delibird: regalo con resultado aleatorio.
- [ ] Celebi: rewind visual de una carta ya descubierta.
- [ ] Castform: clima temporal de página.
- [ ] Rotom: posesión breve de un elemento UI.
- [ ] Lucario: aura solo cuando el micro esté activo.
- [ ] Audino: limpia/estabiliza efectos activos.
- [ ] Zorua/Zoroark: falsa revelación y cambio posterior.
- [ ] Klefki: llaves y sonido al abrir zonas.
- [ ] Gimmighoul: moneda escondida y contador secreto.
- [ ] Palafin: retorno heroico tras descubrir otro Pokémon.

## Fase 4 - Spooky y set pieces

- [ ] Shedinja: halo/carta hueca e insinuación oscura al hover.
- [ ] Sableye: gemas robables.
- [ ] Mawile: boca trasera que muerde cursor/carta cercana.
- [ ] Drifloon: globo con hilo y sombra sutil.
- [ ] Spiritomb: 108 motas/espíritus.
- [ ] Darkrai: pesadilla elegante sin screamer.
- [ ] Mimikyu: falso Pikachu y apagón insinuado.
- [ ] Litwick: llama azul/morada que sigue cursor.
- [ ] Chandelure: luces parpadeantes y sombras grandes.

## Fase 5 - Legendarios y eventos grandes

- [ ] Milotic: reveal elegante con agua/brillo/escamas.
- [ ] Garchomp: pasada a velocidad absurda.
- [ ] Arceus: evento divino con pausa/círculo de Pokéballs.
- [ ] Xerneas: UI florece y recupera color.
- [ ] Yveltal: absorción temporal de color.
- [ ] Xerneas/Yveltal: evento de equilibrio al tener ambos.
- [ ] Necrozma: prismas y aberración cromática.
- [ ] Eternatus: evento dinamax rojo/morado.
- [ ] Genesect: escáner/láser.

## Fase 6 - Coleccionables y rarezas

- [ ] Wooloo: rueda y empuja Pokéballs visualmente.
- [ ] Cramorant: escupe item/silueta aleatoria con assets propios o abstractos.
- [ ] Falinks: formación marchando.
- [ ] Sinistea/Polteageist: té, vapor y comando `té`.
- [ ] Alcremie: frosting/topping aleatorio.
- [ ] Dragapult: Dreepy como misiles.
- [ ] Tandemaus/Maushold: multiplicación sorpresa.
- [ ] Fidough: inflado/horneado.
- [ ] Tinkaton: martillazo y reacción de tipo Acero.
- [ ] Gholdengo: evento al llegar a 999 monedas de Gimmighoul.
- [ ] Kingambit: entrada de jefe final con Pawniard/Bisharp.
