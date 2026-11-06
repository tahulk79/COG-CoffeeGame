// Teacher speech overlay: a short speech bubble at the bottom (tap anywhere to advance), a small Skip button and the
// "Receive N rebirth credits" claim button with a sparkle burst. DOM only; the scene/camera live in scene.js.
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

export function createTeacherUi({ onSkip }) {
  const events = new AbortController(), signal = events.signal;
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const root = el('section', 'tch'); root.setAttribute('aria-label', t('story.label.teacher'));
  const skip = el('button', 'ui-btn ui-btn--plain ui-btn--sm tch-skip', t('story.teacher.skip')); skip.type = 'button';
  const bubble = el('div', 'tch-bubble'); bubble.hidden = true;
  const speaker = el('p', 'tch-speaker', t('story.teacher.name'));
  const text = el('p', 'tch-text'); text.setAttribute('role', 'status'); text.setAttribute('aria-live', 'polite');
  const hint = el('span', 'tch-hint', t('story.teacher.tap'));
  const claimRow = el('div', 'tch-claim'); claimRow.hidden = true;
  bubble.append(speaker, text, claimRow, hint);
  root.append(skip, bubble);
  document.body.append(root);

  let advance = null; // resolver of the line currently shown
  let claimed = null; // resolver of the claim button (skip resolves it too)
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

  function show(line) {
    bubble.hidden = false; claimRow.hidden = true; hint.hidden = false;
    richText(text, line);
    bubble.classList.remove('is-pop'); void bubble.offsetWidth; bubble.classList.add('is-pop'); // restart the pop animation
  }
  return {
    /** Shows one line; resolves on tap / Enter (or when cancel() is called). */
    line(line) { show(line); return new Promise(resolve => { advance = resolve; }); },
    /** Shows the claim button; resolves after the sparkle animation. */
    claim(count) {
      hint.hidden = true; claimRow.hidden = false; claimRow.replaceChildren();
      const button = el('button', 'ui-btn ui-btn--gold ui-btn--lg tch-claim-btn'); button.type = 'button';
      button.append(el('span', 'tch-spark', '✨'), el('span', '', t('story.teacher.claim', { count })));
      claimRow.append(button);
      button.focus({ preventScroll: true });
      return new Promise(resolve => {
        claimed = resolve;
        button.addEventListener('click', event => {
          event.stopPropagation(); button.disabled = true; sfx('reward.levelup');
          const burst = el('div', 'tch-burst'); burst.setAttribute('aria-hidden', 'true');
          burst.append(el('strong', 'tch-burst-count', `✨×${count}`));
          for (let i = 0; i < 9; i++) { const s = el('i', 'tch-burst-spark', '✦'); s.style.setProperty('--a', `${i * 40}deg`); s.style.setProperty('--d', `${(i % 3) * 60}ms`); burst.append(s); }
          root.append(burst);
          richText(text, `**${t('story.teacher.claimed', { count })}**`);
          setTimeout(() => { burst.remove(); claimed = null; resolve(); }, 1300);
        }, { signal, once: true });
      });
    },
    /** A line with no tap hint (e.g. "The gate is opening…"). */
    notice(line) { show(line); hint.hidden = true; skip.hidden = true; },
    /** Resolves a pending line without a tap (skip). */
    cancel() { const done = advance, claim = claimed; advance = claimed = null; done?.(); claim?.(); },
    hide() { bubble.hidden = true; skip.hidden = true; },
    dispose() { advance = claimed = null; events.abort(); root.remove(); },
  };
}
