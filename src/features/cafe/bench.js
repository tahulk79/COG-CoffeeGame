import { CROPS } from '../farm/content.js';
import { AUTO_BREW_COST, QUICK_MS, RECIPES, lockReason, missingFor, quickScore, stars } from './recipes.js';
import { art } from './art.js';
import { t, formatNumber } from '../../i18n/index.js';

const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
const button = (text, onClick, className = '') => { const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', onClick); return node; };
const decimals = step => step.max <= 30 ? 1 : 0;
const amount = (value, step) => `${formatNumber(value, { maximumFractionDigits: decimals(step) })} ${step.unit}`;
// The reading as the player sees it; band cue, sound, ✓/✗ and the result list all judge this value.
const shown = (value, step) => { const k = 10 ** decimals(step); return Math.round(value * k) / k; };
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const middle = step => (step.target[0] + step.target[1]) / 2;
const TOOL_ART = { matcha: 'matcha', heat: 'kettle', beans: 'beans', grinder: 'grinder', scoop: 'scoop', kettle: 'kettle', espresso: '', coffee: 'coffee', can: 'can', milk: 'milk', cream: 'cream', salt: 'salt', steamer: 'pitcher', whisk: 'whisk' };
// Technique steps show the real tool being used. Judged by the options' icons, not the step text, since the text is translated:
// tamp ⬇️, filter paper 📄, phin lid ✋, egg 🟡, milk foam ☁️, ice = 🧊 with a 🚫 "no ice" choice; anything else stirs with a spoon.
const HAND_ART = [['⬇️', 'tamper'], ['📄', 'filter'], ['✋', 'lid'], ['🟡', 'egg'], ['☁️', 'pitcher']];
const handArt = step => {
  if (step.hand) return step.hand; // recipes.js gắn id ngôn-ngữ-trung-lập
  const icons = (step.options || []).map(o => o.icon);
  if (icons.includes('🧊') && icons.includes('🚫')) return 'ice';
  return HAND_ART.find(([icon]) => icons.includes(icon))?.[1] || 'spoon';
};
function toolFor(step) {
  if (step.tool) return step.tool; // recipes.js gắn id ngôn-ngữ-trung-lập
  if (step.type === 'bean') return 'beans';
  // Grind options are the only picks without icons (recipes.js GRINDS).
  if (step.type === 'pick') return step.options.every(o => !o.icon) ? 'grinder' : 'hands';
  if (step.unit === '°C') return 'steamer';
  // Pours are weighed in g/ml; the only other unit is minutes of whisking (label may be translated).
  if (!['g', 'ml'].includes(step.unit)) return 'whisk';
  // The espresso shot is weighed in grams; phin coffee poured over a drink is in ml.
  if (step.icon === '☕') return step.unit === 'g' ? 'espresso' : 'coffee';
  return { '🫘': 'scoop', '🥫': 'can', '🥛': 'milk', '🍶': 'cream', '🧂': 'salt' }[step.icon] || 'kettle';
}

// Close-up brewing bench inside the cafe dialog; returns a cleanup for the dialog to call on close.
export function mountBench(root, { farm, service, notice, close, openPantry, askLater = () => {}, fx = () => {} }) {
  const events = new AbortController(), signal = events.signal;
  // First bench visit (flag `bench-intro`): one yellow line on top until the first step is done.
  const introSeen = () => farm.peek().tutorial.seen.includes('bench-intro');
  const intro = () => introSeen() ? [] : [el('p', 'ui-alert ui-alert--warn', t('cafe.bench.intro'))];
  let raf = 0, gauge = null, timer = 0, sound = null, waitSound = null;
  // Stops the pour/steam/whisk/extract loop and the fast-forward loop; called on every step change and on close.
  const hush = () => { sound?.stop(); waitSound?.stop(); sound = waitSound = null; };
  root.addEventListener('keydown', e => {
    if (!gauge || e.code !== 'Space') return;
    e.preventDefault(); if (!e.repeat) gauge.pouring = true;
  }, { signal });
  root.addEventListener('keyup', e => { if (gauge && e.code === 'Space') { e.preventDefault(); gauge.pouring = false; } }, { signal });

  function choose() {
    gauge = null; hush(); root.replaceChildren(); service.benchEnd();
    const cafe = service.refresh().cafe, tickets = service.tickets();
    root.append(...intro(), el('p', 'cafe-lead', tickets.length ? t('cafe.bench.pickOrder') : t('cafe.bench.noOrders')));
    if (service.hand) root.append(el('p', 'cafe-warning', t('cafe.bench.handFull')));
    const grid = el('div', 'cafe-ticket-grid');
    for (const ticket of tickets) {
      const item = button('', () => start(ticket.recipe), 'cafe-ticket');
      item.dataset.covered = String(ticket.covered);
      item.append(el('span', 'cafe-ticket-icon', ticket.recipe.icon), el('strong', '', ticket.recipe.name), el('small', '', `${ticket.label}${ticket.covered ? t('cafe.bench.covered') : ''}`));
      const bar = el('i', 'cafe-patience'); bar.style.setProperty('--ratio', ticket.ratio); item.append(bar);
      grid.append(item);
    }
    if (tickets.length) root.append(grid);
    root.append(el('h3', 'cafe-subhead', t('cafe.bench.practice')));
    const practice = el('div', 'cafe-ticket-grid');
    for (const recipe of RECIPES) {
      const reason = lockReason(recipe, cafe), best = cafe.mastery[recipe.id]?.best || 0;
      const item = button('', () => start(recipe), 'cafe-ticket'); item.disabled = Boolean(reason);
      item.append(el('span', 'cafe-ticket-icon', reason ? '🔒' : recipe.icon), el('strong', '', recipe.name), el('small', '', reason || `${starText(stars(best))} · ${t('cafe.coins', { n: recipe.price })}`));
      practice.append(item);
    }
    root.append(practice);
  }

  function start(recipe) {
    service.benchStart(recipe.id);
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
    root.append(el('p', 'cafe-warning', t('cafe.bench.lacking', { drink: recipe.name })));
    const list = el('ul', 'cafe-missing'); for (const item of missing) list.append(el('li', '', item)); root.append(list);
    root.append(el('p', 'cafe-lead', t('cafe.bench.lackingLead')));
    const actions = el('div', 'cafe-actions');
    actions.append(button(t('cafe.bench.openPantry'), openPantry, 'cafe-primary'), button(t('cafe.bench.otherDrink'), choose));
    root.append(actions);
  }

  function brew(state) {
    const { recipe } = state, step = recipe.steps[state.index], tool = toolFor(step);
    gauge = null; cancelAnimationFrame(raf); clearTimeout(timer); hush(); root.replaceChildren();
    const layout = el('div', 'cafe-brew'); layout.dataset.auto = String(Boolean(state.auto)); // Auto pha: the step controls are watch-only
    const head = el('div', 'cafe-step-head');
    head.append(el('strong', '', `${recipe.icon} ${recipe.name}`), el('small', '', t('cafe.bench.step', { n: state.index + 1, total: recipe.steps.length })));
    if (state.index === 0 && !state.auto) head.append(button(t('cafe.bench.change'), choose, 'cafe-link')); // Auto pha is paid for: no swapping the dish
    // ⚡ Quick brew (04-cafe/gameplay.md "Pha nhanh"): one tap instead of the steps, for phones and for Auto.
    // 🤖 Auto pha: pay AUTO_BREW_COST to watch every step done right, at the demo cap (each step ≤ 0.8 → ★★).
    if (state.index === 0 && !state.auto) {
      const actions = el('div', 'cafe-brew-modes');
      actions.append(button(t('crew.quick.btn', { stars: starText(stars(quickScore(state.best))), s: QUICK_MS / 1000 }), () => quick(state), 'cafe-primary cafe-quick'),
        button(t('crew.autobrew.btn', { cost: AUTO_BREW_COST }), () => {
          // The fee is charged in finish(), once the cup exists; here only check the player can afford it.
          const coins = farm.peek().coins;
          if (coins < AUTO_BREW_COST) { notice(t('farmRules.err.missingCoins', { n: Math.round((AUTO_BREW_COST - coins) * 100) / 100 }), false); return; }
          state.auto = true; brew(state);
        }, 'cafe-autobrew'));
      head.append(actions);
    }
    if (state.auto) head.append(el('p', 'cafe-auto-note', t('crew.autobrew.note')));
    if (state.canMemory && state.index === 0) {
      const toggle = el('label', 'cafe-memory'), box = el('input'); box.type = 'checkbox'; box.checked = state.memory;
      box.addEventListener('change', () => { state.memory = box.checked; brew(state); });
      toggle.append(box, t('cafe.bench.memoryToggle')); head.append(toggle);
    } else if (state.memory) head.append(el('small', 'cafe-memory', t('cafe.bench.memory')));
    // Step pills replace the side card so the bench stays one centred column at any width.
    // Numbered dots always fit on one line; the current step's name is the big title below them.
    const stepper = el('ol', 'cafe-stepper');
    recipe.steps.forEach((s, i) => { const li = el('li', '', i < state.index ? '✓' : `${i + 1}`); li.title = s.type === 'bean' ? t('cafe.bench.bean') : s.text; li.dataset.state = i < state.index ? 'done' : i === state.index ? 'now' : ''; stepper.append(li); });
    const title = el('h3', 'cafe-step-title', step.type === 'bean' ? t('cafe.bench.beanTitle') : step.text);
    const facts = el('div', 'cafe-chips'); facts.hidden = state.memory;
    for (const [key, text] of [[t('cafe.card.ratio'), recipe.card.ratio], [t('cafe.card.grind'), recipe.card.grind], [t('cafe.card.temp'), recipe.card.temp], [t('cafe.card.time'), recipe.card.time]]) { const chip = el('span'); chip.append(el('b', '', key), text); facts.append(chip); }

    // The stage: three columns on a counter — tool | brewer + cup + scale | instrument (thermometer or shot timer).
    const vessel = recipe.gear.chasen ? 'chawan' : recipe.gear.v60 ? 'v60' : recipe.gear.espresso ? 'portafilter' : 'phin';
    const stage = el('div', 'cafe-stage'); stage.dataset.tool = tool;
    const scooped = recipe.steps.slice(0, state.index).some(s => toolFor(s) === 'scoop');
    const showBrewer = ['scoop', 'espresso', 'matcha'].includes(tool) || (tool === 'kettle' && vessel !== 'portafilter') || (tool === 'hands' && ['tamper', 'filter', 'lid', 'chasen', 'sieve'].includes(handArt(step)));
    stage.style.setProperty('--bed', scooped ? 1 : 0);
    const row = el('div', 'cafe-stage-row');
    const toolNode = art(tool === 'hands' ? handArt(step) : TOOL_ART[tool], 'cafe-tool');
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
    if (tool === 'steamer' || tool === 'heat') { const thermo = el('div', 'cafe-thermo'); thermo.append(mercury); instrument.append(thermo, el('small', '', '°C')); }
    else if (tool === 'espresso') { const clock = el('div', 'cafe-timer'); clock.append(dial); instrument.append(clock, el('small', '', t('cafe.bench.extractSec'))); }
    row.append(toolNode, vesselNode, instrument);
    const stream = el('i', 'cafe-stream'), drips = el('i', 'cafe-drips'), steam = el('div', 'cafe-steam');
    for (let i = 0; i < 3; i++) steam.append(el('i'));
    const pop = el('div', 'cafe-pop'), wait = el('div', 'cafe-wait');
    stage.append(row, stream, drips, steam, pop, wait);
    // The "why" card: the real-world reason for this step, then the feedback after the player acts.
    const learn = el('div', 'cafe-learn'), note = el('p'); learn.append(el('span', '', '💡'), note);
    note.setAttribute('aria-live', 'polite'); note.textContent = state.memory ? t('cafe.bench.memoryNote') : step.learn || '';
    const say = (text, tone = '') => { note.textContent = text.replace(/^[✓✗△]\s*/, ''); learn.dataset.tone = tone; learn.firstChild.textContent = tone === 'bad' ? '✗' : tone === 'good' ? '✓' : '💡'; };
    const body = el('div', 'cafe-step-body');
    layout.append(...intro(), head, stepper, title, facts, stage, learn, body); root.append(layout);

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
    // `fix` = the real reason this step lost points, for the "Sửa bước này trước" line (adjust perk).
    const next = (score, text, value = 0, icon = null, inside = null, fix = '') => {
      // Picks always pop an icon (△ = partly right); a pour without icon outside the band is a miss.
      fx((inside ?? score >= .99) ? 'good' : icon ? 'partial' : 'bad');
      if (!introSeen()) farm.act('tutorial', 'seen', 'bench-intro');
      if (state.hinted) score = Math.min(score, .8);
      const ok = inside ?? score >= .99;
      state.scores.push(score); state.values[state.index] = value;
      state.notes.push({ ok, text, fix: fix || (state.hinted ? t('cafe.bench.hintCap') : '') });
      state.hinted = false; body.inert = true; say(text, ok ? 'good' : score >= .5 && inside === null ? '' : 'bad');
      if (icon) { pop.textContent = icon; stage.dataset.anim = 'pop'; }
      const advance = () => { hush(); if (++state.index >= recipe.steps.length) finish(state); else brew(state); };
      const afterPop = () => {
        if (!step.wait) { advance(); return; }
        stage.dataset.anim = 'wait'; waitSound = fx('wait'); wait.replaceChildren(el('strong', '', `⏩ ${step.wait[0]}`), el('small', '', t('cafe.bench.real', { time: step.wait[1] })), el('i'));
        const skip = button(t('cafe.bench.skip'), () => { clearTimeout(timer); advance(); }, 'cafe-link'); wait.append(skip); skip.focus({ preventScroll: true });
        timer = setTimeout(advance, 2600);
      };
      timer = setTimeout(afterPop, icon ? 900 : 350);
    };

    if (step.type === 'bean' || step.type === 'pick') {
      const cafe = service.snap.cafe, preferred = CROPS.find(c => c.id === recipe.bean);
      const options = step.type === 'bean'
        ? CROPS.map(c => ({ label: `${c.name} · ${cafe.stock.roasted[c.id] || 0} g`, icon: '🫘', crop: c.id, ok: c.id === recipe.bean ? 1 : .7, disabled: (cafe.stock.roasted[c.id] || 0) < recipe.beans, why: t('cafe.bench.beanWhy', { bean: preferred.name }) }))
        : (state.shuffled ||= step.options.map((o, i) => ({ ...o, grind: tool === 'grinder' ? i : null })).sort(() => Math.random() - .5));
      let missed = false, missedWhy = '';
      const grid = el('div', 'cafe-options'), buttons = [];
      for (const option of options) {
        const item = button('', () => {
          if (option.ok === 0) { missed = true; missedWhy ||= t('cafe.bench.firstPick', { label: option.label, why: option.why }); item.dataset.wrong = 'true'; item.disabled = true; say(option.why, 'bad'); fx('bad'); stage.dataset.anim = 'shake'; setTimeout(() => { stage.dataset.anim = ''; }, 350); return; }
          if (tool === 'grinder') fx('grind');
          if (option.crop) state.cropId = option.crop;
          if (option.grind !== null && option.grind !== undefined) stage.dataset.grind = String(option.grind);
          state.shuffled = null;
          const score = missed ? .3 : option.ok;
          next(score, `${score >= .99 ? '✓' : '△'} ${option.label}${option.ok < 1 ? ` — ${option.why}` : ''} ${step.learn || ''}`.trim(), 0, option.icon || '✓', null, missedWhy || (option.ok < 1 ? option.why : ''));
        }, 'cafe-option');
        item.disabled = Boolean(option.disabled);
        if (option.icon) item.append(el('span', '', option.icon));
        item.append(el('b', '', option.label));
        // Grind options show a sample of particle size so the difference is visible, not just named.
        if (tool === 'grinder') { const sample = el('i', 'cafe-grind-sample'); sample.style.setProperty('--size', `${2 + option.grind * 2.2}px`); item.append(sample); }
        buttons.push([item, option]); grid.append(item);
      }
      body.append(grid);
      if (!state.memory) body.append(button(t('cafe.bench.hint'), () => {
        state.hinted = true; const [item, option] = buttons.find(([, o]) => o.ok === 1 && !o.disabled) || [];
        if (item) { item.dataset.hint = 'true'; say(`${option.label}: ${option.why}`); }
      }, 'cafe-link'));
      grid.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
      if (state.auto) {
        // Highlight the right answer, explain it, then tap it (the best bean in stock if the recipe's bean ran out).
        const [item, option] = buttons.filter(([, o]) => !o.disabled && o.ok > 0).sort(([, a], [, b]) => b.ok - a.ok)[0] || [];
        if (item) { item.dataset.hint = 'true'; say(`🤖 ${option.label}: ${option.why}`); timer = setTimeout(() => { state.hinted = true; item.click(); }, 1500); }
      }
      return;
    }

    const from = step.unit === '°C' ? 20 : 0;
    gauge = { value: from, pouring: false, demo: null };
    const meter = el('div', 'cafe-gauge'), band = el('i', 'cafe-gauge-band'), level = el('i', 'cafe-gauge-fill');
    band.style.left = `${step.target[0] / step.max * 100}%`; band.style.width = `${(step.target[1] - step.target[0]) / step.max * 100}%`; band.hidden = state.memory;
    meter.append(band, level);
    const readout = el('output', 'cafe-readout');
    const goal = el('small', '', state.memory ? t('cafe.bench.recall') : t('cafe.bench.target', { lo: step.target[0], hi: step.target[1], unit: step.unit }));
    const verb = t(`cafe.bench.verb.${{ heat: 'heat', steamer: 'steam', whisk: 'whisk', espresso: 'extract', scoop: 'scoop', salt: 'sprinkle' }[tool] || 'pour'}`);
    const hold = button(t('cafe.bench.hold', { icon: step.icon, verb }), () => {}, 'cafe-hold');
    const done = button(t('cafe.bench.done'), () => {
      if (!gauge) return; // the pour already auto-locked this step
      const [lo, hi] = step.target, value = shown(gauge.value, step), inside = value >= lo && value <= hi;
      const distance = inside ? 0 : value < lo ? lo - value : value - hi, score = inside ? 1 : Math.max(.1, 1 - distance / ((hi - lo) * 2.5));
      gauge = null; cancelAnimationFrame(raf); hush(); stage.dataset.pouring = 'false';
      const miss = inside ? '' : t('cafe.bench.pourMiss', { amount: amount(value, step), lo, hi, unit: step.unit, learn: step.learn });
      next(score, inside ? t('cafe.bench.pourOk', { text: step.text, amount: amount(value, step) }) : `✗ ${step.text}: ${miss}`, value, null, inside, miss);
    }, 'cafe-primary');
    done.disabled = true;
    hold.addEventListener('pointerdown', e => { if (!gauge || gauge.demo) return; gauge.pouring = true; hold.setPointerCapture(e.pointerId); });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) hold.addEventListener(type, () => { if (gauge && !gauge.demo) gauge.pouring = false; });
    // Letting go inside the green band locks the step, so a pour is one gesture; outside it you can top up, then «Xong».
    hold.addEventListener('pointerup', () => {
      if (!gauge || gauge.demo) return;
      const v = shown(gauge.value, step);
      if (v >= step.target[0] && v <= step.target[1]) timer = setTimeout(() => { if (gauge && !done.disabled) done.click(); }, 250);
    });
    const controls = el('div', 'cafe-actions'); controls.append(hold, done);
    if (!state.memory) controls.append(button(t('cafe.bench.demo'), () => {
      if (!gauge || gauge.demo) return;
      state.hinted = true; gauge.value = from; gauge.demo = { target: middle(step), until: 0 };
      say(t('cafe.bench.demoNote', { amount: amount(middle(step), step), learn: step.learn }));
    }, 'cafe-link'));
    // Controls panel: target and live reading on one line, the gauge, then the buttons.
    const reading = el('div', 'cafe-reading'); reading.append(goal, readout);
    body.classList.add('cafe-controls'); body.append(reading, meter, controls);
    hold.focus({ preventScroll: true });
    if (state.auto) { gauge.auto = { target: middle(step), wait: 1, released: false }; say(t('crew.autobrew.pour', { amount: amount(middle(step), step), learn: step.learn })); }
    const rate = (step.max - from) / 3.2; // 3.2 s from empty to full: easier to stop on a phone
    const handRate = Math.min(rate, (step.target[1] - step.target[0]) / .45); // PT-3: the band takes >= 0.45 s to cross when held by hand
    let last = performance.now(), zone = '';
    const tick = now => {
      if (!gauge) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      const demo = gauge.demo;
      if (demo) {
        // The demo pours to the target, holds briefly, then empties so the player does it themselves.
        if (!demo.until) { gauge.pouring = true; gauge.value = Math.min(demo.target, gauge.value + rate * .7 * dt); if (gauge.value >= demo.target) { demo.until = now + 900; gauge.pouring = false; } }
        else if (now >= demo.until) { gauge.value = from; gauge.demo = null; }
      } else if (gauge.auto) {
        // Auto pha: hold to the middle of the band, let go, then lock the step.
        if (gauge.auto.wait > 0) gauge.auto.wait -= dt;
        else if (!gauge.auto.released) { gauge.pouring = true; gauge.value = Math.min(gauge.auto.target, gauge.value + rate * .8 * dt); if (gauge.value >= gauge.auto.target) { gauge.pouring = false; gauge.auto.released = true; state.hinted = true; timer = setTimeout(() => done.click(), 700); } }
      } else if (gauge.pouring) gauge.value = Math.min(step.max, gauge.value + handRate * dt);
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

  // Quick brew: QUICK_MS of waiting, then the cup. Score = your best hand score on this drink, kept within 40–90:
  // a new drink is ★, ★★ after one hand cup ≥ 70, ★★★ after 90. Quick never raises mastery past what you earned.
  function quick(state) {
    if (!introSeen()) farm.act('tutorial', 'seen', 'bench-intro');
    gauge = null; cancelAnimationFrame(raf); clearTimeout(timer); hush(); root.replaceChildren();
    const box = el('div', 'cafe-result'), meter = el('progress'); meter.max = QUICK_MS; meter.value = 0;
    box.append(el('strong', '', `${state.recipe.icon} ${state.recipe.name}`), el('p', 'cafe-lead', t('crew.quick.brewing')), meter); root.append(box);
    const began = performance.now();
    const tick = now => { meter.value = now - began; if (now - began < QUICK_MS) raf = requestAnimationFrame(tick); else finish(state, quickScore(state.best)); };
    raf = requestAnimationFrame(tick);
  }

  function finish(state, quickResult = null) {
    // Floor, not round: 89.6 must stay ★★ so a cup with a failed step cannot reach ★★★ / memory mode.
    const { recipe } = state, quickBrew = quickResult !== null, score = quickBrew ? quickResult : Math.floor(state.scores.reduce((a, b) => a + b, 0) / state.scores.length * 100);
    if (state.auto) { const paid = farm.act('cafe', 'autoBrew', null); notice(paid.message, paid.ok); if (!paid.ok) { lacking(recipe, [paid.message]); return; } }
    const result = farm.act('cafe', 'brew', { recipeId: recipe.id, cropId: state.cropId, score, demo: Boolean(state.auto) });
    if (!result.ok) { notice(result.message, false); lacking(recipe, [result.message]); return; }
    // Adjust perk: point at the one step that lost most (lowest score, first on ties) with its real reason.
    const worst = state.scores.reduce((w, s, i) => s < state.scores[w] ? i : w, 0), worstStep = recipe.steps[worst];
    const miss = state.scores[worst] < 1 ? `${recipe.name}: ${worstStep.type === 'bean' ? t('cafe.bench.bean') : worstStep.text}` : null;
    service.benchEnd();
    const earned = stars(score), target = service.addDrink({ recipeId: recipe.id, quality: result.quality, stars: earned, memory: state.memory, miss });
    root.replaceChildren();
    const summary = el('div', 'cafe-result'), starRow = el('div', 'cafe-result-stars');
    // Each star is its own span so the CSS reveals them one by one (--i × 250 ms), in step with the chimes.
    [...starText(earned)].forEach((s, i) => { const span = el('span', '', s); span.style.setProperty('--i', i); starRow.append(span); });
    fx('stars', { count: earned });
    summary.append(starRow, el('strong', '', `${recipe.icon} ${recipe.name}`),
      el('p', '', t('cafe.bench.score', { score, quality: result.quality })),
      el('p', 'cafe-lead', target ? t('cafe.bench.serveTo', { target }) : t('cafe.bench.toShelf')));
    if (farm.peek().lessons.learned.includes('adjust') && state.scores[worst] < 1 && !state.auto) summary.append(el('p', 'ui-alert ui-alert--warn', t('cafe.bench.fixFirst', { step: worstStep.type === 'bean' ? t('cafe.bench.bean') : worstStep.text, fix: state.notes[worst].fix })));
    if (score < 70 && !quickBrew) askLater(['adjust']);
    // Unlock line uses the real thresholds of hired baristas (90 − Trí nhớ × 0.4), not a fixed 70.
    const need = Math.min(...service.agents.filter(a => a.role === 'barista').map(a => a.effects?.mastery ?? Infinity));
    if (Number.isFinite(need) && state.best < need && score >= need) summary.append(el('p', 'cafe-unlock', t('cafe.bench.baristaUnlock', { need })));
    if (state.best < 90 && score >= 90) summary.append(el('p', 'cafe-unlock', t('cafe.bench.memoryUnlock')));
    if (summary.querySelector('.cafe-unlock')) fx('unlock');
    const list = el('ul', 'cafe-notes'); for (const n of state.notes) { const li = el('li', '', n.text); li.dataset.ok = String(n.ok); list.append(li); }
    summary.append(el('p', 'cafe-story', recipe.story), list);
    const actions = el('div', 'cafe-actions');
    const carry = button(t('cafe.bench.carry'), close, 'cafe-primary');
    actions.append(carry, button(t('cafe.bench.another'), choose));
    summary.append(actions); root.append(summary);
    carry.focus({ preventScroll: true });
  }

  const first = service.tickets().find(ticket => !ticket.covered);
  if (first) start(first.recipe); else choose();
  return () => { gauge = null; cancelAnimationFrame(raf); clearTimeout(timer); hush(); events.abort(); service.benchEnd(); };
}
