await mobile(false, 1);
const out = {};
for (const run of [0,1]) {
  await ev('localStorage.clear()'); 
  let t0 = Date.now(); await nav('http://perf.localhost:5174/?fps');
  await waitFor('document.getElementById("loading").hidden && !document.getElementById("selection").hidden', 60000);
  const selLoad = Date.now() - t0;
  await sleep(3500);
  if (run === 0) { out.warm = selLoad; continue; }
  const sel = Object.assign({ load: selLoad }, await ev('__bench(8)'), await ev('__cpu(5)'));
  t0 = Date.now();
  await ev('document.getElementById("player-form").requestSubmit(),1');
  await waitFor('document.getElementById("loading").hidden && document.getElementById("selection").hidden', 60000, 20);
  const load = Date.now() - t0;
  await sleep(1500);
  const intro = Object.assign({ load }, await ev('__bench(8)'), await ev('__cpu(5)'));
  if (run === 1) await shot('d-intro');
  out['run' + run] = { selection: sel, intro };
}
return out;
