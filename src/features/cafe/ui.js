import { CROPS } from '../farm/content.js';
import { ASSETS, assetValue, formatMass, upgradePrice } from '../farm/rules.js';
import { CANDIDATES, GEAR, MAX_CREW, RECIPES, STAFF_MAX, STAFF_ROLES, STAFF_STATS, SUPPLIES, TABLE_LEVELS, cafeRank, effectLines, lockReason, recipeById, roleOf, staffStat, staffWage, stars, trainCost } from './recipes.js';
import { mountBench } from './bench.js';
import { openSettings } from '../../ui/settings.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const button = (text, onClick, className = '') => { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', onClick); return node; };
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const stepLine = (step, recipe) => step.type === 'bean' ? `Chọn hạt ${CROPS.find(c => c.id === recipe.bean).name}` : step.type === 'pour' ? `${step.text}: ${step.target[0]}–${step.target[1]} ${step.unit}` : `${step.text}: ${step.options.find(o => o.ok === 1).label}`;

export function createCafeUI({ farm, service, profile, notice, onExit, onOrders, onWalkTable, fx = () => {} }) {
  const events = new AbortController(), signal = events.signal;
  let cleanup = null, view = null;

  // Native <dialog> gives focus trapping and Esc-to-close; the scene treats it as a movement lock.
  // Markup mirrors the farm modal: green ribbon title, round close button, folder tabs, cream panel.
  const dialog = el('dialog', 'ui-modal ui-modal__window'); dialog.id = 'cafe-dialog'; dialog.setAttribute('aria-labelledby', 'cafe-dialog-title');
  const header = el('header'), title = el('h2'), subtitle = el('p', 'cafe-subtitle'), tabs = el('div', 'cafe-tabs'), body = el('div', 'cafe-dialog-body');
  title.id = 'cafe-dialog-title'; tabs.setAttribute('role', 'tablist');
  const closeButton = button('×', () => dialog.close(), 'cafe-close'); closeButton.setAttribute('aria-label', 'Đóng');
  header.append(title, subtitle, closeButton);
  dialog.append(header, tabs, body); document.body.append(dialog);
  // close fires async; skip it if another panel was opened right after closing.
  dialog.addEventListener('close', () => { if (dialog.open) return; fx('close'); cleanup?.(); cleanup = null; view = null; live = null; body.replaceChildren(); }, { signal });

  let live = null;
  // liveKey lets a card (e.g. a table) re-render when what it shows changes, without rebuilding every frame.
  function open(name, { heading, icon, note = '' }, render, liveKey = null) {
    cleanup?.(); cleanup = null; view = name; body.replaceChildren(); tabs.replaceChildren(); tabs.hidden = true;
    title.replaceChildren(el('span', '', icon), heading); subtitle.textContent = note; subtitle.hidden = !note;
    live = liveKey && { render, liveKey, key: liveKey() };
    cleanup = render(body) || null;
    if (!dialog.open) { fx('open'); dialog.showModal(); }
  }
  // Folder tabs above the panel, same as the farm's filters.
  function setTabs(items, current, pick) {
    tabs.hidden = false; tabs.replaceChildren();
    for (const [id, label] of items) {
      const tab = button(label, () => pick(id)); tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(id === current)); tabs.append(tab);
    }
  }
  const act = (action, choice, rerender) => {
    const before = service.refresh().coins, result = farm.act('cafe', action, choice);
    notice(result.message, result.ok); fx('buy', { ok: result.ok, spent: before - service.refresh().coins }); rerender?.(); return result;
  };
  // One list row: icon chip, title + detail, optional action button (farm settings-row look).
  const row = (icon, heading, detail, action, state = null) => {
    const node = el('div', 'cafe-row'), text = el('div');
    text.append(el('strong', '', heading), el('small', '', detail)); node.append(el('span', 'cafe-icon', icon), text);
    if (action) node.append(action);
    if (state) node.dataset.state = state;
    return node;
  };
  const levelDots = (level, max) => '●'.repeat(level) + '○'.repeat(max - level);

  // Same layout as the farm: quest-style card + "today" card under the profile, quick column under coins, wooden bar bottom-right.
  // modal = the tile opens a centred modal, so it gets ui.open instead of the default click.
  const tile = (icon, text, onClick, modal = false) => { const node = button('', onClick, 'ui-hud-btn'); node.append(el('span', '', icon), el('small', '', text)); if (modal) node.dataset.sfx = 'ui.open'; return node; };
  const quest = el('div', 'quest-tracker cafe-quest'), questText = el('div'), name = el('h2'), hint = el('p');
  questText.append(name, hint); quest.append(el('span', 'quest-marker', '☕'), questText);
  const ops = el('div', 'cafe-ops'); ops.setAttribute('aria-live', 'off');
  const opLine = icon => { const line = el('span'); line.append(el('i', '', icon), el('b')); ops.append(line); return line.lastChild; };
  const shiftLine = opLine('⏱'), openLine = opLine('🚪'), seatLine = opLine('🪑'), repLine = opLine('⭐'), handLine = opLine('🖐');
  // Shift timer bar under the shift line: how much of the 4-minute shift is left.
  const shiftBar = el('i', 'cafe-shift-bar'); shiftLine.parentElement.after(shiftBar);
  const leftHud = document.querySelector('.farm-left-hud') || document.body;
  leftHud.append(quest, ops);
  const rail = el('div'); rail.id = 'cafe-rail'; rail.setAttribute('aria-label', 'Order đang chờ'); document.body.append(rail);
  const quick = el('nav'); quick.id = 'cafe-quick-nav'; quick.setAttribute('aria-label', 'Quán');
  const toggle = tile('🚪', 'Mở cửa', () => { const r = service.toggleOpen(); notice(r.message, r.ok); refreshHud(); });
  quick.append(tile('⚙️', 'Cài đặt', () => openSettings(), true), toggle, tile('🌱', 'Nông trại', onExit));
  (document.getElementById('farm-right-hud') || document.body).append(quick);
  const nav = el('nav'); nav.id = 'cafe-main-nav'; nav.setAttribute('aria-label', 'Menu quán');
  nav.append(tile('🧺', 'Kho', () => openPantry(), true), tile('🛠️', 'Nâng cấp', () => openUpgrades(), true), tile('👥', 'Nhân viên', () => openStaff(), true), tile('📦', 'Đơn farm', onOrders, true), tile('📖', 'Công thức', () => openBook(), true));
  document.body.append(nav);

  function refreshHud() {
    const cafe = service.snap.cafe, tickets = service.tickets(), seated = service.customers.filter(c => c.seat).length;
    const seats = Array.from({ length: service.tableCount() }, (_, i) => service.tableLevel(i).seats).reduce((a, b) => a + b, 0);
    name.textContent = `Quán của ${profile.name} ${'★'.repeat(cafeRank(cafe.reputation))}`;
    openLine.textContent = `${cafe.open ? 'Đang mở cửa' : 'Đang đóng cửa'} · Xếp hàng ${service.queueLength()}`;
    seatLine.textContent = `Ghế ${seated}/${seats}${service.dirty.size ? ` · ${service.dirty.size} chỗ cần dọn` : ''}`;
    repLine.textContent = `Uy tín ${Math.round(cafe.reputation)}${service.combo > 1 ? ` · Combo x${service.combo}` : ''}`;
    const shift = service.shift, left = shift ? Math.max(0, shift.endsAt - Date.now()) : 0;
    shiftLine.textContent = shift ? `Ca ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')} · ${shift.served}/${shift.goal} ly · ⭐ ${recipeById(shift.special).name}` : 'Mở cửa để bắt đầu ca (4 phút)';
    shiftBar.hidden = !shift; if (shift) shiftBar.style.setProperty('--ratio', left / (shift.endsAt - shift.startedAt));
    toggle.lastChild.textContent = cafe.open ? 'Đóng cửa' : 'Mở cửa'; toggle.dataset.notification = String(!cafe.open);
    const key = tickets.map(t => `${t.id}:${t.covered}:${t.seconds}`).join('|');
    rail.hidden = !tickets.length;
    if (rail.dataset.key !== key) {
      rail.dataset.key = key; rail.replaceChildren();
      for (const t of tickets.slice(0, 8)) {
        const chip = el('span', 'cafe-chip'); chip.dataset.covered = String(t.covered); chip.dataset.urgent = String(t.ratio < .3);
        chip.title = `${t.label} · ${t.recipe.name} · còn ${t.seconds} giây`; chip.append(el('b', '', t.recipe.icon), el('small', '', `${t.label.replace('Bàn ', 'B')} · ${t.seconds}s`));
        const bar = el('i', 'cafe-patience'); bar.style.setProperty('--ratio', t.ratio); chip.append(bar); rail.append(chip);
      }
    }
    const held = service.hand && RECIPES.find(r => r.id === service.hand.recipeId);
    handLine.textContent = held ? `Đang cầm ${held.name} ${starText(service.hand.stars)}` : service.shelf.length ? `Kệ có ${service.shelf.length} ly chờ mang` : '';
    handLine.parentElement.hidden = !handLine.textContent;
    // One clear next step, in the order a real shift flows.
    const stuck = service.agents.find(a => a.active && a.blocked);
    hint.textContent = !cafe.open && !service.customers.length ? 'Bấm 🚪 Mở cửa để đón khách.'
      : held ? 'Bấm vào bàn của khách (khách mang đi: quầy thu ngân) để giao ly.'
      : service.shelf.length ? 'Ra quầy pha chế lấy ly trên kệ.'
      : stuck ? `${stuck.person.person} chưa thạo ${stuck.blocked.recipe.name}: tự pha mẫu đạt ${stuck.blocked.score} điểm để dạy.`
      : tickets.some(t => !t.covered) ? 'Ra quầy pha chế để pha order.'
      : service.queueLength() ? 'Ra quầy thu ngân nhận order.'
      : service.dirty.size ? 'Bấm bàn có ly bẩn để dọn.' : 'Chờ khách vào quán…';
  }

  function openBench() {
    open('bench', { heading: 'Quầy pha chế', icon: '☕' }, root => mountBench(root, { farm, service, notice, fx, close: () => dialog.close(), openPantry }));
  }

  // Recipe book: list of recipes; picking one shows its full card in the same modal.
  function openBook(selected = null) {
    open('book', { heading: 'Sổ công thức', icon: '📖', note: selected ? '' : 'Tỉ lệ pha thật · luyện tới 3★ để pha theo trí nhớ' }, root => {
      const cafe = service.refresh().cafe, recipe = selected && recipeById(selected);
      if (recipe) {
        const m = cafe.mastery[recipe.id];
        root.append(button('◀ Tất cả công thức', () => openBook(), 'cafe-link'));
        root.append(row(recipe.icon, recipe.name, `${starText(stars(m?.best || 0))} · ${recipe.price} xu · đã pha ${m?.made || 0} ly`));
        const facts = el('dl', 'cafe-facts');
        for (const [key, text] of [['Tỉ lệ', recipe.card.ratio], ['Dụng cụ', recipe.card.tool], ['Độ xay', recipe.card.grind], ['Nhiệt độ', recipe.card.temp], ['Thời gian', recipe.card.time]]) facts.append(el('dt', '', key), el('dd', '', text));
        const steps = el('ol', 'cafe-steps');
        for (const step of recipe.steps) { const li = el('li', '', stepLine(step, recipe)); if (step.learn) li.append(el('small', '', step.learn)); steps.append(li); }
        root.append(facts, steps, el('p', 'cafe-story', recipe.story));
        return;
      }
      const grid = el('div', 'cafe-grid');
      for (const r of RECIPES) {
        const reason = lockReason(r, cafe), m = cafe.mastery[r.id];
        const card = button('', () => openBook(r.id), 'cafe-card'); card.dataset.locked = String(Boolean(reason));
        card.append(el('span', 'cafe-icon', reason ? '🔒' : r.icon), el('strong', '', r.name), el('small', '', reason || `${starText(stars(m?.best || 0))} · ${r.price} xu`));
        grid.append(card);
      }
      root.append(grid);
    });
  }

  let pantryTab = 'beans';
  function openPantry() {
    open('pantry', { heading: 'Kho nguyên liệu', icon: '🧺' }, function render(root) {
      root.replaceChildren();
      setTabs([['beans', '🫘 Hạt rang'], ['supplies', '🥛 Nguyên liệu']], pantryTab, id => { pantryTab = id; render(root); });
      const p = service.refresh(), cafe = p.cafe, rerender = () => render(root);
      if (pantryTab === 'beans') {
        const pending = p.orders.filter(o => o.source !== 'shop' && ['open', 'transit'].includes(o.status)).length;
        const coming = cafe.shipments.reduce((s, t) => s + t.lots.reduce((n, l) => n + l.grams, 0), 0);
        root.append(el('p', 'cafe-note', `Đặt hạt từ nông trại (rẻ, chờ farm rang & giao) · ${pending} đơn đang làm${coming ? ` · ${formatMass(coming)} đang giao tới` : ''}`));
        for (const crop of CROPS) {
          const grams = cafe.stock.roasted[crop.id] || 0, unlocked = crop.level <= farm.level;
          const order = button('Đặt farm 252 g', () => act('order', crop.id, rerender)); order.disabled = !unlocked;
          root.append(row('🫘', `${crop.name} · ${formatMass(grams)}`, unlocked ? `Đủ khoảng ${Math.floor(grams / 18)} ly` : `Mở ở nông trại cấp ${crop.level}`, order, grams < 60 && unlocked ? 'low' : null));
        }
        const supplier = button('50 xu', () => act('supply', null, rerender)); supplier.disabled = p.coins < 50;
        root.append(row('📦', 'Nhập hạt ngoài 500 g', 'Có ngay nhưng đắt, chất lượng thường.', supplier));
        return;
      }
      for (const s of SUPPLIES) {
        const buy = button(`${s.price} xu`, () => act('buy', s.id, rerender)); buy.disabled = p.coins < s.price;
        root.append(row(s.icon, `${s.name} · ${cafe.supplies[s.id].toLocaleString('vi-VN')} ${s.unit}`, `Nhập ${s.packLabel}`, buy, cafe.supplies[s.id] < s.pack / 5 ? 'low' : null));
      }
    });
  }

  let upgradeTab = 'tables';
  function openUpgrades(tab = null) {
    if (tab) upgradeTab = tab;
    open('upgrades', { heading: 'Nâng cấp quán', icon: '🛠️' }, function render(root) {
      root.replaceChildren();
      setTabs([['tables', '🪑 Bàn ghế'], ['gear', '⚙️ Pha chế'], ['auto', '🤖 Tự động']], upgradeTab, id => { upgradeTab = id; render(root); });
      const p = service.refresh(), cafe = p.cafe, rerender = () => render(root);
      if (upgradeTab === 'tables') {
        const asset = ASSETS.find(a => a.id === 'cafe'), lv = p.upgrades.cafe, price = upgradePrice('cafe', lv), maxed = lv >= 10;
        const buyTables = button(maxed ? 'Tối đa' : `${price} xu`, () => act('upgrade', null, rerender));
        buyTables.disabled = maxed || p.coins < price || farm.level < lv + 1;
        root.append(row('🪑', `Mở thêm bàn · ${assetValue(asset, lv)}/10 bàn`, maxed ? 'Đã mở đủ bàn' : `Cấp ${lv + 1}: ${assetValue(asset, lv + 1)} bàn${farm.level < lv + 1 ? ` · cần nông trại cấp ${lv + 1}` : ''}`, buyTables));
        root.append(el('p', 'cafe-note', 'Bấm vào từng bàn để nâng cấp bàn đó:'));
        for (let i = 0; i < service.tableCount(); i++) {
          const level = cafe.tables[i], info = TABLE_LEVELS[level - 1];
          root.append(row(['🪵', '🪑', '🛋️', '🛋️'][level - 1], `Bàn ${i + 1} · ${info.name}`, `${levelDots(level, TABLE_LEVELS.length)} · ${info.seats} ghế`, button('Nâng cấp', () => openTable(i, 'upgrade'))));
        }
        return;
      }
      if (upgradeTab === 'auto') root.append(el('p', 'cafe-note', 'Mỗi thiết bị lắp vào một ô cố định trên quầy (khung trống trong quán), lối đi không đổi.'));
      for (const gear of GEAR.filter(g => (g.group === 'auto') === (upgradeTab === 'auto'))) {
        const level = cafe.gear[gear.id], max = gear.prices.length, cost = gear.prices[level];
        const buy = button(level >= max ? 'Tối đa' : `${cost} xu`, () => act('gear', gear.id, rerender));
        buy.disabled = level >= max || p.coins < cost;
        root.append(row(gear.icon, `${gear.name} · ${level ? levelDots(level, max) : 'chưa có'}`, gear.detail, buy));
      }
    });
  }

  // Table card: who sits there and what they wait for, used cups, and the table's own upgrade path.
  function openTable(table, tab = 'seats') {
    tableTab = tab;
    open('table', { heading: `Bàn ${table + 1}`, icon: '🪑' }, function render(root) {
      root.replaceChildren();
      const p = service.refresh(), cafe = p.cafe, unlocked = table < service.tableCount(), rerender = () => render(root);
      if (!unlocked) {
        const asset = ASSETS.find(a => a.id === 'cafe'), lv = p.upgrades.cafe, price = upgradePrice('cafe', lv), next = table === service.tableCount();
        root.append(row('🔒', 'Bàn chưa mở', next ? `Mở ở nâng cấp Bàn ghế cấp ${lv + 1} (${assetValue(asset, lv + 1)} bàn)${farm.level < lv + 1 ? ` · cần nông trại cấp ${lv + 1}` : ''}` : 'Mở các bàn gần quầy trước.'));
        if (next) {
          const buy = button(`🪑 Mở bàn · ${price} xu`, () => act('upgrade', null, rerender), 'cafe-primary');
          buy.disabled = lv >= 10 || p.coins < price || farm.level < lv + 1;
          const actions = el('div', 'cafe-actions'); actions.append(buy); root.append(actions);
        }
        return;
      }
      setTabs([['seats', '👥 Khách'], ['upgrade', '⬆️ Nâng cấp']], tableTab, id => { tableTab = id; render(root); });
      const level = cafe.tables[table], info = TABLE_LEVELS[level - 1], guests = service.guestsAt(table);
      if (tableTab === 'seats') {
        const dirty = [0, 1, 2, 3].filter(slot => service.dirty.has(`${table}:${slot}`)).length;
        const servable = service.hand && guests.some(c => c.recipeId === service.hand.recipeId && ['seated', 'toSeat'].includes(c.phase));
        if (servable || dirty) { const actions = el('div', 'cafe-actions'); actions.append(button(servable ? '🚶 Mang ly tới bàn' : `🧽 Tới dọn bàn (${dirty} chỗ)`, () => { dialog.close(); onWalkTable(table); }, 'cafe-primary')); root.append(actions); }
        for (let slot = 0; slot < info.seats; slot++) {
          const guest = guests.find(c => c.seat.slot === slot), recipe = guest?.recipeId && recipeById(guest.recipeId);
          const state = !guest ? (service.dirty.has(`${table}:${slot}`) ? ['🧽', 'Ly bẩn', 'Dọn để khách mới ngồi được.', 'low'] : ['💺', 'Ghế trống', 'Sẵn sàng đón khách.'])
            : guest.phase === 'drinking' ? [guest.mood || '😊', `Đang uống ${recipe.name}`, 'Uống xong khách về, để lại ly cần dọn.']
            : [recipe.icon, `Chờ ${recipe.name}`, `Kiên nhẫn còn ${Math.max(0, Math.ceil(guest.patience))} giây${service.hand?.recipeId === recipe.id ? ' · bạn đang cầm đúng ly' : ''}`];
          root.append(row(state[0], `Ghế ${slot + 1} · ${state[1]}`, state[2], null, state[3]));
        }
        return;
      }
      TABLE_LEVELS.forEach((item, i) => {
        const owned = i < level, nextOne = i === level;
        const buy = nextOne ? button(`${item.price} xu`, () => act('table', table, rerender)) : null;
        if (buy) buy.disabled = p.coins < item.price;
        root.append(row(['🪵', '🪑', '🛋️', '💐'][i], `${item.name}${owned ? ' ✓' : ''}`, item.detail, buy, owned ? 'owned' : null));
      });
    }, () => JSON.stringify([tableTab, service.guestsAt(table).map(c => [c.seat?.slot, c.phase, c.recipeId, Math.ceil(c.patience / 10)]), [...service.dirty].filter(k => k.startsWith(`${table}:`)), service.hand?.recipeId, service.tableCount()]));
  }
  let tableTab = 'seats';

  // Same shape as the farm staff screen: team / recruit tabs, a roster of people, the selected person's sheet with stat bars.
  let staffTab = 'team', staffFocus = null;
  function openStaff(focus = null) {
    if (focus) { staffFocus = focus; staffTab = service.snap.cafe.crew.some(m => m.id === focus) ? 'team' : 'hire'; }
    open('staff', { heading: 'Nhân viên quán', icon: '👥' }, function render(root) {
      root.replaceChildren();
      const p = service.refresh(), cafe = p.cafe, rerender = () => render(root);
      const counts = Object.fromEntries(STAFF_ROLES.map(r => [r.id, cafe.crew.filter(m => roleOf(m.id).id === r.id).length]));
      setTabs([['team', `👥 Đội quán (${cafe.crew.length}/${MAX_CREW})`], ['hire', '🤝 Tuyển dụng']], staffTab, id => { staffTab = id; staffFocus = null; rerender(); });
      const people = staffTab === 'team' ? cafe.crew.map(m => CANDIDATES.find(c => c.id === m.id)) : CANDIDATES.filter(c => !cafe.crew.some(m => m.id === c.id));
      if (staffTab === 'team') root.append(el('p', 'cafe-note', `Mỗi người một việc, tự nhận việc gần và gấp nhất. ${STAFF_ROLES.map(r => `${r.icon} ${counts[r.id]}/${r.max}`).join(' · ')}`));
      if (!people.length) { root.append(el('p', 'cafe-note', staffTab === 'team' ? 'Chưa có nhân viên. Mở tab Tuyển dụng để thuê người đầu tiên.' : 'Đã thuê hết ứng viên.')); return; }
      if (!people.some(c => c.id === staffFocus)) staffFocus = people[0].id;
      const roster = el('div', 'cafe-roster');
      for (const c of people) {
        const member = cafe.crew.find(m => m.id === c.id), role = roleOf(c.id);
        const tile = button('', () => { staffFocus = c.id; rerender(); }, 'cafe-roster-tab');
        tile.setAttribute('aria-pressed', String(c.id === staffFocus));
        tile.dataset.state = !member ? 'candidate' : member.paidUntil > Date.now() ? 'working' : 'idle';
        tile.append(el('span', 'cafe-roster-avatar', c.avatar), el('strong', '', c.person), el('small', '', `${role.icon} ${role.name}${member ? ` · Cấp ${member.level}` : ''}`));
        roster.append(tile);
      }
      root.append(roster);

      const person = CANDIDATES.find(c => c.id === staffFocus), role = roleOf(person.id), member = cafe.crew.find(m => m.id === person.id);
      const level = member?.level || 1, active = member?.paidUntil > Date.now(), maxed = level >= STAFF_MAX;
      const sheet = el('section', 'cafe-staff-sheet');
      const head = el('div', 'cafe-staff-head'), title = el('div');
      title.append(el('strong', '', `${person.person} · ${role.name}`), el('small', '', member ? (active ? `🟢 Đang trong ca · còn ${Math.ceil((member.paidUntil - Date.now()) / 1000)}s` : '🟠 Hết ca · tự trả lương khi quán mở và đủ xu') : `⚪ Ứng viên · ${role.name} ${counts[role.id]}/${role.max}`));
      head.append(el('span', 'cafe-staff-avatar', person.avatar), title, el('b', 'cafe-staff-level', `Cấp ${level}/${STAFF_MAX}`));
      sheet.append(head);
      if (!member) sheet.append(el('p', 'cafe-staff-bio', `“${person.bio}”`));
      sheet.append(el('p', 'cafe-staff-summary', `${role.detail} · ${member ? 'Lương' : 'Phí thuê = lương ngày đầu'} ${staffWage(role, level)} xu/ngày chơi (60 giây)${maxed ? '' : ` · cấp ${level + 1}: ${staffWage(role, level + 1)} xu/ngày`}`));
      // Training adds +6 to every stat; the green number previews the next level.
      for (const [key, label] of STAFF_STATS) {
        const value = staffStat(person, level, key), next = staffStat(person, level + 1, key);
        const line = el('div', 'cafe-stat'), meter = el('meter'); meter.min = 0; meter.max = 100; meter.value = value; meter.setAttribute('aria-label', label);
        line.append(el('span', '', label), meter, el('b', '', String(value)), el('i', '', !maxed && next > value ? `→ ${next}` : ''));
        sheet.append(line);
      }
      const effects = el('div', 'cafe-effects');
      effects.append(el('strong', '', 'Hiệu quả công việc'));
      const now = effectLines(person, level), later = maxed ? null : effectLines(person, level + 1);
      now.forEach(([stat, text], i) => { const item = el('p'); item.append(el('span', '', stat), el('b', '', text)); if (later) item.append(el('i', '', `→ ${later[i][1]}`)); effects.append(item); });
      sheet.append(effects);
      const actions = el('div', 'cafe-actions');
      if (!member) {
        const full = cafe.crew.length >= MAX_CREW || counts[role.id] >= role.max;
        const hire = button(full ? (cafe.crew.length >= MAX_CREW ? `Đã đủ ${MAX_CREW} người` : `Đã đủ ${role.max} ${role.name.toLowerCase()}`) : `🤝 Thuê ${person.person} · ${staffWage(role, 1)} xu`, () => act('hire', person.id, () => { staffTab = 'team'; rerender(); }), 'cafe-primary');
        hire.disabled = full || p.coins < staffWage(role, 1); actions.append(hire);
      } else {
        if (!active) { const pay = button(`💵 Trả lương ca mới · ${staffWage(role, level)} xu`, () => act('hire', person.id, rerender), 'cafe-primary'); pay.disabled = p.coins < staffWage(role, level); actions.append(pay); }
        if (!maxed) { const train = button(`🎓 Đào tạo lên cấp ${level + 1} · ${trainCost(level)} xu`, () => act('train', person.id, rerender), 'cafe-primary'); train.disabled = p.coins < trainCost(level); actions.append(train); }
        actions.append(button('Cho nghỉ', () => act('fire', person.id, rerender)));
      }
      sheet.append(actions);
      root.append(sheet);
    });
  }

  // End-of-shift report: what went well, the reward, and a one-tap next shift.
  function showShiftReport(r) {
    open('shift', { heading: r.met ? 'Hoàn thành ca!' : 'Hết ca', icon: r.met ? '🏆' : '⏱' }, root => {
      root.append(row('☕', `Phục vụ ${r.served}/${r.goal} ly`, `Trung bình ${r.avg.toFixed(1)}★ · khách bỏ về ${r.lost}`, null, r.met ? 'owned' : null));
      root.append(row('🪙', `Doanh thu ca ${Math.round(r.revenue * 100) / 100} xu`, r.met ? `Thưởng hoàn thành ca +${r.bonus} xu · Uy tín +3` : 'Chưa đạt mục tiêu · Uy tín −1'));
      root.append(row(recipeById(r.special).icon, `Món của ca: ${recipeById(r.special).name}`, 'Món của ca được gọi nhiều hơn và bán đắt hơn 30%.'));
      const actions = el('div', 'cafe-actions');
      actions.append(button('🚪 Mở ca mới', () => { dialog.close(); const res = service.toggleOpen(); notice(res.message, res.ok); refreshHud(); }, 'cafe-primary'), button('Nghỉ một lát', () => dialog.close()));
      root.append(actions);
    });
  }

  refreshHud();
  return {
    get open() { return dialog.open; }, get view() { return view; },
    tick() { if (!dialog.open || !live) return; const next = live.liveKey(); if (next !== live.key) { live.key = next; live.render(body); } },
    refreshHud, openBench, openBook, openPantry, openUpgrades, openStaff, openTable, showShiftReport,
    dispose() { events.abort(); if (dialog.open) dialog.close(); for (const node of [dialog, quest, ops, rail, quick, nav]) node.remove(); },
  };
}
