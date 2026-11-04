import { installCurrencyIcons } from './ui/currency.js';
import { installIcons, iconsReady } from './ui/icons.js';
import { startGame } from './app/game.js';
import { applyI18n, t } from './i18n/index.js';

// Dịch HTML tĩnh trước khi hiện màn tải (docs/shared/i18n.md).
applyI18n();
document.title = `COG — ${t('html.tagline')}`;

installCurrencyIcons();
installIcons();
// Canvas labels draw icons from decoded images, so wait for them (data URIs, a few ms); start anyway if one fails.
iconsReady.finally(startGame);
