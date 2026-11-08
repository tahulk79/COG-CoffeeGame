import { installCurrencyIcons } from './ui/currency.js';
import { installIcons, iconsReady } from './ui/icons.js';
import { startGame } from './app/game.js';
import { applyI18n, t } from './i18n/index.js';

// Dịch HTML tĩnh trước khi hiện màn tải (docs/design/godbean-gdd.md §13.6).
applyI18n();
document.documentElement.classList.add('i18n-ready');
document.title = `GodBean: ${t('html.tagline')}`;

// Input modality for focus rings: keyboard navigation shows them, taps / clicks never do (index.html CSS).
const root = document.documentElement;
const NAV_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ']);
addEventListener('keydown', e => { if (NAV_KEYS.has(e.key) && root.dataset.input !== 'key') root.dataset.input = 'key'; }, true);
addEventListener('pointerdown', () => { if (root.dataset.input !== 'pointer') root.dataset.input = 'pointer'; }, true);
// Long-press menus (copy / save image / select all) and pinch-zooming the page itself are not part of the game.
addEventListener('contextmenu', e => { if (!e.target.closest?.('input, textarea, [contenteditable="true"]')) e.preventDefault(); });
addEventListener('selectstart', e => { if (!e.target.closest?.('input, textarea, [contenteditable="true"]')) e.preventDefault(); });
addEventListener('gesturestart', e => e.preventDefault()); // iOS Safari page pinch-zoom (the game zooms its own camera)
addEventListener('dblclick', e => e.preventDefault(), { passive: false });

installCurrencyIcons();
installIcons();
// Canvas labels draw icons from decoded images, so wait for them (data URIs, a few ms); start anyway if one fails.
iconsReady.finally(startGame);
