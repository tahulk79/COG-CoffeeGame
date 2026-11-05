import { defineConfig } from 'vite';

// /data là World Coffee Atlas xuất tĩnh trong public/data (tools/world-coffee-atlas). Vite chỉ phục vụ file public
// khớp đúng tên, nên /data → /data/ và thư mục /data/.../ → index.html; còn lại rơi về trang game.
function atlasStaticDir() {
  const handle = (req, res, next) => {
    const [path, query = ''] = (req.url || '').split('?');
    if (path === '/data') {
      res.statusCode = 301;
      res.setHeader('Location', `/data/${query ? `?${query}` : ''}`);
      res.end();
      return;
    }
    if (path.startsWith('/data/') && path.endsWith('/')) req.url = `${path}index.html${query ? `?${query}` : ''}`;
    next();
  };
  return {
    name: 'atlas-static-dir',
    configureServer(server) { server.middlewares.use(handle); },
    configurePreviewServer(server) { server.middlewares.use(handle); },
  };
}

// Tách three khỏi chunk app: code app đổi thì người chơi không tải lại ~700 kB three. Không đổi base/server.
export default defineConfig({
  plugins: [atlasStaticDir()],
  build: { rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three') ? 'three' : undefined } } },
});
