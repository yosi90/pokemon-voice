# Baseline de Poke-Voice

Referencia tomada el 15 de julio de 2026 antes de iniciar los refactors del roadmap.

## Entorno

- Chromium de Playwright 1.61.1.
- Escritorio: viewport de 1440 × 900 px.
- Móvil: viewport de 390 × 844 px.
- Catálogo completo obtenido de PokeAPI y limitado a las primeras 1025 entradas.

## Métricas observadas

| Métrica | Escritorio | Móvil |
| --- | ---: | ---: |
| Tarjetas renderizadas | 1010 | 1010 |
| Nodos DOM aproximados | 12.276 | 12.276 |
| Altura total de la página | 38.496 px | 210.569 px |
| Errores en consola durante la carga | 0 | 0 |

La aplicación monta las 1010 tarjetas a la vez. En móvil esto genera una página de más de 210.000 px de altura y deja una referencia clara para medir una futura virtualización o paginación sin alterar el comportamiento visible.

## Comportamiento de referencia

- La voz es la interacción principal cuando el navegador ofrece reconocimiento; el texto siempre permanece disponible.
- Un nombre válido revela la tarjeta, reproduce feedback visual y sonoro, actualiza los contadores y persiste el id.
- Un nombre inválido muestra un aviso y registra el fallo para el motor de logros.
- Los filtros por generación modifican las tarjetas y contadores visibles.
- Reiniciar borra actualmente descubrimientos, easter eggs y logros; el roadmap cambiará deliberadamente este contrato al separar las runs de PokeDiscover.
- El modo contrarreloj reinicia el estado actual, dura dos minutos y presenta un resumen final.

## Capturas

- `baseline/desktop-home.png`: catálogo completo a 1440 × 900 px.
- `baseline/mobile-home.png`: catálogo completo a 390 × 844 px.

Estas capturas son una referencia manual. Las pruebas end-to-end usan un fixture local reducido para ser rápidas y deterministas.
