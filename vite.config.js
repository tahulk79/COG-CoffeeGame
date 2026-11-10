import { defineConfig } from 'vite';

// Trang tĩnh trong public/ (privacy, terms): Vite dev/preview trả index.html của game cho /privacy/ (SPA fallback),
// nên đổi /privacy và /privacy/ thành /privacy/index.html trước. Trên host tĩnh thật thì file có sẵn, không cần.
const STATIC_PAGES = ['privacy', 'terms'];
const staticPages = () => {
  const rewrite = (req, _res, next) => {
    const [path, query = ''] = (req.url || '').split('?');
    const m = path.match(/^\/([a-z-]+)\/?$/);
    if (m && STATIC_PAGES.includes(m[1])) req.url = `/${m[1]}/index.html${query ? `?${query}` : ''}`;
    next();
  };
  return { name: 'static-pages', configureServer: s => { s.middlewares.use(rewrite); }, configurePreviewServer: s => { s.middlewares.use(rewrite); } };
};

// Tách three khỏi chunk app: code app đổi thì người chơi không tải lại ~700 kB three. Không đổi base/server.
// Các màn (selection, intro, teacher, atlas, realm + HUD) đã là dynamic import() trong src/app/game.js, nên mỗi màn là một chunk riêng.
// three (~695 kB, ~180 kB gzip) cố ý nằm một chunk riêng và được cache lâu, nên nâng ngưỡng cảnh báo cho chunk đó.
export default defineConfig({
  plugins: [staticPages()],
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three') ? 'three' : undefined } },
  },
});
