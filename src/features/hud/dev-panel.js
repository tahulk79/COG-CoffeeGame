// Dev / QA panel (only when dev=true): collapsible 🧪 button bottom-left with dev/* shortcuts.
import { xpForLevel } from '../../core/config/economy.js';
import { h } from './dom.js';
import { T, fmt } from './text.js';

export function createDevPanel(ctx) {
  const grant = payload => () => ctx.act('dev/grant', payload);
  const items = [
    [`+${fmt(1000)} 🪙`, grant({ coins: 1000 })],
    [`+${fmt(10000)} 🪙`, grant({ coins: 10000 })],
    ['+50 🫘', grant({ beans: 50 })],
    [T('hud.dev.level9'), () => {
      const want = xpForLevel(10) - 1 - ctx.store.state.player.xp;
      if (want > 0) ctx.act('dev/grant', { xp: want });
    }],
    ['+100 XP', grant({ xp: 100 })],
    [T('hud.dev.ripen'), () => ctx.act('dev/ripen', {})],
  ];
  const list = h('div', { class: 'hud-dev-list', hidden: true },
    items.map(([label, fn]) => h('button', { type: 'button', class: 'hud-dev-item', on: { click: fn } }, label)));
  const toggle = h('button', { type: 'button', class: 'hud-dev-toggle', attrs: { 'aria-label': T('hud.dev.title'), 'aria-expanded': 'false' },
    on: { click: () => { list.hidden = !list.hidden; toggle.setAttribute('aria-expanded', String(!list.hidden)); } } }, '🧪');
  const el = h('div', { class: 'hud-dev' }, list, toggle);
  return { el, dispose() { el.remove(); } };
}
