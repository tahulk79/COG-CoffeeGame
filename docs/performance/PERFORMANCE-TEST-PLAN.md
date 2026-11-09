# Performance test plan

How to reproduce the baseline and validate each optimization. Targets below are proposed, not guaranteed.

## 1. Proposed targets

| Area | Target |
|---|---|
| Desktop Chrome and Safari | Stable 60 FPS where practical, 1% low at or above 45 FPS on the late-game save |
| Supported phones | Stable 30 FPS minimum on the late-game save, 1% low at or above 24 FPS |
| Memory | Same-region geometries and textures do not rise over 12 region switches, heap stays in a stable band |
| Long soak | No upward heap trend over 30 minutes |
| Inactive | No rendering while hidden, and no main renders while the world is fully covered |
| Loops | Exactly 1.0 main render per rAF, at most, and never more |
| Assets | `renderer.info` geometries and textures return to their baseline after atlas and region round trips |
| Gameplay | Economy sim output and crew throughput unchanged |
| Visuals | No noticeable difference at the default quality in side-by-side review |

Supported devices still need to be chosen. A sensible minimum is one recent iPhone, one older iPhone, and one mid-range Android.

## 2. Tools

**Profiler (dev server only).** Nothing imports it, so it is not in production builds. It hooks three's prototypes from outside. Run in the DevTools console after the game has loaded.

```js
const p = (await import('/src/dev/perf-profiler.js')).default;
await p.run('camera idle', 15000);  // returns FPS, 1% low, p95/p99, CPU split, GPU ms, draws, tris, heap, long tasks
p.census();                         // scene graph and resource counts, plus estimated GPU memory
p.gpuAvailable();                   // shows whether the timer query is really available
```

`gpuMs` and `longTasks` show `unavailable` when the browser does not expose them. Safari usually does not.

Also available: `p.ab(label, on, off, rounds, ms)` runs the alternating A/B and returns medians. `counters` in each report gives shadow passes per second and `bufferSubData` bytes per second, which several acceptance criteria use.

AI and pathfinding cost are not profiler metrics. Read `realm/staff-brain.js` and `realm/nav.js` from the "JS self time by file" section of the trace summary, and take one trace during an all-ripe harvest as well as idle.

**CPU trace summary.** Save a recording from the Chrome Performance panel, then run:

```bash
node scripts/perf-trace-summary.mjs trace.json.gz 40
```

Take traces without the profiler loaded. The profiler's hooks distort native-call attribution.

**On-device readout.** Add `?fps` to the URL for FPS, draw calls and quality on screen.

## 3. Test save

Use the isolated dev profile so the real save is never touched. Open `http://localhost:5173/?profile=max&fps`, then run this in the console.

This seed has no added buildings. The baseline save also had 29 buildings whose exact mix was not recorded, so compare only against a capture of this seed. For the Starter save, run on a fresh profile only the lines through `play/chooseGame`, then `st.dispatch('dev/set', { level: 9 }); st.flush(); location.reload();`.

```js
const st = window.__godbeanStore;
const D = await import('/src/core/derive.js'), E = await import('/src/core/config/economy.js'), L = await import('/src/core/config/layout.js');
st.dispatch('character/set', { gender: 'female', name: 'QA' });
st.dispatch('story/introDone'); st.dispatch('story/teacherDone');
st.dispatch('world/unlockRegion', { regionId: 'vn-1' }); st.dispatch('world/enterRegion', { regionId: 'vn-1' });
st.dispatch('play/chooseGame', { game: 'farm' });
st.state.story.level10Done = true; // keeps the Level-10 event from pausing the seed
st.dispatch('dev/set', { coins: 1e14, level: 40 });
for (const id of L.PARCEL_ORDER) if (!L.PARCELS[id].area) st.dispatch('land/buyParcel', { parcelId: id });
const r = () => st.state.world.regions['vn-1'], crops = ['robusta', 'arabica', 'liberica']; let n = 0;
for (const id of r().parcels) { const lot = L.PARCELS[id]; if (!lot || lot.area || lot.kind !== 'farm') continue;
  const [x0, z0, x1, z1] = lot.rect;
  for (let z = z0; z <= z1 && n < 200; z++) for (let x = x0; x <= x1 && n < 200; x++) {
    const q = D.snapPosition('field', x, z, 0);
    if (D.placementError(st.state, 'field', q.x, q.z, 0) === null && st.dispatch('farm/plantAt', { x: q.x, z: q.z, crop: crops[n % 3] }).ok) n++;
  } }
const types = Object.entries(E.STAFF).filter(([, v]) => v.zone === 'farm').map(([id]) => id);
for (let i = 0; i < 400 && st.state.staff.units.length < 40; i++) { const t = types[i % types.length]; if (!D.staffError(st.state, t)) st.dispatch('staff/hire', { type: t }); }
st.flush(); location.reload();
```

