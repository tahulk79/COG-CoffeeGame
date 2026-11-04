import { installCurrencyIcons } from './ui/currency.js';
import { installIcons, iconsReady } from './ui/icons.js';
import { startGame } from './app/game.js';

installCurrencyIcons();
installIcons();
// Canvas labels draw icons from decoded images, so wait for them (data URIs, a few ms); start anyway if one fails.
iconsReady.finally(startGame);
