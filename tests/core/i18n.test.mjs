// i18n coverage for V3: every V3 key has non-empty en + vi values of the same type, every literal t()/T() key used by the
// V3 features exists, and every dynamic key family (err.<code>, building.<id>, …) is complete in both languages.
// Locale packs are imported directly (src/i18n/index.js reads localStorage at import time).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUILDINGS, CROPS, DRINKS, STAFF, REBIRTH } from '../../src/core/config/economy.js';
import { COUNTRIES, ALL_REGION_IDS } from '../../src/core/config/world.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCALE_DIR = join(ROOT, 'src/i18n/locales');

const packs = {};
for (const f of readdirSync(LOCALE_DIR).filter(f => f.endsWith('.js'))) {
  packs[f] = (await import(pathToFileURL(join(LOCALE_DIR, f)).href)).default;
}
const v3Packs = Object.entries(packs).filter(([f]) => f.startsWith('v3-'));
const all = { en: {}, vi: {} };
for (const pack of Object.values(packs)) for (const lang of ['en', 'vi']) Object.assign(all[lang], pack?.[lang]);

const SAMPLE = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? 1 : undefined) }); // any param → 1
function nonEmpty(v) {
  if (typeof v === 'string') return v.trim().length > 0;
  if (typeof v === 'function') { const out = v(SAMPLE); return typeof out === 'string' && out.trim().length > 0; }
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === 'object') return Object.keys(v).length > 0;
  return false;
}
// string and function values both render text through t() (en often pluralizes with a function, vi needs no plural).
const kind = v => (Array.isArray(v) ? 'array' : typeof v === 'function' || typeof v === 'string' ? 'text' : typeof v);

test('i18n: V3 locale packs exist and every key has non-empty en and vi of the same type', () => {
  assert.deepEqual(v3Packs.map(([f]) => f).sort(), ['v3-hud.js', 'v3-realm.js', 'v3-story.js']);
  const problems = [];
  for (const [file, pack] of v3Packs) {
    const keys = new Set([...Object.keys(pack.en || {}), ...Object.keys(pack.vi || {})]);
    assert.ok(keys.size > 0, `${file} is empty`);
    for (const key of keys) {
      const en = pack.en?.[key], vi = pack.vi?.[key];
      if (en === undefined) problems.push(`${file}: ${key} missing en`);
      else if (vi === undefined) problems.push(`${file}: ${key} missing vi`);
      else if (kind(en) !== kind(vi)) problems.push(`${file}: ${key} type en=${kind(en)} vi=${kind(vi)}`);
      else {
        if (!nonEmpty(en)) problems.push(`${file}: ${key} empty en`);
        if (!nonEmpty(vi)) problems.push(`${file}: ${key} empty vi`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js)$/.test(name)) out.push(p);
  }
  return out;
}
const SCAN_DIRS = ['src/features/realm', 'src/features/hud', 'src/features/teacher', 'src/features/atlas', 'src/app'];
const sources = SCAN_DIRS.flatMap(d => walk(join(ROOT, d))).map(p => ({ file: p.slice(ROOT.length + 1), text: readFileSync(p, 'utf8') }));

test('i18n: every literal t(\'…\')/T(\'…\') key used by the V3 features exists in a locale pack', () => {
  // Literal string keys only: t('a.b') / T("a.b"). Skips concatenations t('a.' + x) and template literals.
  const re = /(?<![\w$.])[tT]\(\s*(['"])([^'"\n]+)\1\s*(?=[,)])/g;
  const missing = [];
  let count = 0;
  for (const { file, text } of sources) {
    for (const m of text.matchAll(re)) {
      count++;
      const key = m[2];
      if (!(key in all.en) && !(key in all.vi)) missing.push(`${file}: ${key}`);
    }
  }
  assert.ok(count > 50, `scan found only ${count} literal keys — regex or paths broken?`);
  assert.deepEqual([...new Set(missing)], []);
});

// Error codes listed in docs/design/v3-architecture.md ("Error codes (`result.error`)").
function documentedErrorCodes() {
  const doc = readFileSync(join(ROOT, 'docs/design/v3-architecture.md'), 'utf8');
  const line = doc.split('\n').find(l => l.includes('Error codes'));
  assert.ok(line, 'error code line not found in v3-architecture.md');
  return [...line.split(':').slice(1).join(':').matchAll(/`(\w+)`/g)].map(m => m[1]);
}

test('i18n: every dynamic key family is complete in en and vi', () => {
  const codes = documentedErrorCodes();
  assert.ok(codes.length >= 25 && codes.includes('coins') && codes.includes('unknown'), `parsed codes: ${codes}`);
  const families = {
    err: codes,
    building: Object.keys(BUILDINGS),
    crop: Object.keys(CROPS),
    drink: Object.keys(DRINKS),
    staff: Object.keys(STAFF),
    blessing: Object.keys(REBIRTH.blessings),
    country: Object.keys(COUNTRIES),
    regionName: ALL_REGION_IDS,
  };
  const missing = [];
  for (const [prefix, ids] of Object.entries(families)) {
    for (const id of ids) for (const lang of ['en', 'vi']) {
      const v = all[lang][`${prefix}.${id}`];
      if (v === undefined || !nonEmpty(v)) missing.push(`${lang}: ${prefix}.${id}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('i18n: blessing descriptions used by the HUD exist (blessing.<key>.desc)', () => {
  const used = sources.some(s => s.text.includes('blessing.${key}.desc'));
  if (!used) return;
  const missing = [];
  for (const key of Object.keys(REBIRTH.blessings)) for (const lang of ['en', 'vi']) if (!nonEmpty(all[lang][`blessing.${key}.desc`])) missing.push(`${lang}: blessing.${key}.desc`);
  assert.deepEqual(missing, []);
});

test('local café menus: every country has one menu entry per culture.<cc>.menu item (en + vi) and every base drink', async () => {
  const { COUNTRY_MENUS } = await import('../../src/core/config/menus.js');
  assert.deepEqual(Object.keys(COUNTRY_MENUS).sort(), Object.keys(COUNTRIES).sort());
  const problems = [];
  for (const [cc, items] of Object.entries(COUNTRY_MENUS)) {
    for (const lang of ['en', 'vi']) {
      const names = String(all[lang][`culture.${cc}.menu`] || '').split('|').map(x => x.trim()).filter(Boolean);
      if (names.length !== items.length) problems.push(`${lang}: ${cc} has ${names.length} names for ${items.length} items`);
    }
    for (const base of Object.keys(DRINKS)) if (!items.some(i => i.base === base)) problems.push(`${cc}: no ${base} item`);
    for (const i of items) if (!Object.hasOwn(DRINKS, i.base) || !i.icon) problems.push(`${cc}: bad item ${JSON.stringify(i)}`);
  }
  assert.deepEqual(problems, []);
});
