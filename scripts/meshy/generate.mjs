// Meshy pipeline for the farm's static 3D assets (docs/design/meshy-pipeline.md).
//
//   node scripts/meshy/generate.mjs plan                       list every asset, what it costs, what is already done (no key, no cost)
//   node scripts/meshy/generate.mjs run --max-credits 1700     create + texture + download (needs MESHY_API_KEY; REFUSES without --max-credits)
//   node scripts/meshy/generate.mjs apply [--only a,b]         fit to the old model's size (Blender), shrink, compress, install in the game
//   node scripts/meshy/generate.mjs restore [--only a,b]       put the original models back
//
// Options: --only a,b (asset files)  --group buildings|machines|nature  --limit N (first N pending)  --concurrency 4
// The key is read from MESHY_API_KEY or from .env.local (never printed, never committed). Progress is saved in
// scripts/meshy/state.json after every step, so a stopped run resumes and never pays twice for one task.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ASSETS, STYLE, NEGATIVE, CREDITS } from './manifest.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MODELS = path.join(ROOT, 'public/models/gedeo');
const ORIGINALS = path.join(ROOT, 'art-backup/gedeo-originals'); // not under public/: backups must not ship in the build
const RAW = path.join(import.meta.dirname, 'raw');
const STATE = path.join(import.meta.dirname, 'state.json');
const API = 'https://api.meshy.ai/openapi/v2/text-to-3d';
const BLENDER = process.env.BLENDER || (fs.existsSync('/opt/homebrew/bin/blender') ? '/opt/homebrew/bin/blender' : 'blender');

const [cmd = 'plan', ...rest] = process.argv.slice(2);
const flag = (name, def = null) => { const i = rest.indexOf(name); return i >= 0 && i + 1 < rest.length ? rest[i + 1] : def; };
const only = flag('--only')?.split(',');
const group = flag('--group');
const limit = Number(flag('--limit', 0)) || Infinity;
const concurrency = Number(flag('--concurrency', 4));
const maxCredits = Number(flag('--max-credits', 0));
const pick = () => ASSETS.filter(x => (!only || only.includes(x.file)) && (!group || x.group === group));

