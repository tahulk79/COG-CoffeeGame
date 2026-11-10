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
  // One box: the whole-screen reveal of the game design. Collect-all stays quick and only says what came out.
  function openOne(level) {
    ctx.modals.gift({ level, chest: isChestLevel(level), autoOpen: true, onOpen: () => {
      const r = store.dispatch('level/claim', { level, roll: Math.random() });
      const ev = r.ok && r.events?.find(e => e.type === 'giftOpened');
      if (!ev) return null;
      sfx(ev.chest ? 'reward.levelup' : 'coin.gain');
      return { items: ev.items, prize: ev.prize };
    } }).then(() => ctx.rerenderSheet?.());
  }
  const render = s => {
    const list = pendingGifts(s);
    if (!list.length) return h('div', { class: 'ui-hero hud-empty-hero' }, h('span', { class: 'ui-ico ui-ico--gift', attrs: { 'aria-hidden': 'true' } }), h('strong', null, T('hud.gifts.none')));
    return h('div', { class: 'hud-gifts' },
      h('div', { class: 'hud-gift-grid' }, ...list.map(l => h('button', { type: 'button', class: `hud-gift-row${isChestLevel(l) ? ' is-chest' : ''}`,
        attrs: { 'aria-label': `${T(isChestLevel(l) ? 'hud.gift.chestTitle' : 'hud.gift.title', { level: l })}: ${T('hud.gift.collect')}` },
        on: { click: () => openOne(l) } },
      h('span', { class: 'hud-gift-row-ico', attrs: { 'aria-hidden': 'true' } }),
      h('strong', null, String(l))))),
      list.length > 1 ? actionButton({ label: T('hud.gifts.all', { n: list.length }), tone: 'go', onClick: () => { for (const l of [...list]) claim(l); ctx.rerenderSheet?.(); } }) : null);
  };
  render.sig = s => pendingGifts(s).join(',');
  return render;
}
