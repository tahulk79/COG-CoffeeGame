// The one loading screen (#loading in index.html): progress bar, status line and a tip. Every scene change uses it.
import { t } from '../i18n/index.js';

const $ = id => document.getElementById(id);
// Real advice from the game's own rules, shown while a scene loads.
const TIPS = t('loading.tips');
export function loading(value, label) {
  $('load-fill').style.width = `${value}%`;
  $('load-track').setAttribute('aria-valuenow', value);
  $('load-status').textContent = `${label} · ${value}%`;
  if (value <= 45) $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; // new tip when a scene starts loading
}
export const showLoading = (value, label) => { $('loading').hidden = false; loading(value, label); };
export const hideLoading = () => { $('loading').hidden = true; };
