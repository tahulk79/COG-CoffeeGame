// The game's own guide: the God Bean, a smiling coffee bean with a sprout. Original vector art, static trusted markup.
import { h } from './dom.js';

const BEAN_SVG = '<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">'
  + '<path d="M32 15c-1-5 0-9 3-12" fill="none" stroke="#3f8f2a" stroke-width="3.5" stroke-linecap="round"/>'
  + '<path d="M34 8c5-6 13-6 17-3-3 6-11 9-17 3z" fill="#6cc52e"/><path d="M33 10c-5-5-12-5-16-2 3 6 10 8 16 2z" fill="#4faa22"/>'
  + '<ellipse cx="32" cy="37" rx="21" ry="24" fill="#6e3f1d"/><ellipse cx="26" cy="29" rx="12" ry="14" fill="#8a5630"/>'
  + '<path d="M33 13.500c-3.500 4-1 7-2.500 10.500M32 52c2-2 1.500-4 3-6" fill="none" stroke="#472710" stroke-width="3" stroke-linecap="round"/>'
  + '<ellipse cx="24" cy="34" rx="5.500" ry="6.500" fill="#fff"/><ellipse cx="41" cy="34" rx="5.500" ry="6.500" fill="#fff"/>'
  + '<circle cx="25" cy="35" r="3.200" fill="#2b170a"/><circle cx="40" cy="35" r="3.200" fill="#2b170a"/><circle cx="26.200" cy="33.600" r="1.100" fill="#fff"/><circle cx="41.200" cy="33.600" r="1.100" fill="#fff"/>'
  + '<ellipse cx="18" cy="43" rx="4" ry="2.600" fill="#e8795a" opacity=".75"/><ellipse cx="47" cy="43" rx="4" ry="2.600" fill="#e8795a" opacity=".75"/>'
  + '<path d="M26 44c3 5 10 5 13 0-4 1.500-9 1.500-13 0z" fill="#fff" stroke="#2b170a" stroke-width="1.800" stroke-linejoin="round"/></svg>';

/** The bean's face, sized by the box it is placed in (CSS). */
export function mascot(cls = '') {
  const el = h('span', { class: `hud-mascot${cls ? ` ${cls}` : ''}`, attrs: { 'aria-hidden': 'true' } });
  el.innerHTML = BEAN_SVG;
  return el;
}
