// Optional art for the farm HUD (docs/design/farm-ui-bigupdate.md §3). Drop a PNG at public/assets/farm/<path> and it is
// used; with no file the built-in emoji / CSS look stays. The probe is an <img> (never a fetch: the dev server answers
// missing paths with index.html), cached per path, so every slot costs one request at most.
const cache = new Map();
const base = () => `${import.meta.env?.BASE_URL || '/'}assets/farm/`;
export function farmImageUrl(path) {
  if (!cache.has(path)) {
    cache.set(path, new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0 ? img.src : null);
      img.onerror = () => resolve(null);
      img.src = base() + path;
    }));
  }
  return cache.get(path);
}
/** Replaces the content of `el` with the image when public/assets/farm/<path> exists (adds class `has-art`). */
export function useFarmArt(el, path) {
  farmImageUrl(path).then(url => {
    if (!url || !el.isConnected && !el.parentNode) return;
    const img = Object.assign(document.createElement('img'), { src: url, alt: '', draggable: false });
    img.className = 'hud-art';
    el.classList.add('has-art');
    el.replaceChildren(img);
  });
}
