// «Quà» sheet: the level gifts waiting for you, opened from the round gift button instead of a screen-wide pop-up.
// Each row has its own «Nhận»; «Nhận hết» takes them all. What came out is told in a toast.
import { h } from './dom.js';
import { T, fmt } from './text.js';
import { actionButton } from './widgets.js';
import { sfx } from '../../shared/audio/index.js';
import { pendingGifts, isChestLevel } from '../../core/derive.js';

const ITEM_ICON = { coins: '🪙', beans: '🫘', hireTicket: '🎟️', autoRun: '🤖' };

export function giftsSheet(ctx) {
  const store = ctx.store;
  function claim(level) {
    const r = store.dispatch('level/claim', { level, roll: Math.random() });
    const ev = r.ok && r.events?.find(e => e.type === 'giftOpened');
    if (!ev) return false;
    sfx(ev.chest ? 'reward.levelup' : 'coin.gain');
    const text = ev.items.map(it => `${ITEM_ICON[it.kind] || '🎁'} ${T(`hud.gift.item.${it.kind}`, { n: fmt(it.amount) })}`).join('  ');
    ctx.toast(`🎁 ${T('hud.gifts.got', { level })}  ${text}`, 'good');
    return true;
  }
  const render = s => {
    const list = pendingGifts(s);
    if (!list.length) return h('p', { class: 'hud-line hud-line--muted' }, T('hud.gifts.none'));
    return h('div', { class: 'hud-gifts' },
      ...list.map(l => h('div', { class: 'hud-gift-row' },
        h('span', { class: 'hud-gift-row-ico', attrs: { 'aria-hidden': 'true' } }, isChestLevel(l) ? '🧰' : '🎁'),
        h('strong', null, T(isChestLevel(l) ? 'hud.gift.chestTitle' : 'hud.gift.title', { level: l })),
        actionButton({ label: T('hud.gift.collect'), tone: 'gold', onClick: () => { if (claim(l)) ctx.rerenderSheet?.(); } }))),
      list.length > 1 ? actionButton({ label: T('hud.gifts.all', { n: list.length }), tone: 'go', onClick: () => { for (const l of [...list]) claim(l); ctx.rerenderSheet?.(); } }) : null);
  };
  render.sig = s => pendingGifts(s).join(',');
  return render;
}
