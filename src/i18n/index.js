// Đa ngôn ngữ (docs/design/godbean-gdd.md §13.6). Ngôn ngữ cố định trong một lần tải trang: đổi ngôn ngữ thì lưu rồi tải lại,
// nên t() gọi ở cấp module (hằng số, bảng nội dung) vẫn đúng.
import html from './locales/html.js';
import common from './locales/common.js';
import selection from './locales/selection.js';
import intro from './locales/intro.js';
import heaven from './locales/heaven.js';
import farm from './locales/farm.js';
import farmRules from './locales/farm-rules.js';
import cafe from './locales/cafe.js';
import cafeRecipes from './locales/cafe-recipes.js';
import worldMap from './locales/world-map.js';
import crew from './locales/crew.js';
import awakening from './locales/awakening.js';
// Farm & Café V3 packs (docs/design/v3-architecture.md "Locale packs"): realm.*, hud.*/err.*/…, story.*/atlas.*/country.*/regionName.*
import v3Realm from './locales/v3-realm.js';
import v3Hud from './locales/v3-hud.js';
import v3Story from './locales/v3-story.js';

export const LANGS = ['en', 'vi'];
export const DEFAULT_LANG = 'en';
const LOCALES = { en: 'en-US', vi: 'vi-VN' };
// Importing storage-keys also deletes the pre-rename COG save keys (the renamed game starts fresh).
import { PROGRESS_KEY as SETTINGS_KEY } from '../state/storage-keys.js';

const dict = { en: {}, vi: {} };
for (const pack of [html, common, selection, intro, heaven, farm, farmRules, cafe, cafeRecipes, worldMap, crew, awakening, v3Realm, v3Hud, v3Story]) {
  for (const lang of LANGS) Object.assign(dict[lang], pack?.[lang]);
}

// Đọc thẳng localStorage (không qua state/progress.js) để module nào cũng import được, kể cả khi chạy test trong Node.
function savedLang() {
  try {
    const lang = JSON.parse(localStorage.getItem(SETTINGS_KEY))?.settings?.lang;
    return LANGS.includes(lang) ? lang : DEFAULT_LANG;
  } catch { return DEFAULT_LANG; }
}
const lang = savedLang();

export const getLang = () => lang;
/** Locale cho toLocaleString/Intl: 'en-US' | 'vi-VN'. */
export const numberLocale = () => LOCALES[lang];
export const formatNumber = (value, options) => Number(value).toLocaleString(LOCALES[lang], options);

/**
 * Tra chuỗi theo khóa. Thiếu ở ngôn ngữ hiện tại → lấy tiếng Anh → tiếng Việt → trả lại khóa.
 * Giá trị có thể là chuỗi (`{name}` được thay bằng params.name), hàm (params) => chuỗi, hoặc mảng/object (trả nguyên).
 */
export function t(key, params) {
  const value = dict[lang][key] ?? dict.en[key] ?? dict.vi[key];
  if (value === undefined) return key;
  if (typeof value === 'function') return value(params || {});
  if (typeof value !== 'string' || !params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) => (params[name] ?? match));
}
export const hasKey = key => key in dict[lang] || key in dict.en;

/**
 * Dịch HTML tĩnh: data-i18n="key" (textContent), data-i18n-html="key" (innerHTML, chỉ dùng cho chuỗi tin cậy),
 * data-i18n-attr="aria-label:key;title:key2".
 */
export function applyI18n(root = document) {
  if (root === document) document.documentElement.lang = lang;
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
}
