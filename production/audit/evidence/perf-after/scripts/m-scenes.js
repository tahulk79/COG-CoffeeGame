const MOB = state.mob !== false; await mobile(MOB, MOB ? 4 : 1);
const P = MOB ? 'm' : 'd';
const FIX = fs.readFileSync('/Users/macos/Desktop/V2/production/audit/evidence/perf/fixture-farm-unlocked.json','utf8');
const loaded = t => `document.getElementById("loading").hidden && document.title.includes(${JSON.stringify(t)}) && !!document.querySelector("#game canvas")`;
async function scene(save, title, url='http://perf.localhost:5174/?fps') {
  await nav(url); await ev(`localStorage.clear(); ${save ? `localStorage.setItem("cog-coffee-progress", ${JSON.stringify(save)});` : ''} 1`);
  const t0 = Date.now(); await nav(url); await waitFor(loaded(title), 60000, 20); const load = Date.now() - t0;
  await sleep(3500); return Object.assign({ load }, await ev('__bench(8)'), await ev('__cpu(5)'));
}
const dismiss = () => ev(`[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&/Để sau/.test(b.textContent)&&!b.closest('dialog:not([open])')).forEach(b=>b.click()),1`);
const out = {};
out.heaven = await scene(JSON.stringify({version:1,chapter:2,introCompleted:true}), 'Hội đồng');
await shot(P + '-heaven');
if (MOB) { out.farmNew = await scene(JSON.stringify({version:1,chapter:3,introCompleted:true,heaven:{completed:true,gift:'capital'},startingGift:'capital'}), 'Nông trại'); await shot(P + '-farm'); }
out.farm = await scene(FIX, 'Nông trại'); await dismiss(); await shot(P + '-farm-unlocked');
// shop x5
const shop = { open: [], close: [] }; await ev('window.__lt=[];new PerformanceObserver(l=>l.getEntries().forEach(e=>__lt.push(Math.round(e.duration)))).observe({type:"longtask"});1');
if (MOB) await traceStart();
for (let i = 0; i < 5; i++) {
  await dismiss(); let t0 = Date.now(); await tap('#farm-shop-toggle'); await waitFor('!document.getElementById("farm-modal").hidden', 10000, 20); shop.open.push(Date.now() - t0);
  if (i === 0) await shot(P + '-farm-shop-open');
  await sleep(600); t0 = Date.now(); await tap('#farm-modal-close'); await waitFor('document.getElementById("farm-modal").hidden', 10000, 20); shop.close.push(Date.now() - t0); await sleep(600);
}
if (MOB) await traceStop('/Users/macos/Desktop/V2/node_modules/.perf/after-m-shop5.json');
shop.longTasks = await ev('__lt'); shop.gpu = await ev('__gl'); out.shop = shop;
// farm -> cafe first
await dismiss(); await sleep(500);
if (MOB) await traceStart();
let t0 = Date.now(); await tap('[data-shortcut="cafe-play"]'); await waitFor(loaded('Quán cà phê'), 60000, 20); const cafeLoad = Date.now() - t0;
if (MOB) { await sleep(3000); await traceStop('/Users/macos/Desktop/V2/node_modules/.perf/after-m-farm-to-cafe.json'); await sleep(500); } else await sleep(3500);
out.cafe = Object.assign({ load: cafeLoad }, await ev('__bench(8)'), await ev('__cpu(5)')); await shot(P + '-cafe');
// rounds
const exitBtn = `[...document.querySelectorAll('button')].find(b=>b.offsetParent&&/Nông trại/.test(b.textContent))`;
const gpu = async () => ev('(()=>({tex:__gl.tex,buf:__gl.buf,prog:__gl.prog,heapMB:+(performance.memory.usedJSHeapSize/1048576).toFixed(1)}))()');
out.rounds = [];
for (let r = 1; r <= 5; r++) {
  const rr = { round: r };
  let t = Date.now(); await ev(`${exitBtn}.click(),1`); await waitFor('document.title.includes("Nông trại")', 20000, 20); rr.toFarmMs = Date.now() - t; await sleep(1500); await dismiss(); rr.farm = await gpu();
  t = Date.now(); await tap('[data-shortcut="cafe-play"]'); await waitFor(loaded('Quán cà phê'), 20000, 20); rr.toCafeMs = Date.now() - t; await sleep(1500); rr.cafe = await gpu();
  out.rounds.push(rr);
}
out.console = consoleLog.splice(0);
return out;
