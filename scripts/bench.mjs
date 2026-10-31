// Benchmark chapter 1 / 2 in headless Chrome: node scripts/bench.mjs [baseUrl] [label]
// Needs the dev server (window.__PHASER_GAME__, __TCSS__). Headless GL is software-rendered: compare runs, not absolute GPU numbers.
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:5180', label = process.argv[3] ?? '';
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-precise-memory-info'] });
const stat = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return { avg: +(a.reduce((x, y) => x + y, 0) / n).toFixed(2), p50: s[Math.floor(n * .5)], p99: s[Math.min(n - 1, Math.floor(n * .99))], max: s[n - 1] }; };

async function run(name, opts, chap, cpu = 1) {
  const ctx = await browser.newContext(opts), page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.addInitScript(() => {
    window.__draws = 0;
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const f = C.prototype[k]; if (!f) continue;
      C.prototype[k] = function (...a) { window.__draws++; return f.apply(this, a); };
    }
    window.__frames = []; let last = performance.now();
    const loop = (t) => { window.__frames.push([t - last, window.__draws]); window.__draws = 0; last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const t0 = Date.now();
  await page.goto(`${base}/?chap=${chap}`);
  await page.waitForFunction(() => { const b = document.getElementById('boot'); return !b || b.classList.contains('done'); }, undefined, { timeout: 180000 });
  const bootMs = Date.now() - t0;
  await page.waitForTimeout(8000); // let streamed detail finish
  const scene = async () => { await cdp.send('HeapProfiler.collectGarbage'); return page.evaluate(() => {
    const g = window.__PHASER_GAME__, w = g.scene.getScene('WorldScene'); let px = 0;
    const keys = g.textures.getTextureKeys();
    for (const k of keys) for (const s of g.textures.get(k).source) px += s.width * s.height;
    return { objects: w.children.length, textures: keys.length, vramMiB: +(px * 4 / 1048576).toFixed(0), heapMiB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(0), tweens: w.tweens.getTweens().length, timers: w.time._active?.length ?? null, listeners: w.input.keyboard?.listenerCount?.('keydown') ?? null };
  }); };
  const before = await scene();
  await page.evaluate(() => {
    window.__frames.length = 0; window.__cpu = []; let t = 0; const g = window.__PHASER_GAME__;
    g.events.on('prerender', () => { t = performance.now(); }); g.events.on('postrender', () => { window.__cpu.push(performance.now() - t); });
  });
  // Walk the hero along the street for ~20 s: the camera follows, so everything scrolls through the viewport.
  const targets = chap === '1' ? [[8, 6], [40, 6], [40, 14], [8, 14], [24, 14]] : [[18, 19], [12, 12], [24, 8], [30, 20], [18, 19]];
  const t1 = Date.now();
  for (const [x, y] of targets) {
    const p = await page.evaluate(([x, y]) => window.__TCSS__.tileToClient({ x, y }), [x, y]);
    // The tile may be off screen: a click at the nearest visible point still sends the hero that way.
    const vp = page.viewportSize();
    await page.mouse.click(Math.min(vp.width - 5, Math.max(5, p.x)), Math.min(vp.height - 5, Math.max(5, p.y)));
    await page.waitForTimeout(4000);
  }
  const frames = await page.evaluate(() => window.__frames), cpuMs = stat(await page.evaluate(() => window.__cpu));
  const after = await scene();
  const ft = frames.map((f) => f[0]).slice(5), dc = frames.map((f) => f[1]).slice(5);
  const fpsAvg = +(1000 / (ft.reduce((a, b) => a + b, 0) / ft.length)).toFixed(1);
  const low1 = +(1000 / stat(ft).p99).toFixed(1);
  console.log(`${label} ${name} chap${chap}`, JSON.stringify({ bootMs, fpsAvg, fps1pctLow: low1, frameMs: stat(ft), cpuFrameMs: cpuMs, drawCalls: stat(dc), over33ms: ft.filter((x) => x > 33.4).length, frames: ft.length, seconds: Math.round((Date.now() - t1) / 1000), before, after }));
  await page.context().close();
}

const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
await run('desktop', { viewport: { width: 1280, height: 720 } }, '1');
await run('phone-cpu4x', phone, '1', 4);
await run('desktop', { viewport: { width: 1280, height: 720 } }, '2');
await run('phone-cpu4x', phone, '2', 4);
await browser.close();
