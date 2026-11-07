// Scene 2 speech overlay: a short speech bubble at the bottom (tap anywhere to advance) and a small Skip button.
// Two speakers: the Deity (gold) and the hero (green, tail on the right, labelled with the player's name).
// DOM only; the scene/camera live in scene.js.
import { t } from '../../i18n/index.js';
import { sfx } from '../../shared/audio/index.js';
import './teacher.css';

/** Writes `text` into `el`, turning **keyword** into a highlighted <mark> (no innerHTML: text is never parsed as markup). */
export function richText(el, text) {
  el.replaceChildren();
  String(text).split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
    if (!part) return;
    if (i % 2) { const mark = document.createElement('mark'); mark.className = 'tch-key'; mark.textContent = part; el.append(mark); }
    else el.append(document.createTextNode(part));
  });
}

export function createTeacherUi({ onSkip, heroName }) {
  const events = new AbortController(), signal = events.signal;
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const root = el('section', 'tch'); root.setAttribute('aria-label', t('story.label.teacher'));
  const skip = el('button', 'ui-btn ui-btn--plain ui-btn--sm tch-skip', t('story.teacher.skip')); skip.type = 'button';
  const bubble = el('div', 'tch-bubble'); bubble.hidden = true;
  const speaker = el('p', 'tch-speaker', t('story.teacher.name'));
  const text = el('p', 'tch-text'); text.setAttribute('role', 'status'); text.setAttribute('aria-live', 'polite');
  const hint = el('span', 'tch-hint', t('story.teacher.tap'));
  bubble.append(speaker, text, hint);
  root.append(skip, bubble);
  document.body.append(root);

  let advance = null; // resolver of the line currently shown
  skip.addEventListener('click', event => { event.stopPropagation(); skip.disabled = true; onSkip?.(); }, { signal });
  // Tap anywhere (except buttons/dialogs) advances the current line.
  document.addEventListener('pointerup', event => {
    if (!advance || event.target.closest('button, dialog, #game-settings')) return;
    const done = advance; advance = null; sfx('ui.click'); done();
  }, { signal });
  document.addEventListener('keydown', event => {
    if (!advance || !['Enter', 'Space'].includes(event.code) || event.target.closest('button, input, select, textarea, dialog')) return;
    event.preventDefault(); const done = advance; advance = null; done();
  }, { signal });

  function show(line, who = 'god') {
    bubble.hidden = false; hint.hidden = false;
    bubble.classList.toggle('is-hero', who === 'hero');
    speaker.textContent = who === 'hero' ? (heroName || t('story.teacher.hero')) : t('story.teacher.name');
    richText(text, line);
    bubble.classList.remove('is-pop'); void bubble.offsetWidth; bubble.classList.add('is-pop'); // restart the pop animation
  }
  return {
    /** Shows one line; resolves on tap / Enter (or when cancel() is called). */
    line(line, who) { show(line, who); return new Promise(resolve => { advance = resolve; }); },
    /** Resolves a pending line without a tap (skip). */
    cancel() { const done = advance; advance = null; done?.(); },
    hide() { bubble.hidden = true; },
    hideSkip() { skip.hidden = true; },
    dispose() { advance = null; events.abort(); root.remove(); },
  };
}
