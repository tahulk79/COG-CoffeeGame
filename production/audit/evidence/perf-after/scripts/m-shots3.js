const out = {cands:{}};
const FIX = JSON.parse(fs.readFileSync('/Users/macos/Desktop/V2/production/audit/evidence/perf/fixture-farm-unlocked.json','utf8'));
async function load(origin, save) { const url = origin + '/?fps'; await nav(url); await ev(`localStorage.clear(); localStorage.setItem("cog-coffee-progress", ${JSON.stringify(JSON.stringify(save))}); 1`); await nav(url); await sleep(6000); }
const cands = { cafeStock5: f => f.farm.cafe = {stock:5}, cafeLotsNull: f => f.farm.cafe = {...(f.farm.cafe||{}), lots:[null]}, ordersEmptyObj: f => f.farm.orders=[{}], lotsEmptyObj: f => f.farm.lots=[{}], workersBadId: f => f.farm.workers=[{id:5}], plotsBad: f => f.farm.plots=[{id:'plot-0',stage:5}], claimedNull: f => f.farm.claimed=null, statsNull: f => f.farm.stats=null, lessonsNull: f => f.farm.lessons=null, decorBad: f=> f.farm.decorations=[{type:null,x:0,z:0,rotation:0}] };
for (const [k, mut] of Object.entries(cands)) {
  const s = structuredClone(FIX); mut(s); await load('http://broken.localhost:5174', s);
  out.cands[k] = await ev(`[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.textContent).join('|').slice(0,120)`);
  if (/Chơi lại/.test(out.cands[k])) { out.errorWith = k; break; }
}
out.console = consoleLog.splice(0).filter(c => !/AudioContext/.test(c.text)).slice(0, 8);
return out;
