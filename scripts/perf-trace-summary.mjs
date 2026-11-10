// Dev tool: turns a Chrome Performance trace (.json or .json.gz, from DevTools "Save profile") into a CPU summary by function and by
// file. Usage: node scripts/perf-trace-summary.mjs trace.json.gz [topN]. See docs/performance/PERFORMANCE-TEST-PLAN.md.
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2], topN = Number(process.argv[3] || 40);
if (!file) { console.error('usage: node scripts/perf-trace-summary.mjs <trace.json[.gz]> [topN]'); process.exit(1); }
const raw = fs.readFileSync(file);
const text = (file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8');
const parsed = JSON.parse(text);
const events = Array.isArray(parsed) ? parsed : parsed.traceEvents;

// Pick the renderer main thread that did the most work: the page under test.
const mains = new Set(events.filter(e => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map(e => `${e.pid}:${e.tid}`));
const busy = new Map();
for (const e of events) if (e.ph === 'X' && e.name === 'RunTask' && e.dur && mains.has(`${e.pid}:${e.tid}`)) busy.set(`${e.pid}:${e.tid}`, (busy.get(`${e.pid}:${e.tid}`) || 0) + e.dur);
const main = [...busy.entries()].sort((a, b) => b[1] - a[1])[0][0];
const [pid, tid] = main.split(':').map(Number);
const onMain = events.filter(e => e.pid === pid && e.tid === tid);
const X = onMain.filter(e => e.ph === 'X' && e.dur != null);
let first = Infinity, last = -Infinity;
for (const e of X) { if (e.ts < first) first = e.ts; if (e.ts + e.dur > last) last = e.ts + e.dur; }
const windowMs = (last - first) / 1000;

const byName = new Map();
for (const e of X) { const v = byName.get(e.name) || { ms: 0, n: 0 }; v.ms += e.dur / 1000; v.n++; byName.set(e.name, v); }

// Sampled JS CPU profile from ProfileChunk events (self time by function).
const nodes = new Map(), deltas = [];
for (const e of events) {
  if (e.pid !== pid || (e.name !== 'ProfileChunk' && e.name !== 'Profile')) continue;
  const data = e.args?.data, chunk = data?.cpuProfile;
  for (const n of chunk?.nodes || []) nodes.set(n.id, n.callFrame);
  const samples = chunk?.samples || [], times = data?.timeDeltas || [];
  samples.forEach((id, i) => deltas.push([id, (times[i] || 0) / 1000]));
}
const self = new Map(), perFile = new Map();
let sampled = 0;
for (const [id, ms] of deltas) {
  const cf = nodes.get(id); if (!cf) continue;
  if (['(idle)', '(root)', '(program)'].includes(cf.functionName)) continue;
  sampled += ms;
  const src = (cf.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
  const key = `${cf.functionName || '(anon)'} ${src}:${cf.lineNumber + 1}`;
  self.set(key, (self.get(key) || 0) + ms);
  perFile.set(src || '(native)', (perFile.get(src || '(native)') || 0) + ms);
}
const pctOf = v => `${(v / windowMs * 100).toFixed(1)}%`;
console.log(`window ${windowMs.toFixed(0)} ms, main thread ${pid}:${tid}`);
console.log('\n# Trace events on the main thread (inclusive; nested events double count)');
for (const [k, v] of [...byName].sort((a, b) => b[1].ms - a[1].ms).slice(0, 22)) console.log(`${v.ms.toFixed(0).padStart(8)} ms ${pctOf(v.ms).padStart(7)}  n=${String(v.n).padStart(6)}  ${k}`);
console.log(`\n# JS self time by file (sampled JS total ${sampled.toFixed(0)} ms, ${pctOf(sampled)} of window)`);
for (const [k, v] of [...perFile].sort((a, b) => b[1] - a[1]).slice(0, 24)) console.log(`${v.toFixed(0).padStart(8)} ms ${pctOf(v).padStart(7)}  ${k}`);
console.log('\n# JS self time by function');
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, topN)) console.log(`${v.toFixed(0).padStart(8)} ms ${pctOf(v).padStart(7)}  ${k}`);
