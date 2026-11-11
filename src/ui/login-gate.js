// Google login gate (founder 2026-11-11): after the Level-10 incident the player must sign in with Google to go on,
// so the real game (round after the apprenticeship) is tied to an account. Blocking: no close button.
// requireGoogleLogin() resolves once the player is signed in (at once when a session is already on this device).
// On an origin the server does not accept (localhost, preview), Google and the API cannot answer, so a dev skip is offered.
import { t, getLang } from '../i18n/index.js';
import { REMOTE_OK, GOOGLE_OK, DEV_BUILD, isLoggedIn, hasStoredSession, restoreSession, renderGoogleButton } from '../shared/godbean/client.js';
import { log } from '../shared/godbean/telemetry.js';
import './styles/login-gate.css';

let open = null;

/** Session already on this device (or restored): true. Never signed in / token dead: false. Offline with a stored session: true. */
export async function hasAccount() {
  if (isLoggedIn()) return true;
  if (!hasStoredSession()) return false;
  try { return !!(await restoreSession()); } catch { return true; } // offline: they did sign in here; the server will check later
}

/** onShow: called right before the gate appears (the boot screen hides everything else until told otherwise). */
export function requireGoogleLogin({ reason = 'level10', onShow } = {}) {
  if (isLoggedIn()) return Promise.resolve();
  open ??= show(reason, onShow).finally(() => { open = null; });
  return open;
}

async function show(reason, onShow) {
  if (await hasAccount()) return;
  try { onShow?.(); } catch { /* the gate still shows */ }
  log('login_gate_shown', { reason, remote: REMOTE_OK });
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'ui-modal ui-modal--sm gb-login';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'gb-login-title');
    root.innerHTML = `
      <div class="ui-modal__window">
        <header class="ui-modal__head"><h2 class="ui-modal__title" id="gb-login-title"></h2></header>
        <div class="ui-modal__body">
          <div class="gb-login__icon" aria-hidden="true">☁️</div>
          <p class="gb-login__text"></p>
          <ul class="gb-login__perks"></ul>
          <div class="gb-login__google" aria-live="polite"></div>
          <p class="gb-login__status" role="status" hidden></p>
          <div class="gb-login__actions"></div>
        </div>
      </div>`;
    const $ = sel => root.querySelector(sel);
    $('.gb-login__icon').textContent = '🫘';
    $('#gb-login-title').textContent = t('story.login.title');
    $('.gb-login__text').textContent = t('story.login.body');
    for (const k of ['perk1', 'perk2', 'perk3']) { const li = document.createElement('li'); li.textContent = t(`story.login.${k}`); $('.gb-login__perks').append(li); }
    const status = $('.gb-login__status'), slot = $('.gb-login__google'), actions = $('.gb-login__actions');
    const say = (text, bad = false) => { status.hidden = !text; status.textContent = text || ''; status.classList.toggle('is-bad', bad); };
    const button = (label, style, run) => { const b = document.createElement('button'); b.type = 'button'; b.className = `ui-btn ${style}`; b.textContent = label; b.addEventListener('click', run); actions.append(b); return b; };

    // Keys / clicks must not reach the game under the gate.
    const stop = e => e.stopPropagation();
    const trap = ['keydown', 'keyup'];
    for (const type of trap) window.addEventListener(type, stop, true);

    const done = (how, data) => {
      log('login_done', { how, is_new: !!data?.is_new });
      for (const type of trap) window.removeEventListener(type, stop, true);
      root.classList.add('is-out');
      setTimeout(() => root.remove(), 200);
      resolve();
    };
    const failed = e => {
      log('login_failed', { code: e?.code ?? null, status: e?.status ?? null, msg: String(e?.message ?? e).slice(0, 200) }, 'warn');
      say(e?.code === 'gsi_load' || !e?.status ? t('story.login.offline') : e.status === 429 ? t('story.login.busy') : t('story.login.error'), true);
      retry.hidden = false;
    };
    const mount = async () => {
      retry.hidden = true; say(t('story.login.loading'));
      slot.replaceChildren();
      try {
        await renderGoogleButton(slot, {
          locale: getLang(), width: Math.min(300, slot.clientWidth || 300),
          onDone: data => { say(t('story.login.ok')); done('google', data); },
          onError: failed,
        });
        say('');
      } catch (e) { failed(e); }
    };
    const retry = button(t('story.login.retry'), 'ui-btn--plain', mount);
    retry.hidden = true;
    if (!GOOGLE_OK || DEV_BUILD) {
      // An origin Google does not know (origin_mismatch), or a dev build: a test skip so play can go on.
      if (!GOOGLE_OK) { const note = document.createElement('p'); note.className = 'gb-login__dev'; note.textContent = t('story.login.devNote'); actions.before(note); }
      button(t('story.login.devSkip'), 'ui-btn--gold', () => done('dev_skip'));
    }
    document.body.append(root);
    mount();
  });
}
