// God Bean splash: shown once, when the bean dissolves into the hero's mind at the end of scene 2.
// The screen floods with warm light, the bean and the wordmark rise, then it fades out over the world map.
// showSplash() → { shown: Promise (screen fully covered), close(): Promise (faded out and removed) }
import { t } from '../i18n/index.js';
import './styles/splash.css';
import './styles/skin/story.css';

const FADE_IN_MS = 520, FADE_OUT_MS = 650;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function showSplash() {
  const root = document.createElement('section');
  root.className = 'gb-splash';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', `${t('story.splash.title')} — ${t('story.splash.tagline')}`);
  root.innerHTML = '<div class="gb-splash__glow"></div><div class="gb-splash__mark"><i class="gb-splash__bean" aria-hidden="true"></i><h1 class="gb-splash__title"></h1><p class="gb-splash__tag"></p></div>';
  root.querySelector('.gb-splash__title').textContent = t('story.splash.title');
  root.querySelector('.gb-splash__tag').textContent = t('story.splash.tagline');
  document.body.append(root);
  void root.offsetWidth;
  root.classList.add('is-in');
  const shown = new Promise(resolve => setTimeout(resolve, reduced() ? 0 : FADE_IN_MS));
  let closing = null;
  return {
    shown,
    close() {
      closing ??= new Promise(resolve => {
        root.classList.add('is-out');
        setTimeout(() => { root.remove(); resolve(); }, reduced() ? 0 : FADE_OUT_MS);
      });
      return closing;
    },
  };
}
