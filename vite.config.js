import { defineConfig } from 'vite';

// Tách three khỏi chunk app: code app đổi thì người chơi không tải lại ~700 kB three. Không đổi base/server.
export default defineConfig({
  build: { rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three') ? 'three' : undefined } } },
});
