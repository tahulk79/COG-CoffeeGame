import Phaser from 'phaser';
import type { WorldScene } from '../scenes/WorldScene';

/** Opt-in diagnostics: measures completed Phaser frames, never labels browser rAF as game FPS. */
export function installPerfReport(game: Phaser.Game): void {
  const panel = document.createElement('section');
  panel.style.cssText = 'position:fixed;right:6px;bottom:6px;z-index:9999;padding:6px;color:white;background:#251b16e8;border-radius:6px;font:12px monospace;max-width:calc(100vw - 24px)';
  const label = document.createElement('div'), save = document.createElement('button');
  save.textContent = 'Lưu số đo';
  const samples: Array<Record<string, unknown>> = [];
  const started = performance.now();
  let from = started, last = 0, frameStart = 0, frames = 0;
  let gaps: number[] = [], costs: number[] = [];
  let firstWorldMs: number | null = null;
  const percentile = (values: number[], fraction: number) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * fraction))]! : 0;
  const textureStats = () => {
    let pixels = 0;
    const keys = game.textures.getTextureKeys();
    for (const key of keys) for (const source of game.textures.get(key).source) pixels += source.width * source.height;
    return { count: keys.length, rgbaEstimateMiB: +(pixels * 4 / 1048576).toFixed(1) };
  };
  const pre = () => { frameStart = performance.now(); };
  const post = () => {
    const now = performance.now();
    if (document.hidden) return;
    if (last) gaps.push(now - last);
    last = now; frames++;
    costs.push(now - frameStart);
    const world = game.scene.getScene('WorldScene') as WorldScene | null;
    const frame = world?.session?.frame;
    if (firstWorldMs === null && frame) firstWorldMs = now;
    if (now - from < 1000) return;
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const textures = textureStats();
    const fps = frames * 1000 / (now - from), p95 = percentile(gaps, .95), cpu95 = percentile(costs, .95);
    const sample = { elapsedSec: +((now - started) / 1000).toFixed(1), map: frame?.map ?? 'loading', fps: +fps.toFixed(1), frameP95Ms: +p95.toFixed(1), frameMaxMs: Math.max(0, ...gaps), cpuP95Ms: +cpu95.toFixed(1), over50Ms: gaps.filter(n => n > 50).length, textures, heapMiB: heap ? +(heap.usedJSHeapSize / 1048576).toFixed(1) : null, hazards: frame?.story.run?.hazards.length ?? 0, rescue: !!frame?.story.street?.heroDown };
    samples.push(sample);
    if (samples.length > 600) samples.shift();
    label.textContent = `Phaser ${fps.toFixed(0)} fps · frame p95 ${p95.toFixed(1)}ms · CPU p95 ${cpu95.toFixed(1)}ms · textures ${textures.count} (~${textures.rgbaEstimateMiB}MiB RGBA)`;
    frames = 0; gaps = []; costs = []; from = now;
  };
  const reset = () => { last = 0; from = performance.now(); frames = 0; gaps = []; costs = []; };
  save.onclick = () => {
    const report = { schema: 1, production: import.meta.env.PROD, entryModule: document.querySelector<HTMLScriptElement>('script[type=module][src]')?.src ?? null, renderer: game.renderer.type, capturedAt: new Date().toISOString(), userAgent: navigator.userAgent, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, firstWorldFromNavigationMs: firstWorldMs === null ? null : +firstWorldMs.toFixed(1), notes: ['Opt-in Phaser frame samples; CPU excludes GPU execution and browser composition.', 'Texture RGBA estimate excludes mipmaps, render targets and driver overhead; heap may be unavailable.', 'First world includes network/cache/font/initialization; no cold-cache claim.', 'Last 600 seconds maximum; record device, network and scenario separately.'], resources: performance.getEntriesByType('resource').map(e => { const r = e as PerformanceResourceTiming; return { name: r.name, durationMs: +r.duration.toFixed(1), transferBytes: r.transferSize, decodedBytes: r.decodedBodySize }; }), samples };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `cog-performance-${Date.now()}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  panel.append(label, save); document.body.append(panel);
  document.addEventListener('visibilitychange', reset);
  game.events.on(Phaser.Core.Events.PRE_STEP, pre);
  game.events.on(Phaser.Core.Events.POST_RENDER, post);
  game.events.once(Phaser.Core.Events.DESTROY, () => { game.events.off(Phaser.Core.Events.PRE_STEP, pre); game.events.off(Phaser.Core.Events.POST_RENDER, post); document.removeEventListener('visibilitychange', reset); panel.remove(); });
}
