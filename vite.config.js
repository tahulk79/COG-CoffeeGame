import { defineConfig } from 'vite';

// Tách three khỏi chunk app: code app đổi thì người chơi không tải lại ~700 kB three. Không đổi base/server.
// Các màn (selection, intro, teacher, atlas, realm + HUD) đã là dynamic import() trong src/app/game.js, nên mỗi màn là một chunk riêng.
// three (~695 kB, ~180 kB gzip) cố ý nằm một chunk riêng và được cache lâu, nên nâng ngưỡng cảnh báo cho chunk đó.
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three') ? 'three' : undefined } },
  },
});
