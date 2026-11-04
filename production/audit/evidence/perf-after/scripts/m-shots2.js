const out = {};
// state still on poor-farm shop? reload poor fixture
const FIX = JSON.parse(fs.readFileSync('/Users/macos/Desktop/V2/production/audit/evidence/perf/fixture-farm-unlocked.json','utf8'));
async function load(origin, save) { const url = origin + '/?fps'; await nav(url); await ev(`localStorage.clear(); localStorage.setItem("cog-coffee-progress", ${JSON.stringify(JSON.stringify(save))}); 1`); await nav(url); await sleep(6000); }
const poor = structuredClone(FIX); poor.farm.coins = 3;
await load('http://perf.localhost:5174', poor);
await ev(`[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&/Để sau/.test(b.textContent)).forEach(b=>b.click()),1`);
await tap('#farm-shop-toggle'); await sleep(1000);
await tapAt(305, 342); await sleep(400);
out.notice = await ev(`[...document.body.querySelectorAll('*')].filter(e=>e.children.length===0&&/còn thiếu/.test(e.textContent)).map(e=>e.textContent)`);
out.coins = await ev('JSON.parse(localStorage["cog-coffee-progress"]).farm.coins');
await shot('m-shop-short-tap');
// find a corruption that still reaches the error screen
const cands = { plotsNullItem: f => f.farm.plots = [null], stockNull: f => f.farm.stock = null, seedsNull: f => f.farm.seeds = null, upgradesNull: f => f.farm.upgrades = null, farmNull: f => f.farm = null, fieldsNull: f => f.farm.fields = [null], machinesNull: f => f.farm.machines = {dryer:null} };
out.cands = {};
for (const [k, mut] of Object.entries(cands)) {
  const s = structuredClone(FIX); mut(s); await load('http://broken.localhost:5174', s);
  out.cands[k] = await ev(`({title:document.title, buttons:[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.textContent).join('|').slice(0,160)})`);
  if (/Chơi lại/.test(out.cands[k].buttons)) { out.errorWith = k; break; }
}
out.console = consoleLog.splice(0).filter(c => !/AudioContext/.test(c.text)).slice(0, 8);
return out;