const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function key() {
  if (process.env.MESHY_API_KEY) return process.env.MESHY_API_KEY.trim();
  const env = path.join(ROOT, '.env.local');
  if (fs.existsSync(env)) for (const line of fs.readFileSync(env, 'utf8').split('\n')) { const m = /^\s*MESHY_API_KEY\s*=\s*(.+?)\s*$/.exec(line); if (m) return m[1].replace(/^["']|["']$/g, ''); }
  return null;
}

// ---------- plan / status ----------
function plan() {
  const list = pick();
  const per = CREDITS.preview + CREDITS.refine;
  let pending = 0;
  console.log('file'.padEnd(30), 'group'.padEnd(10), 'fit'.padEnd(10), 'tris'.padStart(6), 'state');
  for (const x of list) {
    const st = state[x.file]?.status || (fs.existsSync(path.join(RAW, `${x.file}.glb`)) ? 'downloaded' : 'pending');
    if (st !== 'done' && st !== 'downloaded') pending++;
    console.log(x.file.padEnd(30), x.group.padEnd(10), x.fit.padEnd(10), String(x.tris).padStart(6), st);
  }
  console.log(`\n${list.length} assets, ${pending} still to generate. Estimate ${pending * per} credits (${CREDITS.preview} preview + ${CREDITS.refine} refine each — an assumption, check Meshy pricing).`);
  console.log(key() ? 'MESHY_API_KEY: found.' : 'MESHY_API_KEY: NOT set (export it or put it in .env.local) — needed for `run`, not for `plan`.');
  console.log(`Blender: ${BLENDER}`);
}

// ---------- Meshy ----------
async function call(method, p = '', body = null, tries = 6) {
  for (let i = 0; ; i++) {
    const res = await fetch(API + p, { method, headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && i < tries) { await sleep(Math.min(60000, 3000 * 2 ** i)); continue; }
    throw new Error(`Meshy ${method} ${p || '/'} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}
async function wait(id, label) {
  for (;;) {
    const t = await call('GET', `/${id}`);
    if (t.status === 'SUCCEEDED') return t;
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${label}: ${t.status} ${t.task_error?.message || ''}`);
    await sleep(8000);
  }
}
let spent = 0;
async function generate(x) {
  const st = (state[x.file] ||= { status: 'pending', credits: 0 });
  if (st.status === 'done') return;
  const need = (st.previewId ? 0 : CREDITS.preview) + (st.refineId ? 0 : CREDITS.refine);
  if (spent + need > maxCredits) { console.log(`skip ${x.file}: the --max-credits budget (${maxCredits}) would be exceeded`); return; }
  spent += need;
  try {
    if (!st.previewId) {
      const r = await call('POST', '', { mode: 'preview', prompt: `${x.prompt}. ${STYLE}`.slice(0, 800), negative_prompt: NEGATIVE, model_type: 'standard', topology: 'triangle', target_polycount: Math.max(5000, x.tris * 2), should_remesh: true, origin_at: 'bottom', target_formats: ['glb'] });
      st.previewId = r.result; st.status = 'preview'; save();
    }
    const preview = await wait(st.previewId, `${x.file} preview`);
    if (!st.refineId) {
      const r = await call('POST', '', { mode: 'refine', preview_task_id: st.previewId, enable_pbr: true, texture_prompt: `${x.tex}. clean bright colours, soft painted detail, no baked lighting`.slice(0, 800), texture_resolution: '2k', target_formats: ['glb'] });
      st.refineId = r.result; st.status = 'refine'; save();
    }
    const done = await wait(st.refineId, `${x.file} refine`);
    st.credits = (preview.consumed_credits || 0) + (done.consumed_credits || 0);
    const url = done.model_urls?.glb;
    if (!url) throw new Error(`${x.file}: no GLB in the result`);
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.mkdirSync(RAW, { recursive: true });
    fs.writeFileSync(path.join(RAW, `${x.file}.glb`), buf);
    st.status = 'done'; st.error = undefined; save();
    console.log(`done ${x.file} (${st.credits} credits)`);
  } catch (e) { st.status = 'failed'; st.error = String(e.message || e); save(); console.error(`FAILED ${x.file}: ${st.error}`); }
}
async function run() {
  if (!key()) { console.error('No MESHY_API_KEY. Export it in this terminal or put MESHY_API_KEY=... in .env.local (git-ignored).'); process.exit(1); }
  if (!(maxCredits > 0)) { console.error('Refusing to run without --max-credits N: this spends real Meshy credits. Run `plan` for an estimate first.'); process.exit(1); }
  const todo = pick().filter(x => state[x.file]?.status !== 'done').slice(0, limit);
  console.log(`${todo.length} assets, budget ${maxCredits} credits, ${concurrency} at a time.`);
  const queue = [...todo];
  await Promise.all(Array.from({ length: concurrency }, async () => { while (queue.length) await generate(queue.shift()); }));
  console.log(`Finished. Credits counted by this run: ${spent} (estimate); Meshy's own count is in state.json.`);
}

// ---------- apply / restore ----------
function apply() {
  fs.mkdirSync(ORIGINALS, { recursive: true });
  const installed = [];
  for (const x of pick()) {
    const raw = path.join(RAW, `${x.file}.glb`), cur = path.join(MODELS, `${x.file}.glb`), orig = path.join(ORIGINALS, `${x.file}.glb`);
    if (!fs.existsSync(raw)) continue;
    if (!fs.existsSync(orig)) { if (!fs.existsSync(cur)) { console.log(`skip ${x.file}: no original to size against`); continue; } fs.copyFileSync(cur, orig); }
    for (const l of x.lods || []) { const lc = path.join(MODELS, `${l.file}.glb`), lo = path.join(ORIGINALS, `${l.file}.glb`); if (!fs.existsSync(lo) && fs.existsSync(lc)) fs.copyFileSync(lc, lo); }
    const tmp = path.join(RAW, 'fitted'), out = path.join(tmp, `${x.file}.glb`);
    fs.mkdirSync(tmp, { recursive: true });
    const args = ['-b', '--factory-startup', '-P', path.join(import.meta.dirname, 'fit.py'), '--', '--in', raw, '--like', orig, '--out', out, '--fit', x.fit, '--tris', String(x.tris), '--tex', '1024', ...(x.lods || []).flatMap(l => ['--lod', `${l.file}:${l.ratio}`])];
    const r = spawnSync(BLENDER, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
    const line = /MESHY_FIT (.*)/.exec(r.stdout || '');
    if (r.status !== 0 || !line) { console.error(`FAILED fit ${x.file}\n${(r.stderr || r.stdout || '').slice(-500)}`); continue; }
    for (const f of [x.file, ...(x.lods || []).map(l => l.file)]) { fs.copyFileSync(path.join(tmp, `${f}.glb`), path.join(MODELS, `${f}.glb`)); installed.push(path.join('public/models/gedeo', `${f}.glb`)); }
    console.log(`installed ${x.file}: ${line[1]}`);
  }
  if (installed.length) spawnSync('node', ['scripts/optimize-models.mjs', ...installed], { cwd: ROOT, stdio: 'inherit' });
  console.log(`${installed.length} files installed. Originals are kept in art-backup/gedeo-originals (restore with \`restore\`).`);
}
function restore() {
  let n = 0;
  for (const x of pick()) for (const f of [x.file, ...(x.lods || []).map(l => l.file)]) {
    const orig = path.join(ORIGINALS, `${f}.glb`);
    if (fs.existsSync(orig)) { fs.copyFileSync(orig, path.join(MODELS, `${f}.glb`)); n++; }
  }
  console.log(`${n} original files restored.`);
}

if (cmd === 'plan' || cmd === 'status') plan();
else if (cmd === 'run') await run();
else if (cmd === 'apply') apply();
else if (cmd === 'restore') restore();
else { console.error('Commands: plan | run --max-credits N | apply | restore'); process.exit(1); }
