# Personajes activos de expedición

Esta carpeta contiene únicamente hojas que carga el juego. Los packs todavía
sin asignar viven en `asset-library/unassigned-sprites/`.

## Hojas actuales

| Personaje | Archivo activo | Frame | Distribución |
| --- | --- | --- | --- |
| Achaman | `achaman/achaman-walk.png` | 16×24 px | 4 filas: abajo, izquierda, derecha y arriba |
| Achaman nadando | `achaman/achaman-swim.png` | 16×24 px | 4 filas: abajo, izquierda, derecha y arriba |
| Guayota | `guayota/guayota-walk.png` | 16×24 px | 4 filas: abajo, izquierda, derecha y arriba |
| Guayota nadando | `guayota/guayota-swim.png` | 16×24 px | 4 filas: abajo, izquierda, derecha y arriba |
| Montura Lapras | `mounts/lapras-surf.png` | 32×32 px | 4 filas: abajo, izquierda, derecha y arriba |
| Profesor Alcanfor | `alcanfor/professor-alcanfor-walk.png` | 16×24 px | 4 filas: abajo, izquierda, derecha y arriba |

Las tres hojas activas usan frames nativos de 16×24 y escala 1. Las columnas son
frames consecutivos. La transparencia debe ser alfa real, sin
tablero ni color de fondo. Los pies deben quedar alineados al borde inferior de
cada frame y todos los cambios de tamaño se declaran en `manifest.v1.json`.

Las hojas acuáticas se regeneran desde el pack fuente con
`npm run assets:locomotion:normalize`. La fuente de Lapras conserva un fondo
violeta y una disposición 6×2 no apta para runtime: el normalizador elimina el
fondo, selecciona las direcciones de Surf y produce una hoja 2×4 transparente.
El original permanece en `asset-library/unassigned-sprites/`.

Los packs de Brendan y May también contienen carrera, bicicleta y pesca. Se
conservan como fuentes disponibles, pero no pasan a `public/` hasta que sus
mecánicas tengan un estado y una activación declarativa en runtime.

## Caída de Alcanfor

La caída será una acción narrativa independiente, no una dirección de marcha.
`alcanfor/professor-alcanfor-fall.png` contiene actualmente cuatro poses
normalizadas de caída. Si se amplía manualmente, mantener una sola fila de
frames de 16×24 px y este orden narrativo:

1. Susto.
2. Pérdida de equilibrio.
3. Caída.
4. Impacto.
5. Sentado en el suelo.
6. Recuperación o pose final.

Puede haber más frames si mejoran la animación, pero todos deben conservar
16×24 px, el mismo pivote inferior y el orden temporal de izquierda a derecha.
La hoja se añadirá como acción declarativa al manifiesto y a la secuencia del
prólogo durante su implementación visual.

Las fuentes grandes y los borradores procesados viven fuera del despliegue en
`asset-library/character-sources/<personaje>/`.
