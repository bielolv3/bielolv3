import { defineConfig } from 'vite';
// base relativa: o build roda de qualquer pasta (artifact, GitHub Pages, arquivo local)
export default defineConfig({ base: './', build: { outDir: 'dist', assetsInlineLimit: 0 } });
