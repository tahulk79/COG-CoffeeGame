// Migration from the v1 save (godbean-progress + godbean-player) into the V3 save. Read-only on the old data:
// the old keys are left untouched, so a rollback to the previous build still finds them.
import { createSave } from './state.js';
import { EXPIRY_LEVEL, xpForLevel, levelForXp } from './config/economy.js';
import { COUNTRIES } from './config/world.js';

const LEGACY_LEVEL_XP = [0, 0, 30, 80, 150, 250, 380, 540, 740, 980, 1260];
function legacyLevel(xp) {
  let l = 1;
  while (l < LEGACY_LEVEL_XP.length - 1 && xp >= LEGACY_LEVEL_XP[l + 1]) l++;
  return l;
}

/**
 * @param {object|null} progress  parsed v1 `godbean-progress` (or null)
 * @param {object|null} player    parsed `godbean-player` (or null)
 * @returns {object|null} a V3 save, or null when there is nothing worth migrating
 */
export function migrateLegacy(progress, player, now = Date.now()) {
  const hasPlayer = player && (player.gender === 'male' || player.gender === 'female');
  const p = progress && typeof progress === 'object' && progress.version === 1 ? progress : null;
  if (!p && !hasPlayer) return null;
  const s = createSave(now, hasPlayer ? { gender: player.gender, name: player.name } : null);
  s.migratedFrom = 1;
  if (!p) return s;
  if (p.introCompleted) s.story.phase = 'teacher';
  if (p.heaven?.completed || p.farm) {
    // Old players already met the mentor: give the 3 credits and send them through the World Gate.
    s.story.phase = 'gate';
    s.story.teacherMet = true;
    s.rebirth.credits = 3; s.rebirth.granted = true;
  }
  const farm = p.farm && typeof p.farm === 'object' ? p.farm : null;
  if (farm) {
    const coins = Number(farm.coins);
    // Keep the coins (capped so a dev-profile 1e13 save does not break the new economy).
    if (Number.isFinite(coins)) s.player.coins = Math.max(s.player.coins, Math.min(Math.round(coins), 50000));
    const lvl = Math.min(EXPIRY_LEVEL - 1, legacyLevel(Number(farm.xp) || 0));
    s.player.xp = xpForLevel(lvl);
    if (levelForXp(s.player.xp) !== lvl) s.player.xp = xpForLevel(lvl);
    const country = String(p.startingRegion || farm.region || '');
    if (COUNTRIES[country]?.starter) s.world.startCountry = country;
    s.tutorial = { step: 0, done: false };
  }
  return s;
}
