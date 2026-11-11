import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Build id sent with every server log (godbean-server game-api.md: `build`, ≤ 32 chars): version + commit, so errors can be
// compared before / after a release. A dirty tree gets '*'.
const buildId = (() => {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() ? '*' : '';
    return `${version}+${sha}${dirty}`.slice(0, 32);
  } catch { return version; }
})();

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
  define: { __GB_BUILD__: JSON.stringify(buildId) },
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three') ? 'three' : undefined } },
  },
});
