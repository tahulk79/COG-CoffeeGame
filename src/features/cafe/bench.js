import { CROPS } from '../farm/content.js';
import { RECIPES, lockReason, missingFor, stars } from './recipes.js';
import { art } from './art.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const button = (text, onClick, className = '') => { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', onClick); return node; };
const decimals = step => step.max <= 30 ? 1 : 0;
const amount = (value, step) => `${value.toLocaleString('vi-VN', { maximumFractionDigits: decimals(step) })} ${step.unit}`;
// The reading as the player sees it; band cue, sound, ✓/✗ and the result list all judge this value.
const shown = (value, step) => { const k = 10 ** decimals(step); return Math.round(value * k) / k; };
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const middle = step => (step.target[0] + step.target[1]) / 2;
const TOOL_ART = { beans: 'beans', grinder: 'grinder', scoop: 'scoop', kettle: 'kettle', espresso: '', coffee: 'coffee', can: 'can', milk: 'milk', cream: 'cream', salt: 'salt', steamer: 'pitcher', whisk: 'whisk' };
// Technique steps show the real tool being used.
const handArt = text => [[/Nén/, 'tamper'], [/giấy/, 'filter'], [/nắp/, 'lid'], [/đá/i, 'ice'], [/trứng/i, 'egg'], [/bọt/i, 'pitcher']].find(([re]) => re.test(text))?.[1] || 'spoon';
function toolFor(step) {
  if (step.type === 'bean') return 'beans';
  if (step.type === 'pick') return step.text === 'Chọn độ xay' ? 'grinder' : 'hands';
  if (step.unit === '°C') return 'steamer';
  if (step.unit === 'phút') return 'whisk';
  if (step.icon === '☕') return step.text.startsWith('Chiết') ? 'espresso' : 'coffee';
  return { '🫘': 'scoop', '🥫': 'can', '🥛': 'milk', '🍶': 'cream', '🧂': 'salt' }[step.icon] || 'kettle';
}

