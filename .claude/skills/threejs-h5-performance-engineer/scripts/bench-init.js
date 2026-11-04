// Injected before app scripts: counts live WebGL resources and per-frame draw calls/triangles.
(() => {
  const P = WebGL2RenderingContext.prototype;
  if (P.__patched) return;
  P.__patched = true;
  const gl = window.__gl = { calls: 0, tris: 0, tex: 0, buf: 0, prog: 0, fb: 0, rb: 0, texUploads: 0 };
  const wrap = (n, f) => { const o = P[n]; P[n] = function (...a) { f(a); return o.apply(this, a); }; };
  const draw = (m, c, inst = 1) => { gl.calls++; if (m === 4) gl.tris += c / 3 * inst; };
  wrap('drawElements', a => draw(a[0], a[1]));
  wrap('drawArrays', a => draw(a[0], a[2]));
  wrap('drawElementsInstanced', a => draw(a[0], a[1], a[4]));
  wrap('drawArraysInstanced', a => draw(a[0], a[2], a[3]));
  wrap('createTexture', () => gl.tex++); wrap('deleteTexture', () => gl.tex--);
  wrap('createBuffer', () => gl.buf++); wrap('deleteBuffer', () => gl.buf--);
  wrap('createProgram', () => gl.prog++); wrap('deleteProgram', () => gl.prog--);
  wrap('createFramebuffer', () => gl.fb++); wrap('deleteFramebuffer', () => gl.fb--);
  wrap('createRenderbuffer', () => gl.rb++); wrap('deleteRenderbuffer', () => gl.rb--);
  wrap('texImage2D', () => gl.texUploads++); wrap('texStorage2D', () => gl.texUploads++);

  window.__bench = async (seconds = 8) => {
    const frames = [], calls = [], tris = []; let long = 0, longMs = 0;
    const po = new PerformanceObserver(l => { for (const e of l.getEntries()) { long++; longMs += e.duration; } });
    po.observe({ type: 'longtask' });
    let last = performance.now(); const end = last + seconds * 1000;
    await new Promise(res => {
      const tick = now => { frames.push(now - last); last = now; calls.push(gl.calls); tris.push(gl.tris); gl.calls = gl.tris = 0; now < end ? requestAnimationFrame(tick) : res(); };
      requestAnimationFrame(tick);
    });
    po.disconnect(); frames.shift(); calls.shift(); tris.shift();
    const s = [...frames].sort((a, b) => a - b), n = s.length, avg = frames.reduce((a, b) => a + b, 0) / n;
    const worst = s.slice(Math.floor(n * .99)), med = a => [...a].sort((x, y) => x - y)[a.length >> 1];
    return {
      frames: n, fpsAvg: +(1000 / avg).toFixed(1), fps1Low: +(1000 / (worst.reduce((a, b) => a + b, 0) / worst.length)).toFixed(1),
      p95ms: +s[Math.floor(n * .95)].toFixed(2), maxMs: +s[n - 1].toFixed(1),
      drawCalls: med(calls), maxCalls: Math.max(...calls), triangles: Math.round(med(tris)), longTasks: long, longTaskMs: Math.round(longMs),
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      gpu: { tex: gl.tex, buf: gl.buf, prog: gl.prog, fb: gl.fb, rb: gl.rb, texUploads: gl.texUploads },
      dpr: devicePixelRatio, canvas: (c => c && c.width + 'x' + c.height)(document.querySelector('#game canvas')),
      meter: document.querySelector('output')?.textContent, title: document.title,
    };
  };

  // CPU ms per frame: FPS is vsync-capped at 60, so time the rAF callbacks themselves.
  window.__cpu = async (seconds = 6) => {
    const orig = window.requestAnimationFrame, cost = [];
    window.requestAnimationFrame = cb => orig.call(window, t => { const s = performance.now(); cb(t); cost.push(performance.now() - s); });
    await new Promise(r => setTimeout(r, seconds * 1000));
    window.requestAnimationFrame = orig;
    const s = cost.sort((a, b) => a - b), n = s.length;
    return { cpuMedMs: +s[n >> 1].toFixed(2), cpuP95Ms: +s[Math.floor(n * .95)].toFixed(2) };
  };
})();
