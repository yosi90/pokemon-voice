import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        'pokediscover-randomizer': fileURLToPath(new URL('./tools/pokediscover-randomizer/index.html', import.meta.url)),
        'pokediscover-editor': fileURLToPath(new URL('./tools/pokediscover-editor/index.html', import.meta.url)),
        'visual-novel-editor': fileURLToPath(new URL('./tools/visual-novel-editor/index.html', import.meta.url)),
        'story-editor': fileURLToPath(new URL('./tools/story-editor/index.html', import.meta.url)),
      },
    },
  },
});
