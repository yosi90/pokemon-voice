# Almacén de sprites sin asignar

Aquí se conservan packs y fuentes que todavía no tienen un uso declarado en el
runtime. Al estar fuera de `public/`, Vite no los copia al despliegue.

- `npc-packs/`: atlas y personajes NPC pendientes de selección y normalización.
- `hero-packs/`: packs de protagonistas no usados por Achaman ni Guayota.
- Las fuentes de personajes que ya tienen identidad propia se organizan aparte
  en `asset-library/character-sources/<personaje>/raw`.

Cuando un sprite vaya a utilizarse, no se debe enlazar directamente desde este
almacén. Primero se recorta y normaliza, se copia a la carpeta activa adecuada
bajo `public/assets/sprites/` y se registra en su manifiesto.
