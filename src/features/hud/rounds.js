// Rounds roadmap (HUD 🚂 button → sheet): the three Rounds as stations on a railway line.
// Only the round being played is told plainly (and never what happens at its end). Later rounds are mystery cards:
// a dark starry panel with a blurred silhouette and a glowing "?", a padlock, a "???" title and a one-line riddle.
// Tapping a locked card wiggles it and teases "not yet…" — curiosity, no spoilers.
import { ROUND_IDS } from '../../core/config/economy.js';
import { regionGame } from '../../core/derive.js';
import { h, reducedMotion } from './dom.js';
import { T } from './text.js';
import { sfx } from '../../shared/audio/index.js';

// Silhouettes shown blurred behind the "?" (a hint, never readable).
const SILHOUETTE = { 2: '🌱☕', 3: '⭐' };

export function roundsSheet(ctx) {
  const tease = (card, n) => {
    sfx('ui.deny');
    ctx.toast(T('hud.rounds.tease', { round: n }), 'info');
    if (reducedMotion()) return;
    card.classList.remove('is-wiggle'); void card.offsetWidth; card.classList.add('is-wiggle');
  };
  return s => {
    const now = s.player.round || 1;
    const game = regionGame(s);
    const stations = ROUND_IDS.map(n => {
      const state = n < now ? 'done' : n === now ? 'current' : 'locked';
      const locked = state === 'locked';
      const art = locked
        ? [h('span', { class: 'hud-rail-ghost' }, SILHOUETTE[n] || '⭐'), h('span', { class: 'hud-rail-q' }, '?')]
        : [n === 1 ? (game === 'cafe' ? '☕' : game === 'farm' ? '🌱' : '🌱☕') : SILHOUETTE[n]];
      const card = h(locked ? 'button' : 'div', {
        class: 'hud-rail-card', ...(locked ? { type: 'button', attrs: { 'aria-label': T('hud.rounds.lockedAria', { round: n }) } } : {}),
      },
      h('div', { class: 'hud-rail-art', attrs: { 'aria-hidden': 'true' } }, ...art, locked ? h('span', { class: 'hud-rail-lock' }, '🔒') : null),
      h('div', { class: 'hud-rail-text' },
        h('span', { class: `hud-rail-tag is-${state}` }, T(`hud.rounds.tag.${state}`)),
        h('strong', { class: 'hud-rail-title' }, locked ? T('hud.rounds.mysteryTitle', { round: n }) : T(`hud.rounds.r${n}.title`)),
        h('span', { class: 'hud-rail-body' }, T(locked ? `hud.rounds.r${n}.riddle` : `hud.rounds.r${n}.body`))));
      if (locked) card.addEventListener('click', () => tease(card, n));
      return h('li', { class: `hud-rail-stop is-${state}`, dataset: { round: String(n) } },
        h('span', { class: 'hud-rail-dot', attrs: { 'aria-hidden': 'true' } }, state === 'current' ? '🚂' : locked ? '🔒' : '✓'),
        card);
    });
    return h('div', { class: 'hud-rounds' },
      h('p', { class: 'hud-sub' }, T('hud.rounds.now', { round: now })),
      h('ol', { class: 'hud-rail', attrs: { 'aria-label': T('hud.rounds.title') } }, stations));
  };
}
