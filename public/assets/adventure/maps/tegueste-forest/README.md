Distribución del mapa (los marcados ya están listos):
    [x]         1
    [x]|[ ]     2|3
[x]|[x]       4|5

Las barras `|` son únicamente separadores visuales. La fuente de datos de esta
distribución es `tegueste-forest.world`; el configurador y Tiled comparten ese
archivo y colocan las habitaciones por coordenadas reales, sin huecos.

La habitación de entrada de la misión del profesor Alcanfor es `02-05`. El ID
interno histórico sigue siendo `room:tegueste-forest:02-04` para no romper
referencias anteriores. Las acciones todavía no implementadas se documentan en
`CONTENIDO_PENDIENTE.md`.

Estado del configurador:

- [x] `01-05`, `02-05`, `04-05` y `05-05` se detectan al abrir esta carpeta.
- [x] La vista completa reproduce el archivo `.world`.
- [x] La geometría de objetos puede editarse sin modificar los tiles.
- [ ] `03-05` se añadirá cuando exista su TMJ, en `(960, 320)`.
