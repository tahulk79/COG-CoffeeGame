// Tiny DOM builder for the HUD (no framework). h('button', { class, text, on: { click }, attrs, dataset, style }, ...children)
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'on') for (const [type, fn] of Object.entries(value)) el.addEventListener(type, fn);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style') for (const [name, v] of Object.entries(value)) el.style.setProperty(name, v);
    else if (key === 'attrs') for (const [name, v] of Object.entries(value)) { if (v != null && v !== false) el.setAttribute(name, v === true ? '' : v); }
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child instanceof Node ? child : String(child));
  }
}
/** Sets textContent only when it changed (keeps per-frame updates free of DOM churn). */
export function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Small scale bump (Web Animations, no class toggling → no forced reflow). */
export function bump(el, scale = 1.15) {
  if (!el || reducedMotion() || typeof el.animate !== 'function') return;
  el.animate([{ transform: 'scale(1)' }, { transform: `scale(${scale})` }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' });
}
