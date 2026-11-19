import { defineConfig } from 'vite';

// base: './' — ilova Android (Capacitor) va Windows (Electron) ichida
// fayl sifatida ochilgani uchun barcha yo'llar nisbiy bo'lishi kerak.
export default defineConfig({
  base: './',
  build: {
    target: 'es2017',
    outDir: 'dist',
    chunkSizeWarningLimit: 2000
  }
});
