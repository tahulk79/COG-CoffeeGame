// Long-lived CDP driver: keeps one session (emulation persists); POST JS body to :9444 to run with helpers in scope.
import http from 'node:http';
import fs from 'node:fs';
const BENCH = fs.readFileSync('/Users/macos/Desktop/V2/.claude/skills/threejs-h5-performance-engineer/scripts/bench-init.js', 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0, pending = new Map(), listeners = [];
async function connect() {
  const t = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } else listeners.forEach(l => l(m)); };
  for (const d of ['Page', 'Runtime', 'Log']) await send(d + '.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: BENCH });
  listeners.push(m => { if (m.method === 'Runtime.exceptionThrown') consoleLog.push({ t: Date.now(), type: 'exception', text: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text });
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) consoleLog.push({ t: Date.now(), type: m.params.type, text: m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300) });
    if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) consoleLog.push({ t: Date.now(), type: 'log-' + m.params.entry.level, text: (m.params.entry.text + ' ' + (m.params.entry.url || '')).slice(0, 300) }); });
  return t.id;
}
const consoleLog = [];
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr, timeout = 120000) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
let touch = false;
async function mobile(on, throttle) {
  touch = on;
  if (on) { await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }); await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); }
  else { await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }); await send('Emulation.setTouchEmulationEnabled', { enabled: false }); }
  await send('Emulation.setCPUThrottlingRate', { rate: throttle });
}
async function nav(url) { const t0 = Date.now(); await send('Page.navigate', { url }); await waitFor('document.readyState==="complete"', 30000); return Date.now() - t0; }
async function waitFor(expr, timeout = 60000, step = 100) { const t0 = Date.now(); while (Date.now() - t0 < timeout) { try { if (await ev(`!!(${expr})`)) return Date.now() - t0; } catch {} await sleep(step); } throw new Error('timeout waiting ' + expr); }
async function rect(sel) { return ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height,vis:r.width>0&&!e.closest('[hidden]')}})()`); }
async function tapAt(x, y) {
  if (touch) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  else { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); }
}
async function tap(sel) { const r = await rect(sel); if (!r || !r.vis) throw new Error('not visible ' + sel); await tapAt(r.x, r.y); return r; }
async function key(code, holdMs = 0) { const k = code.replace(/^Key/, '').toLowerCase(); await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k }); if (holdMs) await sleep(holdMs); await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k }); }
async function shot(name) { const r = await send('Page.captureScreenshot', { format: 'png' }); const p = `/Users/macos/Desktop/V2/production/audit/evidence/perf-after/${name}.png`; fs.writeFileSync(p, Buffer.from(r.data, 'base64')); return p; }
async function heap(path) { const out = fs.createWriteStream(path); const l = m => { if (m.method === 'HeapProfiler.addHeapSnapshotChunk') out.write(m.params.chunk); }; listeners.push(l); await send('HeapProfiler.enable'); await send('HeapProfiler.collectGarbage'); await send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }); listeners.splice(listeners.indexOf(l), 1); await new Promise(r => out.end(r)); return fs.statSync(path).size; }
async function gc() { await send('HeapProfiler.enable'); await send('HeapProfiler.collectGarbage'); }
let traceChunks = null;
async function traceStart() { traceChunks = []; const l = m => { if (m.method === 'Tracing.dataCollected') traceChunks.push(...m.params.value); }; listeners.push(l); traceStart.l = l;
  await send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8.execute', 'disabled-by-default-v8.cpu_profiler', 'blink.user_timing', 'loading', 'latencyInfo', 'gpu'] } }); }
async function traceStop(path) { const done = new Promise(r => { const l = m => { if (m.method === 'Tracing.tracingComplete') { listeners.splice(listeners.indexOf(l), 1); r(); } }; listeners.push(l); }); await send('Tracing.end'); await done; listeners.splice(listeners.indexOf(traceStart.l), 1); fs.writeFileSync(path, JSON.stringify({ traceEvents: traceChunks })); return traceChunks.length; }
const targetId = await connect();
const ctx = { send, ev, nav, waitFor, rect, tap, tapAt, key, shot, heap, gc, traceStart, traceStop, mobile, sleep, consoleLog, fs, targetId, state: {} };
http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  try { const fn = new (Object.getPrototypeOf(async function () {}).constructor)(...Object.keys(ctx), body); const out = await fn(...Object.values(ctx)); res.end(JSON.stringify(out, null, 1) ?? 'undefined'); }
  catch (e) { res.statusCode = 500; res.end(String(e.stack || e)); }
}).listen(9444, '127.0.0.1', () => console.log('driver ready', targetId));
