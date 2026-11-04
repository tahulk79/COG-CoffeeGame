// Bong bóng sự cố nhân viên 📱🤒😤 (robot-staff mục 4): phần tử HUD chạm được.
// Khi một <dialog> modal đang mở thì phần ngoài dialog bị inert, nên lớp này được gắn vào dialog đó (host).
// item = { id, type: 'phone'|'sick'|'rude', icon, text, ms?, actions: [{ label, tone?, onClick }] }
export function createIncidentLayer(extraClass = '') {
  const layer = document.createElement('div');
  layer.className = `ui-incidents ${extraClass}`.trim(); layer.hidden = true;
  layer.setAttribute('role', 'status'); layer.setAttribute('aria-live', 'polite');
  document.body.append(layer);
  let key = '';
  function build(item) {
    const bubble = document.createElement('div'); bubble.className = 'ui-incident'; bubble.dataset.type = item.type;
    const icon = document.createElement('span'); icon.className = 'ui-incident__icon'; icon.textContent = item.icon; icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.className = 'ui-incident__text';
    bubble.append(icon, text);
    for (const action of item.actions || []) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = `ui-btn ui-btn--sm ui-btn--${action.tone || 'go'}`; button.textContent = action.label;
      button.addEventListener('click', action.onClick); bubble.append(button);
    }
    // Thanh đếm lùi (chửi khách 3 s); giảm chuyển động thì chỉ còn số giây trong chữ.
    if (item.ms) { const bar = document.createElement('i'); bar.className = 'ui-incident__timer'; bar.style.setProperty('--ms', `${item.ms}ms`); bubble.append(bar); }
    return bubble;
  }
  return {
    render(items, host = document.body) {
      if (layer.parentElement !== host) host.append(layer);
      // Dựng lại chỉ khi bộ bong bóng đổi; chữ (giây còn lại) cập nhật tại chỗ để không nuốt cú chạm đang bấm.
      const next = items.map(item => `${item.id}:${item.type}:${(item.actions || []).map(a => a.label).join('/')}`).join('|');
      if (next !== key) { key = next; layer.replaceChildren(...items.map(build)); }
      items.forEach((item, i) => { const text = layer.children[i]?.querySelector('.ui-incident__text'); if (text && text.textContent !== item.text) text.textContent = item.text; });
      layer.hidden = !items.length;
    },
    remove() { layer.remove(); },
  };
}

export const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`; };