// Close-up brewing bench inside the cafe dialog; returns a cleanup for the dialog to call on close.
export function mountBench(root, { farm, service, notice, close, openPantry, fx = () => {} }) {
  const events = new AbortController(), signal = events.signal;
  let raf = 0, gauge = null, timer = 0, sound = null, waitSound = null;
  // Stops the pour/steam/whisk/extract loop and the fast-forward loop; called on every step change and on close.
  const hush = () => { sound?.stop(); waitSound?.stop(); sound = waitSound = null; };
  root.addEventListener('keydown', e => {
    if (!gauge || e.code !== 'Space') return;
    e.preventDefault(); if (!e.repeat) gauge.pouring = true;
  }, { signal });
  root.addEventListener('keyup', e => { if (gauge && e.code === 'Space') { e.preventDefault(); gauge.pouring = false; } }, { signal });

  function choose() {
    gauge = null; hush(); root.replaceChildren();
    const cafe = service.refresh().cafe, tickets = service.tickets();
    root.append(el('p', 'cafe-lead', tickets.length ? 'Chọn order để pha. Order đã có ly (✓) có thể bỏ qua.' : 'Chưa có order. Pha luyện tập: ly sẽ lên kệ chờ khách gọi đúng món.'));
    if (service.hand) root.append(el('p', 'cafe-warning', 'Tay bạn đang cầm ly; ly mới sẽ đặt lên kệ.'));
    const grid = el('div', 'cafe-ticket-grid');
    for (const t of tickets) {
      const item = button('', () => start(t.recipe), 'cafe-ticket');
      item.dataset.covered = String(t.covered);
      item.append(el('span', 'cafe-ticket-icon', t.recipe.icon), el('strong', '', t.recipe.name), el('small', '', `${t.label}${t.covered ? ' · ✓ đã có ly' : ''}`));
      const bar = el('i', 'cafe-patience'); bar.style.setProperty('--ratio', t.ratio); item.append(bar);
      grid.append(item);
    }
    if (tickets.length) root.append(grid);
    root.append(el('h3', 'cafe-subhead', 'Pha luyện tập'));
    const practice = el('div', 'cafe-ticket-grid');
    for (const recipe of RECIPES) {
      const reason = lockReason(recipe, cafe), best = cafe.mastery[recipe.id]?.best || 0;
      const item = button('', () => start(recipe), 'cafe-ticket'); item.disabled = Boolean(reason);
      item.append(el('span', 'cafe-ticket-icon', reason ? '🔒' : recipe.icon), el('strong', '', recipe.name), el('small', '', reason || `${starText(stars(best))} · ${recipe.price} xu`));
      practice.append(item);
    }
    root.append(practice);
  }

  function start(recipe) {
    const cafe = service.refresh().cafe;
    const crops = CROPS.filter(c => (cafe.stock.roasted[c.id] || 0) >= recipe.beans);
    const cropId = (crops.find(c => c.id === recipe.bean) || crops[0])?.id || recipe.bean;
    const missing = missingFor(recipe, cafe, cropId);
    if (missing.length) { lacking(recipe, missing); return; }
    const best = cafe.mastery[recipe.id]?.best || 0;
    brew({ recipe, cropId, index: 0, scores: [], notes: [], values: [], memory: false, canMemory: best >= 90, best });
  }

  function lacking(recipe, missing) {
    gauge = null; hush(); root.replaceChildren();
    root.append(el('p', 'cafe-warning', `Chưa đủ nguyên liệu cho ${recipe.name}:`));
    const list = el('ul', 'cafe-missing'); for (const item of missing) list.append(el('li', '', item)); root.append(list);
    root.append(el('p', 'cafe-lead', 'Hạt rang đặt từ nông trại (rẻ, cần thời gian) hoặc nhập ngoài (đắt, có ngay). Sữa, đá, ly… nhập trong kho.'));
    const actions = el('div', 'cafe-actions');
    actions.append(button('🧺 Mở kho nguyên liệu', openPantry, 'cafe-primary'), button('◀ Chọn món khác', choose));
    root.append(actions);
  }

  function brew(state) {
    const { recipe } = state, step = recipe.steps[state.index], tool = toolFor(step);
    gauge = null; cancelAnimationFrame(raf); clearTimeout(timer); hush(); root.replaceChildren();
    const layout = el('div', 'cafe-brew');
    const head = el('div', 'cafe-step-head');
    head.append(el('strong', '', `${recipe.icon} ${recipe.name}`), el('small', '', `Bước ${state.index + 1}/${recipe.steps.length}`));
    if (state.index === 0) head.append(button('◀ Đổi món', choose, 'cafe-link'));
    if (state.canMemory && state.index === 0) {
      const toggle = el('label', 'cafe-memory'), box = el('input'); box.type = 'checkbox'; box.checked = state.memory;
      box.addEventListener('change', () => { state.memory = box.checked; brew(state); });
      toggle.append(box, ' Pha theo trí nhớ (+20% tip)'); head.append(toggle);
    } else if (state.memory) head.append(el('small', 'cafe-memory', '🧠 Pha theo trí nhớ'));
    // Step pills replace the side card so the bench stays one centred column at any width.
    // Numbered dots always fit on one line; the current step's name is the big title below them.
    const stepper = el('ol', 'cafe-stepper');
    recipe.steps.forEach((s, i) => { const li = el('li', '', i < state.index ? '✓' : `${i + 1}`); li.title = s.type === 'bean' ? 'Chọn hạt' : s.text; li.dataset.state = i < state.index ? 'done' : i === state.index ? 'now' : ''; stepper.append(li); });
    const title = el('h3', 'cafe-step-title', step.type === 'bean' ? 'Chọn loại hạt' : step.text);
    const facts = el('div', 'cafe-chips'); facts.hidden = state.memory;
    for (const [key, text] of [['Tỉ lệ', recipe.card.ratio], ['Độ xay', recipe.card.grind], ['Nhiệt độ', recipe.card.temp], ['Thời gian', recipe.card.time]]) { const chip = el('span'); chip.append(el('b', '', key), text); facts.append(chip); }

    // The stage: three columns on a counter — tool | brewer + cup + scale | instrument (thermometer or shot timer).
    const vessel = recipe.gear.v60 ? 'v60' : recipe.gear.espresso ? 'portafilter' : 'phin';
    const stage = el('div', 'cafe-stage'); stage.dataset.tool = tool;
    const scooped = recipe.steps.slice(0, state.index).some(s => toolFor(s) === 'scoop');
    const showBrewer = ['scoop', 'espresso'].includes(tool) || (tool === 'kettle' && vessel !== 'portafilter') || (tool === 'hands' && /Nén|giấy|nắp/i.test(step.text));
    stage.style.setProperty('--bed', scooped ? 1 : 0);
    const row = el('div', 'cafe-stage-row');
    const toolNode = art(tool === 'hands' ? handArt(step.text) : TOOL_ART[tool], 'cafe-tool');
    const vesselNode = el('div', 'cafe-vessel');
    if (tool === 'espresso') vesselNode.append(art('machine', 'cafe-machine'));
    if (showBrewer) vesselNode.append(art(vessel, 'cafe-brewer'));
    const cup = el('div', 'cafe-cup'); cup.dataset.iced = String(Boolean(recipe.uses.ice) && state.index >= recipe.steps.length - 2);
    const fill = el('div', 'cafe-cup-fill'); cup.append(fill);
    const scale = el('div', 'cafe-scale'), scaleRead = el('output'); scale.append(scaleRead);
    scale.hidden = !(step.type === 'pour' && ['g', 'ml'].includes(step.unit));
    vesselNode.append(cup, scale);
    const instrument = el('div', 'cafe-instrument');
    const mercury = el('i'), dial = el('output');
    if (tool === 'steamer') { const thermo = el('div', 'cafe-thermo'); thermo.append(mercury); instrument.append(thermo, el('small', '', '°C')); }
    else if (tool === 'espresso') { const clock = el('div', 'cafe-timer'); clock.append(dial); instrument.append(clock, el('small', '', 'giây chiết')); }
    row.append(toolNode, vesselNode, instrument);
    const stream = el('i', 'cafe-stream'), drips = el('i', 'cafe-drips'), steam = el('div', 'cafe-steam');
    for (let i = 0; i < 3; i++) steam.append(el('i'));
    const pop = el('div', 'cafe-pop'), wait = el('div', 'cafe-wait');
    stage.append(row, stream, drips, steam, pop, wait);
    // The "why" card: the real-world reason for this step, then the feedback after the player acts.
    const learn = el('div', 'cafe-learn'), note = el('p'); learn.append(el('span', '', '💡'), note);
    note.setAttribute('aria-live', 'polite'); note.textContent = state.memory ? 'Pha theo trí nhớ: không có gợi ý.' : step.learn || '';
    const say = (text, tone = '') => { note.textContent = text.replace(/^[✓✗△]\s*/, ''); learn.dataset.tone = tone; learn.firstChild.textContent = tone === 'bad' ? '✗' : tone === 'good' ? '✓' : '💡'; };
    const body = el('div', 'cafe-step-body');
    layout.append(head, stepper, title, facts, stage, learn, body); root.append(layout);

    const layered = recipe.steps.filter(s => s.layer && s.type === 'pour'), total = layered.reduce((sum, s) => sum + middle(s), 0) || 1;
    const drawCup = (live = 0) => {
      fill.replaceChildren();
      recipe.steps.forEach((s, i) => {
        if (!s.layer) return;
        const value = i < state.index ? state.values[i] : i === state.index ? live : 0;
        const height = s.type === 'pour' ? value / total * 78 : i < state.index ? 12 : 0;
        if (height <= 0) return;
        const layer = el('i'); layer.style.background = s.layer; layer.style.height = `${Math.min(85, height)}%`; fill.append(layer);
      });
    };
    drawCup();
    // Plays the step's outcome (pop icon, then the real waiting phase fast-forwarded) before moving on.
    // `inside` (pours only) overrides the score-based verdict so text, tone and result list agree with the gauge.
    const next = (score, text, value = 0, icon = null, inside = null) => {
      // Picks always pop an icon (△ = partly right); a pour without icon outside the band is a miss.
      fx((inside ?? score >= .99) ? 'good' : icon ? 'partial' : 'bad');
      if (state.hinted) score = Math.min(score, .8);
      const ok = inside ?? score >= .99;
      state.scores.push(score); state.values[state.index] = value; state.notes.push({ ok, text });
      state.hinted = false; body.inert = true; say(text, ok ? 'good' : score >= .5 && inside === null ? '' : 'bad');
      if (icon) { pop.textContent = icon; stage.dataset.anim = 'pop'; }
      const advance = () => { hush(); if (++state.index >= recipe.steps.length) finish(state); else brew(state); };
      const afterPop = () => {
        if (!step.wait) { advance(); return; }
        stage.dataset.anim = 'wait'; waitSound = fx('wait'); wait.replaceChildren(el('strong', '', `⏩ ${step.wait[0]}`), el('small', '', `Thực tế ${step.wait[1]} · đang tua nhanh`), el('i'));
        const skip = button('Bỏ qua ⏭', () => { clearTimeout(timer); advance(); }, 'cafe-link'); wait.append(skip); skip.focus({ preventScroll: true });
        timer = setTimeout(advance, 2600);
      };
      timer = setTimeout(afterPop, icon ? 900 : 350);
    };

    if (step.type === 'bean' || step.type === 'pick') {
      const cafe = service.snap.cafe, preferred = CROPS.find(c => c.id === recipe.bean);
      const options = step.type === 'bean'
        ? CROPS.map(c => ({ label: `${c.name} · ${cafe.stock.roasted[c.id] || 0} g`, icon: '🫘', crop: c.id, ok: c.id === recipe.bean ? 1 : .7, disabled: (cafe.stock.roasted[c.id] || 0) < recipe.beans, why: `Món này hợp ${preferred.name} hơn.` }))
        : (state.shuffled ||= step.options.map((o, i) => ({ ...o, grind: tool === 'grinder' ? i : null })).sort(() => Math.random() - .5));
      let missed = false;
      const grid = el('div', 'cafe-options'), buttons = [];
      for (const option of options) {
        const item = button('', () => {
          if (option.ok === 0) { missed = true; item.dataset.wrong = 'true'; item.disabled = true; say(option.why, 'bad'); fx('bad'); stage.dataset.anim = 'shake'; setTimeout(() => { stage.dataset.anim = ''; }, 350); return; }
          if (tool === 'grinder') fx('grind');
          if (option.crop) state.cropId = option.crop;
          if (option.grind !== null && option.grind !== undefined) stage.dataset.grind = String(option.grind);
          state.shuffled = null;
          const score = missed ? .3 : option.ok;
          next(score, `${score >= .99 ? '✓' : '△'} ${option.label}${option.ok < 1 ? ` — ${option.why}` : ''} ${step.learn || ''}`.trim(), 0, option.icon || '✓');
        }, 'cafe-option');
        item.disabled = Boolean(option.disabled);
        if (option.icon) item.append(el('span', '', option.icon));
        item.append(el('b', '', option.label));
        // Grind options show a sample of particle size so the difference is visible, not just named.
        if (tool === 'grinder') { const sample = el('i', 'cafe-grind-sample'); sample.style.setProperty('--size', `${2 + option.grind * 2.2}px`); item.append(sample); }
        buttons.push([item, option]); grid.append(item);
      }
      body.append(grid);
      if (!state.memory) body.append(button('💡 Gợi ý (tối đa 80% điểm bước)', () => {
        state.hinted = true; const [item, option] = buttons.find(([, o]) => o.ok === 1 && !o.disabled) || [];
        if (item) { item.dataset.hint = 'true'; say(`${option.label}: ${option.why}`); }
      }, 'cafe-link'));
      grid.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
      return;
    }

    const from = step.unit === '°C' ? 20 : 0;
    gauge = { value: from, pouring: false, demo: null };
    const meter = el('div', 'cafe-gauge'), band = el('i', 'cafe-gauge-band'), level = el('i', 'cafe-gauge-fill');
    band.style.left = `${step.target[0] / step.max * 100}%`; band.style.width = `${(step.target[1] - step.target[0]) / step.max * 100}%`; band.hidden = state.memory;
    meter.append(band, level);
    const readout = el('output', 'cafe-readout');
    const goal = el('small', '', state.memory ? 'Nhớ lại lượng chuẩn' : `Chuẩn: ${step.target[0]}–${step.target[1]} ${step.unit}`);
    const verb = step.unit === '°C' ? 'đánh nóng' : step.unit === 'phút' ? 'đánh bông' : tool === 'espresso' ? 'chiết' : tool === 'scoop' ? 'xúc bột' : tool === 'salt' ? 'rắc' : 'rót';
    const hold = button(`${step.icon} Giữ để ${verb}`, () => {}, 'cafe-hold');
    const done = button('Xong ✓', () => {
      const [lo, hi] = step.target, value = shown(gauge.value, step), inside = value >= lo && value <= hi;
      const distance = inside ? 0 : value < lo ? lo - value : value - hi, score = inside ? 1 : Math.max(.1, 1 - distance / ((hi - lo) * 1.5));
      gauge = null; cancelAnimationFrame(raf); hush(); stage.dataset.pouring = 'false';
      next(score, inside ? `✓ ${step.text}: ${amount(value, step)} — chuẩn.` : `✗ ${step.text}: ${amount(value, step)}, chuẩn ${lo}–${hi} ${step.unit}. ${step.learn}`, value, null, inside);
    }, 'cafe-primary');
    done.disabled = true;
    hold.addEventListener('pointerdown', e => { if (!gauge || gauge.demo) return; gauge.pouring = true; hold.setPointerCapture(e.pointerId); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) hold.addEventListener(type, () => { if (gauge && !gauge.demo) gauge.pouring = false; });
    const controls = el('div', 'cafe-actions'); controls.append(hold, done);
    if (!state.memory) controls.append(button('👀 Xem mẫu', () => {
      if (!gauge || gauge.demo) return;
      state.hinted = true; gauge.value = from; gauge.demo = { target: middle(step), until: 0 };
      say(`Mẫu: dừng ở khoảng ${amount(middle(step), step)}. ${step.learn}`);
    }, 'cafe-link'));
    // Controls panel: target and live reading on one line, the gauge, then the buttons.
    const reading = el('div', 'cafe-reading'); reading.append(goal, readout);
    body.classList.add('cafe-controls'); body.append(reading, meter, controls);
    hold.focus({ preventScroll: true });
    const rate = (step.max - from) / 2.4;
    let last = performance.now(), zone = '';
    const tick = now => {
      if (!gauge) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const demo = gauge.demo;
      if (demo) {
        // The demo pours to the target, holds briefly, then empties so the player does it themselves.
        if (!demo.until) { gauge.pouring = true; gauge.value = Math.min(demo.target, gauge.value + rate * .7 * dt); if (gauge.value >= demo.target) { demo.until = now + 900; gauge.pouring = false; } }
        else if (now >= demo.until) { gauge.value = from; gauge.demo = null; }
      } else if (gauge.pouring) gauge.value = Math.min(step.max, gauge.value + rate * dt);
      const ratio = (gauge.value - from) / (step.max - from);
      // The sound follows the hand (and the demo); its pitch/flow tracks the reading.
      if (gauge.pouring && !sound) sound = fx('hold', { tool, unit: step.unit });
      else if (!gauge.pouring && sound) { sound.stop(); sound = null; }
      sound?.set({ param: ratio });
      // Band cue only when the guide is shown: in memory mode a tick would give the target away.
      if (!state.memory) {
        const v = shown(gauge.value, step), inZone = v > step.target[1] ? 'over' : v >= step.target[0] ? 'in' : '';
        if (inZone !== zone) {
          if (inZone === 'in' && !zone) fx('band');
          if (inZone === 'over') { fx('over'); stage.dataset.anim = 'shake'; setTimeout(() => { if (stage.dataset.anim === 'shake') stage.dataset.anim = ''; }, 350); }
          zone = inZone;
          if (inZone) meter.dataset.band = inZone; else delete meter.dataset.band;
        }
      }
      level.style.width = `${gauge.value / step.max * 100}%`;
      readout.textContent = tool === 'espresso' ? `${amount(gauge.value, step)} · ⏱ ${Math.round(gauge.value / middle(step) * 27.5)} s` : amount(gauge.value, step);
      scaleRead.textContent = step.unit === 'g' || step.unit === 'ml' ? amount(gauge.value, step) : '';
      mercury.style.height = `${Math.min(100, gauge.value / step.max * 100)}%`;
      dial.textContent = `${Math.round(gauge.value / middle(step) * 27.5)}`;
      if (tool === 'scoop') stage.style.setProperty('--bed', Math.min(1, ratio * 1.6));
      stage.style.setProperty('--progress', ratio.toFixed(3));
      stage.dataset.pouring = String(gauge.pouring);
      stage.dataset.hot = String(step.unit === '°C' && gauge.value > 55);
      done.disabled = gauge.value <= from || Boolean(gauge.demo);
      if (step.layer) drawCup(gauge.value);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function finish(state) {
    const { recipe } = state, score = Math.round(state.scores.reduce((a, b) => a + b, 0) / state.scores.length * 100);
    const result = farm.act('cafe', 'brew', { recipeId: recipe.id, cropId: state.cropId, score });
    if (!result.ok) { notice(result.message, false); lacking(recipe, [result.message]); return; }
    const earned = stars(score), target = service.addDrink({ recipeId: recipe.id, quality: result.quality, stars: earned, memory: state.memory });
    root.replaceChildren();
    const summary = el('div', 'cafe-result'), starRow = el('div', 'cafe-result-stars');
    // Each star is its own span so the CSS reveals them one by one (--i × 250 ms), in step with the chimes.
    [...starText(earned)].forEach((s, i) => { const span = el('span', '', s); span.style.setProperty('--i', i); starRow.append(span); });
    fx('stars', { count: earned });
    summary.append(starRow, el('strong', '', `${recipe.icon} ${recipe.name}`),
      el('p', '', `Tay nghề ${score}/100 · Chất lượng ly ${result.quality}/100`),
      el('p', 'cafe-lead', target ? `Mang ra ${target}.` : 'Chưa có khách gọi món này — ly đặt chờ trên kệ.'));
    if (state.best < 70 && score >= 70) summary.append(el('p', 'cafe-unlock', '🎉 Barista giờ có thể tự pha món này.'));
    if (state.best < 90 && score >= 90) summary.append(el('p', 'cafe-unlock', '🧠 Mở chế độ pha theo trí nhớ: ẩn công thức, thêm 20% tip.'));
    if (summary.querySelector('.cafe-unlock')) fx('unlock');
    const list = el('ul', 'cafe-notes'); for (const n of state.notes) { const li = el('li', '', n.text); li.dataset.ok = String(n.ok); list.append(li); }
    summary.append(el('p', 'cafe-story', recipe.story), list);
    const actions = el('div', 'cafe-actions');
    const carry = button('🚶 Mang ly đi', close, 'cafe-primary');
    actions.append(carry, button('Pha ly khác', choose));
    summary.append(actions); root.append(summary);
    carry.focus({ preventScroll: true });
  }

  const first = service.tickets().find(t => !t.covered);
  if (first) start(first.recipe); else choose();
  return () => { gauge = null; cancelAnimationFrame(raf); clearTimeout(timer); hush(); events.abort(); };
}
