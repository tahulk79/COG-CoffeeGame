await mobile(true, 4);
const FIX = JSON.parse(fs.readFileSync('/Users/macos/Desktop/V2/production/audit/evidence/perf/fixture-farm-unlocked.json','utf8'));
const out = {};
async function load(origin, save) {
  const url = origin + '/?fps'; await nav(url); await ev(`localStorage.clear(); localStorage.setItem("cog-coffee-progress", ${JSON.stringify(JSON.stringify(save))}); 1`);
  await nav(url); await waitFor('document.getElementById("loading").hidden || !!document.querySelector(".ui-error, #game-error, [role=alert]")', 60000, 50); await sleep(3000);
}
const dismiss = () => ev(`[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&/Để sau/.test(b.textContent)).forEach(b=>b.click()),1`);
// 1. shop short of coins
const poor = structuredClone(FIX); poor.farm.coins = 3;
await load('http://perf.localhost:5174', poor); await dismiss();
await tap('#farm-shop-toggle'); await waitFor('!document.getElementById("farm-modal").hidden', 10000, 20); await sleep(800);
out.shortQuotes = await ev(`[...document.querySelectorAll('#farm-modal-items *')].filter(e=>e.children.length===0&&/Thiếu .* xu/.test(e.textContent)).map(e=>e.textContent).slice(0,6)`);
out.hud = await ev('document.getElementById("farm-coins")?.textContent');
await shot('m-shop-short');
const buyIdx = await ev(`(()=>{const b=[...document.querySelectorAll('#farm-modal-items button')].filter(b=>b.offsetParent&&!b.disabled&&/Mua/.test(b.textContent));if(!b.length)return null;b[0].scrollIntoView({block:'center'});const r=b[0].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,t:b[0].textContent}})()`);
out.buyBtn = buyIdx;
if (buyIdx) { await sleep(300); const r = await ev(`(()=>{const b=[...document.querySelectorAll('#farm-modal-items button')].filter(b=>b.offsetParent&&!b.disabled&&/Mua/.test(b.textContent))[0].getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`.replace('r.x','b.x').replace('r.width','b.width').replace('r.y','b.y').replace('r.height','b.height')); await tapAt(r.x, r.y); await sleep(500);
  out.noticeAfterTap = await ev(`[...document.querySelectorAll('[role=status],[aria-live],.ui-toast,#farm-notice')].map(e=>e.textContent.trim()).filter(Boolean).slice(0,4)`);
  out.coinsAfter = await ev('JSON.parse(localStorage["cog-coffee-progress"]).farm.coins');
  await shot('m-shop-short-tap'); }
// 2. broken save workers:[null] in separate origin
const broken = structuredClone(FIX); broken.farm.workers = [null];
await load('http://broken.localhost:5174', broken);
out.brokenWorkers = await ev(`({title:document.title, loadingHidden:document.getElementById('loading').hidden, errorText:[...document.querySelectorAll('button')].filter(b=>b.offsetParent).map(b=>b.textContent).join('|').slice(0,300)})`);
await shot('m-broken-workers-null');
out.console = consoleLog.splice(0);
return out;
