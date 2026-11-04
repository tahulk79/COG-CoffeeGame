// PERF-1: tách đóng góp của long task khỏi khung hình thường, dùng đúng công thức bench-init.js:30-35.
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('../perf/raw-results.json', 'utf8')).mobile.intro;
const n = r.frames, worstN = n - Math.floor(n * .99);
const total = n * 1000 / r.fpsAvg, worstAvg = 1000 / r.fps1Low, worstSum = worstAvg * worstN;
const rest = (total - worstSum) / (n - worstN);
console.log({ frames: n, worstN, totalMs: Math.round(total), worstAvgMs: Math.round(worstAvg), worstSumMs: Math.round(worstSum), longTaskMs: r.longTaskMs, restAvgMs: +rest.toFixed(1), restFps: +(1000 / rest).toFixed(1), p95ms: r.p95ms, cpuMedMs: r.cpuMedMs, cpuP95Ms: r.cpuP95Ms });
