# Fuentes de personajes

Cada personaje dispone de una carpeta propia. `raw/` conserva las imágenes
originales sin modificar y `draft/` recibe conversiones automáticas todavía
editables. Ninguno de estos archivos forma parte del despliegue web.

Para regenerar los borradores de Alcanfor:

```bash
npm run assets:camphor:normalize
```

El script elimina solamente el fondo claro conectado al borde de cada celda,
preserva blancos encerrados por el contorno —pelo y bata—, alinea los pies y
exporta frames de 16×24 con alfa real. Nunca sobrescribe los raw.

Las hojas aprobadas se copian después a
`public/assets/sprites/characters/<personaje>/` y se registran en el manifiesto.
