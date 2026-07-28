# Contenido pendiente del Bosque de Tegueste

Este documento describe secuencias, encuentros y triggers todavía no implementados. Los IDs definitivos vivirán en el sidecar; aquí se conserva el diseño narrativo y se marca su avance.

## Sector 01-05

### Secuencia del barco

- [ ] Sustituir el `ActionAnchor` #67 por un `EditorComment`; la anotación no tendrá efecto durante la partida.
- [ ] Crear desde esa anotación una `TriggerZone` con activación `enterZone` y política `oncePerVisit`.
- [ ] Mantener a Pelipper inicialmente en `Sleep`.
- [ ] Pelipper se despierta, reproduce la sorpresa elegida y se marcha volando mediante `movePath`.
- [ ] El estado final conserva a Pelipper junto al árbol en `Idle` entre sectores y recargas de la misma expedición.
- [ ] Una expedición nueva restaura a Pelipper dormido y rearma el evento.
- [ ] Los NPC del picnic se acercan a comprobar qué ocurre en su barco.
- [ ] Pidove aprovecha para comerse el picnic.
- [ ] Los NPC regresan, ahuyentan a Pidove y este queda merodeando la zona.

### Encuentro con Froakie

- [ ] Froakie usa `Shoot` mientras se desplaza libremente por el agua.
- [ ] Al entrar el jugador en su rango, Froakie lanza un ataque de burbujas.
- [ ] Si alcanza al jugador, la expedición termina y se regresa con el profesor Alcanfor.

## Sector 02-05

### Prólogo de los Rattata

- [ ] Al iniciar la primera misión, los Rattata salen de sus madrigueras.
- [ ] Persiguen a Alcanfor y a sus ayudantes.
- [ ] Alcanfor cae al suelo y sus ayudantes huyen.
- [ ] Los Rattata rodean al profesor y quedan amenazantes.
- [ ] El control pasa entonces al jugador.

### Elección de inicial sin compañero

- [ ] Si el jugador llega sin acompañante, Alcanfor deja caer tres Poké Balls.
- [ ] Se ofrece una primera fase inicial de Planta, una de Fuego y una de Agua.
- [ ] La terna se elige aleatoriamente entre todos los iniciales disponibles respetando esa proporción.

### Rescate con compañero

- [ ] Mientras los Rattata amenazan a Alcanfor, el jugador puede pedir ayuda a su compañero.
- [ ] Como alternativa, puede acercarse y ahuyentar personalmente a cada Rattata.

## Sector 05-05

### Klefki del laboratorio

- [ ] Inspeccionar el tile señalado por `anchor:klefki` despierta a Klefki.
- [ ] Klefki huye al interior del laboratorio del profesor.

### Rancho

- [ ] Appletun impide que uno de los Tauros escape por la puerta del rancho.