## 4. Method

1. Use the same save, viewport, zoom level and quality for before and after.
2. Close other GPU-using apps and tabs. Keep the Mac on power. Let the page settle for 10 s.
3. Compare with **alternating A/B**: baseline, variant, baseline, variant, for at least 3 rounds of 4 to 10 s, then take the median. Single before/after captures are unreliable. Baseline GPU time for the same scene varied by a factor of 3 during this audit.
4. When editing code at the same time, block the dev server's reload so a capture cannot restart midway.
5. Report whether a number is measured or estimated.

## 5. Scenarios

| # | Scenario | Steps | Key metrics |
|---|---|---|---|
| 1 | Initial load | Reload with cache disabled, measure until `#loading` is hidden | Time to ready, long tasks, download size |
| 2 | 4-level farm | Late-game save, then `p.census()` at each zoom level | Draws, triangles, textures |
| 3 | Camera idle | No input for 15 s | CB, GPU, draws, frames per second |
| 4 | Camera movement and zoom | WASD for 12 s plus wheel zoom | 1% low, p99, long tasks |
| 5 | Crops growing | Save with planted fields, no ripe trees, idle | Same as 3, instance uploads |
| 6 | Workers and robots | 40 staff working | Skeleton updates, mixer ms, draws |
| 7 | Construction | Place 4 building types | Dispatch ms, long tasks, `programs` rise |
| 8 | Harvest and production | `dev/ripen`, then run the crew | Dispatch rate, CB |
| 9 | Scene switching | 12 atlas cycles, 12 region switches (café is disabled by `CAFE_ENABLED`, so test it too once it returns) | Heap, geometries, textures |
| 10 | Continuous play | 15 to 30 minutes with some real input | Heap trend, FPS trend, thermals |

## 6. Regression checks

Tests are added or run only when requested.

| Area | Check |
|---|---|
| Economy | `npm run sim` output compared with the pre-change run, and `node scripts/qa-personas.mjs` |
| Core reducers | `npm test` |
| Coffee | Plant, grow, ripen, harvest, uproot, tint, trial fields, tap target at every zoom |
| Workers and robots | Every type, carry, tools, tags, shadows of the nearest 8, LOD cap |
| Land | Buy estate, open roads, tier gates, wall and stair shadows |
| Buildings | Place, move, remove, upgrade, icons |
| HUD | Toasts, counters, staff modal, tree viewer, inbox |
| Save and load | Reload at each phase, old saves, expiry cinematic |
| GPU recovery | Context loss and restore, quality switch both ways |
| Language | Switch language with labels and portraits on screen |

## 7. Browser and device matrix

| Platform | How | Notes |
|---|---|---|
| Desktop Chrome | Profiler, Performance panel | Primary profiling platform |
| Safari on macOS | Web Inspector Timelines | `performance.memory`, long tasks and GPU timer are usually unavailable |
| Android Chrome | `adb reverse tcp:5173 tcp:5173`, open `http://localhost:5173/?profile=max&fps`, debug through `chrome://inspect`, same profiler | Timer query support varies by GPU |
| iOS Safari | Run `npm run dev`, which already binds to the network, then open `http://<mac-lan-ip>:5173/?profile=max&fps` and run the seed through Mac Safari Web Inspector | Use `?fps` for on-device frame rate. Test in the app shell too, if the game ships in one. |

Check real refresh behaviour: 60 Hz, ProMotion and 90 or 120 Hz Android devices.

## 8. MacBook energy and heat

- **Activity Monitor.** Energy tab for Energy Impact of the Chrome helper (GPU) process. CPU tab for CPU %. Window, then GPU History for GPU load.
- **Chrome.** Performance panel for main-thread time. Task Manager (More Tools) for GPU memory and CPU of the game's tab.
- **macOS power metrics (needs the user's password):**

```bash
sudo powermetrics --samplers cpu_power,gpu_power,thermal -i 1000 -n 120
```

Compare the same scenario before and after for 2 minutes each, plugged in, and repeat in alternating order. Record the `thermal pressure` field, and note ambient conditions.

## 9. Phone heat and battery

Browsers do not expose device temperature, so use external measurement.

- Start each run with the phone cool, at the same brightness, and unplugged.
- Play the same scenario for 15 to 30 minutes.
- Record FPS over time. A drop at a fixed scene after some minutes indicates thermal throttling.
- Record battery percentage used. On Android, use `adb shell dumpsys batterystats` and `dumpsys thermalservice`. On iPhone, use Xcode Instruments' Energy Log if a build is available.
- A surface thermometer or thermal camera gives direct comparison.

Do not claim a temperature improvement without such a measurement.

## 10. Acceptance record

For every optimization, record: scenario, device, build commit, baseline and variant medians, what changed visually, and whether regression checks passed.
