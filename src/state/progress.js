import { DEFAULT_NAME } from './names.js';

const KEY = 'cog-coffee-progress';
// Set by resetProgress so a farm autosave in the last frames before reload cannot restore the old run.
let locked = false;

export function readProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return value?.version === 1 && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

export function saveHeaven(heaven) {
  if (locked) return true;
  try {
    const previous = readProgress();
    localStorage.setItem(KEY, JSON.stringify({
      ...previous, version: 1, introCompleted: true,
      chapter: Math.max(Number(previous.chapter) || 2, heaven.completed ? 3 : 2),
      heaven, startingGift: heaven.gift,
    }));
    return true;
  } catch { return false; }
}

export function saveFarm(farm) {
  if (locked) return true;
  try {
    const previous = readProgress();
    localStorage.setItem(KEY, JSON.stringify({ ...previous, version: 1, introCompleted: true, chapter: Math.max(3, Number(previous.chapter) || 3), farm }));
    return true;
  } catch { return false; }
}

export function completeIntro() {
  if (locked) return true;
  try {
    const raw = localStorage.getItem(KEY);
    const stored = raw ? JSON.parse(raw) : null;
    const previous = stored?.version === 1 && typeof stored === 'object' ? stored : {};
    localStorage.setItem(KEY, JSON.stringify({
      ...previous,
      version: 1,
      chapter: Math.max(Number(previous.chapter) || 2, 2),
      introCompleted: true,
      accident: 'sign-head-bump',
    }));
    return true;
  } catch {
    return false;
  }
}

// Wipes the run (intro, heaven, farm, cafe) but keeps sound/graphics settings; caller reloads to the selection screen.
export function resetProgress() {
  locked = true;
  try {
    // Best effort: a full storage must not block the reset itself.
    try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(`${KEY}-backup`, raw); } catch {}
    const { settings } = readProgress();
    if (settings) localStorage.setItem(KEY, JSON.stringify({ version: 1, settings }));
    else localStorage.removeItem(KEY);
    return true;
  } catch { return false; }
}

// Mobile first: phones and weak machines start lighter; a saved choice always wins.
function deviceQuality() {
  const weak = (navigator.deviceMemory || 8) <= 2 || (navigator.hardwareConcurrency || 8) <= 4;
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return weak ? 'low' : touch ? 'medium' : 'high';
}
const DEFAULT_SETTINGS = { version: 1, master: 0.8, music: 0.6, ambience: 0.7, sfx: 0.8, ui: 0.6, muted: false, quality: deviceQuality() };
const QUALITIES = ['low', 'medium', 'high'];

function normalizeSettings(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const bus of ['master', 'music', 'ambience', 'sfx', 'ui']) {
    if (Number.isFinite(value[bus])) settings[bus] = Math.min(1, Math.max(0, value[bus]));
  }
  if (typeof value.muted === 'boolean') settings.muted = value.muted;
  if (QUALITIES.includes(value.quality)) settings.quality = value.quality;
  return settings;
}

// Save cũ chưa có `settings` → trả mặc định, không ghi gì.
export function readSettings() {
  return normalizeSettings(readProgress().settings);
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readProgress(), version: 1, settings: normalizeSettings(settings) }));
    return true;
  } catch { return false; }
}

const PLAYER_KEY = 'cog-coffee-player';
export function readPlayer() {
  try {
    const player = JSON.parse(localStorage.getItem(PLAYER_KEY));
    if ((player?.gender === 'male' || player?.gender === 'female') && typeof player.name === 'string') {
      return { gender: player.gender, name: player.name.trim().slice(0, 20) || DEFAULT_NAME };
    }
  } catch { /* Storage may be unavailable. */ }
  return { gender: 'female', name: DEFAULT_NAME };
}
export function savePlayer(player) {
  try { localStorage.setItem(PLAYER_KEY, JSON.stringify(player)); return true; }
  catch { return false; }
}
