import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: { port: 5174, strictPort: true, open: false },
  preview: { port: 5174, strictPort: true },
  build: { outDir: 'dist', sourcemap: false },
});
