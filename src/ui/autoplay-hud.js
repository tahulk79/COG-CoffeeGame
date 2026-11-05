import { t } from '../i18n/index.js';

// Auto mode HUD (docs/design/godbean-gdd.md §8.4): one small button, a pointing hand over what Auto is about to tap,
// and a one-line caption saying what to tap and why, so the player learns the real controls while watching.
export function mountAutoHud({ onToggle }) {
  const button = document.createElement('button');
  button.type = 'button'; button.id = 'autoplay-btn'; button.className = 'ui-btn autoplay-btn';
  button.addEventListener('click', event => { event.stopPropagation(); onToggle(); });
  const hand = document.createElement('div'); hand.className = 'autoplay-hand'; hand.textContent = '👆'; hand.hidden = true; hand.setAttribute('aria-hidden', 'true');
  const caption = document.createElement('p'); caption.className = 'autoplay-caption'; caption.hidden = true; caption.setAttribute('aria-live', 'polite');
  document.body.append(button, hand, caption);
  let pending = null;
  // A modal <dialog> sits in the top layer above everything in <body>: follow it so the hand and Stop stay visible.
  const rehost = () => { const host = document.querySelector('dialog[open]') || document.body; if (button.parentNode !== host) host.append(button, hand, caption); };
  return {
    // runs: free runs left · leftMs: time left in the current run · on: playing now.
    status({ on, runs, leftMs }) {
      rehost();
      const min = Math.floor(leftMs / 60000), sec = String(Math.floor(leftMs / 1000) % 60).padStart(2, '0');
      button.textContent = on ? t('crew.auto.stop', { time: `${min}:${sec}` }) : leftMs > 0 ? t('crew.auto.resume', { time: `${min}:${sec}` }) : runs > 0 ? t('crew.auto.play', { n: runs }) : t('crew.auto.empty');
      button.disabled = !on && leftMs <= 0 && runs <= 0;
      button.dataset.on = String(on);
      if (!on) { hand.hidden = true; caption.hidden = true; }
    },
    // point: screen {x, y} or null; text: caption or null.
    show(point, text) {
      rehost();
      hand.hidden = !point; if (point) { hand.style.left = `${point.x}px`; hand.style.top = `${point.y}px`; }
      caption.hidden = !text; if (text && caption.textContent !== text) caption.textContent = text;
    },
    // Point at a control for `delay` ms, then click it, so the player sees where to press. Returns false if there is no control.
    tap(element, text, delay = 1100) {
      if (!element) return false;
      if (pending?.element !== element) pending = { element, at: performance.now() + delay };
      this.show(this.at(element), text);
      if (performance.now() >= pending.at) { pending = null; element.click(); }
      return true;
    },
    // Heaven re-ask quiz (#caption-box): Auto never answers for you (audit 04/11) — it taps «Để sau» so the question waits for the player.
    quiz() {
      const box = document.getElementById('caption-box');
      // Hội đồng (council-dialogue, F-45) do người chơi tự mở: Auto không bấm hộ, vẫn làm việc phía sau.
      if (!box || box.hidden || !box.classList.contains('lesson-dialogue') || box.classList.contains('council-dialogue')) return false;
      const later = box.querySelector('#dialogue-choices:not([hidden]) .dialogue-later');
      if (later) this.tap(later, t('crew.auto.quiz'), 1800);
      else this.tap(document.getElementById('dialogue-next'), t('crew.auto.quizDone'), 2200);
      return true;
    },
    // Screen point of a DOM control (bench buttons) for the hand.
    at(element) { if (!element) return null; const r = element.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
    dispose() { button.remove(); hand.remove(); caption.remove(); },
  };
}
