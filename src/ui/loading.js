// The one loading screen (#loading in index.html), in the play HUD's look: a cream card with a green progress bar, the
// player's own character (male / female model, as a sprite) running on it and picking up 🫘 beans, a status line, a percent pill and a tip.
// Every scene change uses it.
// Progress set by the game jumps (20 → 40 → 85…); the bar eases towards it and creeps a little while a step takes long,
// so the runner never stands still. It never runs past the real value by more than CREEP_MAX (and never reaches 100
// on its own). Hiding fades the screen out.
import { t } from '../i18n/index.js';

const $ = id => document.getElementById(id);
// Real advice from the game's own rules, shown while a scene loads.
const TIPS = t('loading.tips');
const BEANS = 9;           // beans lying on the road
const CREEP = 1.6;         // %/s the bar creeps while waiting for the next real step
const CREEP_MAX = 7;       // never more than this ahead of the real progress
const FADE_MS = 350;       // matches .loading-screen transition

let target = 0;            // real progress (0–100)
let shown = 0;             // displayed progress
let creep = 0;
let raf = 0, last = 0;
let leaveTimer = 0;
let beans = null;

function ensureBeans() {
  if (beans) return beans;
  const host = $('load-beans');
  beans = [];
  if (!host) return beans;
  for (let i = 0; i < BEANS; i++) {
    const at = 8 + i * (86 / (BEANS - 1)); // 8 % … 94 %
    const el = document.createElement('i');
    el.className = 'ld-bean';
    el.textContent = '🫘';
    el.style.left = `${at}%`;
    host.append(el);
    beans.push({ el, at, got: false });
  }
  return beans;
}

function render() {
  const root = $('loading');
  if (!root) return;
  root.style.setProperty('--p', shown.toFixed(2));
  const pct = $('load-pct');
  if (pct) pct.textContent = `${Math.round(shown)}%`;
  for (const b of ensureBeans()) {
    const got = shown >= b.at;
    if (got !== b.got) { b.got = got; b.el.classList.toggle('got', got); }
  }
}

function frame(time) {
  raf = 0;
  if ($('loading')?.hidden) return;
  const dt = last ? Math.min(.1, (time - last) / 1000) : 0;
  last = time;
  if (target < 100) creep = Math.min(CREEP_MAX, creep + CREEP * dt);
  const goal = Math.min(target < 100 ? 99 : 100, target + (target < 100 ? creep : 0));
  shown += (goal - shown) * Math.min(1, dt * 5);
  if (Math.abs(goal - shown) < .05) shown = goal;
  render();
  raf = requestAnimationFrame(frame);
}
function run() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }

export function loading(value, label) {
  const v = Math.max(0, Math.min(100, Math.round(value) || 0));
  if (v < target) { shown = v; for (const b of ensureBeans()) { b.got = false; b.el.classList.remove('got'); } } // a new load starts over
  target = v;
  creep = 0;
  $('load-track')?.setAttribute('aria-valuenow', v);
  const status = $('load-status');
  if (status && label != null) status.textContent = label;
  if (v <= 45) $('load-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; // new tip when a scene starts loading
  render();
  run();
}

/** The runner is the player's own character: the female or male model's run cycle. */
export function setLoadingRunner(gender) {
  const root = $('loading');
  if (root) root.dataset.gender = gender === 'male' ? 'male' : 'female';
}

export const showLoading = (value, label) => {
  const root = $('loading');
  clearTimeout(leaveTimer);
  root.classList.remove('is-leaving');
  if (root.hidden) { root.hidden = false; shown = 0; target = 0; } // fresh screen: the runner starts at the left
  loading(value, label);
};

export const hideLoading = () => {
  const root = $('loading');
  if (root.hidden || root.classList.contains('is-leaving')) return;
  target = 100; shown = 100; render(); // finish the run, then fade over the scene
  root.classList.add('is-leaving');
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => { root.hidden = true; root.classList.remove('is-leaving'); cancelAnimationFrame(raf); raf = 0; }, FADE_MS);
};
